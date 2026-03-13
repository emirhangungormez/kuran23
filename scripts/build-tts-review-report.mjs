#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const DEFAULT_INPUT = './tmp/tts-lexicon-focused/lexicon-candidates.json'
const DEFAULT_OUTPUT_DIR = './tmp/tts-lexicon-focused/review'
const DEFAULT_TOP = 1000

const args = process.argv.slice(2)
const positional = args.filter((arg) => !arg.startsWith('--'))
const options = parseOptions(args.filter((arg) => arg.startsWith('--')))

const inputPath = path.resolve(positional[0] || options.input || DEFAULT_INPUT)
const outputDir = path.resolve(positional[1] || options.output || DEFAULT_OUTPUT_DIR)
const top = Number.isFinite(options.top) && options.top > 0 ? Math.floor(options.top) : DEFAULT_TOP

function parseOptions(optionArgs) {
  const parsed = {}
  optionArgs.forEach((arg) => {
    const [rawKey, rawValue = ''] = arg.replace(/^--/, '').split('=')
    const key = String(rawKey || '').trim()
    const value = String(rawValue || '').trim()
    if (!key) return

    if (key === 'top') {
      const asNumber = Number(value)
      if (Number.isFinite(asNumber) && asNumber > 0) parsed.top = Math.floor(asNumber)
      return
    }

    if (key === 'input' || key === 'output') parsed[key] = value
  })
  return parsed
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function normalizeLetters(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-zÇĞİÖŞÜçğıöşü]/g, '')
}

function hasVowel(value) {
  return /[aeıioöuü]/iu.test(String(value || ''))
}

function getReasonList(entry) {
  return Array.isArray(entry?.reason) ? entry.reason.map((item) => String(item || '').trim()).filter(Boolean) : []
}

function buildQualityFlags(entry) {
  const flags = []
  const token = String(entry?.token || '')
  const suggested = String(entry?.suggestedPronunciation || '')
  const normalizedToken = normalizeLetters(token)
  const reasons = getReasonList(entry)

  if (entry?.sameAsOriginal === true) flags.push('same_as_original')
  if (normalizedToken.length < 4) flags.push('short_token')
  if (!hasVowel(suggested)) flags.push('no_vowel_suggestion')
  if (/^['’]|['’]$/u.test(token)) flags.push('edge_apostrophe')
  if (reasons.length > 0 && reasons.every((reason) => reason === 'apostrophe')) flags.push('apostrophe_only')
  if (Number(entry?.count || 0) >= 1000) flags.push('very_high_frequency')

  return flags
}

function decideAutoDecision(entry, flags) {
  const reasons = getReasonList(entry)
  const count = Number(entry?.count || 0)
  const sameAsOriginal = entry?.sameAsOriginal === true
  const hasHighPriorityReason = reasons.includes('circumflex') || reasons.includes('specialized-legacy')

  if (flags.includes('no_vowel_suggestion')) return 'reject'
  if (sameAsOriginal && hasHighPriorityReason) return 'review'
  if (sameAsOriginal) return 'reject'
  if (hasHighPriorityReason) return 'accept'
  if (count >= 500 && !flags.includes('short_token')) return 'accept'
  if (flags.includes('apostrophe_only') && count < 30) return 'review'
  if (flags.includes('short_token')) return 'review'
  return 'review'
}

function toCsvCell(value) {
  const raw = String(value ?? '')
  if (!/[",\r\n]/.test(raw)) return raw
  return `"${raw.replace(/"/g, '""')}"`
}

function toCsv(rows, headers) {
  const lines = [headers.join(',')]
  rows.forEach((row) => {
    lines.push(headers.map((header) => toCsvCell(row[header])).join(','))
  })
  return `${lines.join('\n')}\n`
}

function incrementMapCounter(map, key) {
  map.set(key, (map.get(key) || 0) + 1)
}

function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`Aday dosyasi bulunamadi: ${inputPath}`)
    process.exit(1)
  }

  const parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
  const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : []
  if (!candidates.length) {
    console.error(`Aday listesi bos: ${inputPath}`)
    process.exit(1)
  }

  const byCount = candidates
    .slice()
    .sort((a, b) => {
      const countDiff = Number(b.count || 0) - Number(a.count || 0)
      if (countDiff !== 0) return countDiff
      const scoreDiff = Number(b.score || 0) - Number(a.score || 0)
      if (scoreDiff !== 0) return scoreDiff
      return String(a.token || '').localeCompare(String(b.token || ''), 'tr')
    })

  const topCandidates = byCount.slice(0, top)
  const decisionCounts = new Map()
  const reasonCounts = new Map()
  const flagCounts = new Map()

  const reviewRows = topCandidates.map((entry, index) => {
    const reasons = getReasonList(entry)
    const flags = buildQualityFlags(entry)
    const autoDecision = decideAutoDecision(entry, flags)

    reasons.forEach((reason) => incrementMapCounter(reasonCounts, reason))
    flags.forEach((flag) => incrementMapCounter(flagCounts, flag))
    incrementMapCounter(decisionCounts, autoDecision)

    return {
      rank: index + 1,
      token: String(entry.token || ''),
      count: Number(entry.count || 0),
      fileCount: Number(entry.fileCount || 0),
      reason: reasons.join('|'),
      suggestedPronunciation: String(entry.suggestedPronunciation || ''),
      sameAsOriginal: Boolean(entry.sameAsOriginal),
      score: Number(entry.score || 0),
      qualityFlags: flags.join('|'),
      autoDecision,
      reviewerDecision: '',
      reviewerNote: ''
    }
  })

  const totalFrequency = candidates.reduce((sum, entry) => sum + Number(entry.count || 0), 0)
  const topFrequency = reviewRows.reduce((sum, row) => sum + Number(row.count || 0), 0)

  const summary = {
    generatedAt: new Date().toISOString(),
    inputPath,
    outputDir,
    sourceCandidateCount: candidates.length,
    selectedTopCount: reviewRows.length,
    sourceTotalFrequency: totalFrequency,
    topTotalFrequency: topFrequency,
    topCoverageRatio: totalFrequency > 0 ? Number((topFrequency / totalFrequency).toFixed(4)) : 0,
    decisionCounts: Object.fromEntries([...decisionCounts.entries()].sort((a, b) => b[1] - a[1])),
    reasonCounts: Object.fromEntries([...reasonCounts.entries()].sort((a, b) => b[1] - a[1])),
    flagCounts: Object.fromEntries([...flagCounts.entries()].sort((a, b) => b[1] - a[1]))
  }

  ensureDir(outputDir)

  const baseName = `top-${top}-review`
  const jsonPath = path.join(outputDir, `${baseName}.json`)
  const csvPath = path.join(outputDir, `${baseName}.csv`)
  const queueCsvPath = path.join(outputDir, `${baseName}-queue.csv`)
  const mdPath = path.join(outputDir, `${baseName}.md`)
  const queueRows = reviewRows.filter((row) => row.autoDecision !== 'reject')

  fs.writeFileSync(
    jsonPath,
    `${JSON.stringify({ summary, rows: reviewRows }, null, 2)}\n`,
    'utf8'
  )

  fs.writeFileSync(
    csvPath,
    toCsv(reviewRows, [
      'rank',
      'token',
      'count',
      'fileCount',
      'reason',
      'suggestedPronunciation',
      'sameAsOriginal',
      'score',
      'qualityFlags',
      'autoDecision',
      'reviewerDecision',
      'reviewerNote'
    ]),
    'utf8'
  )

  fs.writeFileSync(
    queueCsvPath,
    toCsv(queueRows, [
      'rank',
      'token',
      'count',
      'fileCount',
      'reason',
      'suggestedPronunciation',
      'sameAsOriginal',
      'score',
      'qualityFlags',
      'autoDecision',
      'reviewerDecision',
      'reviewerNote'
    ]),
    'utf8'
  )

  const mdLines = [
    `# TTS Top ${top} Review`,
    '',
    `- Generated at: ${summary.generatedAt}`,
    `- Input: ${summary.inputPath}`,
    `- Source candidate pool size: ${summary.sourceCandidateCount}`,
    `- Selected rows: ${summary.selectedTopCount}`,
    `- Frequency coverage of selected rows: ${summary.topCoverageRatio}`,
    '',
    '## Auto Decision Counts',
    ...Object.entries(summary.decisionCounts).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Reason Counts',
    ...Object.entries(summary.reasonCounts).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Quality Flag Counts',
    ...Object.entries(summary.flagCounts).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Output Files',
    `- JSON: ${jsonPath}`,
    `- CSV: ${csvPath}`,
    `- Queue CSV (reject disi): ${queueCsvPath}`,
    `- Markdown: ${mdPath}`,
    ''
  ]

  fs.writeFileSync(mdPath, `${mdLines.join('\n')}\n`, 'utf8')

  console.log('Review report generated.')
  console.log(`Input: ${inputPath}`)
  console.log(`Output dir: ${outputDir}`)
  console.log(`Rows: ${reviewRows.length}`)
  console.log(`Queue rows: ${queueRows.length}`)
  console.log(`Coverage: ${summary.topCoverageRatio}`)
}

main()
