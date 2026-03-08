import fs from 'node:fs/promises'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const BASE_URL = 'https://tefsirkutuphanesi.net/Kitaplar/Tefsir'
const SURAH_ID = '001'
const MAX_AYAH = 7

const BOOKS = [
  {
    id: '01',
    sourceId: 'celaleyn',
    shortLabel: 'Celaleyn',
    tabLabel: 'Celaleyn Tefsiri',
    sourceLabel: 'Tefsir Kütüphanesi - Celaleyn Tefsiri (Kitap 01)'
  },
  {
    id: '02',
    sourceId: 'beydavi',
    shortLabel: 'Beydavi',
    tabLabel: 'Beydavi Tefsiri',
    sourceLabel: 'Tefsir Kütüphanesi - Beydavi Tefsiri (Kitap 02)'
  },
  {
    id: '03',
    sourceId: 'nesefi',
    shortLabel: 'Nesefi',
    tabLabel: 'Nesefi Tefsiri',
    sourceLabel: 'Tefsir Kütüphanesi - Nesefi Tefsiri (Kitap 03)'
  },
  {
    id: '04',
    sourceId: 'kurtubi',
    shortLabel: 'Kurtubi',
    tabLabel: 'Kurtubi Tefsiri',
    sourceLabel: 'Tefsir Kütüphanesi - Kurtubi Tefsiri (Kitap 04)'
  },
  {
    id: '05',
    sourceId: 'ibn_cevzi',
    shortLabel: "İbnü'l-Cevzi",
    tabLabel: "Zadü'l-Mesir (İbnü'l-Cevzi)",
    sourceLabel: "Tefsir Kütüphanesi - Zadü'l-Mesir (İbnü'l-Cevzi, Kitap 05)"
  },
  {
    id: '06',
    sourceId: 'suyuti_durrul_mensur',
    shortLabel: 'Suyuti',
    tabLabel: "ed-Dürrü'l-Me'sur (Suyuti)",
    sourceLabel: "Tefsir Kütüphanesi - ed-Dürrü'l-Me'sur (Suyuti, Kitap 06)"
  },
  {
    id: '07',
    sourceId: 'ebussuud',
    shortLabel: "Ebu's-Suud",
    tabLabel: "Ebu's-Suud Tefsiri",
    sourceLabel: "Tefsir Kütüphanesi - Ebu's-Suud Tefsiri (Kitap 07)"
  },
  {
    id: '08',
    sourceId: 'razi',
    shortLabel: 'Razi',
    tabLabel: 'Tefsir-i Kebir (Razi)',
    sourceLabel: 'Tefsir Kütüphanesi - Tefsir-i Kebir (Razi, Kitap 08)'
  },
  {
    id: '10',
    sourceId: 'taberi',
    shortLabel: 'Taberi',
    tabLabel: 'Taberi Tefsiri',
    sourceLabel: 'Tefsir Kütüphanesi - Taberi Tefsiri (Kitap 10)'
  },
  {
    id: '11',
    sourceId: 'ruhulbeyan',
    shortLabel: "Ruhu'l-Beyan",
    tabLabel: "Ruhu'l-Beyan Tefsiri",
    sourceLabel: "Tefsir Kütüphanesi - Ruhu'l-Beyan Tefsiri (Kitap 11)"
  },
  {
    id: '12',
    sourceId: 'elmalili_orijinal',
    shortLabel: 'Elmalili (Orijinal)',
    tabLabel: 'Elmalili Tefsiri (Orijinal)',
    sourceLabel: 'Tefsir Kütüphanesi - Elmalili Tefsiri (Kitap 12)'
  },
  {
    id: '13',
    sourceId: 'elmalili_sadelestirilmis',
    shortLabel: 'Elmalili (Sade)',
    tabLabel: 'Elmalili Tefsiri (Sadeleştirilmiş)',
    sourceLabel: 'Tefsir Kütüphanesi - Elmalili Tefsiri (Sadeleştirilmiş, Kitap 13)'
  },
  {
    id: '14',
    sourceId: 'besairul_kuran',
    shortLabel: "Besairu'l Kur'an",
    tabLabel: "Besairu'l Kur'an",
    sourceLabel: "Tefsir Kütüphanesi - Besairu'l Kur'an (Kitap 14)"
  },
  {
    id: '15',
    sourceId: 'ibn_kesir',
    shortLabel: 'İbn Kesir',
    tabLabel: "İbn Kesir Tefsiri",
    sourceLabel: 'Tefsir Kütüphanesi - İbn Kesir Tefsiri (Kitap 15)'
  },
  {
    id: '16',
    sourceId: 'fizilalil_kuran',
    shortLabel: "Fizilal'il Kur'an",
    tabLabel: "Seyyid Kutub - Fizilal'il Kur'an",
    sourceLabel: "Tefsir Kütüphanesi - Seyyid Kutub, Fizilal'il Kur'an (Kitap 16)"
  },
  {
    id: '17',
    sourceId: 'tefhimul_kuran',
    shortLabel: "Tefhimu'l Kur'an",
    tabLabel: "Tefhimu'l Kur'an - Mevdudi",
    sourceLabel: "Tefsir Kütüphanesi - Tefhimu'l Kur'an (Mevdudi, Kitap 17)"
  }
]

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

function findAyahStart(html, ayahNo) {
  if (ayahNo === 0) {
    const markers = [
      /FÂTİHA\s+S[ÛU]RES[İI]/i,
      /FATİHA\s+S[ÛU]RES[İI]/i,
      /FATIHA\s+SURESI/i
    ]
    for (const marker of markers) {
      const idx = html.search(marker)
      if (idx >= 0) return idx
    }
    return 0
  }

  const headingPattern = new RegExp(
    `<h[1-6][^>]*>\\s*(?:<[^>]+>\\s*)*${ayahNo}\\s*(?:<[^>]+>\\s*)*<\\/h[1-6]>`,
    'i'
  )
  const idx = html.search(headingPattern)
  return idx >= 0 ? idx : 0
}

function limitBlocks(blocks, ayahNo) {
  const maxBlocks = ayahNo === 0 ? 24 : 12
  const maxChars = ayahNo === 0 ? 14000 : 7000

  const limited = []
  let total = 0

  for (const block of blocks) {
    if (limited.length >= maxBlocks) break
    const nextTotal = total + block.length
    if (nextTotal > maxChars) break
    limited.push(block)
    total = nextTotal
  }

  return limited.length ? limited : blocks.slice(0, Math.min(4, blocks.length))
}

function textToHtml(text, fallbackTitle, ayahNo) {
  const blocks = text
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!blocks.length) return ''

  const clippedBlocks = limitBlocks(blocks, ayahNo)
  const parts = ['<div class="tafsir-content-wrapper">']
  const first = clippedBlocks[0]

  if (first.length < 120 && /fatiha|suresi|tefsiri|^\d+$|^\d+\s*[\-–:]/i.test(first)) {
    parts.push(`<h3>${escapeHtml(first)}</h3>`)
    for (const block of clippedBlocks.slice(1)) {
      parts.push(`<p>${escapeHtml(block)}</p>`)
    }
  } else {
    parts.push(`<h3>${escapeHtml(fallbackTitle)}</h3>`)
    for (const block of clippedBlocks) {
      parts.push(`<p>${escapeHtml(block)}</p>`)
    }
  }

  parts.push('</div>')
  return parts.join('\n')
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function fetchAyahHtml(bookId, ayahNo) {
  const ayahId = String(ayahNo).padStart(3, '0')
  const url = `${BASE_URL}/${bookId}/${SURAH_ID}/${ayahId}.htm`

  try {
    const rawHtml = await fetchText(url)
    const start = findAyahStart(rawHtml, ayahNo)
    const sliced = rawHtml.slice(start)
    const text = stripHtmlToText(sliced)
    if (!text.trim()) return ''
    return textToHtml(text, ayahNo === 0 ? 'Fatiha Suresi' : `${ayahNo}. Ayet Tefsiri`, ayahNo)
  } catch {
    return ''
  }
}

async function buildDataset() {
  const dataset = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    surahId: 1,
    maxAyah: MAX_AYAH,
    sources: BOOKS.map((book) => ({
      id: book.sourceId,
      shortLabel: book.shortLabel,
      tabLabel: book.tabLabel,
      sourceLabel: book.sourceLabel,
      bookId: book.id
    })),
    content: {}
  }

  for (const book of BOOKS) {
    const sourceEntry = {
      surah: {},
      verse: {}
    }

    for (let ayahNo = 0; ayahNo <= MAX_AYAH; ayahNo += 1) {
      const html = await fetchAyahHtml(book.id, ayahNo)
      if (!html) continue

      if (ayahNo === 0) {
        sourceEntry.surah[1] = html
      } else {
        sourceEntry.verse[`1:${ayahNo}`] = html
      }
    }

    dataset.content[book.sourceId] = sourceEntry
  }

  return dataset
}

async function main() {
  const dataset = await buildDataset()
  const targetFile = path.join(projectRoot, 'src', 'data', 'tefsirkutuphanesiFatihaData.js')
  const js = [
    '// Auto-generated by scripts/fetch-tefsirkutuphanesi-fatiha.mjs',
    `export const TEFSIRKUTUPHANESI_FATIHA_DATA = ${JSON.stringify(dataset, null, 2)};`,
    ''
  ].join('\n')

  await fs.writeFile(targetFile, js, 'utf8')
  console.log(`Generated: ${path.relative(projectRoot, targetFile)}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
