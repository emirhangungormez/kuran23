import fs from 'node:fs'
import path from 'node:path'

import { buildTafsirSpeechQueue, stripHtmlForSpeech } from '../src/services/tafsirSpeech.js'
import { TEFSIR_LIBRARY_BOOKS } from '../src/data/tefsirLibraryCatalog.js'

const ROOT = path.resolve('.')
const LIBRARY_DIR = path.join(ROOT, 'public', 'tafsir-library')
const CANDIDATES_PATH = path.join(ROOT, 'tmp', 'tts-lexicon-focused', 'lexicon-candidates.json')
const GROUPS_PATH = path.join(ROOT, 'tmp', 'tts-lexicon-focused', 'lemma-groups-top1000.json')
const REPORT_DIR = path.join(ROOT, 'reports', 'tts')
const SAMPLE_FILENAME = 'tts-batch-test-samples.json'
const MISREAD_REPORT_FILENAME = 'tts-misread-report.md'
const BOOK_EXCEPTIONS_FILENAME = 'tts-book-exceptions-candidates.json'
const NEXT_STEP_FILENAME = 'tts-next-step-recommendation.md'
const SAMPLE_SURAH = '001.json'
const MAX_SAMPLE_CHARS = 560
const MIN_SENTENCE_CHARS = 48

const TOKEN_REGEX = /[\p{Script=Latin}'’\-]+/gu
const LETTER_APOSTROPHE_REGEX = /([A-Za-zÇĞİÖŞÜçğıöşü])'([A-Za-zÇĞİÖŞÜçğıöşü])/gu
const COMBINING_MARK_REGEX = /[\u0300-\u036f]/gu
const SPECIALIZED_HINT_REGEX = /(ullah|iddin|uddin|te['’]?vil|me['’]?al|n[üu]z[üu]l|k[ıi]raat|ubudiyet|n[üu]b[üu]vvet|m[üu]te[sş]abih|marifetullah|muhabbetullah|esma[-\s]?i?\s*h[üu]sna|aleyhisselam|sallallahu|radiyallahu|teala|cenab|binaenaleyh|mesela|ahiret|mucize|katade|beyhaki|tirmizi|buhari|taberi|beydavi|nesefi|suyuti|maturidi|mukatil|musa|isa|yusuf|yakub|nuh|lut|harun|davud)/iu
const CIRCUMFLEX_REGEX = /[âîûÂÎÛ]/u
const APOSTROPHE_REGEX = /['’]/u
const HYPHEN_REGEX = /-/u
const SENTENCE_SPLIT_REGEX = /(?<=[.!?…])\s+/u
const SURFACE_SUFFIX_REGEX = /^(?:da|de|ta|te|dan|den|tan|ten|a|e|ya|ye|i|ı|u|ü|yi|yı|yu|yü|in|ın|un|ün|nin|nın|nun|nün|na|ne|nda|nde|ndan|nden|ında|inde|unda|ünde|ından|inden|undan|ünden|la|le|yla|yle|lar|ler|lari|leri|ların|lerin|im|ım|um|üm|dir|dır|dur|dür|tir|tır|tur|tür|siz|sız|suz|süz|li|lı|lu|lü)$/iu

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function normalizeQuotes(value) {
  return String(value || '').replace(/[\u2019'`\u00b4]/gu, "'")
}

function normalizeTokenKey(value) {
  return normalizeQuotes(value)
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('tr-TR')
}

function normalizeCompareKey(value) {
  return normalizeQuotes(value)
    .normalize('NFKC')
    .replace(COMBINING_MARK_REGEX, '')
    .replace(/kâ/giu, 'kaa')
    .replace(/gâ/giu, 'gaa')
    .replace(/lâ/giu, 'laa')
    .replace(/â/giu, 'aa')
    .replace(/î/giu, 'ii')
    .replace(/û/giu, 'uu')
    .replace(LETTER_APOSTROPHE_REGEX, '$1$2')
    .replace(/\b([A-Za-zÇĞİÖŞÜçğıöşü]+)-([ıiuüİIUÜ])\b/gu, '$1$2')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(COMBINING_MARK_REGEX, '')
    .replace(/[^a-z0-9çğıöşü]/gu, '')
}

function normalizeOnlyForSpeech(value) {
  return normalizeQuotes(value)
    .normalize('NFKC')
    .replace(COMBINING_MARK_REGEX, '')
    .replace(/kâ/giu, 'kaa')
    .replace(/gâ/giu, 'gaa')
    .replace(/lâ/giu, 'laa')
    .replace(/â/giu, 'aa')
    .replace(/î/giu, 'ii')
    .replace(/û/giu, 'uu')
    .replace(LETTER_APOSTROPHE_REGEX, '$1$2')
    .replace(/\b([A-Za-zÇĞİÖŞÜçğıöşü]+)-([ıiuüİIUÜ])\b/gu, '$1$2')
    .replace(/\s+/gu, ' ')
    .trim()
}

function tokenize(text) {
  return (String(text || '').match(TOKEN_REGEX) || [])
    .map((token) => normalizeQuotes(token).trim())
    .filter(Boolean)
}

function splitSentences(text) {
  const raw = String(text || '').trim()
  if (!raw) return []

  const base = raw
    .split(SENTENCE_SPLIT_REGEX)
    .map((part) => part.trim())
    .filter(Boolean)

  const merged = []
  base.forEach((sentence) => {
    if (!merged.length) {
      merged.push(sentence)
      return
    }
    if (sentence.length < MIN_SENTENCE_CHARS) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${sentence}`.trim()
      return
    }
    merged.push(sentence)
  })
  return merged
}

function createWindows(sentences) {
  const windows = []
  for (let i = 0; i < sentences.length; i += 1) {
    for (let size = 2; size <= 4; size += 1) {
      const slice = sentences.slice(i, i + size)
      if (!slice.length) continue
      const text = slice.join(' ').trim()
      if (!text || text.length > MAX_SAMPLE_CHARS) continue
      windows.push(text)
    }
  }
  return windows.length ? windows : sentences.slice(0, 2).map((item) => item.trim()).filter(Boolean)
}

function getExcerpt(text, token, radius = 100) {
  const source = String(text || '')
  const needle = String(token || '')
  if (!source || !needle) return source.slice(0, radius * 2).trim()
  const index = source.toLocaleLowerCase('tr-TR').indexOf(needle.toLocaleLowerCase('tr-TR'))
  if (index < 0) return source.slice(0, radius * 2).trim()
  const start = Math.max(0, index - radius)
  const end = Math.min(source.length, index + needle.length + radius)
  return source.slice(start, end).trim()
}

const speechCache = new Map()
function prepareForSpeech(text) {
  const source = String(text || '').trim()
  if (!source) return ''
  if (speechCache.has(source)) return speechCache.get(source)

  const queue = buildTafsirSpeechQueue(source, {
    maxChunkLength: 240,
    useArabicDiacritics: true,
    aggressiveArabicNormalization: false
  })

  const prepared = queue.map((item) => String(item?.text || '').trim()).filter(Boolean).join(' ').replace(/\s+/gu, ' ').trim()
  speechCache.set(source, prepared)
  return prepared
}

function splitTokenRootAndSuffix(token) {
  const source = normalizeQuotes(token)
  const indexes = []
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "'") indexes.push(i)
  }
  if (!indexes.length) return { root: source, suffix: '', hasSuffix: false }

  const lastIndex = indexes[indexes.length - 1]
  const suffix = source.slice(lastIndex + 1)
  if (!SURFACE_SUFFIX_REGEX.test(suffix)) {
    return { root: source, suffix: '', hasSuffix: false }
  }

  return {
    root: source.slice(0, lastIndex),
    suffix,
    hasSuffix: true
  }
}

function deriveExpectedSpeech(token, candidate, group) {
  const split = splitTokenRootAndSuffix(token)
  if (candidate?.suggestedPronunciation) {
    const candidateSpeech = prepareForSpeech(candidate.suggestedPronunciation)
    if (!split.hasSuffix) return candidateSpeech

    const suffixSpeech = normalizeOnlyForSpeech(split.suffix)
    const rootSpeech = prepareForSpeech(split.root || token)
    const candidateKey = normalizeCompareKey(candidateSpeech)
    const rootKey = normalizeCompareKey(rootSpeech)
    const suffixKey = normalizeCompareKey(suffixSpeech)
    const combined = `${candidateSpeech}${suffixSpeech}`

    if (candidateKey === rootKey) return combined
    if (candidateKey.startsWith(rootKey) && candidateKey.endsWith(suffixKey)) return candidateSpeech
    return candidateSpeech
  }

  const rootSource = group?.temsilKok || group?.onerilenOkunus || split.root || token
  const rootSpeech = prepareForSpeech(rootSource)
  if (!split.hasSuffix) return rootSpeech

  const suffixSpeech = normalizeOnlyForSpeech(split.suffix)
  const combined = `${rootSpeech}${suffixSpeech}`

  return combined
}

function buildCandidateMaps() {
  const candidatePayload = loadJson(CANDIDATES_PATH)
  const groupPayload = loadJson(GROUPS_PATH)

  const candidates = Array.isArray(candidatePayload.candidates) ? candidatePayload.candidates : []
  const groups = Array.isArray(groupPayload.groups) ? groupPayload.groups : []

  const candidateMap = new Map()
  candidates.forEach((entry) => {
    const key = normalizeTokenKey(entry.token)
    if (!key) return
    const existing = candidateMap.get(key)
    if (!existing || Number(entry.count || 0) > Number(existing.count || 0)) {
      candidateMap.set(key, entry)
    }
  })

  const surfaceGroupMap = new Map()
  groups.forEach((group) => {
    const surfaces = Array.isArray(group.yuzeyFormlar) ? group.yuzeyFormlar : []
    surfaces.forEach((surface) => {
      const key = normalizeTokenKey(surface)
      if (!key || surfaceGroupMap.has(key)) return
      surfaceGroupMap.set(key, group)
    })

    const rootKey = normalizeTokenKey(group.temsilKok)
    if (rootKey && !surfaceGroupMap.has(rootKey)) surfaceGroupMap.set(rootKey, group)
  })

  return { candidateMap, surfaceGroupMap }
}

function shouldInspectToken(token, candidate) {
  if (candidate) return true
  return CIRCUMFLEX_REGEX.test(token)
    || APOSTROPHE_REGEX.test(token)
    || HYPHEN_REGEX.test(token)
    || SPECIALIZED_HINT_REGEX.test(token)
}

function buildTokenAnalyses(cleanText, candidateMap, surfaceGroupMap) {
  const tokens = tokenize(cleanText)
  const tokenCounts = new Map()
  tokens.forEach((token) => {
    const key = normalizeTokenKey(token)
    if (!key) return
    const bucket = tokenCounts.get(key) || { token, count: 0 }
    bucket.count += 1
    if (token.length > bucket.token.length) bucket.token = token
    tokenCounts.set(key, bucket)
  })

  const analyses = []
  tokenCounts.forEach(({ token, count }, key) => {
    const candidate = candidateMap.get(key) || null
    const group = surfaceGroupMap.get(key) || null
    if (!shouldInspectToken(token, candidate)) return

    const normalizeOnly = normalizeOnlyForSpeech(token)
    const actualSpeech = prepareForSpeech(token)
    const expectedSpeech = candidate || group
      ? deriveExpectedSpeech(token, candidate, group)
      : ''

    const isCandidateBacked = Boolean(candidate && candidate.sameAsOriginal !== true && expectedSpeech)
    const actualKey = normalizeCompareKey(actualSpeech)
    const expectedKey = normalizeCompareKey(expectedSpeech)
    const candidateKey = normalizeCompareKey(candidate?.suggestedPronunciation ? prepareForSpeech(candidate.suggestedPronunciation) : '')
    const suffixSurfaceCovered = Boolean(
      isCandidateBacked
      && candidateKey
      && (APOSTROPHE_REGEX.test(token) || HYPHEN_REGEX.test(token))
      && actualKey !== candidateKey
      && actualKey.startsWith(candidateKey)
    )
    const isMismatch = isCandidateBacked
      && actualKey !== expectedKey
      && !suffixSurfaceCovered

    analyses.push({
      key,
      token,
      count,
      candidate,
      group,
      normalizeOnly,
      actualSpeech,
      expectedSpeech,
      isCandidateBacked,
      isMismatch,
      reasons: Array.isArray(candidate?.reason) ? candidate.reason : []
    })
  })

  return analyses.sort((a, b) => b.count - a.count || String(a.token).localeCompare(String(b.token), 'tr'))
}

function classifyIssue(record, tokenBookCounts) {
  const candidate = record.candidate
  const group = record.group
  const bookSpread = tokenBookCounts.get(record.key) || 1
  const fileSpread = Number(candidate?.fileCount || 0)
  const rootKey = normalizeCompareKey(group?.temsilKok || '')
  const tokenKey = normalizeCompareKey(record.token)
  const exactRoot = Boolean(rootKey && tokenKey === rootKey)
  const normalizeMiss = record.actualSpeech === record.normalizeOnly && record.expectedSpeech && record.expectedSpeech !== record.normalizeOnly
  const bookSpecificSignal = bookSpread === 1 || (fileSpread > 0 && fileSpread <= 3)
  const suffixSurfaceSignal = APOSTROPHE_REGEX.test(record.token) || HYPHEN_REGEX.test(record.token)

  if (normalizeMiss && group?.kuralDurumu === 'Kabul' && exactRoot) return 'regex_miss'
  if (normalizeMiss && (bookSpecificSignal || suffixSurfaceSignal)) return 'exception_needed'
  if (normalizeMiss) return 'normalize_miss'
  if (bookSpecificSignal) return 'book_orthography'
  if (group?.kuralDurumu !== 'Kabul') return 'exception_needed'
  if (suffixSurfaceSignal) return 'exception_needed'
  return 'normalize_miss'
}

function issueTypeLabel(issueType) {
  switch (issueType) {
    case 'regex_miss':
      return 'Yanlis regex kacagi'
    case 'book_orthography':
      return 'Kitap / muellif imla farki'
    case 'exception_needed':
      return 'Lemma yerine exception gerek'
    default:
      return 'Normalize akisina ragmen eslesmeyen'
  }
}

function buildBooksToAnalyze() {
  return TEFSIR_LIBRARY_BOOKS
    .map((book) => ({
      ...book,
      filePath: path.join(LIBRARY_DIR, book.sourceId, SAMPLE_SURAH)
    }))
    .filter((book) => fs.existsSync(book.filePath))
}

function analyzeBooks() {
  const { candidateMap, surfaceGroupMap } = buildCandidateMaps()
  const books = buildBooksToAnalyze()
  const tokenBookCounts = new Map()
  const unresolved = []
  const perBook = []

  books.forEach((book) => {
    const payload = loadJson(book.filePath)
    const cleanText = stripHtmlForSpeech(payload.surahHtml || '')
    const tokenAnalyses = buildTokenAnalyses(cleanText, candidateMap, surfaceGroupMap)

    const sensitiveOccurrences = tokenAnalyses.reduce((sum, item) => sum + item.count, 0)
    const candidateOccurrences = tokenAnalyses.filter((item) => item.isCandidateBacked).reduce((sum, item) => sum + item.count, 0)
    const coveredOccurrences = tokenAnalyses.filter((item) => item.isCandidateBacked && !item.isMismatch).reduce((sum, item) => sum + item.count, 0)
    const unresolvedItems = tokenAnalyses.filter((item) => item.isMismatch)

    unresolvedItems.forEach((item) => {
      tokenBookCounts.set(item.key, (tokenBookCounts.get(item.key) || 0) + 1)
    })

    perBook.push({
      book,
      cleanText,
      tokenAnalyses,
      unresolvedItems,
      stats: {
        sensitiveOccurrences,
        candidateOccurrences,
        coveredOccurrences,
        unresolvedOccurrences: unresolvedItems.reduce((sum, item) => sum + item.count, 0)
      }
    })
  })

  perBook.forEach((bookEntry) => {
    bookEntry.unresolvedItems.forEach((item) => {
      const issueType = classifyIssue(item, tokenBookCounts)
      unresolved.push({
        bookId: bookEntry.book.sourceId,
        bookTitle: bookEntry.book.titleTr,
        author: bookEntry.book.authorTr,
        issueType,
        issueLabel: issueTypeLabel(issueType),
        token: item.token,
        tokenKey: item.key,
        localCount: item.count,
        globalCount: Number(item.candidate?.count || 0),
        globalFileCount: Number(item.candidate?.fileCount || 0),
        reasons: item.reasons,
        suggestedPronunciation: String(item.candidate?.suggestedPronunciation || ''),
        actualSpeech: item.actualSpeech,
        expectedSpeech: item.expectedSpeech,
        normalizeOnly: item.normalizeOnly,
        groupStatus: String(item.group?.kuralDurumu || ''),
        groupRoot: String(item.group?.temsilKok || ''),
        excerpt: getExcerpt(bookEntry.cleanText, item.token),
        bookSpread: tokenBookCounts.get(item.key) || 1
      })
    })
  })

  return { books, perBook, unresolved, tokenBookCounts }
}

function pickSampleWindow(bookEntry, unresolvedMap, sensitiveMap) {
  const sentences = splitSentences(bookEntry.cleanText)
  const windows = createWindows(sentences)
  let best = { text: bookEntry.cleanText.slice(0, MAX_SAMPLE_CHARS).trim(), score: -1 }

  windows.forEach((windowText) => {
    const tokens = tokenize(windowText)
    let score = 0
    tokens.forEach((token) => {
      const key = normalizeTokenKey(token)
      if (!key) return
      if (unresolvedMap.has(key)) score += 8
      else if (sensitiveMap.has(key)) score += 2
    })
    score += Math.min(6, Math.floor(windowText.length / 120))
    if (score > best.score) best = { text: windowText, score }
  })

  const flagged = []
  tokenize(best.text).forEach((token) => {
    const key = normalizeTokenKey(token)
    if (!key || !unresolvedMap.has(key)) return
    const record = unresolvedMap.get(key)
    if (flagged.some((item) => item.tokenKey === key)) return
    flagged.push({
      tokenKey: key,
      token: record.token,
      issueType: record.issueType,
      issueLabel: record.issueLabel,
      actualSpeech: record.actualSpeech,
      expectedSpeech: record.expectedSpeech,
      localCount: record.localCount,
      reasons: record.reasons
    })
  })

  return {
    text: best.text,
    speechReadyText: prepareForSpeech(best.text),
    flaggedIssues: flagged
  }
}

function buildSamples(perBook, unresolved) {
  const unresolvedByBook = new Map()
  unresolved.forEach((record) => {
    const bucket = unresolvedByBook.get(record.bookId) || new Map()
    bucket.set(record.tokenKey, record)
    unresolvedByBook.set(record.bookId, bucket)
  })

  return perBook.map((bookEntry) => {
    const sensitiveMap = new Map(bookEntry.tokenAnalyses.map((item) => [item.key, item]))
    const unresolvedMap = unresolvedByBook.get(bookEntry.book.sourceId) || new Map()
    const selected = pickSampleWindow(bookEntry, unresolvedMap, sensitiveMap)

    return {
      bookId: bookEntry.book.sourceId,
      bookTitle: bookEntry.book.titleTr,
      author: bookEntry.book.authorTr,
      surahId: 1,
      sampleText: selected.text,
      speechReadyText: selected.speechReadyText,
      sensitiveTokenCount: bookEntry.stats.sensitiveOccurrences,
      unresolvedTokenCount: bookEntry.stats.unresolvedOccurrences,
      candidateCoverageRatio: bookEntry.stats.candidateOccurrences > 0
        ? Number((bookEntry.stats.coveredOccurrences / bookEntry.stats.candidateOccurrences).toFixed(4))
        : 1,
      flaggedIssues: selected.flaggedIssues
    }
  }).sort((a, b) => b.unresolvedTokenCount - a.unresolvedTokenCount || a.bookTitle.localeCompare(b.bookTitle, 'tr'))
}

function buildBookExceptions(perBook, unresolved) {
  const unresolvedByBook = new Map()
  unresolved.forEach((record) => {
    if (record.issueType !== 'book_orthography' && record.issueType !== 'exception_needed') return
    const bucket = unresolvedByBook.get(record.bookId) || []
    bucket.push(record)
    unresolvedByBook.set(record.bookId, bucket)
  })

  return perBook
    .map((bookEntry) => {
      const bucket = unresolvedByBook.get(bookEntry.book.sourceId) || []
      const candidates = bucket
        .slice()
        .sort((a, b) => b.localCount - a.localCount || b.globalCount - a.globalCount)
        .slice(0, 12)
        .map((record) => ({
          token: record.token,
          issueType: record.issueType,
          issueLabel: record.issueLabel,
          localCount: record.localCount,
          globalCount: record.globalCount,
          globalFileCount: record.globalFileCount,
          suggestedPronunciation: record.suggestedPronunciation,
          actualSpeech: record.actualSpeech,
          expectedSpeech: record.expectedSpeech,
          normalizeOnly: record.normalizeOnly,
          reasons: record.reasons,
          excerpt: record.excerpt
        }))

      return {
        bookId: bookEntry.book.sourceId,
        bookTitle: bookEntry.book.titleTr,
        author: bookEntry.book.authorTr,
        candidates
      }
    })
    .filter((entry) => entry.candidates.length > 0)
    .sort((a, b) => b.candidates.length - a.candidates.length || a.bookTitle.localeCompare(b.bookTitle, 'tr'))
}

function buildSummary(perBook, unresolved) {
  const totals = {
    booksAnalyzed: perBook.length,
    sensitiveOccurrences: 0,
    candidateOccurrences: 0,
    coveredOccurrences: 0,
    unresolvedOccurrences: 0
  }

  perBook.forEach((bookEntry) => {
    totals.sensitiveOccurrences += bookEntry.stats.sensitiveOccurrences
    totals.candidateOccurrences += bookEntry.stats.candidateOccurrences
    totals.coveredOccurrences += bookEntry.stats.coveredOccurrences
    totals.unresolvedOccurrences += bookEntry.stats.unresolvedOccurrences
  })

  const issueCounts = new Map()
  unresolved.forEach((record) => {
    issueCounts.set(record.issueType, (issueCounts.get(record.issueType) || 0) + record.localCount)
  })

  return {
    ...totals,
    candidateCoverageRatio: totals.candidateOccurrences > 0
      ? Number((totals.coveredOccurrences / totals.candidateOccurrences).toFixed(4))
      : 1,
    unresolvedUniqueTokens: unresolved.length,
    issueCounts: Object.fromEntries([...issueCounts.entries()].sort((a, b) => b[1] - a[1]))
  }
}

function buildMisreadReport(summary, samples, unresolved, bookExceptions) {
  const topExamples = unresolved
    .slice()
    .sort((a, b) => b.localCount - a.localCount || b.globalCount - a.globalCount)
    .slice(0, 30)

  const section = (title, records) => {
    const lines = [`## ${title}`, '']
    if (!records.length) {
      lines.push('- Yok veya bu batch setinde anlamli bir kacik bulunmadi.', '')
      return lines
    }
    records.slice(0, 12).forEach((record) => {
      lines.push(`- ${record.bookTitle}: \`${record.token}\` -> mevcut: \`${record.actualSpeech}\`, beklenen: \`${record.expectedSpeech}\``)
      lines.push(`  - Neden: ${record.issueLabel}`)
      lines.push(`  - Ornek: ${record.excerpt}`)
    })
    lines.push('')
    return lines
  }

  const lines = [
    '# TTS Misread Report',
    '',
    '## Ozet',
    '',
    `- Analiz edilen kitap sayisi: ${summary.booksAnalyzed}`,
    `- Hassas token gecisi: ${summary.sensitiveOccurrences}`,
    `- Candidate-backed token gecisi: ${summary.candidateOccurrences}`,
    `- Mevcut 187 lemma + mevcut runtime ile kapsanan candidate-backed gecis: ${summary.coveredOccurrences}`,
    `- Candidate-backed kapsama orani: ${summary.candidateCoverageRatio}`,
    `- Kalan sorunlu token gecisi: ${summary.unresolvedOccurrences}`,
    `- Kalan sorunlu benzersiz token: ${summary.unresolvedUniqueTokens}`,
    '',
    '## Hata Tipi Siniflandirmasi',
    '',
    ...(Object.keys(summary.issueCounts).length
      ? Object.entries(summary.issueCounts).map(([key, value]) => `- ${issueTypeLabel(key)}: ${value}`)
      : ['- Kalan anlamli hata yok.']),
    '',
    '## Temsili Test Pasajlari',
    '',
    ...samples.map((sample) => `- ${sample.bookTitle}: unresolved ${sample.unresolvedTokenCount}, coverage ${sample.candidateCoverageRatio}, pasaj: ${sample.sampleText}`),
    '',
    '## Yanlis Okunan Ornekler Listesi',
    ''
  ]

  topExamples.forEach((record) => {
    lines.push(`- ${record.bookTitle} / \`${record.token}\``)
    lines.push(`  - Mevcut cikti: \`${record.actualSpeech}\``)
    lines.push(`  - Beklenen: \`${record.expectedSpeech}\``)
    lines.push(`  - Tip: ${record.issueLabel}`)
    lines.push(`  - Global frekans: ${record.globalCount}, kitap ici tekrar: ${record.localCount}`)
  })
  lines.push('')

  lines.push(...section('Normalize akisina ragmen eslesmeyen kelimeler', unresolved.filter((item) => item.issueType === 'normalize_miss')))
  lines.push(...section('Yanlis regex yuzunden kacanlar', unresolved.filter((item) => item.issueType === 'regex_miss')))
  lines.push(...section('Kitap / muellif ozel imla farklari', unresolved.filter((item) => item.issueType === 'book_orthography')))
  lines.push(...section('Lemma ile cozulmeyip exception gerektiren ornekler', unresolved.filter((item) => item.issueType === 'exception_needed')))

  lines.push('## Kitap Bazli Exception Adaylari', '')
  if (!bookExceptions.length) {
    lines.push('- Guclu kitap-bazli exception adayi cikmadi.', '')
  } else {
    bookExceptions.forEach((entry) => {
      lines.push(`- ${entry.bookTitle}`)
      entry.candidates.slice(0, 5).forEach((candidate) => {
        lines.push(`  - \`${candidate.token}\` -> ${candidate.issueLabel} (kitap ici ${candidate.localCount}, global dosya ${candidate.globalFileCount || 0})`)
      })
    })
    lines.push('')
  }

  return `${lines.join('\n')}\n`
}

function buildNextStepRecommendation(summary, unresolved) {
  const weightedTargeted = unresolved
    .filter((item) => item.issueType === 'book_orthography' || item.issueType === 'exception_needed')
    .reduce((sum, item) => sum + item.localCount, 0)
  const weightedGeneral = unresolved
    .filter((item) => item.issueType === 'normalize_miss' || item.issueType === 'regex_miss')
    .reduce((sum, item) => sum + item.localCount, 0)
  const regexMissCount = unresolved.filter((item) => item.issueType === 'regex_miss').length

  if (summary.unresolvedOccurrences === 0) {
    const lines = [
      '# TTS Next Step Recommendation',
      '',
      '- Karar: Top3000 genislemesine gecme.',
      `- Candidate-backed kapsama orani: ${summary.candidateCoverageRatio}`,
      '- Kalan sorunlu token gecisi: 0',
      '- Kalan benzersiz token: 0',
      '',
      '## Gerekce',
      '',
      '- Mevcut batch setinde anlamli kalan hata yok.',
      '- Yeni hata sinifi dogmadi.',
      '- Hedefli runtime exception kalan yuzey formu kapatti.',
      '',
      '## Onerilen Sirali Sonraki Adimlar',
      '',
      '1. Top3000 genislemesine bu asamada gecme.',
      '2. Yeni gercek hata ornekleri birikirse ayni batch analizini tekrar kos.',
      '3. Exception setini dar tut; benzer ama farkli yuzey formlari veri gelmeden genisletme.',
      ''
    ]

    return `${lines.join('\n')}\n`
  }

  const shouldDelayTop3000 = weightedTargeted >= weightedGeneral && regexMissCount <= 3
  const verdict = shouldDelayTop3000
    ? 'Top3000 genislemesine simdi gecmek gerekli degil.'
    : 'Top3000 genislemesi hedefli duzeltmelerle paralel dusunulebilir.'

  const reasons = shouldDelayTop3000
    ? [
        `Kalan sorunlarin agirlikli kismi kitap-bazli veya yuzey-form exception tipinde: ${weightedTargeted}`,
        `Genel normalize/regex kaynakli kalan yuk: ${weightedGeneral}`,
        `Dogrudan regex kacagi sayisi dusuk: ${regexMissCount}`
      ]
    : [
        `Genel normalize/regex kaynakli kalan yuk hala yuksek: ${weightedGeneral}`,
        `Hedefli exceptionlar tek basina yeterli olmayabilir.`
      ]

  const nextActions = shouldDelayTop3000
    ? [
        'En cok tekrarlanan exception adaylari icin kitap-bazli mini sozluk cikar.',
        'Cok tekrarli apostrof / izafet formlarini ayri exception katmanina al.',
        'Regex kacagi gorunen az sayidaki exact-root formu duzelt ve batch testi yeniden kos.'
      ]
    : [
        'Top3000 once yeni batch raporundaki genel kalan kokleri hedeflesin.',
        'Bununla paralel olarak kitap-bazli exception listesi de tutulmaya devam etsin.'
      ]

  const lines = [
    '# TTS Next Step Recommendation',
    '',
    `- Karar: ${verdict}`,
    `- Candidate-backed kapsama orani: ${summary.candidateCoverageRatio}`,
    `- Kalan sorunlu token gecisi: ${summary.unresolvedOccurrences}`,
    `- Kalan benzersiz token: ${summary.unresolvedUniqueTokens}`,
    '',
    '## Gerekce',
    '',
    ...reasons.map((item) => `- ${item}`),
    '',
    '## Onerilen Sirali Sonraki Adimlar',
    '',
    ...nextActions.map((item, index) => `${index + 1}. ${item}`),
    ''
  ]

  return `${lines.join('\n')}\n`
}

function main() {
  ensureDir(REPORT_DIR)

  const { perBook, unresolved } = analyzeBooks()
  const samples = buildSamples(perBook, unresolved)
  const bookExceptions = buildBookExceptions(perBook, unresolved)
  const summary = buildSummary(perBook, unresolved)

  const samplePayload = {
    generatedAt: new Date().toISOString(),
    methodology: {
      source: 'public/tafsir-library/*/001.json',
      booksAnalyzed: perBook.length,
      note: 'Her kitap icin Fatiha suresi surahHtml metni uzerinden batch analiz yapildi. Pasajlar hassas token yogunluguna gore secildi.'
    },
    summary,
    samples
  }

  const bookExceptionPayload = {
    generatedAt: new Date().toISOString(),
    summary: {
      booksWithCandidates: bookExceptions.length,
      totalCandidates: bookExceptions.reduce((sum, entry) => sum + entry.candidates.length, 0)
    },
    books: bookExceptions
  }

  fs.writeFileSync(path.join(REPORT_DIR, SAMPLE_FILENAME), `${JSON.stringify(samplePayload, null, 2)}\n`, 'utf8')
  fs.writeFileSync(path.join(REPORT_DIR, MISREAD_REPORT_FILENAME), buildMisreadReport(summary, samples, unresolved, bookExceptions), 'utf8')
  fs.writeFileSync(path.join(REPORT_DIR, BOOK_EXCEPTIONS_FILENAME), `${JSON.stringify(bookExceptionPayload, null, 2)}\n`, 'utf8')
  fs.writeFileSync(path.join(REPORT_DIR, NEXT_STEP_FILENAME), buildNextStepRecommendation(summary, unresolved), 'utf8')

  console.log(`Reports written to ${REPORT_DIR}`)
  console.log(`Books analyzed: ${perBook.length}`)
  console.log(`Unresolved unique tokens: ${summary.unresolvedUniqueTokens}`)
  console.log(`Coverage ratio: ${summary.candidateCoverageRatio}`)
}

main()
