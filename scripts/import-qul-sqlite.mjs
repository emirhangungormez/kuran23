#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import Database from 'better-sqlite3'

const { Client: PgClient } = pg

function env(name, fallback = undefined) {
  const value = process.env[name]
  if (value === undefined || value === null || value === '') return fallback
  return value
}

function parseArgs(argv) {
  const out = {
    sqlitePath: env('QUL_SQLITE_PATH', ''),
    surahId: Number(env('QUL_SURAH_ID', '1')),
    dryRun: false,
    batchTag: env('QUL_BATCH_TAG', '')
  }

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--dry-run') out.dryRun = true
    if (token.startsWith('--sqlite=')) out.sqlitePath = token.slice('--sqlite='.length)
    if (token === '--sqlite' && argv[i + 1]) out.sqlitePath = argv[++i]
    if (token.startsWith('--surah=')) out.surahId = Number(token.slice('--surah='.length))
    if (token === '--surah' && argv[i + 1]) out.surahId = Number(argv[++i])
    if (token.startsWith('--batch=')) out.batchTag = token.slice('--batch='.length)
    if (token === '--batch' && argv[i + 1]) out.batchTag = argv[++i]
  }

  if (!out.batchTag) out.batchTag = `qul_s${out.surahId}_${new Date().toISOString()}`
  return out
}

function listTables(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((r) => r.name)
}

function getColumns(db, table) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all()
  return rows.map((r) => String(r.name))
}

function pickColumn(columns, candidates) {
  for (const item of candidates) {
    if (columns.includes(item)) return item
  }
  return null
}

function findTableByCandidates(allTables, candidates) {
  for (const t of candidates) {
    if (allTables.includes(t)) return t
  }
  return null
}

function normalizeText(value) {
  const str = String(value ?? '').trim()
  return str || null
}

function hasArabicChars(value) {
  return /\p{Script=Arabic}/u.test(String(value || ''))
}

function buildVerseRecords(db, surahId) {
  const tables = listTables(db)
  const verseTable = findTableByCandidates(tables, [
    'verses', 'ayahs', 'quran_verses', 'quran_ayahs', 'quran_text'
  ])
  if (!verseTable) {
    throw new Error(`No verse-like table found. Available tables: ${tables.join(', ')}`)
  }

  const cols = getColumns(db, verseTable)
  const idCol = pickColumn(cols, ['id', 'verse_id', 'ayah_id'])
  const surahCol = pickColumn(cols, ['surah_id', 'sura_id', 'chapter_id'])
  const ayahCol = pickColumn(cols, ['verse_number', 'ayah_number', 'aya_no', 'verse', 'ayah'])
  const textUthmaniCol = pickColumn(cols, ['text_uthmani', 'uthmani', 'verse_text_uthmani', 'verse_text', 'text'])
  const textPlainCol = pickColumn(cols, ['text_plain', 'plain', 'verse_text_plain', 'verse_without_vowel', 'text_no_diacritics'])
  const textTajweedCol = pickColumn(cols, ['text_tajweed', 'tajweed', 'verse_text_tajweed'])

  if (!ayahCol || !textUthmaniCol) {
    throw new Error(`Could not map verse columns for table '${verseTable}'.`)
  }

  const whereSql = surahCol ? `WHERE ${surahCol} = ?` : ''
  const rows = db.prepare(`SELECT * FROM ${verseTable} ${whereSql}`).all(...(surahCol ? [surahId] : []))

  const records = rows
    .map((row) => {
      const verseNumber = Number(row[ayahCol] ?? 0)
      const uthmani = normalizeText(row[textUthmaniCol])
      const plain = normalizeText(textPlainCol ? row[textPlainCol] : null) || uthmani
      const tajweed = normalizeText(textTajweedCol ? row[textTajweedCol] : null) || uthmani
      return {
        sqliteVerseId: idCol ? row[idCol] : null,
        verseNumber,
        uthmani,
        plain,
        tajweed
      }
    })
    .filter((r) => Number.isFinite(r.verseNumber) && r.verseNumber >= 1 && r.verseNumber <= 7)
    .sort((a, b) => a.verseNumber - b.verseNumber)

  return { verseTable, records }
}

function buildSurahRecord(db, surahId) {
  const tables = listTables(db)
  const surahTable = findTableByCandidates(tables, ['surahs', 'chapters', 'quran_surahs'])
  if (!surahTable) return { surahTable: null, record: null }

  const cols = getColumns(db, surahTable)
  const idCol = pickColumn(cols, ['id', 'surah_id', 'chapter_id'])
  const trCol = pickColumn(cols, ['transliteration_tr', 'name_tr_translit', 'name_translit_tr'])
  const enCol = pickColumn(cols, ['transliteration_en', 'name_en_translit', 'name_translit_en'])
  if (!idCol || (!trCol && !enCol)) return { surahTable, record: null }

  const row = db.prepare(`SELECT * FROM ${surahTable} WHERE ${idCol} = ? LIMIT 1`).get(surahId)
  if (!row) return { surahTable, record: null }

  return {
    surahTable,
    record: {
      transliteration_tr: normalizeText(trCol ? row[trCol] : null),
      transliteration_en: normalizeText(enCol ? row[enCol] : null)
    }
  }
}

function buildWordRecords(db, surahId, sqliteVerseIdToAyah) {
  const tables = listTables(db)
  const wordTable = findTableByCandidates(tables, [
    'verse_words', 'words', 'ayah_words', 'word_by_word', 'quran_words'
  ])
  if (!wordTable) return { wordTable: null, records: [] }

  const cols = getColumns(db, wordTable)
  const surahCol = pickColumn(cols, ['surah_id', 'sura_id', 'chapter_id'])
  const ayahCol = pickColumn(cols, ['ayah_number', 'verse_number', 'aya_no', 'ayah', 'verse'])
  const verseRefCol = pickColumn(cols, ['verse_id', 'ayah_id'])
  const sortCol = pickColumn(cols, ['sort_number', 'word_number', 'position', 'word_index', 'token_number'])
  const arabicCol = pickColumn(cols, ['arabic', 'text_ar', 'word', 'token'])
  const trCol = pickColumn(cols, ['translation_tr', 'tr', 'meaning_tr'])
  const enCol = pickColumn(cols, ['translation_en', 'en', 'meaning_en'])
  const transTrCol = pickColumn(cols, ['transcription_tr', 'transliteration_tr', 'read_tr'])
  const transEnCol = pickColumn(cols, ['transcription_en', 'transliteration_en', 'read_en'])
  const posCol = pickColumn(cols, ['pos', 'grammar_pos', 'part_of_speech'])
  const posArCol = pickColumn(cols, ['pos_ar', 'grammar_pos_ar'])
  const lemmaCol = pickColumn(cols, ['lemma', 'grammar_lemma'])
  const lemmaArCol = pickColumn(cols, ['lemma_ar', 'grammar_lemma_ar'])
  const stemCol = pickColumn(cols, ['stem', 'grammar_stem'])
  const rootCol = pickColumn(cols, ['root', 'grammar_root', 'root_text', 'root_latin'])
  const patternCol = pickColumn(cols, ['pattern', 'grammar_pattern'])
  const caseCol = pickColumn(cols, ['gram_case', 'word_case', 'grammar_case'])
  const moodCol = pickColumn(cols, ['mood', 'grammar_mood'])
  const personCol = pickColumn(cols, ['person', 'grammar_person'])
  const genderCol = pickColumn(cols, ['gender', 'grammar_gender'])
  const numberCol = pickColumn(cols, ['number', 'grammar_number'])
  const voiceCol = pickColumn(cols, ['voice', 'grammar_voice'])
  const aspectCol = pickColumn(cols, ['aspect', 'grammar_aspect'])
  const stateCol = pickColumn(cols, ['state', 'grammar_state'])
  const formCol = pickColumn(cols, ['form', 'grammar_form'])
  const i3rabCol = pickColumn(cols, ['i3rab', 'irab', 'grammar_i3rab'])
  const detailsCol = pickColumn(cols, ['grammar_details', 'analysis_json', 'morphology_json', 'raw_json'])

  const whereSql = surahCol ? `WHERE ${surahCol} = ?` : ''
  const rows = db.prepare(`SELECT * FROM ${wordTable} ${whereSql}`).all(...(surahCol ? [surahId] : []))

  const records = rows
    .map((row, index) => {
      let ayah = Number(ayahCol ? row[ayahCol] : 0)
      if (!ayah && verseRefCol && sqliteVerseIdToAyah.size > 0) {
        ayah = Number(sqliteVerseIdToAyah.get(row[verseRefCol]) || 0)
      }
      if (!ayah || ayah < 1 || ayah > 7) return null

      const sort = Number(sortCol ? row[sortCol] : index + 1) || index + 1
      const rootRaw = normalizeText(rootCol ? row[rootCol] : null)
      const detailsRaw = detailsCol ? row[detailsCol] : null
      let details = null
      if (typeof detailsRaw === 'string' && detailsRaw.trim()) {
        try {
          details = JSON.parse(detailsRaw)
        } catch {
          details = detailsRaw
        }
      } else if (detailsRaw && typeof detailsRaw === 'object') {
        details = detailsRaw
      }

      return {
        ayah,
        sort,
        arabic: normalizeText(arabicCol ? row[arabicCol] : null),
        transcription_tr: normalizeText(transTrCol ? row[transTrCol] : null),
        transcription_en: normalizeText(transEnCol ? row[transEnCol] : null),
        translation_tr: normalizeText(trCol ? row[trCol] : null),
        translation_en: normalizeText(enCol ? row[enCol] : null),
        grammar_pos: normalizeText(posCol ? row[posCol] : null),
        grammar_pos_ar: normalizeText(posArCol ? row[posArCol] : null),
        grammar_lemma: normalizeText(lemmaCol ? row[lemmaCol] : null),
        grammar_lemma_ar: normalizeText(lemmaArCol ? row[lemmaArCol] : null),
        grammar_stem: normalizeText(stemCol ? row[stemCol] : null),
        grammar_root: rootRaw,
        grammar_pattern: normalizeText(patternCol ? row[patternCol] : null),
        grammar_case: normalizeText(caseCol ? row[caseCol] : null),
        grammar_mood: normalizeText(moodCol ? row[moodCol] : null),
        grammar_person: normalizeText(personCol ? row[personCol] : null),
        grammar_gender: normalizeText(genderCol ? row[genderCol] : null),
        grammar_number: normalizeText(numberCol ? row[numberCol] : null),
        grammar_voice: normalizeText(voiceCol ? row[voiceCol] : null),
        grammar_aspect: normalizeText(aspectCol ? row[aspectCol] : null),
        grammar_state: normalizeText(stateCol ? row[stateCol] : null),
        grammar_form: normalizeText(formCol ? row[formCol] : null),
        grammar_i3rab: normalizeText(i3rabCol ? row[i3rabCol] : null),
        grammar_details: details
      }
    })
    .filter(Boolean)
    .sort((a, b) => (a.ayah - b.ayah) || (a.sort - b.sort))

  return { wordTable, records }
}

async function resolveRootId(pgClient, cache, rootRaw, sequenceState) {
  const value = normalizeText(rootRaw)
  if (!value) return null
  const cacheKey = value.toLowerCase()
  if (cache.has(cacheKey)) return cache.get(cacheKey)

  let row = null
  if (hasArabicChars(value)) {
    const res = await pgClient.query('SELECT id FROM public.roots WHERE arabic = $1 LIMIT 1', [value])
    row = res.rows[0] || null
    if (!row) {
      sequenceState.nextRootId += 1
      const newId = sequenceState.nextRootId
      await pgClient.query(
        'INSERT INTO public.roots (id, arabic, created_at) VALUES ($1, $2, now()) ON CONFLICT (id) DO NOTHING',
        [newId, value]
      )
      row = { id: newId }
    }
  } else {
    const normalizedLatin = value.toLowerCase()
    const res = await pgClient.query('SELECT id FROM public.roots WHERE lower(latin) = $1 LIMIT 1', [normalizedLatin])
    row = res.rows[0] || null
    if (!row) {
      sequenceState.nextRootId += 1
      const newId = sequenceState.nextRootId
      await pgClient.query(
        'INSERT INTO public.roots (id, latin, created_at) VALUES ($1, $2, now()) ON CONFLICT (id) DO NOTHING',
        [newId, value]
      )
      row = { id: newId }
    }
  }

  cache.set(cacheKey, row?.id ?? null)
  return row?.id ?? null
}

async function main() {
  const args = parseArgs(process.argv)
  const sqlitePath = args.sqlitePath
  const surahId = Number.isFinite(args.surahId) && args.surahId > 0 ? args.surahId : 1
  const dbUrl = env('SUPABASE_DB_URL', '')

  if (!sqlitePath) throw new Error('Missing SQLite path. Use --sqlite or QUL_SQLITE_PATH.')
  if (!dbUrl) throw new Error('Missing SUPABASE_DB_URL environment variable.')
  if (!fs.existsSync(sqlitePath)) throw new Error(`SQLite file not found: ${sqlitePath}`)

  const absSqlitePath = path.resolve(sqlitePath)
  const sqlite = new Database(absSqlitePath, { readonly: true, fileMustExist: true })
  const pgClient = new PgClient({ connectionString: dbUrl })

  try {
    const versePayload = buildVerseRecords(sqlite, surahId)
    const surahPayload = buildSurahRecord(sqlite, surahId)
    const sqliteVerseIdToAyah = new Map()
    for (const record of versePayload.records) {
      if (record.sqliteVerseId !== null && record.sqliteVerseId !== undefined) {
        sqliteVerseIdToAyah.set(record.sqliteVerseId, record.verseNumber)
      }
    }
    const wordPayload = buildWordRecords(sqlite, surahId, sqliteVerseIdToAyah)

    if (versePayload.records.length === 0) {
      throw new Error(`No verses found for surah ${surahId} in table '${versePayload.verseTable}'.`)
    }

    await pgClient.connect()

    const pgVerses = await pgClient.query(
      'SELECT id, verse_number FROM public.verses WHERE surah_id = $1 AND verse_number BETWEEN 1 AND 7 ORDER BY verse_number',
      [surahId]
    )
    const verseMap = new Map(pgVerses.rows.map((r) => [Number(r.verse_number), Number(r.id)]))
    if (verseMap.size === 0) throw new Error(`Supabase verses not found for surah ${surahId}. Run base migration first.`)

    if (args.dryRun) {
      console.log('[dry-run] SQLite source:', absSqlitePath)
      console.log(`[dry-run] Verse table: ${versePayload.verseTable}, records: ${versePayload.records.length}`)
      console.log(`[dry-run] Word table: ${wordPayload.wordTable || 'not found'}, records: ${wordPayload.records.length}`)
      if (surahPayload.record) {
        console.log(`[dry-run] Surah table: ${surahPayload.surahTable}, transliteration fields found`)
      }
      console.log(`[dry-run] Batch tag: ${args.batchTag}`)
      return
    }

    await pgClient.query('BEGIN')

    for (const record of versePayload.records) {
      const verseId = verseMap.get(record.verseNumber)
      if (!verseId) continue
      await pgClient.query(
        `UPDATE public.verses
         SET verse_text_uthmani = $1,
             verse_text_plain = $2,
             verse_text_tajweed = $3,
             text_source = 'qul',
             text_is_fallback = false,
             qul_import_batch = $4,
             qul_imported_at = now()
         WHERE id = $5`,
        [record.uthmani, record.plain, record.tajweed, args.batchTag, verseId]
      )
    }

    if (surahPayload.record) {
      await pgClient.query(
        `UPDATE public.surahs
         SET transliteration_tr = COALESCE($1, transliteration_tr),
             transliteration_en = COALESCE($2, transliteration_en),
             source = 'qul',
             is_fallback = false
         WHERE id = $3`,
        [surahPayload.record.transliteration_tr, surahPayload.record.transliteration_en, surahId]
      )
    }

    const maxWordRes = await pgClient.query('SELECT COALESCE(MAX(id), 0) AS max_id FROM public.verse_words')
    let nextWordId = Number(maxWordRes.rows[0]?.max_id || 0)
    const maxRootRes = await pgClient.query('SELECT COALESCE(MAX(id), 0) AS max_id FROM public.roots')
    const rootState = { nextRootId: Number(maxRootRes.rows[0]?.max_id || 0) }

    const verseIds = [...verseMap.values()]
    const existingWordsRes = await pgClient.query(
      'SELECT id, verse_id, sort_number FROM public.verse_words WHERE verse_id = ANY($1::int[])',
      [verseIds]
    )
    const existingWordByKey = new Map(
      existingWordsRes.rows.map((r) => [`${Number(r.verse_id)}:${Number(r.sort_number)}`, Number(r.id)])
    )

    const rootCache = new Map()

    for (const word of wordPayload.records) {
      const verseId = verseMap.get(Number(word.ayah))
      if (!verseId) continue

      const key = `${verseId}:${word.sort}`
      const existingId = existingWordByKey.get(key)
      const id = existingId || ++nextWordId
      const rootId = await resolveRootId(pgClient, rootCache, word.grammar_root, rootState)

      await pgClient.query(
        `INSERT INTO public.verse_words (
          id, verse_id, sort_number, arabic, transcription_tr, transcription_en,
          translation_tr, translation_en, root_id, source, is_fallback,
          grammar_pos, grammar_pos_ar, grammar_lemma, grammar_lemma_ar, grammar_stem,
          grammar_root, grammar_pattern, grammar_case, grammar_mood, grammar_person,
          grammar_gender, grammar_number, grammar_voice, grammar_aspect, grammar_state,
          grammar_form, grammar_i3rab, grammar_details
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, 'qul', false,
          $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24,
          $25, $26, $27::jsonb
        )
        ON CONFLICT (verse_id, sort_number) DO UPDATE SET
          id = EXCLUDED.id,
          arabic = EXCLUDED.arabic,
          transcription_tr = EXCLUDED.transcription_tr,
          transcription_en = EXCLUDED.transcription_en,
          translation_tr = EXCLUDED.translation_tr,
          translation_en = EXCLUDED.translation_en,
          root_id = EXCLUDED.root_id,
          source = EXCLUDED.source,
          is_fallback = EXCLUDED.is_fallback,
          grammar_pos = EXCLUDED.grammar_pos,
          grammar_pos_ar = EXCLUDED.grammar_pos_ar,
          grammar_lemma = EXCLUDED.grammar_lemma,
          grammar_lemma_ar = EXCLUDED.grammar_lemma_ar,
          grammar_stem = EXCLUDED.grammar_stem,
          grammar_root = EXCLUDED.grammar_root,
          grammar_pattern = EXCLUDED.grammar_pattern,
          grammar_case = EXCLUDED.grammar_case,
          grammar_mood = EXCLUDED.grammar_mood,
          grammar_person = EXCLUDED.grammar_person,
          grammar_gender = EXCLUDED.grammar_gender,
          grammar_number = EXCLUDED.grammar_number,
          grammar_voice = EXCLUDED.grammar_voice,
          grammar_aspect = EXCLUDED.grammar_aspect,
          grammar_state = EXCLUDED.grammar_state,
          grammar_form = EXCLUDED.grammar_form,
          grammar_i3rab = EXCLUDED.grammar_i3rab,
          grammar_details = EXCLUDED.grammar_details`,
        [
          id,
          verseId,
          word.sort,
          word.arabic,
          word.transcription_tr,
          word.transcription_en,
          word.translation_tr,
          word.translation_en,
          rootId,
          word.grammar_pos,
          word.grammar_pos_ar,
          word.grammar_lemma,
          word.grammar_lemma_ar,
          word.grammar_stem,
          word.grammar_root,
          word.grammar_pattern,
          word.grammar_case,
          word.grammar_mood,
          word.grammar_person,
          word.grammar_gender,
          word.grammar_number,
          word.grammar_voice,
          word.grammar_aspect,
          word.grammar_state,
          word.grammar_form,
          word.grammar_i3rab,
          word.grammar_details ? JSON.stringify(word.grammar_details) : null
        ]
      )
    }

    await pgClient.query('COMMIT')

    console.log('QUL pilot import completed.')
    console.log(`SQLite: ${absSqlitePath}`)
    console.log(`Verse table: ${versePayload.verseTable} (${versePayload.records.length} rows)`)
    console.log(`Word table: ${wordPayload.wordTable || 'not found'} (${wordPayload.records.length} rows)`)
    if (surahPayload.record) {
      console.log(`Surah table: ${surahPayload.surahTable} (transliteration updated)`)
    }
    console.log(`Batch: ${args.batchTag}`)
  } catch (error) {
    try { await pgClient.query('ROLLBACK') } catch (_e) { }
    throw error
  } finally {
    try { await pgClient.end() } catch (_e) { }
    try { sqlite.close() } catch (_e) { }
  }
}

main().catch((err) => {
  console.error('[import-qul-sqlite] failed:', err?.message || err)
  process.exit(1)
})
