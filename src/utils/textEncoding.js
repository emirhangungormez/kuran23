// Detect common mojibake fragments while avoiding valid Turkish chars like "â".
const MOJIBAKE_MARKER_REGEX = /(?:[\u00c2-\u00c5][\u0080-\u00bf]|[\u00e2][\u0080-\u00bf]|\ufffd)/
const MOJIBAKE_MARKER_GLOBAL_REGEX = /(?:[\u00c2-\u00c5][\u0080-\u00bf]|[\u00e2][\u0080-\u00bf]|\ufffd)/g

// Reverse map for bytes 0x80-0x9F in Windows-1252.
const CP1252_REVERSE_MAP = new Map([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f]
])

function mojibakeScore(value) {
  if (!value) return 0
  const markerCount = (value.match(MOJIBAKE_MARKER_GLOBAL_REGEX) || []).length
  const replacementCount = (value.match(/\ufffd/g) || []).length
  return markerCount + replacementCount * 2
}

function decodeLatin1AsUtf8(value) {
  try {
    const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff)
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  } catch {
    return value
  }
}

function decodeCp1252AsUtf8(value) {
  try {
    const bytes = new Uint8Array(value.length)

    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i)
      const mapped = CP1252_REVERSE_MAP.get(code)
      if (mapped !== undefined) {
        bytes[i] = mapped
      } else if (code <= 0xff) {
        bytes[i] = code
      } else {
        bytes[i] = 0x3f
      }
    }

    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  } catch {
    return value
  }
}

function maybeFixMojibake(value) {
  if (!value || !MOJIBAKE_MARKER_REGEX.test(value)) return value

  const candidates = new Set([value, decodeCp1252AsUtf8(value), decodeLatin1AsUtf8(value)])

  // One extra round catches nested corruption such as UTF-8 -> CP1252 -> UTF-8.
  for (const candidate of Array.from(candidates)) {
    candidates.add(decodeCp1252AsUtf8(candidate))
    candidates.add(decodeLatin1AsUtf8(candidate))
  }

  const originalScore = mojibakeScore(value)
  let best = value
  let bestScore = originalScore

  for (const candidate of candidates) {
    const score = mojibakeScore(candidate)
    if (score < bestScore) {
      best = candidate
      bestScore = score
    }
  }

  return bestScore < originalScore ? best : value
}

export function normalizeTafsirText(value) {
  if (typeof value !== 'string' || !value) return value || ''

  const cleaned = value
    .replace(/\ufeff/g, '')
    .replace(/\u00a0/g, ' ')

  return maybeFixMojibake(cleaned)
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
