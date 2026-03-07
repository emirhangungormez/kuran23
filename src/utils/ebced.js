const HARAKAT_RE = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL_RE = /\u0640/g;
const ARABIC_LETTER_RE = /[\u0621-\u063A\u0641-\u064A]/;

const NORMALIZE_MAP = Object.freeze({
  'أ': 'ا',
  'إ': 'ا',
  'آ': 'ا',
  'ٱ': 'ا',
  'ؤ': 'و',
  'ئ': 'ي',
  'ى': 'ي',
  'ة': 'ه',
});

const EBCED_VALUES = Object.freeze({
  'ا': 1,
  'ء': 1,
  'ب': 2,
  'ج': 3,
  'د': 4,
  'ه': 5,
  'و': 6,
  'ز': 7,
  'ح': 8,
  'ط': 9,
  'ي': 10,
  'ك': 20,
  'ل': 30,
  'م': 40,
  'ن': 50,
  'س': 60,
  'ع': 70,
  'ف': 80,
  'ص': 90,
  'ق': 100,
  'ر': 200,
  'ش': 300,
  'ت': 400,
  'ث': 500,
  'خ': 600,
  'ذ': 700,
  'ض': 800,
  'ظ': 900,
  'غ': 1000,
});

function normalizeLetter(char) {
  return NORMALIZE_MAP[char] || char;
}

export function normalizeArabicForEbced(text) {
  if (!text) return '';

  const raw = String(text)
    .normalize('NFKC')
    .replace(HARAKAT_RE, '')
    .replace(TATWEEL_RE, '');

  let normalized = '';

  for (const char of raw) {
    if (/\s/.test(char)) {
      normalized += ' ';
      continue;
    }

    const letter = normalizeLetter(char);
    if (ARABIC_LETTER_RE.test(letter)) {
      normalized += letter;
      continue;
    }

    normalized += ' ';
  }

  return normalized.replace(/\s+/g, ' ').trim();
}

export function splitArabicLetters(text) {
  if (!text) return [];
  const normalized = normalizeArabicForEbced(text).replace(/\s+/g, '');
  return Array.from(normalized);
}

export function getEbcedValue(letter) {
  return EBCED_VALUES[letter] || 0;
}

export function calculateWordEbced(wordText) {
  const letters = splitArabicLetters(wordText).map((char, index) => {
    const value = getEbcedValue(char);
    return {
      char,
      value,
      index,
      isUnknown: value === 0,
    };
  });

  const total = letters.reduce((sum, item) => sum + item.value, 0);

  return {
    original: wordText || '',
    normalized: normalizeArabicForEbced(wordText || ''),
    letterCount: letters.length,
    letters,
    total,
    unknownCount: letters.filter((item) => item.isUnknown).length,
  };
}

export function calculateVerseEbced(words) {
  const analyses = (words || []).map((word) => calculateWordEbced(word));
  const total = analyses.reduce((sum, item) => sum + item.total, 0);
  const letterCount = analyses.reduce((sum, item) => sum + item.letterCount, 0);
  const unknownCount = analyses.reduce((sum, item) => sum + item.unknownCount, 0);

  return {
    total,
    letterCount,
    unknownCount,
    words: analyses,
  };
}

export { EBCED_VALUES };
