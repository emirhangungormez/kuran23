#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';
import { createClient } from '@supabase/supabase-js';

const DEFAULT_PROJECT_NAME = 'kuran23';
const DEFAULT_BRAVE_PROFILE = path.join(
  process.env.LOCALAPPDATA || '',
  'BraveSoftware',
  'Brave-Browser',
  'User Data',
  'Default',
  'Local Storage',
  'leveldb'
);

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
    truncateFirst: args.has('--truncate-first') || envBool('MIGRATION_TRUNCATE_FIRST', false),
    createMissingAuth: args.has('--create-missing-auth') || envBool('MIGRATION_CREATE_MISSING_AUTH', true),
    batchSize: Number(env('MIGRATION_BATCH_SIZE', '300')),
    projectName: env('SUPABASE_PROJECT_NAME', DEFAULT_PROJECT_NAME),
    projectRef: env('SUPABASE_PROJECT_REF', null),
  };
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

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function mysqlTableExists(conn, table) {
  const [rows] = await conn.query('SHOW TABLES LIKE ?', [table]);
  return rows.length > 0;
}

const mysqlColumnsCache = new Map();

async function mysqlTableColumns(conn, table) {
  if (mysqlColumnsCache.has(table)) return mysqlColumnsCache.get(table);
  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${table}\``);
  const set = new Set(rows.map((r) => String(r.Field || '').trim()));
  mysqlColumnsCache.set(table, set);
  return set;
}

async function readMysqlRows(conn, table, columns, orderBy = null) {
  const exists = await mysqlTableExists(conn, table);
  if (!exists) {
    console.warn(`[skip] MySQL table missing: ${table}`);
    return [];
  }
  const available = await mysqlTableColumns(conn, table);
  const selectedColumns = columns.filter((c) => available.has(c));
  const missingColumns = columns.filter((c) => !available.has(c));
  if (missingColumns.length > 0) {
    console.warn(`[warn] ${table} missing columns: ${missingColumns.join(', ')}`);
  }
  if (selectedColumns.length === 0) {
    console.warn(`[skip] ${table} has no matching columns`);
    return [];
  }
  const cols = selectedColumns.map((c) => `\`${c}\``).join(', ');
  const order = orderBy ? ` ORDER BY ${orderBy}` : '';
  const [rows] = await conn.query(`SELECT ${cols} FROM \`${table}\`${order}`);
  return rows;
}

function loadTokenFromFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const obj = JSON.parse(content);
    if (obj?.access_token) return obj;
  } catch {}
  return null;
}

function extractSupabaseDashboardTokenFromBrave(localStorageLevelDbDir) {
  if (!fs.existsSync(localStorageLevelDbDir)) return null;
  const files = fs.readdirSync(localStorageLevelDbDir).filter((f) => /\.(ldb|log)$/i.test(f));
  let best = null;

  for (const file of files) {
    const fullPath = path.join(localStorageLevelDbDir, file);
    let text = '';
    try {
      text = fs.readFileSync(fullPath).toString('latin1');
    } catch {
      continue;
    }
    const re =
      /supabase\.dashboard\.auth\.token[\s\S]{0,1600}(\{"access_token":"[^"]+","token_type":"[^"]+","expires_in":\d+,"expires_at":\d+,"refresh_token":"[^"]+"\})/g;

    let match;
    while ((match = re.exec(text))) {
      try {
        const parsed = JSON.parse(match[1]);
        if (!best || Number(parsed.expires_at || 0) > Number(best.expires_at || 0)) {
          best = parsed;
        }
      } catch {}
    }
  }
  return best;
}

async function fetchJson(url, headers = {}, method = 'GET', body = null) {
  const response = await fetch(url, {
    method,
    headers: {
      ...headers,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : null,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`);
  }
  if (!text) return null;
  return JSON.parse(text);
}

async function resolveSupabaseContext(options) {
  const fromEnv = env('SUPABASE_MANAGEMENT_TOKEN', null);
  const fromTmp = loadTokenFromFile(path.resolve('.tmp/supa_dashboard_token.json'))?.access_token || null;
  const fromBrave =
    extractSupabaseDashboardTokenFromBrave(env('BRAVE_LEVELDB_DIR', DEFAULT_BRAVE_PROFILE))?.access_token || null;
  const managementToken = fromEnv || fromTmp || fromBrave;
  if (!managementToken) {
    throw new Error('SUPABASE_MANAGEMENT_TOKEN bulunamadi (env/.tmp/Brave profile).');
  }

  const headers = {
    Authorization: `Bearer ${managementToken}`,
    apikey: managementToken,
  };

  const projects = await fetchJson('https://api.supabase.com/v1/projects', headers);
  if (!Array.isArray(projects) || projects.length === 0) {
    throw new Error('Supabase Management API: proje bulunamadi.');
  }

  let project = null;
  if (options.projectRef) {
    project = projects.find((p) => p.id === options.projectRef || p.ref === options.projectRef);
  }
  if (!project && options.projectName) {
    project = projects.find((p) => String(p.name || '').toLowerCase() === String(options.projectName).toLowerCase());
  }
  if (!project) project = projects[0];

  const apiKeys = await fetchJson(`https://api.supabase.com/v1/projects/${project.id}/api-keys`, headers);
  if (!Array.isArray(apiKeys)) throw new Error('Supabase api-keys endpoint beklenen formatta donmedi.');
  const serviceRole = apiKeys.find((k) => k.name === 'service_role')?.api_key || null;
  if (!serviceRole) throw new Error('service_role api key bulunamadi.');

  return {
    projectRef: project.id,
    projectName: project.name,
    projectHost: project?.database?.host || `db.${project.id}.supabase.co`,
    managementToken,
    managementHeaders: headers,
    serviceRoleKey: serviceRole,
    supabaseUrl: `https://${project.id}.supabase.co`,
  };
}

async function runSqlViaManagement(projectRef, managementHeaders, query, dryRun = false) {
  if (dryRun) return [];
  const data = await fetchJson(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    managementHeaders,
    'POST',
    { query }
  );
  return data;
}

async function applySchema(projectRef, managementHeaders, options) {
  if (options.skipSchema) {
    console.log('[schema] skipped');
    return;
  }
  let sql = fs.readFileSync(path.resolve(env('MIGRATION_SQL_FILE', 'supabase/migrations/20260307_big_goc.sql')), 'utf8');
  sql = sql.replace(/^\uFEFF/, '');
  await runSqlViaManagement(projectRef, managementHeaders, sql, options.dryRun);
  console.log('[schema] applied');
}

async function maybeTruncate(projectRef, managementHeaders, options) {
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
  await runSqlViaManagement(projectRef, managementHeaders, sql, options.dryRun);
  console.log('[data] target tables truncated');
}

async function fetchAuthUsersViaSql(projectRef, managementHeaders, dryRun = false) {
  const query = `
    select
      id::text as id,
      lower(coalesce(email, '')) as email,
      lower(coalesce(raw_user_meta_data ->> 'username', '')) as username
    from auth.users
  `;
  return runSqlViaManagement(projectRef, managementHeaders, query, dryRun);
}

async function createAuthUserIfMissing(supabaseAdmin, legacyUser, fakeDomain) {
  const normalizedUsername = normalizeUsername(legacyUser.username, legacyUser.id).toLowerCase();
  const desiredEmail = normalizeEmail(legacyUser.email) || `${normalizedUsername}.${legacyUser.id}@${fakeDomain}`;
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

async function upsertBatches(supabase, table, rows, onConflict, batchSize, dryRun = false) {
  if (!rows || rows.length === 0) return 0;
  let total = 0;
  for (const batch of chunkArray(rows, batchSize)) {
    if (!dryRun) {
      const { error } = await supabase
        .from(table)
        .upsert(batch, { onConflict, ignoreDuplicates: false, defaultToNull: true });
      if (error) {
        throw new Error(`upsert ${table} failed: ${error.message}`);
      }
    }
    total += batch.length;
  }
  return total;
}

async function main() {
  const options = parseArgs();
  if (!Number.isFinite(options.batchSize) || options.batchSize < 1) {
    throw new Error('MIGRATION_BATCH_SIZE pozitif bir sayi olmali.');
  }

  const mysqlHost = env('MYSQL_HOST', '127.0.0.1');
  const mysqlPort = Number(env('MYSQL_PORT', '3306'));
  const mysqlDatabase = env('MYSQL_DATABASE', 'kuran_db');
  const mysqlUser = env('MYSQL_USER', 'root');
  const mysqlPassword = env('MYSQL_PASSWORD', '');

  const ctx = await resolveSupabaseContext(options);
  const supabaseAdmin = createClient(ctx.supabaseUrl, ctx.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`[start] project=${ctx.projectName} (${ctx.projectRef}) dryRun=${options.dryRun}`);

  const mysqlConn = await mysql.createConnection({
    host: mysqlHost,
    port: mysqlPort,
    user: mysqlUser,
    password: mysqlPassword,
    database: mysqlDatabase,
    charset: 'utf8mb4',
  });

  const report = {
    started_at: new Date().toISOString(),
    project_ref: ctx.projectRef,
    options,
    counts: {},
    skipped: {},
    unresolved_users: [],
    created_auth_users: [],
  };

  try {
    await applySchema(ctx.projectRef, ctx.managementHeaders, options);
    await maybeTruncate(ctx.projectRef, ctx.managementHeaders, options);

    // Quran core tables
    const coreTables = [
      {
        mysql: 'surahs',
        target: 'surahs',
        columns: ['id', 'name', 'name_en', 'name_original', 'slug', 'verse_count', 'page_number', 'audio_mp3', 'audio_duration', 'created_at'],
        orderBy: 'id',
        conflict: 'id',
      },
      {
        mysql: 'verses',
        target: 'verses',
        columns: ['id', 'surah_id', 'verse_number', 'verse_text', 'verse_simplified', 'verse_without_vowel', 'transcription', 'transcription_en', 'audio_mp3', 'audio_duration', 'page', 'juz_number', 'created_at'],
        orderBy: 'id',
        conflict: 'id',
      },
      {
        mysql: 'authors',
        target: 'authors',
        columns: ['id', 'name', 'description', 'language', 'created_at'],
        orderBy: 'id',
        conflict: 'id',
      },
      {
        mysql: 'translations',
        target: 'translations',
        columns: ['id', 'verse_id', 'author_id', 'text', 'created_at'],
        orderBy: 'id',
        conflict: 'id',
      },
      {
        mysql: 'footnotes',
        target: 'footnotes',
        columns: ['id', 'translation_id', 'number', 'text', 'created_at'],
        orderBy: 'id',
        conflict: 'id',
      },
      {
        mysql: 'roots',
        target: 'roots',
        columns: ['id', 'latin', 'arabic', 'transcription', 'mean_tr', 'mean_en', 'created_at'],
        orderBy: 'id',
        conflict: 'id',
      },
      {
        mysql: 'verse_words',
        target: 'verse_words',
        columns: ['id', 'verse_id', 'sort_number', 'arabic', 'transcription_tr', 'transcription_en', 'translation_tr', 'translation_en', 'root_id', 'created_at'],
        orderBy: 'id',
        conflict: 'id',
      },
    ];

    for (const table of coreTables) {
      const rows = await readMysqlRows(mysqlConn, table.mysql, table.columns, table.orderBy);
      report.counts[table.mysql] = rows.length;
      const count = await upsertBatches(supabaseAdmin, table.target, rows, table.conflict, options.batchSize, options.dryRun);
      console.log(`[core] ${table.mysql}: ${count}`);
    }

    // Legacy users -> auth.users mapping
    const mysqlUsers = await readMysqlRows(
      mysqlConn,
      'users',
      ['id', 'username', 'full_name', 'email', 'profile_icon', 'pro_expires_at', 'bio', 'hatim_count', 'created_at', 'updated_at'],
      'id'
    );
    report.counts.users_legacy = mysqlUsers.length;

    let authUsers = await fetchAuthUsersViaSql(ctx.projectRef, ctx.managementHeaders, options.dryRun);
    if (!Array.isArray(authUsers)) authUsers = [];

    const byEmail = new Map();
    const byUsername = new Map();
    for (const user of authUsers) {
      const e = normalizeEmail(user.email);
      const u = String(user.username || '').trim().toLowerCase();
      if (e) byEmail.set(e, user.id);
      if (u) byUsername.set(u, user.id);
    }

    const legacyMap = new Map();
    const unresolved = [];
    const createdAuth = [];
    const fakeDomain = env('MIGRATION_FAKE_EMAIL_DOMAIN', 'legacy.local');

    for (const legacy of mysqlUsers) {
      const legacyId = Number(legacy.id);
      const email = normalizeEmail(legacy.email);
      const username = normalizeUsername(legacy.username, legacyId).toLowerCase();

      let authId = null;
      if (email && byEmail.has(email)) {
        authId = byEmail.get(email);
      } else if (username && byUsername.has(username)) {
        authId = byUsername.get(username);
      } else if (options.createMissingAuth) {
        const created = options.dryRun
          ? { userId: `dry-${legacyId}`, error: null }
          : await createAuthUserIfMissing(supabaseAdmin, legacy, fakeDomain);
        if (created.userId) {
          authId = created.userId;
          if (email) byEmail.set(email, authId);
          byUsername.set(username, authId);
          createdAuth.push({ legacy_id: legacyId, auth_user_id: authId, email: email || null });
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

      if (authId) legacyMap.set(legacyId, authId);
    }

    report.unresolved_users = unresolved;
    report.created_auth_users = createdAuth;
    console.log(`[users] mapped=${legacyMap.size} unresolved=${unresolved.length} created_auth=${createdAuth.length}`);

    // public.users
    let existingUsers = [];
    if (!options.dryRun) {
      const { data, error } = await supabaseAdmin.from('users').select('id,username');
      if (error) throw new Error(`public.users read failed: ${error.message}`);
      existingUsers = data || [];
    }
    const existingUsersById = new Map((existingUsers || []).map((u) => [u.id, u.username || null]));
    const takenUsernames = new Set((existingUsers || []).map((u) => String(u.username || '').toLowerCase()).filter(Boolean));

    const pgUsers = [];
    for (const row of mysqlUsers) {
      const mappedId = legacyMap.get(Number(row.id));
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
    await upsertBatches(supabaseAdmin, 'users', pgUsers, 'id', options.batchSize, options.dryRun);
    report.counts.users_migrated = pgUsers.length;

    const mapUserId = (legacyId) => legacyMap.get(Number(legacyId)) || null;
    const skipped = {};

    // user_settings
    const settingsRaw = await readMysqlRows(mysqlConn, 'user_settings', ['user_id', 'settings_json', 'updated_at'], 'user_id');
    const settingsRows = [];
    for (const row of settingsRaw) {
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
    await upsertBatches(supabaseAdmin, 'user_settings', settingsRows, 'user_id', options.batchSize, options.dryRun);
    report.counts.user_settings = settingsRows.length;

    // user_bookmarks
    const bookmarksRaw = await readMysqlRows(
      mysqlConn,
      'user_bookmarks',
      ['id', 'user_id', 'item_id', 'item_type', 'surah_id', 'verse_number', 'metadata', 'created_at'],
      'id'
    );
    const bookmarksRows = [];
    for (const row of bookmarksRaw) {
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
    await upsertBatches(supabaseAdmin, 'user_bookmarks', bookmarksRows, 'id', options.batchSize, options.dryRun);
    report.counts.user_bookmarks = bookmarksRows.length;

    // user_notes
    const notesRaw = await readMysqlRows(mysqlConn, 'user_notes', ['id', 'user_id', 'verse_id', 'content', 'created_at', 'updated_at'], 'id');
    const notesRows = [];
    for (const row of notesRaw) {
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
    await upsertBatches(supabaseAdmin, 'user_notes', notesRows, 'id', options.batchSize, options.dryRun);
    report.counts.user_notes = notesRows.length;

    // user_playlists
    const playlistsRaw = await readMysqlRows(mysqlConn, 'user_playlists', ['id', 'user_id', 'name', 'items_json', 'created_at', 'updated_at'], 'id');
    const playlistsRows = [];
    for (const row of playlistsRaw) {
      const userId = mapUserId(row.user_id);
      if (!userId) {
        skipped.user_playlists = (skipped.user_playlists || 0) + 1;
        continue;
      }
      const item = {
        id: Number(row.id),
        user_id: userId,
        name: row.name || 'Playlist',
        items_json: parseJsonMaybe(row.items_json, []),
      };
      if (row.created_at) item.created_at = row.created_at;
      if (row.updated_at) item.updated_at = row.updated_at;
      playlistsRows.push(item);
    }
    await upsertBatches(supabaseAdmin, 'user_playlists', playlistsRows, 'id', options.batchSize, options.dryRun);
    report.counts.user_playlists = playlistsRows.length;

    // user_support_stats
    const supportRaw = await readMysqlRows(
      mysqlConn,
      'user_support_stats',
      ['user_id', 'ads_enabled', 'ads_watched', 'usage_seconds', 'supporter_until', 'milestone_count', 'created_at', 'updated_at'],
      'user_id'
    );
    const supportRows = [];
    for (const row of supportRaw) {
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
    await upsertBatches(supabaseAdmin, 'user_support_stats', supportRows, 'user_id', options.batchSize, options.dryRun);
    report.counts.user_support_stats = supportRows.length;

    // rewarded_ad_callbacks
    const callbacksRaw = await readMysqlRows(
      mysqlConn,
      'rewarded_ad_callbacks',
      ['id', 'transaction_id', 'user_id', 'reward_item', 'reward_amount', 'callback_payload', 'key_id', 'signature', 'verified', 'source', 'consumed_at', 'created_at'],
      'id'
    );
    const callbacksRows = [];
    const callbackIdSet = new Set();
    for (const row of callbacksRaw) {
      const userId = mapUserId(row.user_id);
      if (!userId) {
        skipped.rewarded_ad_callbacks = (skipped.rewarded_ad_callbacks || 0) + 1;
        continue;
      }
      const id = Number(row.id);
      callbacksRows.push({
        id,
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
      callbackIdSet.add(id);
    }
    await upsertBatches(supabaseAdmin, 'rewarded_ad_callbacks', callbacksRows, 'id', options.batchSize, options.dryRun);
    report.counts.rewarded_ad_callbacks = callbacksRows.length;

    // user_daily_pro_ad_usage
    const dailyRaw = await readMysqlRows(
      mysqlConn,
      'user_daily_pro_ad_usage',
      ['user_id', 'usage_date', 'used_count', 'updated_at'],
      'usage_date, user_id'
    );
    const dailyRows = [];
    for (const row of dailyRaw) {
      const userId = mapUserId(row.user_id);
      if (!userId) {
        skipped.user_daily_pro_ad_usage = (skipped.user_daily_pro_ad_usage || 0) + 1;
        continue;
      }
      dailyRows.push({
        user_id: userId,
        usage_date: row.usage_date,
        used_count: Number(row.used_count || 0),
        updated_at: row.updated_at || null,
      });
    }
    await upsertBatches(supabaseAdmin, 'user_daily_pro_ad_usage', dailyRows, 'user_id,usage_date', options.batchSize, options.dryRun);
    report.counts.user_daily_pro_ad_usage = dailyRows.length;

    // user_pro_access_grants
    const grantsRaw = await readMysqlRows(
      mysqlConn,
      'user_pro_access_grants',
      ['id', 'user_id', 'callback_id', 'transaction_id', 'previous_expires_at', 'new_expires_at', 'duration_minutes', 'source', 'granted_at'],
      'id'
    );
    const grantsRows = [];
    for (const row of grantsRaw) {
      const userId = mapUserId(row.user_id);
      if (!userId) {
        skipped.user_pro_access_grants = (skipped.user_pro_access_grants || 0) + 1;
        continue;
      }
      const callbackId = row.callback_id ? Number(row.callback_id) : null;
      grantsRows.push({
        id: Number(row.id),
        user_id: userId,
        callback_id: callbackId && callbackIdSet.has(callbackId) ? callbackId : null,
        transaction_id: row.transaction_id || null,
        previous_expires_at: row.previous_expires_at || null,
        new_expires_at: row.new_expires_at,
        duration_minutes: Number(row.duration_minutes || 60),
        source: row.source || 'rewarded_ad',
        granted_at: row.granted_at || null,
      });
    }
    await upsertBatches(supabaseAdmin, 'user_pro_access_grants', grantsRows, 'id', options.batchSize, options.dryRun);
    report.counts.user_pro_access_grants = grantsRows.length;

    report.skipped = skipped;

    // Sequence sync
    if (!options.dryRun) {
      await runSqlViaManagement(
        ctx.projectRef,
        ctx.managementHeaders,
        `
          select setval(pg_get_serial_sequence('public.user_bookmarks', 'id'), coalesce((select max(id) from public.user_bookmarks), 0) + 1, false);
          select setval(pg_get_serial_sequence('public.user_notes', 'id'), coalesce((select max(id) from public.user_notes), 0) + 1, false);
          select setval(pg_get_serial_sequence('public.user_playlists', 'id'), coalesce((select max(id) from public.user_playlists), 0) + 1, false);
          select setval(pg_get_serial_sequence('public.rewarded_ad_callbacks', 'id'), coalesce((select max(id) from public.rewarded_ad_callbacks), 0) + 1, false);
          select setval(pg_get_serial_sequence('public.user_pro_access_grants', 'id'), coalesce((select max(id) from public.user_pro_access_grants), 0) + 1, false);
        `,
        false
      );
      console.log('[data] sequences synced');
    }

    report.success = true;
    report.finished_at = new Date().toISOString();
  } finally {
    await mysqlConn.end();
  }

  const reportDir = path.resolve('supabase/migrations/reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `big_goc_online_report_${nowStamp()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`[done] report: ${reportPath}`);
  console.log(`[done] unresolved users: ${report.unresolved_users.length}`);
}

main().catch((err) => {
  console.error('[fatal]', err?.message || err);
  process.exit(1);
});
