import { stripArabicDiacritics } from './textEncoding'

export const TEXT_MODE_OPTIONS = [
  { value: 'uthmani', label: 'Harekeli' },
  { value: 'plain', label: 'Harekesiz' },
  { value: 'tajweed', label: 'Tecvid' }
]

export const TEXT_MODE_LABELS = TEXT_MODE_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label
  return acc
}, {})

export function normalizeTextMode(value, legacyShowTajweed = false) {
  const raw = String(value || '').trim().toLowerCase()
  if (raw === 'uthmani' || raw === 'plain' || raw === 'tajweed') return raw
  return legacyShowTajweed ? 'tajweed' : 'uthmani'
}

export function modeToLegacyTajweed(mode) {
  return normalizeTextMode(mode) === 'tajweed'
}

export function buildTextModesFromVerse(verse = {}) {
  const uthmani =
    verse.text_modes?.uthmani ||
    verse.verse_text_uthmani ||
    verse.verse ||
    verse.verse_text ||
    ''
  const plain =
    verse.text_modes?.plain ||
    verse.verse_text_plain ||
    verse.verse_without_vowel ||
    verse.verse_simplified ||
    uthmani
  const tajweed =
    verse.text_modes?.tajweed ||
    verse.verse_text_tajweed ||
    verse.verse_tajweed ||
    uthmani

  return { uthmani, plain, tajweed }
}

export function getVerseTextByMode(verse = {}, requestedMode = 'uthmani') {
  const textModes = buildTextModesFromVerse(verse)
  const mode = normalizeTextMode(requestedMode, false)
  if (mode === 'plain') {
    return stripArabicDiacritics(textModes.plain || textModes.uthmani || '')
  }
  return textModes[mode] || textModes.uthmani || ''
}
