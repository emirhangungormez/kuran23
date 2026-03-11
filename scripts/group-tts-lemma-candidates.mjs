#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_INPUT = './tmp/tts-lexicon-full/lexicon-candidates.json'
const DEFAULT_OUTPUT = './tmp/tts-lexicon-full/lemma-groups-top200.json'
const DEFAULT_TOP = 200

const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const options = parseOptions(process.argv.slice(2).filter((arg) => arg.startsWith('--')))

const inputPath = path.resolve(positional[0] || DEFAULT_INPUT)
const outputPath = path.resolve(positional[1] || DEFAULT_OUTPUT)
const top = Number.isFinite(options.top) && options.top > 0 ? Math.floor(options.top) : DEFAULT_TOP

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u
const QUOTE_REGEX = /[’`´‘‛]/g
const WORD_SUFFIX_REGEX = /^[a-zçğıöşüâîû]+$/iu

const LIKELY_SUFFIXES = new Set([
  'ı', 'i', 'u', 'ü', 'a', 'e',
  'ın', 'in', 'un', 'ün',
  'nın', 'nin', 'nun', 'nün',
  'ya', 'ye', 'na', 'ne',
  'da', 'de', 'ta', 'te',
  'nda', 'nde',
  'dan', 'den', 'tan', 'ten',
  'ndan', 'nden',
  'yla', 'yle',
  'ca', 'ce', 'ça', 'çe',
  'ki',
  'dır', 'dir', 'dur', 'dür',
  'tır', 'tir', 'tur', 'tür',
  'lar', 'ler',
  'ları', 'leri',
  'ların', 'lerin',
  'lara', 'lere',
  'larda', 'lerde',
  'lardan', 'lerden'
])

const CHAR_CLASS_MAP = {
  a: '[aâ]',
  â: '[aâ]',
  e: '[eê]',
  ê: '[eê]',
  i: '[iî]',
  î: '[iî]',
  ı: '[ıiî]',
  u: '[uû]',
  û: '[uû]',
  ü: '[üuû]',
  o: '[oö]',
  ö: '[öo]',
  c: '[cç]',
  ç: '[çc]',
  g: '[gğ]',
  ğ: '[ğg]',
  s: '[sş]',
  ş: '[şs]'
}

function parseOptions(optionArgs) {
  const out = {}
  optionArgs.forEach((arg) => {
    const [rawKey, rawValue = ''] = arg.replace(/^--/, '').split('=')
    const key = String(rawKey || '').trim()
    const value = String(rawValue || '').trim()
    if (!key) return

    if (key === 'top') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) out.top = parsed
      return
    }

    out[key] = value
  })
  return out
}

function normalizeQuotes(value) {
  return String(value || '').replace(QUOTE_REGEX, "'")
}

function isLikelySuffix(candidate) {
  const suffix = String(candidate || '').toLocaleLowerCase('tr-TR')
  if (!suffix) return false
  if (LIKELY_SUFFIXES.has(suffix)) return true
  if (!WORD_SUFFIX_REGEX.test(suffix)) return false

  return /^(?:[dtny]?[aeıiuü](?:n|m|k)?|[dt][ae](?:n)?|[yn]?[ıiuü](?:n)?|lar(?:ın|in|un|ün|a|e|da|de|dan|den)?|ler(?:in|a|e|de|den)?|ki)$/iu.test(suffix)
}

function splitRootAndSuffix(token) {
  const normalized = normalizeQuotes(token).trim()
  if (!normalized.includes("'")) {
    return { root: normalized, suffix: '', hasSuffix: false }
  }

  const apostropheIndexes = []
  for (let i = 0; i < normalized.length; i += 1) {
    if (normalized[i] === "'") apostropheIndexes.push(i)
  }

  const lastAposIndex = apostropheIndexes[apostropheIndexes.length - 1]
  const suffix = normalized.slice(lastAposIndex + 1)
  const hasMultipleApostrophes = apostropheIndexes.length > 1

  if (isLikelySuffix(suffix) || (hasMultipleApostrophes && suffix.length <= 5 && WORD_SUFFIX_REGEX.test(suffix))) {
    return {
      root: normalized.slice(0, lastAposIndex),
      suffix,
      hasSuffix: true
    }
  }

  return { root: normalized, suffix: '', hasSuffix: false }
}

function normalizeGroupingKey(root) {
  return normalizeQuotes(root)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[â]/g, 'a')
    .replace(/[î]/g, 'i')
    .replace(/[û]/g, 'u')
    .replace(/['’`´‘‛-]/g, '')
    .replace(/[^a-z0-9çğıöşü]/g, '')
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildFlexibleRootPattern(root) {
  const normalizedRoot = normalizeQuotes(root)
  let pattern = ''
  for (const char of normalizedRoot) {
    if (char === "'") {
      pattern += "['’]?"
      continue
    }

    if (char === '-' || char === '–') {
      pattern += '[-–]?'
      continue
    }

    if (char === ' ') {
      pattern += '\\s+'
      continue
    }

    const lower = char.toLocaleLowerCase('tr-TR')
    if (CHAR_CLASS_MAP[lower]) {
      pattern += CHAR_CLASS_MAP[lower]
      continue
    }

    pattern += escapeRegex(char)
  }

  return pattern
}

function pickRepresentativeRoot(rootCounts) {
  const entries = Array.from(rootCounts.entries())
  if (!entries.length) return ''

  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]
    return a[0].localeCompare(b[0], 'tr')
  })
  return entries[0][0]
}

function normalizeCompareKey(value) {
  return normalizeQuotes(value)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9çğıöşü]/g, '')
}

function derivePronunciationFromRoot(root) {
  return normalizeQuotes(root)
    .replace(/([A-Za-zÇĞİÖŞÜçğıöşü])'([A-Za-zÇĞİÖŞÜçğıöşü])/g, '$1$2')
    .replace(/â/gi, 'aa')
    .replace(/î/gi, 'ii')
    .replace(/û/gi, 'uu')
}

function isPronunciationSuspicious(root, candidatePronunciation) {
  const rootKey = normalizeCompareKey(root)
  const pronunciationKey = normalizeCompareKey(candidatePronunciation)
  if (!rootKey || !pronunciationKey) return true
  if (pronunciationKey.length < Math.max(3, Math.floor(rootKey.length * 0.75))) return true
  const rootAnchor = rootKey.slice(0, Math.min(3, rootKey.length))
  return rootAnchor.length >= 2 && !pronunciationKey.includes(rootAnchor)
}

function pickPronunciation(group, representativeRoot) {
  const rootCandidates = group.members
    .filter((member) => normalizeQuotes(member.root) === normalizeQuotes(representativeRoot))
    .sort((a, b) => b.count - a.count)

  const rootDirect = rootCandidates.find((member) => !member.hasSuffix)
  if (rootDirect && rootDirect.suggestedPronunciation) {
    if (!isPronunciationSuspicious(representativeRoot, rootDirect.suggestedPronunciation)) {
      return rootDirect.suggestedPronunciation
    }
  }

  if (rootCandidates[0]?.suggestedPronunciation) {
    if (!isPronunciationSuspicious(representativeRoot, rootCandidates[0].suggestedPronunciation)) {
      return rootCandidates[0].suggestedPronunciation
    }
  }

  const all = [...group.members].sort((a, b) => b.count - a.count)
  if (all[0]?.suggestedPronunciation && !isPronunciationSuspicious(representativeRoot, all[0].suggestedPronunciation)) {
    return all[0].suggestedPronunciation
  }

  return derivePronunciationFromRoot(representativeRoot)
}

function computeRiskLevel(group, representativeRoot, pronunciation) {
  let riskScore = 0
  if (group.hasArabic) riskScore += 5
  if (group.uniqueSuggestionCount > 3) riskScore += 2
  if (group.uniqueRootCount > 2) riskScore += 2
  if (String(representativeRoot || '').length <= 3) riskScore += 2
  if (group.hasOnlySuffixForms) riskScore += 1
  if (!pronunciation || pronunciation === representativeRoot) riskScore += 1

  if (riskScore >= 6) return 'Yüksek'
  if (riskScore >= 3) return 'Orta'
  return 'Düşük'
}

function buildRegexRule(representativeRoot, hasSuffixForms) {
  const rootPattern = buildFlexibleRootPattern(representativeRoot)
  const suffixPattern = hasSuffixForms
    ? "(?:['’][A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû]{1,12})?"
    : ''
  return `/\\b${rootPattern}${suffixPattern}\\b/giu`
}

function groupCandidates(candidates, topCount) {
  const selected = candidates.slice(0, topCount)
  const groups = new Map()

  selected.forEach((item) => {
    const token = String(item.token || '').trim()
    if (!token) return

    const { root, suffix, hasSuffix } = splitRootAndSuffix(token)
    const groupKey = normalizeGroupingKey(root)
    if (!groupKey) return

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        members: [],
        rootCounts: new Map(),
        surfaceForms: new Set(),
        totalCount: 0,
        hasArabic: false,
        hasSuffixForms: false
      })
    }

    const group = groups.get(groupKey)
    group.members.push({
      token,
      root,
      suffix,
      hasSuffix,
      count: Number(item.count || 0),
      fileCount: Number(item.fileCount || 0),
      suggestedPronunciation: String(item.suggestedPronunciation || '')
    })
    group.surfaceForms.add(token)
    group.totalCount += Number(item.count || 0)
    group.hasArabic = group.hasArabic || ARABIC_REGEX.test(token)
    group.hasSuffixForms = group.hasSuffixForms || hasSuffix
    group.rootCounts.set(root, (group.rootCounts.get(root) || 0) + Number(item.count || 0))
  })

  const grouped = Array.from(groups.values()).map((group) => {
    const representativeRoot = pickRepresentativeRoot(group.rootCounts)
    const pronunciation = pickPronunciation(group, representativeRoot)
    const uniqueSuggestions = new Set(
      group.members
        .map((member) => member.suggestedPronunciation)
        .filter(Boolean)
    )
    const uniqueRoots = new Set(group.members.map((member) => normalizeQuotes(member.root)))
    const hasOnlySuffixForms = group.members.every((member) => member.hasSuffix)
    const regexRule = buildRegexRule(representativeRoot, group.hasSuffixForms)
    const riskLevel = computeRiskLevel(
      {
        hasArabic: group.hasArabic,
        uniqueSuggestionCount: uniqueSuggestions.size,
        uniqueRootCount: uniqueRoots.size,
        hasOnlySuffixForms
      },
      representativeRoot,
      pronunciation
    )

    return {
      temsilKok: representativeRoot,
      regexKurali: regexRule,
      onerilenOkunus: pronunciation,
      riskSeviyesi: riskLevel,
      toplamFrekans: group.totalCount,
      yuzeyFormSayisi: group.surfaceForms.size,
      yuzeyFormlar: Array.from(group.surfaceForms).sort((a, b) => a.localeCompare(b, 'tr')),
      adaylar: group.members
        .slice()
        .sort((a, b) => b.count - a.count)
        .map((member) => ({
          token: member.token,
          count: member.count,
          suggestedPronunciation: member.suggestedPronunciation
        }))
    }
  })

  return grouped.sort((a, b) => {
    if (b.toplamFrekans !== a.toplamFrekans) return b.toplamFrekans - a.toplamFrekans
    return a.temsilKok.localeCompare(b.temsilKok, 'tr')
  })
}

function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`Aday dosyasi bulunamadi: ${inputPath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(inputPath, 'utf8')
  const parsed = JSON.parse(raw)
  const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : []
  if (!candidates.length) {
    console.error('Aday listesi bos.')
    process.exit(1)
  }

  const groups = groupCandidates(candidates, top)
  const output = {
    meta: {
      kaynak: inputPath,
      secilenAdaySayisi: Math.min(top, candidates.length),
      toplamGrupSayisi: groups.length
    },
    groups
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

  console.log('Gruplama tamamlandi.')
  console.log(`Girdi: ${inputPath}`)
  console.log(`Secilen aday: ${Math.min(top, candidates.length)}`)
  console.log(`Uretilen grup: ${groups.length}`)
  console.log(`Cikti: ${outputPath}`)
}

main()
