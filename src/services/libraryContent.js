const LIBRARY_MANIFEST_URL = '/tafsir-library/manifest.json'

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'force-cache' })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json()
}

export async function loadLibraryManifest() {
  return fetchJson(LIBRARY_MANIFEST_URL)
}

export async function loadLibrarySurah({ bookId, surahId }) {
  const normalizedBookId = String(bookId || '').trim()
  const normalizedSurahId = Number(surahId)
  if (!normalizedBookId || !Number.isInteger(normalizedSurahId) || normalizedSurahId < 1) {
    throw new Error('Geçersiz kitap veya sûre kimliği')
  }

  const paddedSurahId = String(normalizedSurahId).padStart(3, '0')
  return fetchJson(`/tafsir-library/${normalizedBookId}/${paddedSurahId}.json`)
}

export function getManifestBookEntry(manifest, bookId) {
  return manifest?.books?.find((book) => book.bookId === bookId || book.sourceId === bookId) || null
}

export function getSurahIdsFromManifest(manifest, bookId) {
  const entry = getManifestBookEntry(manifest, bookId)
  return Array.isArray(entry?.surahs)
    ? entry.surahs
        .map((surah) => Number(surah.surahId))
        .filter((surahId) => Number.isInteger(surahId) && surahId > 0)
        .sort((a, b) => a - b)
    : []
}

export function getAyahNumbersFromManifest(manifest, bookId, surahId) {
  const entry = getManifestBookEntry(manifest, bookId)
  const surahEntry = entry?.surahs?.find((surah) => Number(surah.surahId) === Number(surahId))
  return Array.isArray(surahEntry?.availableAyahs)
    ? surahEntry.availableAyahs
        .map((ayahNo) => Number(ayahNo))
        .filter((ayahNo) => Number.isInteger(ayahNo) && ayahNo > 0)
        .sort((a, b) => a - b)
    : []
}

export function getRawTafsirHtml({ scope, surahData, surahId, ayahNo }) {
  if (!surahData) return ''
  if (scope === 'surah') return surahData.surahHtml || ''
  return surahData.verse?.[String(ayahNo)] || surahData.verse?.[`${Number(surahId)}:${Number(ayahNo)}`] || ''
}
