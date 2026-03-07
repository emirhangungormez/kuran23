const MOJIBAKE_REPLACEMENTS = [
  ['?', 'ü'],
  ['Ãœ', 'Ü'],
  ['?', 'ö'],
  ['Ã–', 'Ö'],
  ['?', 'ç'],
  ['Ã‡', 'Ç'],
  ['ÄŸ', 'ğ'],
  ['Äž', 'Ğ'],
  ['?', 'Ğ'],
  ['?', 'İ'],
  ['?', 'ı'],
  ['ÅŸ', 'ş'],
  ['?', 'ş'],
  ['?', 'Ş'],
  ['?', 'â'],
  ['Ã‚', 'Â'],
  ['?', 'ê'],
  ['ÃŠ', 'Ê'],
  ['?', 'î'],
  ['ÃŽ', 'Î'],
  ['?', 'û'],
  ['Ã›', 'Û'],
  ['â€™', '’'],
  ['â€œ', '“'],
  ['â€', '”'],
  ['â€“', '–'],
  ['â€”', '—'],
  ['â€¦', '…'],
  ['â€¢', '•'],
  ['?', '·'],
  ['Â ', ' '],
  ['Â', '']
]

export function normalizeTafsirText(value) {
  if (typeof value !== 'string' || !value) return value || ''

  let output = value
  for (const [broken, fixed] of MOJIBAKE_REPLACEMENTS) {
    output = output.split(broken).join(fixed)
  }
  return output
}

const INVISIBLE_ARABIC_MARKS_REGEX = /[\u200c\u200d\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g
const QURANIC_ANNOTATIONS_REGEX = /[\u0610-\u061a\u06d6-\u06ed]/g
const ARABIC_VERSE_ORNAMENTS_REGEX = /[\u06dd\u06de\u06e9]/g

export function normalizeArabicDisplayText(value, options = {}) {
  if (typeof value !== 'string' || !value) return value || ''

  const stripQuranicAnnotations = options.stripQuranicAnnotations !== false
  const stripVerseOrnaments = options.stripVerseOrnaments !== false
  // NFKC prevents mixed presentation-form glyph fallback on final letters.
  let output = value.normalize('NFKC').replace(INVISIBLE_ARABIC_MARKS_REGEX, '')

  if (stripQuranicAnnotations) {
    output = output.replace(QURANIC_ANNOTATIONS_REGEX, '')
  }

  if (stripVerseOrnaments) {
    output = output.replace(ARABIC_VERSE_ORNAMENTS_REGEX, '')
  }

  return output
}
