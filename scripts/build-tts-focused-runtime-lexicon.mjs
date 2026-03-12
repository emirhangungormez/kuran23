import fs from 'node:fs'
import path from 'node:path'

const inputPath = path.resolve(process.argv[2] || './tmp/tts-lexicon-focused/lemma-groups-top1000.json')
const outputPath = path.resolve(process.argv[3] || './src/data/generatedTtsLemmaLexicon.js')

const QUOTE_REGEX = /[\u2019'`\u00b4]/gu
const LETTER_APOSTROPHE_REGEX = /([A-Za-z\u00c7\u011e\u0130\u00d6\u015e\u00dc\u00e7\u011f\u0131\u00f6\u015f\u00fc])'([A-Za-z\u00c7\u011e\u0130\u00d6\u015e\u00dc\u00e7\u011f\u0131\u00f6\u015f\u00fc])/gu
const COMBINING_MARK_REGEX = /[\u0300-\u036f]/gu
const NON_WORD_COMPARE_REGEX = /[^a-z0-9\u00e7\u011f\u0131\u00f6\u015f\u00fc]/gu
const SURFACE_SUFFIX_REGEX = /(?:'|’)(?:da|de|ta|te|dan|den|tan|ten|a|e|ya|ye|i|\u0131|u|\u00fc|yi|y\u0131|yu|y\u00fc|in|\u0131n|un|\u00fcn|nin|n\u0131n|nun|n\u00fcn|na|ne|nda|nde|ndan|nden|lar|ler|lari|leri|lar\u0131n|lerin|im|\u0131m|um|\u00fcm|dir|d\u0131r|dur|d\u00fcr|tir|t\u0131r|tur|t\u00fcr)$/iu
const SHORT_RISKY_ROOT_LENGTH = 3

function normalizeQuotes(value) {
  return String(value || '').replace(QUOTE_REGEX, "'")
}

function normalizeSpeechToken(value) {
  return normalizeQuotes(value)
    .normalize('NFKC')
    .replace(COMBINING_MARK_REGEX, '')
    .replace(/k\u00e2/giu, 'kaa')
    .replace(/g\u00e2/giu, 'gaa')
    .replace(/l\u00e2/giu, 'laa')
    .replace(/\u00e2/giu, 'aa')
    .replace(/\u00ee/giu, 'ii')
    .replace(/\u00fb/giu, 'uu')
    .replace(LETTER_APOSTROPHE_REGEX, '$1$2')
    .replace(/\s+/gu, ' ')
    .trim()
}

function normalizeCompareKey(value) {
  return normalizeSpeechToken(value)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(COMBINING_MARK_REGEX, '')
    .replace(NON_WORD_COMPARE_REGEX, '')
}

function hasSurfaceSuffix(token) {
  return SURFACE_SUFFIX_REGEX.test(normalizeQuotes(token))
}

function escapeRegexChar(char) {
  return String(char || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildRuntimePattern(root) {
  const source = normalizeQuotes(root)
  let pattern = ''

  for (const rawChar of source) {
    const char = rawChar.toLocaleLowerCase('tr-TR')
    if (char === "'" || char === '\u2019') continue
    if (char === ' ') {
      pattern += '\\s+'
      continue
    }
    if (char === '-' || char === '\u2013') {
      pattern += '[-\\s]?'
      continue
    }

    switch (char) {
      case 'a':
        pattern += 'a'
        break
      case '\u00e2':
        pattern += 'a{1,2}'
        break
      case 'e':
        pattern += 'e'
        break
      case '\u00ea':
        pattern += 'e{1,2}'
        break
      case 'i':
        pattern += 'i'
        break
      case '\u00ee':
        pattern += 'i{1,2}'
        break
      case '\u0131':
        pattern += '[\\u0131i]'
        break
      case 'u':
        pattern += 'u'
        break
      case '\u00fb':
        pattern += 'u{1,2}'
        break
      case '\u00fc':
        pattern += '\\u00fc'
        break
      case 'o':
        pattern += 'o'
        break
      case '\u00f6':
        pattern += '\\u00f6'
        break
      case 'c':
      case '\u00e7':
        pattern += '[c\\u00e7]'
        break
      case 'g':
      case '\u011f':
        pattern += '[g\\u011f]'
        break
      case 's':
      case '\u015f':
        pattern += '[s\\u015f]'
        break
      default:
        pattern += escapeRegexChar(char)
        break
    }
  }

  return `/\\b${pattern}\\b/giu`
}

function getExactRootCandidate(group, rootKey) {
  const candidates = Array.isArray(group?.adaylar) ? group.adaylar : []
  return candidates
    .filter((candidate) => normalizeCompareKey(candidate?.token) === rootKey)
    .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))[0]
}

function pickSafeReplacement(group, exactRootCandidate) {
  const fromCandidate = exactRootCandidate?.suggestedPronunciation
  const fallback = group?.temsilKok
  const replacement = normalizeSpeechToken(fromCandidate || fallback)
  return replacement || ''
}

function hasPronunciationDrift(rootKey, replacementKey) {
  if (!rootKey || !replacementKey) return true
  if (replacementKey === rootKey) return false
  if (!replacementKey.startsWith(rootKey)) return true

  const tail = replacementKey.slice(rootKey.length)
  if (!tail) return false

  return /^(?:da|de|ta|te|dan|den|tan|ten|a|e|ya|ye|i|\u0131|u|\u00fc|yi|y\u0131|yu|y\u00fc|in|\u0131n|un|\u00fcn|nin|n\u0131n|nun|n\u00fcn|na|ne|nda|nde|ndan|nden|lar|ler|lari|leri|lar\u0131n|lerin|im|\u0131m|um|\u00fcm|dir|d\u0131r|dur|d\u00fcr|tir|t\u0131r|tur|t\u00fcr)$/u.test(tail)
}

function buildSafeEntry(group) {
  if (!group || group.kuralDurumu !== 'Kabul') return null
  if (String(group.altGrup || '') !== 'kok') return null

  const root = String(group.temsilKok || '').trim()
  if (!root) return null

  const rootKey = normalizeCompareKey(root)
  if (!rootKey) return null

  const exactRootCandidate = getExactRootCandidate(group, rootKey)
  const surfaceForms = Array.isArray(group.yuzeyFormlar) ? group.yuzeyFormlar : []
  const hasApostropheOnlySurfaceForms = surfaceForms.length > 0 && surfaceForms.every((token) => hasSurfaceSuffix(token))

  if (!exactRootCandidate && hasApostropheOnlySurfaceForms) return null

  const replacement = pickSafeReplacement(group, exactRootCandidate)
  const replacementKey = normalizeCompareKey(replacement)
  if (!replacement || !replacementKey) return null
  if (hasPronunciationDrift(rootKey, replacementKey)) return null

  const topCandidate = Array.isArray(group.adaylar)
    ? group.adaylar.slice().sort((a, b) => Number(b.count || 0) - Number(a.count || 0))[0]
    : null
  const topCandidateKey = normalizeCompareKey(topCandidate?.token)
  if (!exactRootCandidate && rootKey.length <= SHORT_RISKY_ROOT_LENGTH && topCandidateKey && topCandidateKey.length > rootKey.length + 1) {
    return null
  }

  return {
    group,
    pattern: buildRuntimePattern(exactRootCandidate?.token || root),
    replacement
  }
}

function escapeReplacement(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
}

function emitGeneratedLexicon(entries, meta = {}) {
  const lines = [
    '// Generated by scripts/build-tts-focused-runtime-lexicon.mjs',
    `// Source: ${meta.source || ''}`,
    `// Safe accepted groups: ${meta.count || entries.length}`,
    'export const GENERATED_TTS_LEMMA_LEXICON = ['
  ]

  entries.forEach(({ pattern, replacement }) => {
    const regexLiteral = String(pattern || '').replace(/^\/|\/[gimsuy]*$/g, '')
    const flagsMatch = String(pattern || '').match(/\/([gimsuy]+)$/)
    const flags = flagsMatch ? flagsMatch[1] : 'giu'
    lines.push(`  [/${regexLiteral}/${flags}, '${escapeReplacement(replacement)}'],`)
  })

  lines.push(']')
  lines.push('')
  return lines.join('\n')
}

function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(inputPath, 'utf8')
  const parsed = JSON.parse(raw)
  const groups = Array.isArray(parsed.groups) ? parsed.groups : []
  const safeEntries = groups
    .map(buildSafeEntry)
    .filter(Boolean)
    .sort((a, b) => Number(b.group?.toplamFrekans || 0) - Number(a.group?.toplamFrekans || 0))

  const content = emitGeneratedLexicon(safeEntries, {
    source: inputPath,
    count: safeEntries.length
  })

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, content, 'utf8')

  console.log(`Generated: ${outputPath}`)
  console.log(`Safe rules: ${safeEntries.length}`)
}

main()
