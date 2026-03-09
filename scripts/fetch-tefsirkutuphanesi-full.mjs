import fs from 'node:fs/promises'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'
import { surahs } from '../src/data/quranData.js'
import { TEFSIR_LIBRARY_BOOKS } from '../src/data/tefsirLibraryCatalog.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const BASE_URL = 'https://tefsirkutuphanesi.net/Kitaplar/Tefsir'
const OUTPUT_ROOT = path.join(projectRoot, 'public', 'tafsir-library')
const DEFAULT_CONCURRENCY = 4

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

function stripHtmlToText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|td|font|span|b|i|u)>/gi, '\n\n')
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

function splitBlocks(text) {
  return text
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
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

function buildSurahHtml(title, introBlocks, verses) {
  const parts = ['<div class="tafsir-content-wrapper">']
  const heading = introBlocks[0] || title
  parts.push(`<h2>${escapeHtml(heading)}</h2>`)

  for (const block of introBlocks.slice(1)) {
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

function extractSurahContent(rawText, ayahCount, title) {
  const blocks = splitBlocks(rawText)
  const verses = {}
  const introBlocks = []
  let currentAyah = null

  for (const block of blocks) {
    const numeric = /^(?<ayah>\d{1,3})$/.exec(block)
    const nextAyah = Number(numeric?.groups?.ayah)

    if (Number.isInteger(nextAyah) && nextAyah >= 1 && nextAyah <= ayahCount) {
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
    availableAyahs.map((ayahNo) => [String(ayahNo), buildVerseHtml(ayahNo, verses[ayahNo])])
  )

  return {
    surahHtml: buildSurahHtml(title, introBlocks, verses),
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

    const extracted = extractSurahContent(text, surah.ayahCount, `${surah.no} - ${surah.nameTr} Sûresi`)
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
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    books: {},
    errors: []
  }

  await fs.mkdir(OUTPUT_ROOT, { recursive: true })

  for (const book of books) {
    console.log(`\n[Kitap] ${book.sourceId} (${book.bookId})`)
    const results = await runLimited(selectedSurahs, args.concurrency, (surah) => fetchSurahPayload(book, surah, args))

    const surahEntries = results
      .filter((result) => result?.status === 'ok' || result?.status === 'skipped')
      .map((result) => ({
        surahId: result.surahId,
        availableAyahs: result.availableAyahs
      }))
      .sort((a, b) => a.surahId - b.surahId)

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
    books: Object.values(report.books)
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
