import fs from 'node:fs/promises'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'
import { surahs } from '../src/data/quranData.js'
import { TEFSIR_LIBRARY_BOOKS } from '../src/data/tefsirLibraryCatalog.js'
import { normalizeTafsirText } from '../src/utils/textEncoding.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const BASE_URL = 'https://tefsirkutuphanesi.net/Kitaplar/Tefsir'
const OUTPUT_ROOT = path.join(projectRoot, 'public', 'tafsir-library')
const DEFAULT_CONCURRENCY = 4
const SENTENCE_END_REGEX = /[.!?:;)\]»”]$/
const SURAH_HEADING_REGEX = /\bSURESI\b/i

function parseArgs(argv) {
  const args = {
    concurrency: DEFAULT_CONCURRENCY,
    skipExisting: false,
    books: [],
    surahs: []
  }

  argv.forEach((arg) => {
    if (arg === '--skip-existing') args.skipExisting = true
    else if (arg.startsWith('--concurrency=')) args.concurrency = Math.max(1, Number.parseInt(arg.split('=')[1], 10) || DEFAULT_CONCURRENCY)
    else if (arg.startsWith('--book=')) args.books = arg.split('=')[1].split(',').map((item) => item.trim()).filter(Boolean)
    else if (arg.startsWith('--surah=')) args.surahs = arg.split('=')[1].split(',').map((item) => Number.parseInt(item.trim(), 10)).filter((item) => Number.isInteger(item) && item >= 1 && item <= 114)
  })

  return args
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (
          res.statusCode &&
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          const redirected = new URL(res.headers.location, url).toString()
          res.resume()
          resolve(fetchText(redirected))
          return
        }

        if (res.statusCode !== 200) {
          const code = res.statusCode || 'ERR'
          res.resume()
          reject(new Error(`HTTP ${code}`))
          return
        }

        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      })
      .on('error', reject)
  })
}

function decodeEntities(value) {
  const entityMap = {
    nbsp: ' ',
    amp: '&',
    quot: '"',
    apos: "'",
    lt: '<',
    gt: '>',
    rsquo: '’',
    lsquo: '‘',
    rdquo: '”',
    ldquo: '“',
    mdash: '—',
    ndash: '–'
  }

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity) => {
    const key = String(entity).toLowerCase()
    if (key in entityMap) return entityMap[key]

    if (key.startsWith('#x')) {
      const code = Number.parseInt(key.slice(2), 16)
      return Number.isFinite(code) ? String.fromCodePoint(code) : ''
    }

    if (key.startsWith('#')) {
      const code = Number.parseInt(key.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : ''
    }

    return ' '
  })
}

function stripHtmlTags(html) {
  return decodeEntities(
    String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|td)>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \f\v]+/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
  )
}

function stripHtmlToText(html) {
  return stripHtmlTags(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
  )
}

function normalizeBlockText(value) {
  return String(value || '')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function shouldMergeBlocks(previous, current) {
  if (!previous || !current) return false
  if (/^\d{1,3}$/.test(previous) || /^\d{1,3}$/.test(current)) return false
  if (SURAH_HEADING_REGEX.test(normalizeComparable(previous)) || SURAH_HEADING_REGEX.test(normalizeComparable(current))) return false
  if (previous.length > 220) return false

  const currentStartsInline = /^[a-zçğıöşüâîû(“"'’,-]/iu.test(current)
  const previousLooksIncomplete = !SENTENCE_END_REGEX.test(previous)
  const hasShortFragment = previous.length <= 40 || current.length <= 40
  return previousLooksIncomplete && (currentStartsInline || hasShortFragment)
}

function compactBlocks(blocks) {
  const merged = []

  for (const block of blocks) {
    const normalized = normalizeBlockText(block)
    if (!normalized) continue

    const previous = merged[merged.length - 1]
    if (shouldMergeBlocks(previous, normalized)) {
      merged[merged.length - 1] = `${previous} ${normalized}`.replace(/\s{2,}/g, ' ').trim()
      continue
    }

    merged.push(normalized)
  }

  return merged
}

function splitBlocks(text) {
  return compactBlocks(
    text
      .split(/\n{2,}/)
      .map((line) => normalizeBlockText(line))
      .filter(Boolean)
  )
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function extractMainContentHtml(rawHtml) {
  const normalized = String(rawHtml || '')
    .replace(/\ufeff/g, '')
    .replace(/\u00a0/g, ' ')
  if (!normalized.trim()) return ''

  const textMatch = normalized.match(/<div[^>]+id=["']text["'][^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>\s*){0,4}/i)
  if (textMatch?.[1]) return textMatch[1].trim()

  const tdMatches = [...normalized.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
  if (tdMatches.length) {
    const ranked = tdMatches
      .map((match) => match[1])
      .sort((left, right) => right.length - left.length)
    return String(ranked[0] || '').trim()
  }

  return normalized.trim()
}

function sanitizeLegacyHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?font\b[^>]*>/gi, '')
    .replace(/<(\/?)(b)\b[^>]*>/gi, '<$1strong>')
    .replace(/<(\/?)(i)\b[^>]*>/gi, '<$1em>')
    .replace(/<(\/?)(u)\b[^>]*>/gi, '<$1span>')
    .replace(/<(h[1-4]|p|span|strong|em|br)\b[^>]*>/gi, '<$1>')
    .replace(/<o:p>\s*<\/o:p>/gi, '')
    .replace(/<o:p>/gi, '')
    .replace(/<\/o:p>/gi, '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .trim()
}

function extractHtmlBlocks(html) {
  const sanitized = sanitizeLegacyHtml(html)
  const matches = [...sanitized.matchAll(/<(h1|h2|h3|h4|p)\b[^>]*>[\s\S]*?<\/\1>/gi)]
  return matches.map((match) => {
    const rawHtml = match[0].trim()
    return {
      html: rawHtml,
      text: normalizeBlockText(stripHtmlTags(rawHtml))
    }
  }).filter((block) => block.text)
}

function getHtmlAyahMarker(blockText, surah) {
  const direct = /^(?<ayah>\d{1,3})$/.exec(blockText)
  const ayahNo = Number(direct?.groups?.ayah)
  if (Number.isInteger(ayahNo) && ayahNo >= 1 && ayahNo <= surah.ayahCount) return ayahNo

  const wrapped = /^\((?<ayah>\d{1,3})\)$/.exec(blockText)
  const wrappedAyahNo = Number(wrapped?.groups?.ayah)
  if (Number.isInteger(wrappedAyahNo) && wrappedAyahNo >= 1 && wrappedAyahNo <= surah.ayahCount) return wrappedAyahNo

  return null
}

function findSurahStartIndex(blocks, surah) {
  const numberedTitleIndex = blocks.findIndex((block) => /^\s*\d{1,3}\s*[-.)]\s*/.test(block.text) && /s[ûu]resi/i.test(block.text))
  if (numberedTitleIndex >= 0) return numberedTitleIndex

  const titleIndex = blocks.findIndex((block) => isSurahTitleBlock(block.text, surah))
  if (titleIndex >= 0) return titleIndex

  return 0
}

function buildWrappedHtml(blocks) {
  if (!Array.isArray(blocks) || !blocks.length) return ''
  return ['<div class="tafsir-content-wrapper">', ...blocks.map((block) => block.html), '</div>'].join('\n')
}

function extractSurahContentFromHtml(rawHtml, surah) {
  const mainHtml = extractMainContentHtml(rawHtml)
  if (!mainHtml) return null

  const allBlocks = extractHtmlBlocks(mainHtml)
  if (!allBlocks.length) return null

  const startIndex = findSurahStartIndex(allBlocks, surah)
  const blocks = allBlocks.slice(startIndex)
  if (!blocks.length) return null

  const verses = {}
  const introBlocks = []
  const surahBlocks = []
  let currentAyah = null

  for (const block of blocks) {
    const nextAyah = getHtmlAyahMarker(block.text, surah)
    if (nextAyah) {
      currentAyah = nextAyah
      if (!verses[currentAyah]) verses[currentAyah] = []
    }

    surahBlocks.push(block)

    if (currentAyah === null) introBlocks.push(block)
    else verses[currentAyah].push(block)
  }

  const availableAyahs = Object.keys(verses)
    .map((ayahNo) => Number(ayahNo))
    .filter((ayahNo) => {
      const blocksForAyah = verses[ayahNo] || []
      const contentText = normalizeBlockText(
        blocksForAyah
          .map((block) => block.text)
          .filter((text) => text && text !== String(ayahNo) && text !== `(${ayahNo})`)
          .join(' ')
      )
      return Boolean(contentText)
    })
    .sort((a, b) => a - b)

  return {
    surahHtml: trimLeadingFrontMatter(buildWrappedHtml(surahBlocks)),
    verse: Object.fromEntries(availableAyahs.map((ayahNo) => [String(ayahNo), buildWrappedHtml(verses[ayahNo] || [])])),
    availableAyahs
  }
}

function blockToHtml(block) {
  return `<p>${escapeHtml(block)}</p>`
}

function buildVerseHtml(ayahNo, blocks) {
  if (!Array.isArray(blocks) || !blocks.length) return ''
  return [
    '<div class="tafsir-content-wrapper">',
    `<h3>${ayahNo}</h3>`,
    ...blocks.map(blockToHtml),
    '</div>'
  ].join('\n')
}

function normalizeComparable(value) {
  return normalizeTafsirText(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleUpperCase('tr-TR')
    .replace(/[\-–—:;,.()[\]'"`’“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isSurahTitleBlock(block, surah) {
  const normalizedBlock = normalizeComparable(block)
  const normalizedSurahName = normalizeComparable(surah.nameTr)
  const normalizedLabel = normalizeComparable(`${surah.no} ${surah.nameTr} Sûresi`)
  const startsWithNumber = normalizedBlock.startsWith(`${surah.no} `) || normalizedBlock === String(surah.no)
  const startsWithName = normalizedBlock.startsWith(normalizedSurahName)

  return normalizedBlock.startsWith(normalizedLabel) || (
    (startsWithNumber || startsWithName) &&
    normalizedBlock.includes(normalizedSurahName) &&
    SURAH_HEADING_REGEX.test(normalizedBlock)
  )
}

function sanitizeIntroBlocks(introBlocks, surah) {
  const blocks = compactBlocks(introBlocks)
  const numberedTitleIndex = blocks.findIndex((block) => /^\s*\d{1,3}\s*[-.)]\s*/.test(block) && /s[ûu]resi/i.test(block))
  if (numberedTitleIndex > 0) return blocks.slice(numberedTitleIndex)
  const titleIndex = blocks.findIndex((block) => isSurahTitleBlock(block, surah))
  if (titleIndex > 0) return blocks.slice(titleIndex)
  return blocks
}

function splitHeadingBlock(block, surah) {
  const text = normalizeBlockText(block)
  if (!text) return { heading: `${surah.no} - ${surah.nameTr} Sûresi`, remainder: '' }

  const surahHeadingMatch = text.match(new RegExp(`^\\s*${surah.no}\\s*[-.)]?\\s*.+?s[ûu]resi\\b`, 'iu'))
  if (surahHeadingMatch) {
    const heading = normalizeBlockText(surahHeadingMatch[0])
    const remainder = normalizeBlockText(text.slice(surahHeadingMatch[0].length))
    return { heading, remainder }
  }

  return { heading: text, remainder: '' }
}

function buildSurahHtml(surah, introBlocks, verses) {
  const cleanedIntroBlocks = sanitizeIntroBlocks(introBlocks, surah)
  const { heading, remainder } = splitHeadingBlock(cleanedIntroBlocks[0], surah)
  const parts = ['<div class="tafsir-content-wrapper">', `<h2>${escapeHtml(heading)}</h2>`]

  if (remainder) {
    parts.push(blockToHtml(remainder))
  }

  for (const block of cleanedIntroBlocks.slice(1)) {
    parts.push(blockToHtml(block))
  }

  Object.keys(verses)
    .map((ayahNo) => Number(ayahNo))
    .sort((a, b) => a - b)
    .forEach((ayahNo) => {
      parts.push(`<h3>${ayahNo}</h3>`)
      for (const block of verses[ayahNo] || []) {
        parts.push(blockToHtml(block))
      }
    })

  parts.push('</div>')
  return parts.join('\n')
}

function trimLeadingFrontMatter(html) {
  const pattern = /^<div class="tafsir-content-wrapper">\s*<h2>(?<currentHeading>[\s\S]*?)<\/h2>(?<beforeTitle>[\s\S]*?)<p>(?<surahHeading>\d{1,3}\s*-\s*.+?S[ÛU]RESİ)<\/p>\s*/u
  const match = html.match(pattern)
  if (!match?.groups) return html

  const normalizedCurrentHeading = normalizeComparable(match.groups.currentHeading)
  if (/^\d{1,3}\s/.test(normalizedCurrentHeading) && SURAH_HEADING_REGEX.test(normalizedCurrentHeading)) {
    return html
  }

  return html.replace(
    pattern,
    `<div class="tafsir-content-wrapper">\n<h2>${match.groups.surahHeading}</h2>\n`
  )
}

function extractSurahContent(rawText, surah) {
  const blocks = splitBlocks(rawText)
  const verses = {}
  const introBlocks = []
  let currentAyah = null

  for (const block of blocks) {
    const numeric = /^(?<ayah>\d{1,3})$/.exec(block)
    const nextAyah = Number(numeric?.groups?.ayah)

    if (Number.isInteger(nextAyah) && nextAyah >= 1 && nextAyah <= surah.ayahCount) {
      currentAyah = nextAyah
      if (!verses[currentAyah]) verses[currentAyah] = []
      continue
    }

    if (currentAyah === null) introBlocks.push(block)
    else verses[currentAyah].push(block)
  }

  const availableAyahs = Object.keys(verses)
    .map((ayahNo) => Number(ayahNo))
    .filter((ayahNo) => Array.isArray(verses[ayahNo]) && verses[ayahNo].length > 0)
    .sort((a, b) => a - b)

  const verseHtml = Object.fromEntries(
    availableAyahs.map((ayahNo) => [String(ayahNo), buildVerseHtml(ayahNo, compactBlocks(verses[ayahNo]))])
  )

  return {
    surahHtml: trimLeadingFrontMatter(buildSurahHtml(surah, introBlocks, verses)),
    verse: verseHtml,
    availableAyahs
  }
}

async function fileExists(targetFile) {
  try {
    await fs.access(targetFile)
    return true
  } catch {
    return false
  }
}

async function readJsonIfExists(targetFile, fallback) {
  try {
    const raw = await fs.readFile(targetFile, 'utf8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function runLimited(items, limit, worker) {
  const results = []
  let nextIndex = 0

  async function runner() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await worker(items[currentIndex], currentIndex)
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length || 1) }, () => runner())
  await Promise.all(runners)
  return results
}

async function fetchSurahPayload(book, surah, options) {
  const paddedSurahId = String(surah.no).padStart(3, '0')
  const outputDir = path.join(OUTPUT_ROOT, book.sourceId)
  const outputFile = path.join(outputDir, `${paddedSurahId}.json`)

  if (options.skipExisting && await fileExists(outputFile)) {
    const raw = await fs.readFile(outputFile, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      status: 'skipped',
      book: book.sourceId,
      surahId: surah.no,
      availableAyahs: Object.keys(parsed.verse || {}).map(Number).sort((a, b) => a - b)
    }
  }

  const sourceUrl = `${BASE_URL}/${book.bookId}/${paddedSurahId}/000.htm`

  try {
    const rawHtml = await fetchText(sourceUrl)
    const text = stripHtmlToText(rawHtml)
    if (!text.trim()) {
      return { status: 'empty', book: book.sourceId, surahId: surah.no, sourceUrl }
    }

    const extracted = extractSurahContentFromHtml(rawHtml, surah) || extractSurahContent(text, surah)
    if (!extracted.surahHtml.trim() && !Object.keys(extracted.verse).length) {
      return { status: 'empty', book: book.sourceId, surahId: surah.no, sourceUrl }
    }

    const payload = {
      bookId: book.sourceId,
      surahId: surah.no,
      surahHtml: extracted.surahHtml,
      verse: extracted.verse,
      meta: {
        sourceUrl,
        sourceBookId: book.bookId,
        generatedAt: new Date().toISOString()
      }
    }

    await fs.mkdir(outputDir, { recursive: true })
    await fs.writeFile(outputFile, JSON.stringify(payload), 'utf8')

    return {
      status: 'ok',
      book: book.sourceId,
      surahId: surah.no,
      availableAyahs: extracted.availableAyahs
    }
  } catch (error) {
    return {
      status: 'error',
      book: book.sourceId,
      surahId: surah.no,
      sourceUrl,
      message: error?.message || 'Bilinmeyen hata'
    }
  }
}

function selectBooks(args) {
  if (!args.books.length) return TEFSIR_LIBRARY_BOOKS
  const requested = new Set(args.books)
  return TEFSIR_LIBRARY_BOOKS.filter((book) => requested.has(book.sourceId) || requested.has(book.bookId))
}

function selectSurahs(args) {
  if (!args.surahs.length) return surahs
  const requested = new Set(args.surahs)
  return surahs.filter((surah) => requested.has(Number(surah.no)))
}

async function buildLibraryDataset(args) {
  const books = selectBooks(args)
  const selectedSurahs = selectSurahs(args)
  const existingManifest = await readJsonIfExists(path.join(OUTPUT_ROOT, 'manifest.json'), null)
  const existingReport = await readJsonIfExists(path.join(OUTPUT_ROOT, 'report.json'), null)
  const selectedBookIds = new Set(books.map((book) => book.sourceId))

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    books: { ...(existingReport?.books || {}) },
    errors: Array.isArray(existingReport?.errors)
      ? existingReport.errors.filter((error) => !selectedBookIds.has(error.book))
      : []
  }

  await fs.mkdir(OUTPUT_ROOT, { recursive: true })

  for (const book of books) {
    console.log(`\n[Kitap] ${book.sourceId} (${book.bookId})`)
    const results = await runLimited(selectedSurahs, args.concurrency, (surah) => fetchSurahPayload(book, surah, args))

    const previousBookEntry = report.books[book.sourceId] || existingManifest?.books?.find((entry) => entry.sourceId === book.sourceId)
    const surahMap = new Map(
      Array.isArray(previousBookEntry?.surahs)
        ? previousBookEntry.surahs.map((entry) => [entry.surahId, entry])
        : []
    )

    results
      .filter((result) => result?.status === 'ok' || result?.status === 'skipped')
      .forEach((result) => {
        surahMap.set(result.surahId, {
          surahId: result.surahId,
          availableAyahs: result.availableAyahs
        })
      })

    const surahEntries = Array.from(surahMap.values()).sort((a, b) => a.surahId - b.surahId)

    report.books[book.sourceId] = {
      sourceId: book.sourceId,
      bookId: book.bookId,
      shortLabel: book.shortLabel,
      tabLabel: book.tabLabel,
      sourceLabel: book.sourceLabel,
      titleTr: book.titleTr,
      authorTr: book.authorTr,
      surahs: surahEntries
    }

    results
      .filter((result) => result?.status === 'error')
      .forEach((result) => report.errors.push(result))

    const okCount = results.filter((result) => result?.status === 'ok').length
    const skipCount = results.filter((result) => result?.status === 'skipped').length
    const emptyCount = results.filter((result) => result?.status === 'empty').length
    const errorCount = results.filter((result) => result?.status === 'error').length
    console.log(`  tamam: ${okCount} | skip: ${skipCount} | boş: ${emptyCount} | hata: ${errorCount}`)
  }

  const manifest = {
    version: 1,
    generatedAt: report.generatedAt,
    baseUrl: BASE_URL,
    books: Object.values(report.books).sort((a, b) => String(a.bookId).localeCompare(String(b.bookId), 'tr'))
  }

  await fs.writeFile(path.join(OUTPUT_ROOT, 'manifest.json'), JSON.stringify(manifest), 'utf8')
  await fs.writeFile(path.join(OUTPUT_ROOT, 'report.json'), JSON.stringify(report), 'utf8')

  return { manifest, report }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { manifest, report } = await buildLibraryDataset(args)

  console.log(`\nManifest kitap sayısı: ${manifest.books.length}`)
  console.log(`Toplam hata: ${report.errors.length}`)
  console.log(`Çıktı dizini: ${path.relative(projectRoot, OUTPUT_ROOT)}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
