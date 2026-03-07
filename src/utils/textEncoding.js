const MOJIBAKE_MARKER_REGEX = /(?:Ã.|â.|Â.|Å.|Ä.|�)/
const MOJIBAKE_MARKER_GLOBAL_REGEX = /(?:Ã.|â.|Â.|Å.|Ä.|�)/g

// Reverse map for bytes 0x80-0x9F in Windows-1252.
const CP1252_REVERSE_MAP = new Map([
  ['€', 0x80],
  ['‚', 0x82],
  ['ƒ', 0x83],
  ['„', 0x84],
  ['…', 0x85],
  ['†', 0x86],
  ['‡', 0x87],
  ['ˆ', 0x88],
  ['‰', 0x89],
  ['Š', 0x8a],
  ['‹', 0x8b],
  ['Œ', 0x8c],
  ['Ž', 0x8e],
  ['‘', 0x91],
  ['’', 0x92],
  ['“', 0x93],
  ['”', 0x94],
  ['•', 0x95],
  ['–', 0x96],
  ['—', 0x97],
  ['˜', 0x98],
  ['™', 0x99],
  ['š', 0x9a],
  ['›', 0x9b],
  ['œ', 0x9c],
  ['ž', 0x9e],
  ['Ÿ', 0x9f]
])

function mojibakeScore(value) {
  if (!value) return 0
  const matches = value.match(MOJIBAKE_MARKER_GLOBAL_REGEX)
  const markerCount = matches ? matches.length : 0
  const replacementCount = (value.match(/�/g) || []).length
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
      const ch = value[i]
      const mapped = CP1252_REVERSE_MAP.get(ch)
      if (mapped !== undefined) {
        bytes[i] = mapped
        continue
      }
      const code = ch.charCodeAt(0)
      bytes[i] = code <= 0xff ? code : 0x3f
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  } catch {
    return value
  }
}

function maybeFixMojibake(value) {
  if (!value || !MOJIBAKE_MARKER_REGEX.test(value)) return value

  const candidates = new Set([value])
  candidates.add(decodeCp1252AsUtf8(value))
  candidates.add(decodeLatin1AsUtf8(value))

  // Try one more round for nested breakage.
  const round1 = Array.from(candidates)
  for (const c of round1) {
    candidates.add(decodeCp1252AsUtf8(c))
    candidates.add(decodeLatin1AsUtf8(c))
  }

  let best = value
  let bestScore = mojibakeScore(value)
  for (const candidate of candidates) {
    const score = mojibakeScore(candidate)
    if (score < bestScore) {
      best = candidate
      bestScore = score
    }
  }

  return best
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
