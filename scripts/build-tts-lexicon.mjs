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
const MIN_CANDIDATE_COUNT = parsedOptions.minCount || 3

const SPECIALIZED_OR_OTTOMANIZED_REGEX =
  /(ullah|iddin|uddin|te['’]?vil|me['’]?al|n[üu]z[üu]l|k[ıi]raat|ubudiyet|n[üu]b[üu]vvet|m[üu]te[sş]abih|marifetullah|muhabbetullah|esma[-\s]?i?\s*h[üu]sna|aleyhisselam|sallallahu|radiyallahu)/iu

const CORE_REPLACEMENTS = [
  [/\bs\.a\.v\.?\b/gi, 'sallallahu aleyhi ve sellem'],
  [/\ba\.s\.?\b/gi, 'aleyhisselam'],
  [/\br\.a\.?\b/gi, 'radiyallahu anh'],
  [/\br\.\s*anh[Ã¼u]m\b/gi, 'radiyallahu anhum'],
  [/\bk\.s\.?\b/gi, 'kuddise sirruh'],
  [/\bc\.c\.?\b/gi, 'celle celaluhu'],
  [/\bhz\.\b/gi, 'Hazreti'],
  [/\bM\.Ã–\.\b/gi, 'milattan once'],
  [/\bM\.S\.\b/gi, 'milattan sonra'],
  [/\bH\.\s*(\d+)\.\s*yÃ¼zyÄ±l\b/gi, 'hicri $1. yuzyil'],
  [/\bM\.\s*(\d+)\.\s*yÃ¼zyÄ±l\b/gi, 'miladi $1. yuzyil'],
  [/\bdr\.\b/gi, 'doktor'],
  [/\bprof\.\b/gi, 'profesor'],
  [/\bdoÃ§\.\b/gi, 'docent'],
  [/(\d+)\s*\/\s*(\d+)/g, '$1 bolu $2']
]

const CORE_PRONUNCIATION_LEXICON = [
  [/\bkÃ¢fir\b/gi, 'kaafir'],
  [/\bhÃ¢lÃ¢\b/gi, 'haalaa'],
  [/\bsÃ»re\b/gi, 'suure'],
  [/\bnÃ¼zÃ»l\b/gi, 'nÃ¼zuul'],
  [/\bnÃ¼zul\b/gi, 'nÃ¼zuul'],
  [/\bmÃ¼teÅŸabih\b/gi, 'mÃ¼teÅŸaabih'],
  [/\bmÃ¼teÅŸÃ¢bih\b/gi, 'mÃ¼teÅŸaabih'],
  [/\bmuhkem\b/gi, 'muhkem'],
  [/\btefsir\b/gi, 'tefsiir'],
  [/\btefsÃ®r\b/gi, 'tefsiir'],
  [/\bte'vil\b/gi, 'tevil'],
  [/\bteâ€™vil\b/gi, 'tevil'],
  [/\btev'il\b/gi, 'tevil'],
  [/\bmeÃ¢l\b/gi, 'meaal'],
  [/\bmeal\b/gi, 'meaal'],
  [/\bÃ¢yet\b/gi, 'aayet'],
  [/\bÃ¢yeti\b/gi, 'aayeti'],
  [/\bkÄ±raat\b/gi, 'kÄ±raat'],
  [/\bzÃ¢hir\b/gi, 'zaahir'],
  [/\bbÃ¢tÄ±n\b/gi, 'baatÄ±n'],
  [/\baleyhissel[aÃ¢]m\b/gi, 'aleyhisselaam'],
  [/\bsallallahu aleyhi ve sellem\b/gi, 'sallallahu aleyhi vesellem'],
  [/\brad[iÄ±]yallahu anh\b/gi, 'radiyallahu anh'],
  [/\bteÃ¢lÃ¢\b/gi, 'tealaa'],
  [/\bisnad\b/gi, 'isnaad'],
  [/\brivayet\b/gi, 'rivaayet'],
  [/\bkÄ±yamet\b/gi, 'kÄ±yaamet'],
  [/\bKur'an\b/gi, 'Kuran'],
  [/\brahmÃ¢n\b/gi, 'rahmaan'],
  [/\brahÃ®m\b/gi, 'rahiim'],
  [/\bmelekÃ»t\b/gi, 'melekuut'],
  [/\bnasih\b/gi, 'naasih'],
  [/\bmensuh\b/gi, 'mensuuh'],
  [/\bmensÃ»h\b/gi, 'mensuuh'],
  [/\btevhÃ®d\b/gi, 'tevhiid'],
  [/\bubÃ»diyet\b/gi, 'ubuudiyet'],
  [/\bilÃ¢hÃ®\b/gi, 'ilaahii'],
  [/\brisÃ¢let\b/gi, 'risaalet'],
  [/\bmarifet\b/gi, 'maarifet'],
  [/\bÅŸeriat\b/gi, 'ÅŸeriaat'],
  [/\bmarifetullah\b/gi, 'maarifetullah'],
  [/\bmuhabbetullah\b/gi, 'muhabbetullah'],
  [/\besmÃ¢-i hÃ¼snÃ¢\b/gi, 'esmaai hÃ¼snaa'],
  [/\besmÃ¢\b/gi, 'esmaa'],
  [/\bcemÃ¢l\b/gi, 'cemaal'],
  [/\bcelÃ¢l\b/gi, 'celaal'],
  [/\bkemÃ¢l\b/gi, 'kemaal'],
  [/\bharÃ¢m\b/gi, 'haraam'],
  [/\bhalÃ¢l\b/gi, 'halaal']
]

const ARABIC_CHAR_CLASS = '\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF'
const ARABIC_CHAR_REGEX = new RegExp(`[${ARABIC_CHAR_CLASS}]`, 'u')
const LATIN_TURKISH_WORD_REGEX = /\p{Script=Latin}+/u
const TOKEN_REGEX = /[\p{Script=Latin}'’]+|[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/gu
const FILE_EXTENSIONS = new Set(['.txt', '.md', '.html', '.htm', '.json'])

function parseOptions(options) {
  const parsed = {}
  options.forEach((arg) => {
    const [rawKey, rawValue = ''] = arg.replace(/^--/, '').split('=')
    const key = String(rawKey || '').trim()
    const value = String(rawValue || '').trim()
    if (!key) return
    if (key === 'limit' || key === 'top' || key === 'min-count' || key === 'minCount') {
      const asNumber = Number(value)
      if (!Number.isFinite(asNumber) || asNumber <= 0) return
      if (key === 'min-count') parsed.minCount = Math.floor(asNumber)
      else parsed[key] = Math.floor(asNumber)
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
    .replace(/[\u0640]+/gu, '')
    .replace(/[\u201C\u201D"]/g, '')
    .replace(/[\u2019`\u00B4\u2018\u203A]/g, "'")
    .replace(/\(([^)]*?)\)/g, ' $1 ')
    .replace(/[\u06D6-\u06DC\u06DD\u06DE\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeToken(token) {
  return String(token || '')
    .normalize('NFKC')
    .replace(/[\u2019`\u00B4\u2018\u203A]/g, "'")
    .trim()
}

function tokenize(text) {
  const source = String(text || '')
  const matches = source.match(TOKEN_REGEX)
  if (!matches) return []
  return matches.map(normalizeToken).filter(Boolean)
}

function hasCircumflex(token) {
  return /[âîûÂÎÛ]/u.test(token)
}

function hasApostrophe(token) {
  const normalized = String(token || '').replace(/[’]/g, "'").trim()
  if (!normalized.includes("'")) return false
  if (normalized.startsWith("'") || normalized.endsWith("'")) return false

  const parts = normalized.split("'")
  if (parts.length < 2) return false
  if (parts.some((part) => !part || part.length < 2 || !/^\p{Script=Latin}+$/u.test(part))) return false

  const letterCount = parts.join('').length
  return letterCount >= 5
}

function isArabicToken(token) {
  return ARABIC_CHAR_REGEX.test(token)
}

function looksLikeTurkishOrOttomanizedLatin(token) {
  return LATIN_TURKISH_WORD_REGEX.test(token)
}

function isSpecializedOrOttomanized(token) {
  return SPECIALIZED_OR_OTTOMANIZED_REGEX.test(String(token || ''))
}
function isLikelyPronunciationCandidate(token) {
  const value = String(token || '')
  const lower = value.toLocaleLowerCase('tr-TR')
  if (lower.length < 3) return false
  if (isArabicToken(lower)) return true
  if (hasCircumflex(lower)) return true
  if (hasApostrophe(lower)) return true
  if (!looksLikeTurkishOrOttomanizedLatin(lower)) return false
  return isSpecializedOrOttomanized(lower)
}

function suggestPronunciation(token) {
  let value = String(token || '')
  if (!value) return value

  for (const [pattern, replacement] of CORE_PRONUNCIATION_LEXICON) {
    if (pattern.test(value)) return replacement
  }

  if (isArabicToken(value)) return value

  value = value
    .replace(/kÃ¢/gi, 'kaa')
    .replace(/gÃ¢/gi, 'gaa')
    .replace(/lÃ¢/gi, 'laa')
    .replace(/Ã¢/gi, 'aa')
    .replace(/Ã®/gi, 'ii')
    .replace(/Ã»/gi, 'uu')
    .replace(/([A-Za-zÃ‡ÄÄ°Ã–ÅÃœÃ§ÄŸÄ±Ã¶ÅŸÃ¼])'([A-Za-zÃ‡ÄÄ°Ã–ÅÃœÃ§ÄŸÄ±Ã¶ÅŸÃ¼])/g, '$1$2')

  value = value
    .replace(/\btefsir\b/gi, 'tefsiir')
    .replace(/\btefsÃ®r\b/gi, 'tefsiir')
    .replace(/\bte'vil\b/gi, 'tevil')
    .replace(/\bteâ€™vil\b/gi, 'tevil')
    .replace(/\bmeÃ¢l\b/gi, 'meaal')
    .replace(/\bnÃ¼zÃ»l\b/gi, 'nÃ¼zuul')
    .replace(/\brahmÃ¢n\b/gi, 'rahmaan')
    .replace(/\brahÃ®m\b/gi, 'rahiim')

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
    entry.flags.candidate = entry.count >= MIN_CANDIDATE_COUNT && isLikelyPronunciationCandidate(entry.token)
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
  if (item.reason.includes('specialized-legacy')) score += 20
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
      if (isSpecializedOrOttomanized(lower)) reason.push('specialized-legacy')

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

function isUsableLexiconToken(token) {
  const normalized = String(token || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '')

  if (normalized.length < 3) return false
  return /[aeıioöuü]/iu.test(normalized)
}

function buildGeneratedLexicon(candidates, limit = 500) {
  const selected = candidates
    .filter((item) => !item.sameAsOriginal && !isArabicToken(item.token))
    .filter((item) => isUsableLexiconToken(item.token) && isUsableLexiconToken(item.suggestedPronunciation))
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
  console.log(`Minimum aday frekansi: ${MIN_CANDIDATE_COUNT}`)
  console.log(`Cikti klasoru: ${OUTPUT_DIR}`)
  console.log(`Runtime lexicon: ${RUNTIME_FILE}`)
}

main()

