#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const { Client: PgClient } = pg;

const SUPER_ADMIN_USERNAMES = new Set(['emirhangungormez', 'emirhangungormezpro']);

function env(name, fallback = undefined) {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') return fallback;
  return value;
}

function envBool(name, fallback = false) {
  const raw = env(name, null);
  if (raw === null) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return {
    dryRun: args.has('--dry-run') || envBool('MIGRATION_DRY_RUN', false),
    skipSchema: args.has('--skip-schema') || envBool('MIGRATION_SKIP_SCHEMA', false),
    createMissingAuth: args.has('--create-missing-auth') || envBool('MIGRATION_CREATE_MISSING_AUTH', false),
    truncateFirst: args.has('--truncate-first') || envBool('MIGRATION_TRUNCATE_FIRST', false),
    batchSize: Number(env('MIGRATION_BATCH_SIZE', '500')),
  };
}

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function splitTableRef(tableRef) {
  const [schema, table] = tableRef.split('.');
  if (!schema || !table) throw new Error(`Invalid table ref: ${tableRef}`);
  return { schema, table };
}

function normalizeEmail(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase();
}

function normalizeUsername(value, legacyId = 0) {
  const raw = String(value || '').trim();
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]+/g, '');
  if (cleaned.length >= 3) return cleaned.slice(0, 50);
  return `user_${String(legacyId || '').replace(/\D/g, '') || 'x'}`.slice(0, 50);
}

function ensureUniqueUsername(candidate, takenSet, legacyId) {
  let base = normalizeUsername(candidate, legacyId);
  if (base.length < 3) base = `user_${legacyId}`;
  let result = base.slice(0, 50);
  let i = 0;
  while (takenSet.has(result.toLowerCase())) {
    i += 1;
    const suffix = `_${legacyId}_${i}`;
    const maxBaseLen = Math.max(3, 50 - suffix.length);
    result = `${base.slice(0, maxBaseLen)}${suffix}`;
  }
  takenSet.add(result.toLowerCase());
  return result;
}

function asBool(v) {
  if (typeof v === 'boolean') return v;
  return Number(v || 0) === 1;
}

function parseJsonMaybe(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  const str = String(value).trim();
  if (!str) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function chunkArray(arr, chunkSize) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }
  return chunks;
}

async function mysqlTableExists(conn, table) {
  const [rows] = await conn.query('SHOW TABLES LIKE ?', [table]);
  return rows.length > 0;
}

async function readMysqlRows(conn, table, columns, orderBy = null) {
  const exists = await mysqlTableExists(conn, table);
  if (!exists) {
    console.warn(`[skip] MySQL table missing: ${table}`);
    return [];
  }
  const cols = columns.map((c) => `\`${c}\``).join(', ');
  const order = orderBy ? ` ORDER BY ${orderBy}` : '';
  const [rows] = await conn.query(`SELECT ${cols} FROM \`${table}\`${order}`);
  return rows;
}

async function applySchemaIfNeeded(pgClient, options) {
  if (options.skipSchema) {
    console.log('[schema] skipped');
    return;
  }

  const migrationPath = path.resolve(env('MIGRATION_SQL_FILE', 'supabase/migrations/20260307_big_goc.sql'));
  const sql = await fs.readFile(migrationPath, 'utf8');
  if (options.dryRun) {
    console.log(`[dry-run] schema would be applied from ${migrationPath}`);
    return;
  }
  await pgClient.query(sql);
  console.log(`[schema] applied from ${migrationPath}`);
}

async function maybeTruncateTarget(pgClient, options) {
  if (!options.truncateFirst) return;
  const sql = `
    truncate table
      public.user_pro_access_grants,
      public.user_daily_pro_ad_usage,
      public.rewarded_ad_callbacks,
      public.user_support_stats,
      public.user_playlists,
      public.user_notes,
      public.user_bookmarks,
      public.user_settings,
      public.users,
      public.verse_words,
      public.footnotes,
      public.translations,
      public.authors,
      public.roots,
      public.verses,
      public.surahs
    restart identity cascade;
  `;
  if (options.dryRun) {
    console.log('[dry-run] target tables would be truncated');
    return;
  }
  await pgClient.query(sql);
  console.log('[data] target tables truncated');
}

async function upsertRows(pgClient, cfg) {
  const {
    tableRef,
    columns,
    conflictColumns = [],
    updateColumns = null,
    rows,
    batchSize,
    dryRun,
  } = cfg;

  if (!rows || rows.length === 0) return { insertedOrUpdated: 0 };

  const finalUpdateCols = updateColumns ?? columns.filter((c) => !conflictColumns.includes(c));
  const colSql = columns.map(quoteIdent).join(', ');
  const conflictSql = conflictColumns.length > 0
    ? `(${conflictColumns.map(quoteIdent).join(', ')})`
    : '';
  const updateSql = finalUpdateCols.length > 0
    ? finalUpdateCols.map((c) => `${quoteIdent(c)} = excluded.${quoteIdent(c)}`).join(', ')
    : '';

  let affected = 0;
  for (const batch of chunkArray(rows, batchSize)) {
    const values = [];
    const params = [];
    let p = 1;

    for (const row of batch) {
      const placeholders = columns.map(() => `$${p++}`);
      values.push(`(${placeholders.join(', ')})`);
      for (const col of columns) params.push(row[col] ?? null);
    }

    const base = `insert into ${tableRef} (${colSql}) values ${values.join(', ')}`;
    const conflictPart = conflictColumns.length === 0
      ? ''
      : ` on conflict ${conflictSql} ${updateSql ? `do update set ${updateSql}` : 'do nothing'}`;
    const sql = `${base}${conflictPart};`;

    if (!dryRun) {
      await pgClient.query(sql, params);
    }
    affected += batch.length;
  }

  return { insertedOrUpdated: affected };
}

async function fetchExistingUsernames(pgClient) {
  const { rows } = await pgClient.query('select username from public.users');
  const set = new Set();
  for (const r of rows) {
    if (r.username) set.add(String(r.username).toLowerCase());
  }
  return set;
}

async function fetchExistingUsersById(pgClient) {
  const { rows } = await pgClient.query('select id, username from public.users');
  const map = new Map();
  for (const r of rows) {
    if (r.id) map.set(r.id, r.username || null);
  }
  return map;
}

async function fetchAuthUsersFromPg(pgClient) {
  const { rows } = await pgClient.query(`
    select id, email, raw_user_meta_data
    from auth.users
  `);
  return rows.map((r) => ({
    id: r.id,
    email: normalizeEmail(r.email),
    username: normalizeUsername(r.raw_user_meta_data?.username || '', 0).toLowerCase(),
  }));
}

async function createAuthUserIfMissing(supabaseAdmin, legacyUser, fakeDomain) {
  const normalizedUsername = normalizeUsername(legacyUser.username, legacyUser.id).toLowerCase();
  const desiredEmail = normalizeEmail(legacyUser.email)
    || `${normalizedUsername}.${legacyUser.id}@${fakeDomain}`;
  const password = crypto.randomBytes(18).toString('base64url');

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: desiredEmail,
    password,
    email_confirm: true,
    user_metadata: {
      username: normalizedUsername,
      full_name: legacyUser.full_name || null,
      profile_icon: legacyUser.profile_icon || 'muessis',
      legacy_mysql_user_id: legacyUser.id,
      migration_source: 'mysql_kuran_db',
    },
  });

  if (error) {
    return { userId: null, error: error.message || 'createUser failed' };
  }
  return { userId: data.user?.id || null, error: null };
}

async function buildLegacyUserMap(pgClient, mysqlUsers, options) {
  const authUsers = await fetchAuthUsersFromPg(pgClient);
  const byEmail = new Map();
  const byUsername = new Map();
  for (const user of authUsers) {
    if (user.email) byEmail.set(user.email, user.id);
    if (user.username) byUsername.set(user.username, user.id);
  }

  let supabaseAdmin = null;
  const supabaseUrl = env('SUPABASE_URL', null);
  const serviceRole = env('SUPABASE_SERVICE_ROLE_KEY', null);
  if (options.createMissingAuth) {
    if (!supabaseUrl || !serviceRole) {
      throw new Error('MIGRATION_CREATE_MISSING_AUTH=true için SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.');
    }
    supabaseAdmin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  const map = new Map();
  const unresolved = [];
  const createdAuth = [];
  const fakeDomain = env('MIGRATION_FAKE_EMAIL_DOMAIN', 'legacy.local');

  for (const legacy of mysqlUsers) {
    const legacyId = Number(legacy.id);
    const normalizedEmail = normalizeEmail(legacy.email);
    const normalizedUsername = normalizeUsername(legacy.username, legacyId).toLowerCase();

    let authId = null;
    if (normalizedEmail && byEmail.has(normalizedEmail)) {
      authId = byEmail.get(normalizedEmail);
    } else if (normalizedUsername && byUsername.has(normalizedUsername)) {
      authId = byUsername.get(normalizedUsername);
    } else if (supabaseAdmin) {
      const created = await createAuthUserIfMissing(supabaseAdmin, legacy, fakeDomain);
      if (created.userId) {
        authId = created.userId;
        if (normalizedEmail) byEmail.set(normalizedEmail, authId);
        byUsername.set(normalizedUsername, authId);
        createdAuth.push({ legacy_id: legacyId, auth_user_id: authId, email: normalizedEmail || null });
      } else {
        unresolved.push({
          legacy_id: legacyId,
          username: legacy.username || null,
          email: legacy.email || null,
          reason: created.error || 'missing auth user',
        });
      }
    } else {
      unresolved.push({
        legacy_id: legacyId,
        username: legacy.username || null,
        email: legacy.email || null,
        reason: 'no auth.users match by email/username',
      });
    }

    if (authId) map.set(legacyId, authId);
  }

  return { map, unresolved, createdAuth };
}

async function syncSequence(pgClient, tableRef, column) {
  const { schema, table } = splitTableRef(tableRef);
  const sequenceSql = `
    select setval(
      pg_get_serial_sequence('${schema}.${table}', '${column}'),
      coalesce((select max(${quoteIdent(column)}) from ${schema}.${table}), 0) + 1,
      false
    );
  `;
  await pgClient.query(sequenceSql);
}

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main() {
  const options = parseArgs();
  if (!Number.isFinite(options.batchSize) || options.batchSize < 1) {
    throw new Error('MIGRATION_BATCH_SIZE pozitif bir sayı olmalı.');
  }

  const mysqlHost = env('MYSQL_HOST', '127.0.0.1');
  const mysqlPort = Number(env('MYSQL_PORT', '3306'));
  const mysqlDatabase = env('MYSQL_DATABASE', 'kuran_db');
  const mysqlUser = env('MYSQL_USER', 'root');
  const mysqlPassword = env('MYSQL_PASSWORD', '');
  const pgUrl = env('SUPABASE_DB_URL', null);
  if (!pgUrl) throw new Error('SUPABASE_DB_URL gerekli.');

  console.log('[start] MySQL -> Supabase migration');
  console.log(`[mode] dryRun=${options.dryRun} skipSchema=${options.skipSchema} truncateFirst=${options.truncateFirst} createMissingAuth=${options.createMissingAuth}`);

  const mysqlConn = await mysql.createConnection({
    host: mysqlHost,
    port: mysqlPort,
    user: mysqlUser,
    password: mysqlPassword,
    database: mysqlDatabase,
    charset: 'utf8mb4',
  });

  const pgClient = new PgClient({
    connectionString: pgUrl,
    ssl: { rejectUnauthorized: false },
  });
  await pgClient.connect();

  const report = {
    started_at: new Date().toISOString(),
    options,
    counts: {},
    skipped: {},
    unresolved_users: [],
    created_auth_users: [],
  };

  try {
    await applySchemaIfNeeded(pgClient, options);
    await maybeTruncateTarget(pgClient, options);

    const quranImports = [
      {
        mysqlTable: 'surahs',
        columns: ['id', 'name', 'name_en', 'name_original', 'slug', 'verse_count', 'page_number', 'audio_mp3', 'audio_duration', 'created_at'],
        orderBy: 'id',
        target: 'public.surahs',
        conflict: ['id'],
      },
      {
        mysqlTable: 'verses',
        columns: ['id', 'surah_id', 'verse_number', 'verse_text', 'verse_simplified', 'verse_without_vowel', 'transcription', 'transcription_en', 'audio_mp3', 'audio_duration', 'page', 'juz_number', 'created_at'],
        orderBy: 'id',
        target: 'public.verses',
        conflict: ['id'],
      },
      {
        mysqlTable: 'authors',
        columns: ['id', 'name', 'description', 'language', 'created_at'],
        orderBy: 'id',
        target: 'public.authors',
        conflict: ['id'],
      },
      {
        mysqlTable: 'translations',
        columns: ['id', 'verse_id', 'author_id', 'text', 'created_at'],
        orderBy: 'id',
        target: 'public.translations',
        conflict: ['id'],
      },
      {
        mysqlTable: 'footnotes',
        columns: ['id', 'translation_id', 'number', 'text', 'created_at'],
        orderBy: 'id',
        target: 'public.footnotes',
        conflict: ['id'],
      },
      {
        mysqlTable: 'roots',
        columns: ['id', 'latin', 'arabic', 'transcription', 'mean_tr', 'mean_en', 'created_at'],
        orderBy: 'id',
        target: 'public.roots',
        conflict: ['id'],
      },
      {
        mysqlTable: 'verse_words',
        columns: ['id', 'verse_id', 'sort_number', 'arabic', 'transcription_tr', 'transcription_en', 'translation_tr', 'translation_en', 'root_id', 'created_at'],
        orderBy: 'id',
        target: 'public.verse_words',
        conflict: ['id'],
      },
    ];

    for (const item of quranImports) {
      const rows = await readMysqlRows(mysqlConn, item.mysqlTable, item.columns, item.orderBy);
      report.counts[item.mysqlTable] = rows.length;
      const result = await upsertRows(pgClient, {
        tableRef: item.target,
        columns: item.columns,
        conflictColumns: item.conflict,
        rows,
        batchSize: options.batchSize,
        dryRun: options.dryRun,
      });
      console.log(`[quran] ${item.mysqlTable}: ${result.insertedOrUpdated}`);
    }

    const mysqlUsers = await readMysqlRows(
      mysqlConn,
      'users',
      ['id', 'username', 'full_name', 'email', 'profile_icon', 'pro_expires_at', 'bio', 'hatim_count', 'created_at', 'updated_at'],
      'id'
    );
    report.counts.users_legacy = mysqlUsers.length;

    const { map: legacyUserMap, unresolved, createdAuth } = await buildLegacyUserMap(pgClient, mysqlUsers, options);
    report.unresolved_users = unresolved;
    report.created_auth_users = createdAuth;
    console.log(`[users] mapped=${legacyUserMap.size} unresolved=${unresolved.length}`);

    const takenUsernames = await fetchExistingUsernames(pgClient);
    const existingUsersById = await fetchExistingUsersById(pgClient);
    const pgUsers = [];
    for (const row of mysqlUsers) {
      const mappedId = legacyUserMap.get(Number(row.id));
      if (!mappedId) continue;
      const existingUsername = existingUsersById.get(mappedId);
      const username = existingUsername
        ? normalizeUsername(existingUsername, row.id)
        : ensureUniqueUsername(row.username, takenUsernames, row.id);
      pgUsers.push({
        id: mappedId,
        username,
        full_name: row.full_name || null,
        email: normalizeEmail(row.email) || null,
        profile_icon: row.profile_icon || 'muessis',
        pro_expires_at: row.pro_expires_at || null,
        bio: row.bio || null,
        hatim_count: Number(row.hatim_count || 0),
        is_super_admin: SUPER_ADMIN_USERNAMES.has(String(row.username || '').trim().toLowerCase()),
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
      });
    }

    await upsertRows(pgClient, {
      tableRef: 'public.users',
      columns: ['id', 'username', 'full_name', 'email', 'profile_icon', 'pro_expires_at', 'bio', 'hatim_count', 'is_super_admin', 'created_at', 'updated_at'],
      conflictColumns: ['id'],
      updateColumns: ['full_name', 'email', 'profile_icon', 'pro_expires_at', 'bio', 'hatim_count', 'is_super_admin', 'updated_at'],
      rows: pgUsers,
      batchSize: options.batchSize,
      dryRun: options.dryRun,
    });
    report.counts.users_migrated = pgUsers.length;

    const mapUserId = (legacyId) => legacyUserMap.get(Number(legacyId)) || null;
    const skipped = {};

    const settingsRowsRaw = await readMysqlRows(mysqlConn, 'user_settings', ['user_id', 'settings_json', 'updated_at'], 'user_id');
    const settingsRows = [];
    for (const row of settingsRowsRaw) {
      const userId = mapUserId(row.user_id);
      if (!userId) {
        skipped.user_settings = (skipped.user_settings || 0) + 1;
        continue;
      }
      settingsRows.push({
        user_id: userId,
        settings_json: parseJsonMaybe(row.settings_json, {}),
        updated_at: row.updated_at || null,
      });
    }
    await upsertRows(pgClient, {
      tableRef: 'public.user_settings',
      columns: ['user_id', 'settings_json', 'updated_at'],
      conflictColumns: ['user_id'],
      rows: settingsRows,
      batchSize: options.batchSize,
      dryRun: options.dryRun,
    });
    report.counts.user_settings = settingsRows.length;

    const bookmarksRowsRaw = await readMysqlRows(
      mysqlConn,
      'user_bookmarks',
      ['id', 'user_id', 'item_id', 'item_type', 'surah_id', 'verse_number', 'metadata', 'created_at'],
      'id'
    );
    const bookmarksRows = [];
    for (const row of bookmarksRowsRaw) {
      const userId = mapUserId(row.user_id);
      if (!userId) {
        skipped.user_bookmarks = (skipped.user_bookmarks || 0) + 1;
        continue;
      }
      bookmarksRows.push({
        id: Number(row.id),
        user_id: userId,
        item_id: String(row.item_id || ''),
        item_type: row.item_type,
        surah_id: row.surah_id || null,
        verse_number: row.verse_number || null,
        metadata: parseJsonMaybe(row.metadata, null),
        created_at: row.created_at || null,
      });
    }
    await upsertRows(pgClient, {
      tableRef: 'public.user_bookmarks',
      columns: ['id', 'user_id', 'item_id', 'item_type', 'surah_id', 'verse_number', 'metadata', 'created_at'],
      conflictColumns: ['id'],
      rows: bookmarksRows,
      batchSize: options.batchSize,
      dryRun: options.dryRun,
    });
    report.counts.user_bookmarks = bookmarksRows.length;

    const notesRowsRaw = await readMysqlRows(mysqlConn, 'user_notes', ['id', 'user_id', 'verse_id', 'content', 'created_at', 'updated_at'], 'id');
    const notesRows = [];
    for (const row of notesRowsRaw) {
      const userId = mapUserId(row.user_id);
      if (!userId) {
        skipped.user_notes = (skipped.user_notes || 0) + 1;
        continue;
      }
      notesRows.push({
        id: Number(row.id),
        user_id: userId,
        verse_id: Number(row.verse_id),
        content: row.content || '',
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
      });
    }
    await upsertRows(pgClient, {
      tableRef: 'public.user_notes',
      columns: ['id', 'user_id', 'verse_id', 'content', 'created_at', 'updated_at'],
      conflictColumns: ['id'],
      rows: notesRows,
      batchSize: options.batchSize,
      dryRun: options.dryRun,
    });
    report.counts.user_notes = notesRows.length;

    const playlistsRowsRaw = await readMysqlRows(mysqlConn, 'user_playlists', ['id', 'user_id', 'name', 'items_json', 'created_at', 'updated_at'], 'id');
    const playlistsRows = [];
    for (const row of playlistsRowsRaw) {
      const userId = mapUserId(row.user_id);
      if (!userId) {
        skipped.user_playlists = (skipped.user_playlists || 0) + 1;
        continue;
      }
      playlistsRows.push({
        id: Number(row.id),
        user_id: userId,
        name: row.name || 'Playlist',
        items_json: parseJsonMaybe(row.items_json, []),
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
      });
    }
    await upsertRows(pgClient, {
      tableRef: 'public.user_playlists',
      columns: ['id', 'user_id', 'name', 'items_json', 'created_at', 'updated_at'],
      conflictColumns: ['id'],
      rows: playlistsRows,
      batchSize: options.batchSize,
      dryRun: options.dryRun,
    });
    report.counts.user_playlists = playlistsRows.length;

    const supportRowsRaw = await readMysqlRows(
      mysqlConn,
      'user_support_stats',
      ['user_id', 'ads_enabled', 'ads_watched', 'usage_seconds', 'supporter_until', 'milestone_count', 'created_at', 'updated_at'],
      'user_id'
    );
    const supportRows = [];
    for (const row of supportRowsRaw) {
      const userId = mapUserId(row.user_id);
      if (!userId) {
        skipped.user_support_stats = (skipped.user_support_stats || 0) + 1;
        continue;
      }
      supportRows.push({
        user_id: userId,
        ads_enabled: asBool(row.ads_enabled),
        ads_watched: Number(row.ads_watched || 0),
        usage_seconds: Number(row.usage_seconds || 0),
        supporter_until: row.supporter_until || null,
        milestone_count: Number(row.milestone_count || 0),
        created_at: row.created_at || null,
        updated_at: row.updated_at || null,
      });
    }
    await upsertRows(pgClient, {
      tableRef: 'public.user_support_stats',
      columns: ['user_id', 'ads_enabled', 'ads_watched', 'usage_seconds', 'supporter_until', 'milestone_count', 'created_at', 'updated_at'],
      conflictColumns: ['user_id'],
      rows: supportRows,
      batchSize: options.batchSize,
      dryRun: options.dryRun,
    });
    report.counts.user_support_stats = supportRows.length;

    const callbacksRowsRaw = await readMysqlRows(
      mysqlConn,
      'rewarded_ad_callbacks',
      ['id', 'transaction_id', 'user_id', 'reward_item', 'reward_amount', 'callback_payload', 'key_id', 'signature', 'verified', 'source', 'consumed_at', 'created_at'],
      'id'
    );
    const callbacksRows = [];
    for (const row of callbacksRowsRaw) {
      const userId = mapUserId(row.user_id);
      if (!userId) {
        skipped.rewarded_ad_callbacks = (skipped.rewarded_ad_callbacks || 0) + 1;
        continue;
      }
      callbacksRows.push({
        id: Number(row.id),
        transaction_id: row.transaction_id,
        user_id: userId,
        reward_item: row.reward_item || 'quick_pro_hour',
        reward_amount: Number(row.reward_amount || 1),
        callback_payload: parseJsonMaybe(row.callback_payload, null),
        key_id: row.key_id || null,
        signature: row.signature || null,
        verified: asBool(row.verified),
        source: row.source || 'google_ssv',
        consumed_at: row.consumed_at || null,
        created_at: row.created_at || null,
      });
    }
    await upsertRows(pgClient, {
      tableRef: 'public.rewarded_ad_callbacks',
      columns: ['id', 'transaction_id', 'user_id', 'reward_item', 'reward_amount', 'callback_payload', 'key_id', 'signature', 'verified', 'source', 'consumed_at', 'created_at'],
      conflictColumns: ['id'],
      rows: callbacksRows,
      batchSize: options.batchSize,
      dryRun: options.dryRun,
    });
    report.counts.rewarded_ad_callbacks = callbacksRows.length;

    const dailyUsageRowsRaw = await readMysqlRows(
      mysqlConn,
      'user_daily_pro_ad_usage',
      ['user_id', 'usage_date', 'used_count', 'updated_at'],
      'usage_date, user_id'
    );
    const dailyUsageRows = [];
    for (const row of dailyUsageRowsRaw) {
      const userId = mapUserId(row.user_id);
      if (!userId) {
        skipped.user_daily_pro_ad_usage = (skipped.user_daily_pro_ad_usage || 0) + 1;
        continue;
      }
      dailyUsageRows.push({
        user_id: userId,
        usage_date: row.usage_date,
        used_count: Number(row.used_count || 0),
        updated_at: row.updated_at || null,
      });
    }
    await upsertRows(pgClient, {
      tableRef: 'public.user_daily_pro_ad_usage',
      columns: ['user_id', 'usage_date', 'used_count', 'updated_at'],
      conflictColumns: ['user_id', 'usage_date'],
      rows: dailyUsageRows,
      batchSize: options.batchSize,
      dryRun: options.dryRun,
    });
    report.counts.user_daily_pro_ad_usage = dailyUsageRows.length;

    const grantsRowsRaw = await readMysqlRows(
      mysqlConn,
      'user_pro_access_grants',
      ['id', 'user_id', 'callback_id', 'transaction_id', 'previous_expires_at', 'new_expires_at', 'duration_minutes', 'source', 'granted_at'],
      'id'
    );
    const grantsRows = [];
    for (const row of grantsRowsRaw) {
      const userId = mapUserId(row.user_id);
      if (!userId) {
        skipped.user_pro_access_grants = (skipped.user_pro_access_grants || 0) + 1;
        continue;
      }
      grantsRows.push({
        id: Number(row.id),
        user_id: userId,
        callback_id: row.callback_id || null,
        transaction_id: row.transaction_id || null,
        previous_expires_at: row.previous_expires_at || null,
        new_expires_at: row.new_expires_at,
        duration_minutes: Number(row.duration_minutes || 60),
        source: row.source || 'rewarded_ad',
        granted_at: row.granted_at || null,
      });
    }
    await upsertRows(pgClient, {
      tableRef: 'public.user_pro_access_grants',
      columns: ['id', 'user_id', 'callback_id', 'transaction_id', 'previous_expires_at', 'new_expires_at', 'duration_minutes', 'source', 'granted_at'],
      conflictColumns: ['id'],
      rows: grantsRows,
      batchSize: options.batchSize,
      dryRun: options.dryRun,
    });
    report.counts.user_pro_access_grants = grantsRows.length;

    report.skipped = skipped;

    if (!options.dryRun) {
      await syncSequence(pgClient, 'public.user_bookmarks', 'id');
      await syncSequence(pgClient, 'public.user_notes', 'id');
      await syncSequence(pgClient, 'public.user_playlists', 'id');
      await syncSequence(pgClient, 'public.rewarded_ad_callbacks', 'id');
      await syncSequence(pgClient, 'public.user_pro_access_grants', 'id');
      console.log('[data] sequences synced');
    }

    report.finished_at = new Date().toISOString();
    report.success = true;
  } finally {
    await mysqlConn.end();
    await pgClient.end();
  }

  const reportDir = path.resolve('supabase/migrations/reports');
  await fs.mkdir(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `big_goc_report_${nowStamp()}.json`);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`[done] report: ${reportPath}`);
  console.log(`[done] unresolved users: ${report.unresolved_users.length}`);
}

main().catch((err) => {
  console.error('[fatal]', err?.message || err);
  process.exit(1);
});
