import { supabase } from '../infrastructure/supabaseClient'

function safeInt(value, fallback = 0) {
  const n = parseInt(value, 10)
  return Number.isFinite(n) ? n : fallback
}

function unique(values) {
  return [...new Set((values || []).filter((v) => v !== null && v !== undefined))]
}

function normalizeArabicForSearch(text) {
  return String(text || '')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
    .replace(/\u0629/g, '\u0647')
    .replace(/\u0649/g, '\u064A')
    .trim()
}

function hasArabic(text) {
  return /\p{Script=Arabic}/u.test(String(text || ''))
}

function asBool(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value === null || value === undefined) return fallback
  if (typeof value === 'number') return value > 0
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return fallback
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

function buildTextModes(verse = {}) {
  const uthmani = verse.verse_text_uthmani || verse.verse_text || verse.verse_simplified || ''
  const plain = verse.verse_text_plain || verse.verse_without_vowel || verse.verse_simplified || uthmani
  const tajweed = verse.verse_text_tajweed || verse.verse_text || uthmani
  return { uthmani, plain, tajweed }
}

function withSourceMeta(data, sourceField = 'source', fallbackField = 'is_fallback') {
  const source = String(data?.[sourceField] || '').trim() || 'legacy'
  const isFallback = asBool(data?.[fallbackField], source !== 'qul')
  return { source, isFallback }
}

function mapWordRow(w) {
  const meta = withSourceMeta(w)
  return {
    id: w.id,
    sort_number: w.sort_number,
    arabic: w.arabic,
    transcription_tr: w.transcription_tr,
    transcription_en: w.transcription_en,
    translation_tr: w.translation_tr,
    translation_en: w.translation_en,
    source: meta.source,
    isFallback: meta.isFallback,
    root: w.root ? {
      id: w.root.id,
      latin: w.root.latin,
      arabic: w.root.arabic,
      transcription: w.root.transcription,
      mean_tr: w.root.mean_tr,
      mean_en: w.root.mean_en
    } : null,
    morphology: {
      pos: w.grammar_pos || '',
      pos_ar: w.grammar_pos_ar || '',
      lemma: w.grammar_lemma || '',
      lemma_ar: w.grammar_lemma_ar || '',
      stem: w.grammar_stem || '',
      root: w.grammar_root || '',
      pattern: w.grammar_pattern || '',
      person: w.grammar_person || '',
      gender: w.grammar_gender || '',
      number: w.grammar_number || '',
      case: w.grammar_case || '',
      mood: w.grammar_mood || '',
      voice: w.grammar_voice || '',
      aspect: w.grammar_aspect || '',
      state: w.grammar_state || '',
      form: w.grammar_form || '',
      i3rab: w.grammar_i3rab || '',
      details: w.grammar_details || null
    }
  }
}

async function fetchSurahs() {
  const { data, error } = await supabase
    .from('surahs')
    .select('id,name,name_en,name_original,slug,verse_count,page_number,audio_mp3,audio_duration,transliteration_tr,transliteration_en,source,is_fallback')
    .order('id')
  if (error) throw error
  return (data || []).map((item) => {
    const meta = withSourceMeta(item)
    return {
      ...item,
      source: meta.source,
      isFallback: meta.isFallback
    }
  })
}

async function fetchSurah(params, mapIdForApi, defaultAuthor) {
  const surahId = safeInt(params.get('id'))
  const authorId = mapIdForApi(safeInt(params.get('author'), defaultAuthor))
  if (surahId < 1 || surahId > 114) throw new Error('Invalid surah id')

  const { data: surah, error: surahError } = await supabase
    .from('surahs')
    .select('*')
    .eq('id', surahId)
    .maybeSingle()
  if (surahError) throw surahError
  if (!surah) throw new Error('Surah not found')

  const { data: verses, error: versesError } = await supabase
    .from('verses')
    .select('id,verse_number,verse_text,verse_simplified,verse_without_vowel,verse_text_uthmani,verse_text_plain,verse_text_tajweed,text_source,text_is_fallback,transcription,transcription_en,page,juz_number')
    .eq('surah_id', surahId)
    .order('verse_number')
  if (versesError) throw versesError

  const verseIds = (verses || []).map((v) => v.id)
  const translationMap = new Map()
  if (verseIds.length > 0) {
    const { data: translations, error: tError } = await supabase
      .from('translations')
      .select('id,verse_id,text,author_id')
      .eq('author_id', authorId)
      .in('verse_id', verseIds)
    if (tError) throw tError
    for (const item of translations || []) {
      translationMap.set(item.verse_id, {
        id: item.id,
        text: item.text,
        author_id: item.author_id
      })
    }
  }

  const surahMeta = withSourceMeta(surah)
  return {
    ...surah,
    source: surahMeta.source,
    isFallback: surahMeta.isFallback,
    verses: (verses || []).map((v) => ({
      ...withSourceMeta(v, 'text_source', 'text_is_fallback'),
      id: v.id,
      verse_number: v.verse_number,
      verse: v.verse_text,
      verse_simplified: v.verse_simplified,
      verse_without_vowel: v.verse_without_vowel,
      text_modes: buildTextModes(v),
      transcription: v.transcription,
      transcription_en: v.transcription_en,
      page: v.page,
      juz_number: v.juz_number,
      translation: translationMap.get(v.id) || null
    }))
  }
}

async function fetchVerse(params, mapIdForApi, defaultAuthor) {
  const surahId = safeInt(params.get('surah'))
  const ayahNo = safeInt(params.get('ayah'))
  const authorId = mapIdForApi(safeInt(params.get('author'), defaultAuthor))
  if (surahId < 1 || surahId > 114 || ayahNo < 1) throw new Error('Invalid verse params')

  const { data: verse, error: verseError } = await supabase
    .from('verses')
    .select('id,surah_id,verse_number,verse_text,verse_simplified,verse_without_vowel,verse_text_uthmani,verse_text_plain,verse_text_tajweed,text_source,text_is_fallback,transcription,transcription_en,audio_mp3,audio_duration,page,juz_number')
    .eq('surah_id', surahId)
    .eq('verse_number', ayahNo)
    .maybeSingle()
  if (verseError) throw verseError
  if (!verse) throw new Error('Verse not found')

  const { data: surah, error: surahError } = await supabase
    .from('surahs')
    .select('id,name,name_en,name_original,slug')
    .eq('id', surahId)
    .maybeSingle()
  if (surahError) throw surahError

  const { data: translation, error: translationError } = await supabase
    .from('translations')
    .select('id,text,author_id')
    .eq('verse_id', verse.id)
    .eq('author_id', authorId)
    .maybeSingle()
  if (translationError) throw translationError

  let author = null
  let footnotes = []
  if (translation) {
    const [{ data: authorData, error: authorError }, { data: footnoteData, error: footnoteError }] = await Promise.all([
      supabase.from('authors').select('id,name,description').eq('id', translation.author_id).maybeSingle(),
      supabase.from('footnotes').select('id,number,text').eq('translation_id', translation.id).order('number')
    ])
    if (authorError) throw authorError
    if (footnoteError) throw footnoteError
    author = authorData || null
    footnotes = footnoteData || []
  }

  const { data: wordsData, error: wordsError } = await supabase
    .from('verse_words')
    .select('id,sort_number,arabic,transcription_tr,transcription_en,translation_tr,translation_en,source,is_fallback,grammar_pos,grammar_pos_ar,grammar_lemma,grammar_lemma_ar,grammar_stem,grammar_root,grammar_pattern,grammar_case,grammar_mood,grammar_person,grammar_gender,grammar_number,grammar_voice,grammar_aspect,grammar_state,grammar_form,grammar_i3rab,grammar_details,root:roots(id,latin,arabic,transcription,mean_tr,mean_en)')
    .eq('verse_id', verse.id)
    .order('sort_number')
  if (wordsError) throw wordsError

  const verseMeta = withSourceMeta(verse, 'text_source', 'text_is_fallback')

  return {
    id: verse.id,
    surah: surah ? {
      id: surah.id,
      name: surah.name,
      name_en: surah.name_en,
      name_original: surah.name_original,
      slug: surah.slug,
    } : { id: surahId, name: `Sure ${surahId}` },
    verse_number: verse.verse_number,
    source: verseMeta.source,
    isFallback: verseMeta.isFallback,
    verse: verse.verse_text,
    verse_simplified: verse.verse_simplified,
    verse_without_vowel: verse.verse_without_vowel,
    text_modes: buildTextModes(verse),
    transcription: verse.transcription,
    transcription_en: verse.transcription_en,
    page: verse.page,
    juz_number: verse.juz_number,
    translation: translation ? {
      id: translation.id,
      text: translation.text,
      author: author ? {
        id: author.id,
        name: author.name,
        description: author.description
      } : { id: authorId, name: 'Diyanet İşleri', description: '' },
      footnotes
    } : null,
    words: (wordsData || []).map(mapWordRow)
  }
}

async function fetchTranslations(params) {
  const surahId = safeInt(params.get('surah'))
  const ayahNo = safeInt(params.get('ayah'))
  if (surahId < 1 || surahId > 114 || ayahNo < 1) throw new Error('Invalid translation params')

  const { data: verse, error: verseError } = await supabase
    .from('verses')
    .select('id')
    .eq('surah_id', surahId)
    .eq('verse_number', ayahNo)
    .maybeSingle()
  if (verseError) throw verseError
  if (!verse) throw new Error('Verse not found')

  const { data: translations, error: translationsError } = await supabase
    .from('translations')
    .select('id,text,author_id')
    .eq('verse_id', verse.id)
  if (translationsError) throw translationsError

  const authorIds = unique((translations || []).map((t) => t.author_id))
  const translationIds = unique((translations || []).map((t) => t.id))

  const [{ data: authors, error: authorsError }, { data: footnotes, error: footnotesError }] = await Promise.all([
    authorIds.length > 0
      ? supabase.from('authors').select('id,name,description,language').in('id', authorIds)
      : Promise.resolve({ data: [], error: null }),
    translationIds.length > 0
      ? supabase.from('footnotes').select('id,translation_id,number,text').in('translation_id', translationIds).order('number')
      : Promise.resolve({ data: [], error: null })
  ])
  if (authorsError) throw authorsError
  if (footnotesError) throw footnotesError

  const authorMap = new Map((authors || []).map((a) => [a.id, a]))
  const footnoteMap = new Map()
  for (const item of footnotes || []) {
    if (!footnoteMap.has(item.translation_id)) footnoteMap.set(item.translation_id, [])
    footnoteMap.get(item.translation_id).push({
      id: item.id,
      number: item.number,
      text: item.text
    })
  }

  return (translations || [])
    .map((t) => {
      const author = authorMap.get(t.author_id)
      if (!author) return null
      return {
        id: t.id,
        text: t.text,
        author: {
          id: author.id,
          name: author.name,
          description: author.description,
          language: author.language
        },
        footnotes: footnoteMap.get(t.id) || []
      }
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aLang = String(a.author.language || '')
      const bLang = String(b.author.language || '')
      if (aLang !== bLang) return aLang.localeCompare(bLang)
      return String(a.author.name || '').localeCompare(String(b.author.name || ''))
    })
}

async function fetchVerseWords(params) {
  const surahId = safeInt(params.get('surah'))
  const ayahNo = safeInt(params.get('ayah'))
  if (surahId < 1 || surahId > 114 || ayahNo < 1) throw new Error('Invalid verse words params')

  const { data: verse, error: verseError } = await supabase
    .from('verses')
    .select('id')
    .eq('surah_id', surahId)
    .eq('verse_number', ayahNo)
    .maybeSingle()
  if (verseError) throw verseError
  if (!verse) throw new Error('Verse not found')

  const { data, error } = await supabase
    .from('verse_words')
    .select('id,sort_number,arabic,transcription_tr,transcription_en,translation_tr,translation_en,source,is_fallback,grammar_pos,grammar_pos_ar,grammar_lemma,grammar_lemma_ar,grammar_stem,grammar_root,grammar_pattern,grammar_case,grammar_mood,grammar_person,grammar_gender,grammar_number,grammar_voice,grammar_aspect,grammar_state,grammar_form,grammar_i3rab,grammar_details,root:roots(id,latin,arabic,transcription,mean_tr,mean_en)')
    .eq('verse_id', verse.id)
    .order('sort_number')
  if (error) throw error

  return (data || []).map(mapWordRow)
}

async function fetchSearch(params, mapIdForApi, defaultAuthor) {
  const query = String(params.get('q') || '').trim()
  const primaryAuthorId = mapIdForApi(safeInt(params.get('primary_author_id'), defaultAuthor))
  let limit = safeInt(params.get('limit'), 20)
  if (limit < 1) limit = 20
  if (limit > 80) limit = 80
  const isArabicQuery = hasArabic(query)
  if (!isArabicQuery && query.length < 2) throw new Error('Search query must be at least 2 characters.')
  if (isArabicQuery && query.length < 1) throw new Error('Search query cannot be empty.')

  const normalizedQuery = isArabicQuery ? normalizeArabicForSearch(query) : query

  const { data: allSurahs, error: surahError } = await supabase
    .from('surahs')
    .select('id,name,name_en,name_original,slug,verse_count,page_number')
    .order('id')
  if (surahError) throw surahError

  const qLower = query.toLocaleLowerCase('tr-TR')
  const numQuery = safeInt(query, 0)
  const surahs = (allSurahs || [])
    .filter((s) => {
      const idMatch = numQuery > 0 && s.id === numQuery
      const nameTr = String(s.name || '').toLocaleLowerCase('tr-TR')
      const nameEn = String(s.name_en || '').toLocaleLowerCase('tr-TR')
      const nameAr = String(s.name_original || '')
      return idMatch || nameTr.includes(qLower) || nameEn.includes(qLower) || nameAr.includes(query)
    })
    .slice(0, 10)

  let verses = []
  if (isArabicQuery) {
    const { data: verseRows, error: verseRowsError } = await supabase
      .from('verses')
      .select('id,surah_id,verse_number,verse_text,verse_simplified,verse_without_vowel,verse_text_plain,transcription,page,juz_number')
      .or(`verse_text.ilike.%${query}%,verse_simplified.ilike.%${normalizedQuery}%,verse_without_vowel.ilike.%${normalizedQuery}%,verse_text_plain.ilike.%${normalizedQuery}%`)
      .order('surah_id')
      .order('verse_number')
      .limit(limit)
    if (verseRowsError) throw verseRowsError

    const verseIds = unique((verseRows || []).map((v) => v.id))
    const surahIds = unique((verseRows || []).map((v) => v.surah_id))
    const [{ data: previewTranslations, error: previewError }, { data: surahRows, error: surahRowsError }, { data: previewAuthors, error: previewAuthorsError }] = await Promise.all([
      verseIds.length > 0
        ? supabase.from('translations').select('verse_id,text,author_id').eq('author_id', primaryAuthorId).in('verse_id', verseIds)
        : Promise.resolve({ data: [], error: null }),
      surahIds.length > 0
        ? supabase.from('surahs').select('id,name,slug').in('id', surahIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('authors').select('id,name,language').eq('id', primaryAuthorId)
    ])
    if (previewError) throw previewError
    if (surahRowsError) throw surahRowsError
    if (previewAuthorsError) throw previewAuthorsError

    const trMap = new Map((previewTranslations || []).map((t) => [t.verse_id, t]))
    const surahMap = new Map((surahRows || []).map((s) => [s.id, s]))
    const author = (previewAuthors || [])[0]

    verses = (verseRows || []).map((v) => ({
      id: v.id,
      surah_id: v.surah_id,
      verse_number: v.verse_number,
      verse_text: v.verse_text,
      transcription: v.transcription,
      page: v.page,
      juz_number: v.juz_number,
      surah_name: surahMap.get(v.surah_id)?.name || '',
      surah_slug: surahMap.get(v.surah_id)?.slug || '',
      translation_text: trMap.get(v.id)?.text || '',
      translation_language: author?.language || 'tr',
      translation_author: author?.name || ''
    }))
  } else {
    const { data: translationRows, error: translationRowsError } = await supabase
      .from('translations')
      .select('id,verse_id,text,author_id')
      .ilike('text', `%${query}%`)
      .limit(limit * 2)
    if (translationRowsError) throw translationRowsError

    const authorIds = unique((translationRows || []).map((t) => t.author_id))
    const verseIds = unique((translationRows || []).map((t) => t.verse_id))

    const [{ data: authorRows, error: authorRowsError }, { data: verseRows, error: verseRowsError }] = await Promise.all([
      authorIds.length > 0
        ? supabase.from('authors').select('id,name,language').in('id', authorIds)
        : Promise.resolve({ data: [], error: null }),
      verseIds.length > 0
        ? supabase.from('verses').select('id,surah_id,verse_number,verse_text,transcription,page,juz_number').in('id', verseIds)
        : Promise.resolve({ data: [], error: null })
    ])
    if (authorRowsError) throw authorRowsError
    if (verseRowsError) throw verseRowsError

    const eligibleAuthors = new Map(
      (authorRows || [])
        .filter((a) => ['tr', 'en'].includes(String(a.language || '').toLowerCase()))
        .map((a) => [a.id, a])
    )
    const verseMap = new Map((verseRows || []).map((v) => [v.id, v]))
    const surahIds = unique((verseRows || []).map((v) => v.surah_id))
    const { data: surahRows, error: surahRowsError } = surahIds.length > 0
      ? await supabase.from('surahs').select('id,name,slug').in('id', surahIds)
      : { data: [], error: null }
    if (surahRowsError) throw surahRowsError
    const surahMap = new Map((surahRows || []).map((s) => [s.id, s]))

    verses = (translationRows || [])
      .map((t) => {
        const author = eligibleAuthors.get(t.author_id)
        const verse = verseMap.get(t.verse_id)
        if (!author || !verse) return null
        return {
          id: verse.id,
          surah_id: verse.surah_id,
          verse_number: verse.verse_number,
          verse_text: verse.verse_text,
          transcription: verse.transcription,
          page: verse.page,
          juz_number: verse.juz_number,
          surah_name: surahMap.get(verse.surah_id)?.name || '',
          surah_slug: surahMap.get(verse.surah_id)?.slug || '',
          translation_text: t.text,
          translation_language: author.language,
          translation_author: author.name
        }
      })
      .filter(Boolean)
      .sort((a, b) => (a.surah_id - b.surah_id) || (a.verse_number - b.verse_number))
      .slice(0, limit)
  }

  return {
    query,
    is_arabic: isArabicQuery,
    surahs,
    verses,
    total: (surahs?.length || 0) + (verses?.length || 0)
  }
}

async function fetchPage(params, mapIdForApi, defaultAuthor) {
  const pageNumber = safeInt(params.get('page'))
  const authorId = mapIdForApi(safeInt(params.get('author'), defaultAuthor))
  if (pageNumber < 1) throw new Error('Invalid page number')

  const { data: verseRows, error: verseRowsError } = await supabase
    .from('verses')
    .select('id,surah_id,verse_number,verse_text,verse_simplified,verse_without_vowel,verse_text_uthmani,verse_text_plain,verse_text_tajweed,text_source,text_is_fallback,transcription,transcription_en,page,juz_number,surah:surahs(id,name,name_en,name_original,slug)')
    .eq('page', pageNumber)
    .order('surah_id')
    .order('verse_number')
  if (verseRowsError) throw verseRowsError

  const verseIds = unique((verseRows || []).map((v) => v.id))
  const { data: translations, error: tError } = verseIds.length > 0
    ? await supabase
      .from('translations')
      .select('id,verse_id,text,author_id')
      .eq('author_id', authorId)
      .in('verse_id', verseIds)
    : { data: [], error: null }
  if (tError) throw tError
  const tMap = new Map((translations || []).map((t) => [t.verse_id, t]))

  return (verseRows || []).map((v) => ({
    id: v.id,
    ...withSourceMeta(v, 'text_source', 'text_is_fallback'),
    surah: v.surah ? {
      id: v.surah.id,
      name: v.surah.name,
      name_en: v.surah.name_en,
      name_original: v.surah.name_original,
      slug: v.surah.slug
    } : null,
    verse_number: v.verse_number,
    verse: v.verse_text,
    verse_simplified: v.verse_simplified,
    verse_without_vowel: v.verse_without_vowel,
    text_modes: buildTextModes(v),
    transcription: v.transcription,
    transcription_en: v.transcription_en,
    page: v.page,
    juz_number: v.juz_number,
    translation: tMap.get(v.id) ? {
      id: tMap.get(v.id).id,
      text: tMap.get(v.id).text,
      author: { id: tMap.get(v.id).author_id }
    } : null
  }))
}

async function fetchRoot(params) {
  const rootId = safeInt(params.get('id'))
  const latin = String(params.get('latin') || '').trim()

  let query = supabase.from('roots').select('id,latin,arabic,transcription,mean_tr,mean_en')
  if (rootId > 0) query = query.eq('id', rootId)
  else if (latin) query = query.eq('latin', latin)
  else throw new Error('Provide either id or latin')

  const { data: root, error: rootError } = await query.maybeSingle()
  if (rootError) throw rootError
  if (!root) throw new Error('Root not found')

  const { count, error: countError } = await supabase
    .from('verse_words')
    .select('*', { count: 'exact', head: true })
    .eq('root_id', root.id)
  if (countError) throw countError

  const { data: words, error: wordsError } = await supabase
    .from('verse_words')
    .select('verse_id,arabic,translation_tr')
    .eq('root_id', root.id)
    .order('verse_id')
    .limit(200)
  if (wordsError) throw wordsError

  const firstByVerse = new Map()
  for (const item of words || []) {
    if (!firstByVerse.has(item.verse_id)) firstByVerse.set(item.verse_id, item)
  }
  const verseIds = unique([...firstByVerse.keys()]).slice(0, 40)
  const { data: verses, error: versesError } = verseIds.length > 0
    ? await supabase.from('verses').select('id,surah_id,verse_number,verse_text').in('id', verseIds)
    : { data: [], error: null }
  if (versesError) throw versesError
  const surahIds = unique((verses || []).map((v) => v.surah_id))
  const { data: surahRows, error: surahRowsError } = surahIds.length > 0
    ? await supabase.from('surahs').select('id,name').in('id', surahIds)
    : { data: [], error: null }
  if (surahRowsError) throw surahRowsError

  const surahMap = new Map((surahRows || []).map((s) => [s.id, s.name]))
  const sampleVerses = (verses || [])
    .sort((a, b) => (a.surah_id - b.surah_id) || (a.verse_number - b.verse_number))
    .slice(0, 10)
    .map((v) => ({
      surah_id: v.surah_id,
      verse_number: v.verse_number,
      verse_text: v.verse_text,
      surah_name: surahMap.get(v.surah_id) || '',
      arabic: firstByVerse.get(v.id)?.arabic || '',
      translation_tr: firstByVerse.get(v.id)?.translation_tr || ''
    }))

  return {
    id: root.id,
    latin: root.latin,
    arabic: root.arabic,
    transcription: root.transcription,
    mean_tr: root.mean_tr,
    mean_en: root.mean_en,
    usage_count: count || 0,
    sample_verses: sampleVerses
  }
}

export async function fetchSupabaseEndpoint(endpoint, { mapIdForApi, defaultAuthor }) {
  const [rawPath, rawQuery = ''] = String(endpoint || '').split('?')
  const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  const params = new URLSearchParams(rawQuery)

  switch (path) {
    case '/surahs.php':
      return fetchSurahs()
    case '/surah.php':
      return fetchSurah(params, mapIdForApi, defaultAuthor)
    case '/verse.php':
      return fetchVerse(params, mapIdForApi, defaultAuthor)
    case '/translations.php':
      return fetchTranslations(params)
    case '/verse_words.php':
      return fetchVerseWords(params)
    case '/search.php':
      return fetchSearch(params, mapIdForApi, defaultAuthor)
    case '/page.php':
      return fetchPage(params, mapIdForApi, defaultAuthor)
    case '/root.php':
      return fetchRoot(params)
    default:
      return null
  }
}

