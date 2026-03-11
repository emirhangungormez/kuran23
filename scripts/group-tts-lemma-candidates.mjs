#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_INPUT = './tmp/tts-lexicon-full/lexicon-candidates.json'
const DEFAULT_OUTPUT = './tmp/tts-lexicon-full/lemma-groups-top200.json'
const DEFAULT_TOP = 200
const DEFAULT_QUALITY = 'strict'

const QUALITY_PRESETS = {
  strict: {
    minFrequencyForAccept: 1000,
    minRootLength: 4,
    maxSurfaceFormsPerRule: 6,
    maxSuffixAlternativesPerRule: 8,
    maxAcceptedRules: 120,
    splitSuffixThreshold: 4
  },
  balanced: {
    minFrequencyForAccept: 400,
    minRootLength: 3,
    maxSurfaceFormsPerRule: 10,
    maxSuffixAlternativesPerRule: 12,
    maxAcceptedRules: 200,
    splitSuffixThreshold: 6
  }
}

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u
const QUOTE_REGEX = /[’`´‘‛]/g
const WORD_SUFFIX_REGEX = /^[a-zçğıöşüâîû]+$/iu
const REPEATED_CHAR_REGEX = /(.)\1\1/u

const args = process.argv.slice(2)
const positional = args.filter((arg) => !arg.startsWith('--'))
const options = parseOptions(args.filter((arg) => arg.startsWith('--')))

const inputPath = path.resolve(positional[0] || DEFAULT_INPUT)
const outputPath = path.resolve(positional[1] || DEFAULT_OUTPUT)
const top = Number.isFinite(options.top) && options.top > 0 ? Math.floor(options.top) : DEFAULT_TOP
const quality = String(options.quality || DEFAULT_QUALITY).toLowerCase()
const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.strict

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

function normalizeCompareKey(value) {
  return normalizeQuotes(value)
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9çğıöşü]/g, '')
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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

  const indexes = []
  for (let i = 0; i < normalized.length; i += 1) {
    if (normalized[i] === "'") indexes.push(i)
  }

  const last = indexes[indexes.length - 1]
  const suffix = normalized.slice(last + 1)
  const hasMultiple = indexes.length > 1

  if (isLikelySuffix(suffix) || (hasMultiple && suffix.length <= 5 && WORD_SUFFIX_REGEX.test(suffix))) {
    return { root: normalized.slice(0, last), suffix, hasSuffix: true }
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
    .replace(/['’-]/g, '')
    .replace(/[^a-z0-9çğıöşü]/g, '')
}

function buildFlexibleRootPattern(root) {
  const normalized = normalizeQuotes(root)
  let pattern = ''
  for (const char of normalized) {
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
    pattern += CHAR_CLASS_MAP[lower] || escapeRegex(char)
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

function derivePronunciationFromRoot(root) {
  return normalizeQuotes(root)
    .replace(/([A-Za-zÇĞİÖŞÜçğıöşü])'([A-Za-zÇĞİÖŞÜçğıöşü])/g, '$1$2')
    .replace(/â/gi, 'aa')
    .replace(/î/gi, 'ii')
    .replace(/û/gi, 'uu')
}

function isPronunciationSuspicious(root, pronunciation) {
  const rootKey = normalizeCompareKey(root)
  const pronKey = normalizeCompareKey(pronunciation)
  if (!rootKey || !pronKey) return true
  if (pronKey.length < Math.max(3, Math.floor(rootKey.length * 0.75))) return true
  const anchor = rootKey.slice(0, Math.min(3, rootKey.length))
  return anchor.length >= 2 && !pronKey.includes(anchor)
}

function isNaturalTurkishPronunciation(root, pronunciation) {
  const safe = String(pronunciation || '').trim()
  if (!safe) return false
  if (/['’`´]/u.test(safe)) return false
  if (REPEATED_CHAR_REGEX.test(safe.toLocaleLowerCase('tr-TR'))) return false

  const rootKey = normalizeCompareKey(root)
  const pronKey = normalizeCompareKey(safe)
  if (!rootKey || !pronKey) return false
  if (pronKey.length > Math.ceil(rootKey.length * 1.8)) return false
  if (isPronunciationSuspicious(root, safe)) return false
  return true
}

function pickPronunciation(members, representativeRoot) {
  const sorted = members
    .slice()
    .sort((a, b) => b.count - a.count)

  for (const candidate of sorted) {
    const value = candidate.suggestedPronunciation
    if (value && isNaturalTurkishPronunciation(representativeRoot, value)) return value
  }

  return derivePronunciationFromRoot(representativeRoot)
}

function collectSuffixAlternatives(members) {
  const suffixSet = new Set()
  members.forEach((member) => {
    if (!member.hasSuffix) return
    const suffix = String(member.suffix || '').toLocaleLowerCase('tr-TR')
    if (!suffix || !isLikelySuffix(suffix)) return
    suffixSet.add(suffix)
  })
  return Array.from(suffixSet).sort((a, b) => b.length - a.length || a.localeCompare(b, 'tr'))
}

function buildRegexRule(representativeRoot, suffixAlternatives = []) {
  const rootPattern = buildFlexibleRootPattern(representativeRoot)
  if (!suffixAlternatives.length) {
    return `/\\b${rootPattern}\\b/giu`
  }

  const suffixPattern = suffixAlternatives.map((suffix) => escapeRegex(suffix)).join('|')
  return `/\\b${rootPattern}['’](?:${suffixPattern})\\b/giu`
}

function computeRiskLevel(input) {
  let score = 0
  if (input.hasArabic) score += 5
  if (input.isShortRoot) score += 3
  if (input.surfaceFormCount > preset.maxSurfaceFormsPerRule) score += 3
  if (input.suffixAlternatives > preset.maxSuffixAlternativesPerRule) score += 3
  if (input.frequency < preset.minFrequencyForAccept) score += 2
  if (input.uncertainPronunciation) score += 4
  if (input.ruleSplitFromBroad) score += 1

  if (score >= 7) return 'Yüksek'
  if (score >= 4) return 'Orta'
  return 'Düşük'
}

function buildVariant(representativeRoot, members, variantType, fromBroadSplit) {
  const frequency = members.reduce((sum, item) => sum + item.count, 0)
  const surfaceForms = Array.from(new Set(members.map((item) => item.token))).sort((a, b) => a.localeCompare(b, 'tr'))
  const suffixAlternatives = collectSuffixAlternatives(members)
  const pronunciation = pickPronunciation(members, representativeRoot)
  const uncertainPronunciation = !isNaturalTurkishPronunciation(representativeRoot, pronunciation)
  const hasArabic = surfaceForms.some((token) => ARABIC_REGEX.test(token))
  const riskSeviyesi = computeRiskLevel({
    hasArabic,
    isShortRoot: normalizeCompareKey(representativeRoot).length < preset.minRootLength,
    surfaceFormCount: surfaceForms.length,
    suffixAlternatives: suffixAlternatives.length,
    frequency,
    uncertainPronunciation,
    ruleSplitFromBroad: fromBroadSplit
  })

  const riskNedenleri = []
  if (hasArabic) riskNedenleri.push('Arapça karakter içeriyor')
  if (normalizeCompareKey(representativeRoot).length < preset.minRootLength) riskNedenleri.push('Kök çok kısa')
  if (surfaceForms.length > preset.maxSurfaceFormsPerRule) riskNedenleri.push('Yüzey form kapsamı geniş')
  if (suffixAlternatives.length > preset.maxSuffixAlternativesPerRule) riskNedenleri.push('Ek alternatifleri fazla')
  if (frequency < preset.minFrequencyForAccept) riskNedenleri.push('Frekans düşük')
  if (uncertainPronunciation) riskNedenleri.push('Telaffuz güveni düşük')
  if (fromBroadSplit) riskNedenleri.push('Geniş kural parçalanarak üretildi')

  const regexKurali = buildRegexRule(representativeRoot, variantType === 'suffix' ? suffixAlternatives : [])

  return {
    temsilKok: representativeRoot,
    altGrup: variantType === 'suffix' ? 'ekli' : 'kok',
    regexKurali,
    onerilenOkunus: pronunciation,
    riskSeviyesi,
    riskNedenleri,
    toplamFrekans: frequency,
    yuzeyFormSayisi: surfaceForms.length,
    yuzeyFormlar: surfaceForms,
    adaylar: members
      .slice()
      .sort((a, b) => b.count - a.count)
      .map((member) => ({
        token: member.token,
        count: member.count,
        suggestedPronunciation: member.suggestedPronunciation
      }))
  }
}

function shouldSplitBroadGroup(group) {
  const suffixCount = group.members.filter((member) => member.hasSuffix).length
  const plainCount = group.members.length - suffixCount
  if (!suffixCount || !plainCount) return false
  if (group.surfaceForms.size > preset.maxSurfaceFormsPerRule) return true
  const suffixAlternatives = collectSuffixAlternatives(group.members)
  return suffixAlternatives.length > preset.splitSuffixThreshold
}

function splitGroupVariants(group) {
  const representativeRoot = pickRepresentativeRoot(group.rootCounts)
  const fromBroadSplit = shouldSplitBroadGroup(group)
  if (!fromBroadSplit) {
    return [buildVariant(representativeRoot, group.members, 'root', false)]
  }

  const rootMembers = group.members.filter((member) => !member.hasSuffix)
  const suffixMembers = group.members.filter((member) => member.hasSuffix)
  const variants = []

  if (rootMembers.length) variants.push(buildVariant(representativeRoot, rootMembers, 'root', true))
  if (suffixMembers.length) variants.push(buildVariant(representativeRoot, suffixMembers, 'suffix', true))
  return variants
}

function groupCandidates(candidates, topCount) {
  const selected = candidates.slice(0, topCount)
  const groups = new Map()

  selected.forEach((item) => {
    const token = String(item.token || '').trim()
    if (!token) return

    const split = splitRootAndSuffix(token)
    const key = normalizeGroupingKey(split.root)
    if (!key) return

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        members: [],
        rootCounts: new Map(),
        surfaceForms: new Set()
      })
    }

    const group = groups.get(key)
    const member = {
      token,
      root: split.root,
      suffix: split.suffix,
      hasSuffix: split.hasSuffix,
      count: Number(item.count || 0),
      fileCount: Number(item.fileCount || 0),
      suggestedPronunciation: String(item.suggestedPronunciation || '')
    }
    group.members.push(member)
    group.surfaceForms.add(token)
    group.rootCounts.set(split.root, (group.rootCounts.get(split.root) || 0) + member.count)
  })

  const expandedGroups = Array.from(groups.values())
    .flatMap((group) => splitGroupVariants(group))
    .sort((a, b) => {
      if (b.toplamFrekans !== a.toplamFrekans) return b.toplamFrekans - a.toplamFrekans
      return a.temsilKok.localeCompare(b.temsilKok, 'tr')
    })

  const accepted = []
  const rejected = []
  expandedGroups.forEach((group) => {
    const rejectByRisk = group.riskSeviyesi === 'Yüksek'
    const rejectByFrequency = group.toplamFrekans < preset.minFrequencyForAccept
    const rejectByBloat = group.yuzeyFormSayisi > preset.maxSurfaceFormsPerRule
    const rejectByPron = group.riskNedenleri.includes('Telaffuz güveni düşük')
    const shouldReject = rejectByRisk || rejectByFrequency || rejectByBloat || rejectByPron

    const next = {
      ...group,
      kuralDurumu: shouldReject ? 'Reddedildi' : 'Kabul'
    }

    if (shouldReject) rejected.push(next)
    else accepted.push(next)
  })

  const trimmedAccepted = accepted.slice(0, preset.maxAcceptedRules)
  if (accepted.length > preset.maxAcceptedRules) {
    rejected.push(...accepted.slice(preset.maxAcceptedRules).map((entry) => ({
      ...entry,
      kuralDurumu: 'Reddedildi',
      riskSeviyesi: entry.riskSeviyesi === 'Düşük' ? 'Orta' : entry.riskSeviyesi,
      riskNedenleri: [...entry.riskNedenleri, 'Lexicon şişmesini önlemek için sınır üstü']
    })))
  }

  return {
    groups: [...trimmedAccepted, ...rejected],
    accepted: trimmedAccepted,
    rejected
  }
}

function emitGeneratedLexicon(acceptedGroups) {
  const lines = ['export const GENERATED_TTS_LEMMA_LEXICON = [']
  acceptedGroups.forEach((group) => {
    const regexLiteral = String(group.regexKurali || '').replace(/^\/|\/[gimsuy]*$/g, '')
    const flagsMatch = String(group.regexKurali || '').match(/\/([gimsuy]+)$/)
    const flags = flagsMatch ? flagsMatch[1] : 'giu'
    const safePron = String(group.onerilenOkunus || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    lines.push(`  [/${regexLiteral}/${flags}, '${safePron}'],`)
  })
  lines.push(']')
  lines.push('')
  return lines.join('\n')
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

  const result = groupCandidates(candidates, top)
  const output = {
    meta: {
      kaliteModu: quality in QUALITY_PRESETS ? quality : 'strict',
      kaynak: inputPath,
      secilenAdaySayisi: Math.min(top, candidates.length),
      toplamGrupSayisi: result.groups.length,
      kabulEdilenKuralSayisi: result.accepted.length,
      reddedilenKuralSayisi: result.rejected.length
    },
    groups: result.groups
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8')

  const lexiconOutputPath = outputPath.replace(/\.json$/i, '.generated.js')
  fs.writeFileSync(lexiconOutputPath, emitGeneratedLexicon(result.accepted), 'utf8')

  console.log('Kalite modlu gruplama tamamlandi.')
  console.log(`Kalite modu: ${output.meta.kaliteModu}`)
  console.log(`Girdi: ${inputPath}`)
  console.log(`Secilen aday: ${Math.min(top, candidates.length)}`)
  console.log(`Toplam grup: ${result.groups.length}`)
  console.log(`Kabul: ${result.accepted.length}`)
  console.log(`Red: ${result.rejected.length}`)
  console.log(`Cikti JSON: ${outputPath}`)
  console.log(`Cikti Lexicon: ${lexiconOutputPath}`)
}

main()
