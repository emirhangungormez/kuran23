#!/usr/bin/env node

/**
 * build-tts-lexicon.mjs
 *
 * Usage:
 *   node scripts/build-tts-lexicon.mjs [inputDir] [outputDir] [--limit=500] [--runtime=src/data/generatedTtsLexicon.js]
 *
 * Example:
 *   node scripts/build-tts-lexicon.mjs ./public/tafsir-library ./tmp/tts-lexicon
 */

import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_INPUT_DIR = './public/tafsir-library'
const DEFAULT_OUTPUT_DIR = './tmp/tts-lexicon'
const DEFAULT_RUNTIME_FILE = './src/data/generatedTtsLexicon.js'

const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const optionArgs = process.argv.slice(2).filter((arg) => arg.startsWith('--'))

const INPUT_DIR = path.resolve(positionalArgs[0] || DEFAULT_INPUT_DIR)
const OUTPUT_DIR = path.resolve(positionalArgs[1] || DEFAULT_OUTPUT_DIR)

const parsedOptions = parseOptions(optionArgs)
const GENERATED_LIMIT = parsedOptions.limit || 500
const RUNTIME_FILE = path.resolve(parsedOptions.runtime || DEFAULT_RUNTIME_FILE)
const TOP_LIST_LIMIT = parsedOptions.top || 5000

const KNOWN_TURKISH_WORDS = new Set([
  've', 'ile', 'bir', 'bu', 'su', 'o', 'da', 'de', 'ki', 'icin', 'olan', 'olarak',
  'cok', 'daha', 'gibi', 'kadar', 'sonra', 'once', 'ancak', 'fakat', 'cunku',
  'ayet', 'sure', 'suresi', 'ayetler', 'ayetleri', 'hadis', 'hadisi', 'tefsir',
  'allah', 'peygamber', 'resul', 'islam', 'iman', 'amel', 'dunya', 'ahiret',
  'insan', 'kitap', 'kuran', 'rab', 'rahmet', 'ilim', 'din', 'hak',
  'batil', 'kalp', 'nefis', 'seytan', 'cennet', 'cehennem', 'melek', 'namaz',
  'oruc', 'zekat', 'dua', 'tevbe', 'sabir', 'sukur', 'hikmet', 'ibadet', 'kul'
])

const CORE_REPLACEMENTS = [
  [/\bs\.a\.v\.?\b/gi, 'sallallahu aleyhi ve sellem'],
  [/\ba\.s\.?\b/gi, 'aleyhisselam'],
  [/\br\.a\.?\b/gi, 'radiyallahu anh'],
  [/\br\.\s*anh[üu]m\b/gi, 'radiyallahu anhum'],
  [/\bk\.s\.?\b/gi, 'kuddise sirruh'],
  [/\bc\.c\.?\b/gi, 'celle celaluhu'],
  [/\bhz\.\b/gi, 'Hazreti'],
  [/\bM\.Ö\.\b/gi, 'milattan once'],
  [/\bM\.S\.\b/gi, 'milattan sonra'],
  [/\bH\.\s*(\d+)\.\s*yüzyıl\b/gi, 'hicri $1. yuzyil'],
  [/\bM\.\s*(\d+)\.\s*yüzyıl\b/gi, 'miladi $1. yuzyil'],
  [/\bdr\.\b/gi, 'doktor'],
  [/\bprof\.\b/gi, 'profesor'],
  [/\bdoç\.\b/gi, 'docent'],
  [/(\d+)\s*\/\s*(\d+)/g, '$1 bolu $2']
]

const CORE_PRONUNCIATION_LEXICON = [
  [/\bkâfir\b/gi, 'kaafir'],
  [/\bhâlâ\b/gi, 'haalaa'],
  [/\bsûre\b/gi, 'suure'],
  [/\bnüzûl\b/gi, 'nüzuul'],
  [/\bnüzul\b/gi, 'nüzuul'],
  [/\bmüteşabih\b/gi, 'müteşaabih'],
  [/\bmüteşâbih\b/gi, 'müteşaabih'],
  [/\bmuhkem\b/gi, 'muhkem'],
  [/\btefsir\b/gi, 'tefsiir'],
  [/\btefsîr\b/gi, 'tefsiir'],
  [/\bte'vil\b/gi, 'tevil'],
  [/\bte’vil\b/gi, 'tevil'],
  [/\btev'il\b/gi, 'tevil'],
  [/\bmeâl\b/gi, 'meaal'],
  [/\bmeal\b/gi, 'meaal'],
  [/\bâyet\b/gi, 'aayet'],
  [/\bâyeti\b/gi, 'aayeti'],
  [/\bkıraat\b/gi, 'kıraat'],
  [/\bzâhir\b/gi, 'zaahir'],
  [/\bbâtın\b/gi, 'baatın'],
  [/\baleyhissel[aâ]m\b/gi, 'aleyhisselaam'],
  [/\bsallallahu aleyhi ve sellem\b/gi, 'sallallahu aleyhi vesellem'],
  [/\brad[iı]yallahu anh\b/gi, 'radiyallahu anh'],
  [/\bteâlâ\b/gi, 'tealaa'],
  [/\bisnad\b/gi, 'isnaad'],
  [/\brivayet\b/gi, 'rivaayet'],
  [/\bkıyamet\b/gi, 'kıyaamet'],
  [/\bKur'an\b/gi, 'Kuran'],
  [/\brahmân\b/gi, 'rahmaan'],
  [/\brahîm\b/gi, 'rahiim'],
  [/\bmelekût\b/gi, 'melekuut'],
  [/\bnasih\b/gi, 'naasih'],
  [/\bmensuh\b/gi, 'mensuuh'],
  [/\bmensûh\b/gi, 'mensuuh'],
  [/\btevhîd\b/gi, 'tevhiid'],
  [/\bubûdiyet\b/gi, 'ubuudiyet'],
  [/\bilâhî\b/gi, 'ilaahii'],
  [/\brisâlet\b/gi, 'risaalet'],
  [/\bmarifet\b/gi, 'maarifet'],
  [/\bşeriat\b/gi, 'şeriaat'],
  [/\bmarifetullah\b/gi, 'maarifetullah'],
  [/\bmuhabbetullah\b/gi, 'muhabbetullah'],
  [/\besmâ-i hüsnâ\b/gi, 'esmaai hüsnaa'],
  [/\besmâ\b/gi, 'esmaa'],
  [/\bcemâl\b/gi, 'cemaal'],
  [/\bcelâl\b/gi, 'celaal'],
  [/\bkemâl\b/gi, 'kemaal'],
  [/\bharâm\b/gi, 'haraam'],
  [/\bhalâl\b/gi, 'halaal']
]

const ARABIC_CHAR_CLASS = '\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF'
const ARABIC_CHAR_REGEX = new RegExp(`[${ARABIC_CHAR_CLASS}]`, 'u')
const LATIN_TURKISH_WORD_REGEX = /[A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû]+/u
const TOKEN_REGEX = /[A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû']+|[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/gu
const FILE_EXTENSIONS = new Set(['.txt', '.md', '.html', '.htm', '.json'])

function parseOptions(options) {
  const parsed = {}
  options.forEach((arg) => {
    const [rawKey, rawValue = ''] = arg.replace(/^--/, '').split('=')
    const key = String(rawKey || '').trim()
    const value = String(rawValue || '').trim()
    if (!key) return
    if (key === 'limit' || key === 'top') {
      const asNumber = Number(value)
      if (Number.isFinite(asNumber) && asNumber > 0) parsed[key] = Math.floor(asNumber)
      return
    }
    parsed[key] = value
  })
  return parsed
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function walkDir(dir) {
  const result = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      result.push(...walkDir(fullPath))
      continue
    }

    const ext = path.extname(entry.name).toLowerCase()
    if (FILE_EXTENSIONS.has(ext)) result.push(fullPath)
  }
  return result
}

function stripHtml(raw) {
  return String(raw || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
}

function extractTextFromJson(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(extractTextFromJson).join(' ')
  if (typeof value === 'object') return Object.values(value).map(extractTextFromJson).join(' ')
  return ''
}

function loadFileContent(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const raw = fs.readFileSync(filePath, 'utf8')

  if (ext === '.html' || ext === '.htm') return stripHtml(raw)

  if (ext === '.json') {
    try {
      return extractTextFromJson(JSON.parse(raw))
    } catch {
      return raw
    }
  }

  return raw
}

function normalizeBaseText(text) {
  let normalized = String(text || '').normalize('NFKC')

  CORE_REPLACEMENTS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement)
  })

  return normalized
    .replace(/[ـ]+/gu, '')
    .replace(/[“”"]/g, '')
    .replace(/[’`´‘‛]/g, "'")
    .replace(/\(([^)]*?)\)/g, ' $1 ')
    .replace(/[ۖۗۘۙۚۛۜ۝۞]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeToken(token) {
  return String(token || '')
    .normalize('NFKC')
    .replace(/[’`´‘‛]/g, "'")
    .trim()
}

function tokenize(text) {
  const source = String(text || '')
  const matches = source.match(TOKEN_REGEX)
  if (!matches) return []
  return matches.map(normalizeToken).filter(Boolean)
}

function hasCircumflex(token) {
  return /[âîûÂÎÛ]/.test(token)
}

function hasApostrophe(token) {
  return /['’]/.test(token)
}

function isArabicToken(token) {
  return ARABIC_CHAR_REGEX.test(token)
}

function looksLikeTurkishOrOttomanizedLatin(token) {
  return LATIN_TURKISH_WORD_REGEX.test(token)
}

function isLikelyPronunciationCandidate(token) {
  const value = String(token || '')
  const lower = value.toLocaleLowerCase('tr-TR')

  if (lower.length < 3) return false
  if (isArabicToken(lower)) return true
  if (hasCircumflex(lower)) return true
  if (hasApostrophe(lower)) return true

  if (/(ullah|iddin|üddin|âl|î|û|rahm|tefs|tevil|nüz|kıra|isnad|rivayet|hikmet|marifet|ubudiyet|nübüvvet|risalet|müteş|muhkem|zahir|batın)/i.test(lower)) {
    return true
  }

  if (looksLikeTurkishOrOttomanizedLatin(lower) && !KNOWN_TURKISH_WORDS.has(lower)) {
    if (/[kgşhlmnrvyz][aeiıioöuü]{1,2}[a-zçğıöşüâîû']{2,}/i.test(lower)) return true
  }

  return false
}

function suggestPronunciation(token) {
  let value = String(token || '')
  if (!value) return value

  for (const [pattern, replacement] of CORE_PRONUNCIATION_LEXICON) {
    if (pattern.test(value)) return replacement
  }

  if (isArabicToken(value)) return value

  value = value
    .replace(/kâ/gi, 'kaa')
    .replace(/gâ/gi, 'gaa')
    .replace(/lâ/gi, 'laa')
    .replace(/â/gi, 'aa')
    .replace(/î/gi, 'ii')
    .replace(/û/gi, 'uu')
    .replace(/([A-Za-zÇĞİÖŞÜçğıöşü])'([A-Za-zÇĞİÖŞÜçğıöşü])/g, '$1$2')

  value = value
    .replace(/\btefsir\b/gi, 'tefsiir')
    .replace(/\btefsîr\b/gi, 'tefsiir')
    .replace(/\bte'vil\b/gi, 'tevil')
    .replace(/\bte’vil\b/gi, 'tevil')
    .replace(/\bmeâl\b/gi, 'meaal')
    .replace(/\bnüzûl\b/gi, 'nüzuul')
    .replace(/\brahmân\b/gi, 'rahmaan')
    .replace(/\brahîm\b/gi, 'rahiim')

  return value
}

function makeEmptyStats() {
  return {
    totalFiles: 0,
    totalTokens: 0,
    uniqueTokens: 0,
    tokens: {},
    files: {},
    candidateCount: 0
  }
}

function addToken(stats, token, filePath) {
  if (!stats.tokens[token]) {
    stats.tokens[token] = {
      token,
      count: 0,
      files: new Set(),
      flags: {
        arabic: isArabicToken(token),
        circumflex: hasCircumflex(token),
        apostrophe: hasApostrophe(token),
        candidate: false
      }
    }
  }

  stats.tokens[token].count += 1
  stats.tokens[token].files.add(filePath)
  stats.totalTokens += 1
}

function finalizeStats(stats) {
  const entries = Object.values(stats.tokens)
  stats.uniqueTokens = entries.length

  entries.forEach((entry) => {
    entry.flags.candidate = isLikelyPronunciationCandidate(entry.token)
    entry.fileCount = entry.files.size
    entry.files = Array.from(entry.files).sort()
  })

  stats.candidateCount = entries.filter((entry) => entry.flags.candidate).length
}

function scoreCandidate(item) {
  let score = 0
  score += Math.min(item.count, 500)
  if (item.reason.includes('circumflex')) score += 50
  if (item.reason.includes('apostrophe')) score += 30
  if (item.reason.includes('arabic-script')) score += 40
  if (item.reason.includes('unknown-or-specialized')) score += 20
  if (!item.sameAsOriginal) score += 35
  return score
}

function buildCandidateList(stats) {
  return Object.values(stats.tokens)
    .filter((entry) => entry.flags.candidate)
    .map((entry) => {
      const lower = entry.token.toLocaleLowerCase('tr-TR')
      const suggested = suggestPronunciation(entry.token)
      const reason = []

      if (entry.flags.arabic) reason.push('arabic-script')
      if (entry.flags.circumflex) reason.push('circumflex')
      if (entry.flags.apostrophe) reason.push('apostrophe')
      if (!KNOWN_TURKISH_WORDS.has(lower) && looksLikeTurkishOrOttomanizedLatin(lower)) {
        reason.push('unknown-or-specialized')
      }

      const item = {
        token: entry.token,
        count: entry.count,
        fileCount: entry.fileCount,
        reason,
        suggestedPronunciation: suggested,
        sameAsOriginal: suggested === entry.token
      }

      return {
        ...item,
        score: scoreCandidate(item)
      }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.count !== a.count) return b.count - a.count
      return a.token.localeCompare(b.token, 'tr')
    })
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildGeneratedLexicon(candidates, limit = 500) {
  const selected = candidates
    .filter((item) => !item.sameAsOriginal && !isArabicToken(item.token))
    .slice(0, limit)

  const lines = []
  lines.push('export const GENERATED_TTS_LEXICON = [')
  selected.forEach((item) => {
    const escapedToken = escapeRegex(item.token)
    const escapedValue = String(item.suggestedPronunciation || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
    lines.push(`  [/\\b${escapedToken}\\b/gi, '${escapedValue}'],`)
  })
  lines.push(']')
  lines.push('')
  return lines.join('\n')
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8')
}

function main() {
  ensureDir(OUTPUT_DIR)
  ensureDir(path.dirname(RUNTIME_FILE))

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Girdi klasoru bulunamadi: ${INPUT_DIR}`)
    process.exit(1)
  }

  const files = walkDir(INPUT_DIR)
  if (!files.length) {
    console.error(`Islenecek dosya bulunamadi: ${INPUT_DIR}`)
    process.exit(1)
  }

  const stats = makeEmptyStats()
  stats.totalFiles = files.length

  files.forEach((filePath) => {
    const rawText = loadFileContent(filePath)
    const cleanText = normalizeBaseText(rawText)
    const tokens = tokenize(cleanText)

    stats.files[filePath] = { tokenCount: tokens.length }
    tokens.forEach((token) => addToken(stats, token, filePath))
  })

  finalizeStats(stats)

  const frequencyEntries = Object.values(stats.tokens)
    .map((entry) => ({
      token: entry.token,
      count: entry.count,
      fileCount: entry.fileCount,
      flags: entry.flags
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.token.localeCompare(b.token, 'tr')
    })

  const candidates = buildCandidateList(stats)
  const generatedLexicon = buildGeneratedLexicon(candidates, GENERATED_LIMIT)

  const frequencyOutputPath = path.join(OUTPUT_DIR, 'frequency-report.json')
  const candidatesOutputPath = path.join(OUTPUT_DIR, 'lexicon-candidates.json')
  const generatedOutputPath = path.join(OUTPUT_DIR, 'generated-lexicon.js')

  writeJson(frequencyOutputPath, {
    summary: {
      totalFiles: stats.totalFiles,
      totalTokens: stats.totalTokens,
      uniqueTokens: stats.uniqueTokens,
      candidateCount: stats.candidateCount
    },
    topTokens: frequencyEntries.slice(0, TOP_LIST_LIMIT)
  })

  writeJson(candidatesOutputPath, {
    summary: {
      totalCandidates: candidates.length
    },
    candidates: candidates.slice(0, TOP_LIST_LIMIT)
  })

  fs.writeFileSync(generatedOutputPath, generatedLexicon, 'utf8')
  fs.writeFileSync(RUNTIME_FILE, generatedLexicon, 'utf8')

  console.log('Tamamlandi.')
  console.log(`Islenen dosya sayisi: ${stats.totalFiles}`)
  console.log(`Toplam token: ${stats.totalTokens}`)
  console.log(`Tekil token: ${stats.uniqueTokens}`)
  console.log(`Aday telaffuz sayisi: ${stats.candidateCount}`)
  console.log(`Cikti klasoru: ${OUTPUT_DIR}`)
  console.log(`Runtime lexicon: ${RUNTIME_FILE}`)
}

main()
