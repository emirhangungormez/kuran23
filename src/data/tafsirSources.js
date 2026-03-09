import { TEFSIRKUTUPHANESI_FATIHA_DATA } from './tefsirkutuphanesiFatihaData.js'
import { TEFSIR_LIBRARY_BOOKS } from './tefsirLibraryCatalog'

const CORE_TAFSIR_SOURCES = [
  {
    id: 'kuran23',
    shortLabel: 'Kuran23',
    tabLabel: 'Kuran23 Tefsiri',
    sourceLabel: 'Kuran23 Tefsiri'
  },
  {
    id: 'diyanet',
    shortLabel: 'Diyanet',
    tabLabel: 'Diyanet Tefsiri',
    sourceLabel: "Diyanet İşleri Başkanlığı - Kur'an Yolu"
  }
]

const KUTUPHANE_SOURCES = TEFSIR_LIBRARY_BOOKS.map((book) => ({
  id: book.sourceId,
  shortLabel: book.shortLabel,
  tabLabel: book.tabLabel,
  sourceLabel: book.sourceLabel,
  bookId: book.bookId
}))

export const TAFSIR_SOURCES = [...CORE_TAFSIR_SOURCES, ...KUTUPHANE_SOURCES]

export const TAFSIR_SOURCE_MAP = Object.fromEntries(
  TAFSIR_SOURCES.map((source) => [source.id, source])
)

const MANUAL_SOURCE_TAFSIR = TEFSIRKUTUPHANESI_FATIHA_DATA?.content || {}

export function getManualSurahSourceTafsir(sourceId, surahId) {
  const sid = Number(surahId)
  return MANUAL_SOURCE_TAFSIR[sourceId]?.surah?.[sid] || ''
}

export function getManualVerseSourceTafsir(sourceId, surahId, ayahNo) {
  const sid = Number(surahId)
  const ayah = Number(ayahNo)
  return MANUAL_SOURCE_TAFSIR[sourceId]?.verse?.[`${sid}:${ayah}`] || ''
}

export function extractSourceSpecificTafsir() {
  return ''
}
