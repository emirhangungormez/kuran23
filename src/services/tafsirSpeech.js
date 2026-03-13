import { GENERATED_TTS_LEXICON } from '../data/generatedTtsLexicon.js'
import { GENERATED_TTS_LEMMA_LEXICON } from '../data/generatedTtsLemmaLexicon.js'
import { RUNTIME_TTS_EXCEPTIONS } from '../data/runtimeTtsExceptions.js'

const PIPER_CDN_URL = 'https://cdn.jsdelivr.net/npm/piper-tts-web@1.1.2/dist/piper-tts-web.js'
let piperModulePromise = null

function getSpeechSynthesisInstance() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  return window.speechSynthesis
}

export function isTafsirSpeechSupported() {
  return Boolean(getSpeechSynthesisInstance() && typeof window.SpeechSynthesisUtterance !== 'undefined')
}

function normalizeVoiceName(name) {
  return String(name || '').trim().toLocaleLowerCase('tr-TR')
}

const FEMALE_VOICE_MARKERS = [
  'female',
  'woman',
  'microsoft ayse',
  'ayse',
  'emel',
  'seda',
  'selen',
  'selin',
  'selma',
  'filiz',
  'eda',
  'esra',
  'zira',
  'zira desktop'
]

const MALE_VOICE_MARKERS = [
  'male',
  'man',
  'erkek',
  'ahmet',
  'mehmet',
  'ali',
  'murat',
  'cem',
  'emre',
  'kaan',
  'hakan',
  'fatih',
  'onur',
  'ocal',
  'fahrettin',
  'fettah',
  'tolga',
  'yusuf',
  'mustafa'
]

function isLikelyFemaleVoice(voice) {
  const name = normalizeVoiceName(voice?.name)
  return FEMALE_VOICE_MARKERS.some((marker) => name.includes(marker))
}

function isLikelyMaleVoice(voice) {
  const name = normalizeVoiceName(voice?.name)
  return MALE_VOICE_MARKERS.some((marker) => name.includes(marker))
}

function isTurkishVoice(voice) {
  const lang = String(voice?.lang || '').toLocaleLowerCase('tr-TR')
  const name = normalizeVoiceName(voice?.name)
  return lang.startsWith('tr') || name.includes('turk') || name.includes('türk')
}

function isArabicVoice(voice) {
  const lang = String(voice?.lang || '').toLocaleLowerCase('tr-TR')
  const name = normalizeVoiceName(voice?.name)
  return lang.startsWith('ar') || name.includes('arabic') || name.includes('arap')
}

const ARABIC_CHAR_CLASS = '\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF'
const ARABIC_CHAR_REGEX = new RegExp(`[${ARABIC_CHAR_CLASS}]`, 'u')
const ARABIC_CHAR_REGEX_GLOBAL = new RegExp(`[${ARABIC_CHAR_CLASS}]`, 'gu')
const LATIN_TURKISH_CHAR_REGEX_GLOBAL = /[A-Za-zÇĞİÖŞÜçğıöşü]/g
const ARABIC_RUN_SPLIT_REGEX = new RegExp(`[${ARABIC_CHAR_CLASS}]+|[^${ARABIC_CHAR_CLASS}]+`, 'gu')

const TAFSIR_SPEECH_REPLACEMENTS = [
  [/\bs\.a\.v\.?\b/gi, 'sallallahu aleyhi ve sellem'],
  [/\ba\.s\.?\b/gi, 'aleyhisselam'],
  [/\br\.a\.?\b/gi, 'radiyallahu anh'],
  [/\br\.\s*anh[üu]m\b/gi, 'radiyallahu anhum'],
  [/\bk\.s\.?\b/gi, 'kuddise sirruh'],
  [/\bc\.c\.?\b/gi, 'celle celaluhu'],
  [/\bhz\.\b/gi, 'Hazreti'],
  [/\bM\.Ö\.\b/gi, 'milattan önce'],
  [/\bM\.S\.\b/gi, 'milattan sonra'],
  [/\bH\.\s*(\d+)\.\s*yüzyıl\b/gi, 'hicri $1. yüzyıl'],
  [/\bM\.\s*(\d+)\.\s*yüzyıl\b/gi, 'miladi $1. yüzyıl'],
  [/\bdr\./gi, 'doktor'],
  [/\bprof\./gi, 'profesör'],
  [/\bdoç\./gi, 'doçent'],
  [/\bbkz?\./gi, 'bak\u0131n\u0131z'],
  [/\bkr\u015f\./gi, 'kar\u015f\u0131la\u015ft\u0131r\u0131n\u0131z'],
  [/\bv\.\s*d\./gi, 've devam\u0131'],
  [/\bv\.\s*s\./gi, 've saire'],
  [/\byy\./gi, 'y\u00fczy\u0131l'],
  [/\bno\./gi, 'numara'],
  [/(\d+)\s*\/\s*(\d+)/g, '$1 bölü $2'],
  [/sûre/gi, 'sure'],
  [/âyet/gi, 'ayet'],
  [/teâlâ/gi, 'teala'],
  [/şeyh/gi, 'seyh']
]

const TR_PRONUNCIATION_LEXICON = [
  [/\bkâfir\b/gi, 'kaafir'],
  [/\bhâlâ\b/gi, 'haalaa'],
  [/\bsûre\b/gi, 'suure'],
  [/\bnüzûl\b/gi, 'nüzuul'],
  [/\bnüzul\b/gi, 'nüzuul'],
  [/\bmüteşabih\b/gi, 'müteşaabih'],
  [/\bmüteşâbih\b/gi, 'müteşaabih'],
  [/\bmuhkem\b/gi, 'muhkem'],
  [/\btefsir\b/gi, 'tefsiir'],
  [/\btefsîr\b/gi, 'tefsiir'],
  [/\bte'vil\b/gi, 'tevil'],
  [/\bte’vil\b/gi, 'tevil'],
  [/\btev'il\b/gi, 'tevil'],
  [/\bmeâl\b/gi, 'meaal'],
  [/\bmeal\b/gi, 'meaal'],
  [/\bâyet\b/gi, 'aayet'],
  [/\bâyeti\b/gi, 'aayeti'],
  [/\bkıraat\b/gi, 'kıraat'],
  [/\bzâhir\b/gi, 'zaahir'],
  [/\bbâtın\b/gi, 'baatın'],
  [/\bfıkıh\b/gi, 'fıkıh'],
  [/\baleyhissel[aâ]m\b/gi, 'aleyhisselaam'],
  [/\bsallallahu aleyhi ve sellem\b/gi, 'sallallahu aleyhi vesellem'],
  [/\brad[iı]yallahu anh\b/gi, 'radiyallahu anh'],
  [/\bteâlâ\b/gi, 'tealaa'],
  [/\bisnad\b/gi, 'isnaad'],
  [/\brivayet\b/gi, 'rivaayet'],
  [/\bkıyamet\b/gi, 'kıyaamet'],
  [/\bkelâm\b/gi, 'kelam'],
  [/\bistiğfar\b/gi, 'istiğfar'],
  [/\bKur'an\b/gi, 'Kuran'],
  [/\brahmân\b/gi, 'rahmaan'],
  [/\brahîm\b/gi, 'rahiim'],
  [/\bmelekût\b/gi, 'melekuut'],
  [/\bnasih\b/gi, 'naasih'],
  [/\bmensuh\b/gi, 'mensuuh'],
  [/\bmensûh\b/gi, 'mensuuh'],
  [/\btebliğ\b/gi, 'tebliğ'],
  [/\btesbih\b/gi, 'tesbih'],
  [/\btenzih\b/gi, 'tenzih'],
  [/\btevhid\b/gi, 'tevhid'],
  [/\btevhîd\b/gi, 'tevhiid'],
  [/\bubudiyet\b/gi, 'ubuudiyet'],
  [/\bubûdiyet\b/gi, 'ubuudiyet'],
  [/\bilahî\b/gi, 'ilaahii'],
  [/\bilâhî\b/gi, 'ilaahii'],
  [/\brisalet\b/gi, 'risaalet'],
  [/\brisâlet\b/gi, 'risaalet'],
  [/\bnübüvvet\b/gi, 'nübüvvet'],
  [/\bmarifet\b/gi, 'maarifet'],
  [/\bhikmet\b/gi, 'hikmet'],
  [/\bhakikat\b/gi, 'hakikat'],
  [/\bşeriat\b/gi, 'şeriaat'],
  [/\btarikat\b/gi, 'tarikat'],
  [/\bmarifetullah\b/gi, 'maarifetullah'],
  [/\bmuhabbetullah\b/gi, 'muhabbetullah'],
  [/\besmâ-i hüsnâ\b/gi, 'esmaai hüsnaa'],
  [/\besmâ\b/gi, 'esmaa'],
  [/\bhususî\b/gi, 'hususii'],
  [/\bumumî\b/gi, 'umumii'],
  [/\bcemâl\b/gi, 'cemaal'],
  [/\bcelâl\b/gi, 'celaal'],
  [/\bkemâl\b/gi, 'kemaal'],
  [/\bhelâk\b/gi, 'helaak'],
  [/\bharâm\b/gi, 'haraam'],
  [/\bhalâl\b/gi, 'halaal']
]

const TR_FOCUSED_PRONUNCIATION_LEXICON = [
  [/\bresulullah\b/gi, 'resuulullah'],
  [/\brasulullah\b/gi, 'rasuulullah'],
  [/\bcenab\b/gi, 'cenaab'],
  [/\baleyhisselam\b/gi, 'aleyhisselaam'],
  [/\bteala\b/gi, 'teaalaa'],
  [/\bcelaluhu\b/gi, 'celaaluhu'],
  [/\bbinaenaleyh\b/gi, 'binaaenaleyh'],
  [/\brivayet\b/gi, 'rivaayet'],
  [/\bdelalet\b/gi, 'delaalet'],
  [/\bmucize\b/gi, 'muucize'],
  [/\bmucizeler\b/gi, 'muucizeler'],
  [/\bmesela\b/gi, 'meselaa'],
  [/\bahiret\b/gi, 'aahiret'],
  [/\bahirette\b/gi, 'aahirette'],
  [/\bilah\b/gi, 'ilaah'],
  [/\bilahi\b/gi, 'ilaahii'],
  [/\bkatade\b/gi, 'kataade'],
  [/\bm[\u00fcu]cahid\b/gi, 'm\u00fccaahid'],
  [/\bbeyhaki\b/gi, 'beyhakii'],
  [/\btirmizi\b/gi, 'tirmizii'],
  [/\bbuhari\b/gi, 'buhaarii'],
  [/\btaberani\b/gi, 'taberaanii'],
  [/\btaberi\b/gi, 'taberii'],
  [/\bbeydavi\b/gi, 'beydaavii'],
  [/\bnesefi\b/gi, 'nesefii'],
  [/\bs[\u00fcu]yuti\b/gi, 's\u00fcyuutii'],
  [/\bzemah[s\u015f]eri\b/gi, 'zemah\u015ferii'],
  [/\bmaturidi\b/gi, 'maatuuridii'],
  [/\bmukatil\b/gi, 'mukaatil'],
  [/\bmusa\b/gi, 'muusa'],
  [/\bisa\b/gi, 'iisa'],
  [/\byusuf\b/gi, 'yuusuf'],
  [/\byakub\b/gi, 'yakuub'],
  [/\bnuh\b/gi, 'nuuh'],
  [/\blut\b/gi, 'luut'],
  [/\bharun\b/gi, 'haaruun'],
  [/\bdavud\b/gi, 'daavuud'],
  [/\beyyub\b/gi, 'eyyuub']
]

const MAX_GENERATED_TTS_LEXICON_ENTRIES = 200
const MAX_GENERATED_TTS_LEMMA_LEXICON_ENTRIES = 200

function buildEffectivePronunciationLexicon() {
  const merged = [...RUNTIME_TTS_EXCEPTIONS, ...TR_PRONUNCIATION_LEXICON, ...TR_FOCUSED_PRONUNCIATION_LEXICON]
  const seenPatterns = new Set(merged.map(([pattern]) => `${pattern.source}__${pattern.flags}`))
  const generatedEntries = Array.isArray(GENERATED_TTS_LEXICON)
    ? GENERATED_TTS_LEXICON.slice(0, MAX_GENERATED_TTS_LEXICON_ENTRIES)
    : []

  generatedEntries.forEach((entry) => {
    if (!Array.isArray(entry) || entry.length < 2) return
    const [pattern, replacement] = entry
    if (!(pattern instanceof RegExp) || typeof replacement !== 'string') return

    const patternKey = `${pattern.source}__${pattern.flags}`
    if (seenPatterns.has(patternKey)) return
    seenPatterns.add(patternKey)
    merged.push([pattern, replacement])
  })

  const generatedLemmaEntries = Array.isArray(GENERATED_TTS_LEMMA_LEXICON)
    ? GENERATED_TTS_LEMMA_LEXICON.slice(0, MAX_GENERATED_TTS_LEMMA_LEXICON_ENTRIES)
    : []

  generatedLemmaEntries.forEach((entry) => {
    if (!Array.isArray(entry) || entry.length < 2) return
    const [pattern, replacement] = entry
    if (!(pattern instanceof RegExp) || typeof replacement !== 'string') return

    const patternKey = `${pattern.source}__${pattern.flags}`
    if (seenPatterns.has(patternKey)) return
    seenPatterns.add(patternKey)
    merged.push([pattern, replacement])
  })

  return merged
}

const EFFECTIVE_TR_PRONUNCIATION_LEXICON = buildEffectivePronunciationLexicon()

const ARABIC_DIACRITIC_LEXICON = [
  ['\u0628\u0633\u0645 \u0627\u0644\u0644\u0647 \u0627\u0644\u0631\u062d\u0645\u0646 \u0627\u0644\u0631\u062d\u064a\u0645', '\u0628\u0650\u0633\u0652\u0645\u0650 \u0627\u0644\u0644\u0651\u064e\u0647\u0650 \u0627\u0644\u0631\u0651\u064e\u062d\u0652\u0645\u064e\u0670\u0646\u0650 \u0627\u0644\u0631\u0651\u064e\u062d\u0650\u064a\u0645\u0650'],
  ['\u0623\u0639\u0648\u0630 \u0628\u0627\u0644\u0644\u0647 \u0645\u0646 \u0627\u0644\u0634\u064a\u0637\u0627\u0646 \u0627\u0644\u0631\u062c\u064a\u0645', '\u0623\u064e\u0639\u064f\u0648\u0630\u064f \u0628\u0650\u0627\u0644\u0644\u0651\u064e\u0647\u0650 \u0645\u0650\u0646\u064e \u0627\u0644\u0634\u0651\u064e\u064a\u0652\u0637\u064e\u0627\u0646\u0650 \u0627\u0644\u0631\u0651\u064e\u062c\u0650\u064a\u0645\u0650'],
  ['\u0627\u0639\u0648\u0630 \u0628\u0627\u0644\u0644\u0647 \u0645\u0646 \u0627\u0644\u0634\u064a\u0637\u0627\u0646 \u0627\u0644\u0631\u062c\u064a\u0645', '\u0623\u064e\u0639\u064f\u0648\u0630\u064f \u0628\u0650\u0627\u0644\u0644\u0651\u064e\u0647\u0650 \u0645\u0650\u0646\u064e \u0627\u0644\u0634\u0651\u064e\u064a\u0652\u0637\u064e\u0627\u0646\u0650 \u0627\u0644\u0631\u0651\u064e\u062c\u0650\u064a\u0645\u0650'],
  ['\u0635\u0644\u0649 \u0627\u0644\u0644\u0647 \u0639\u0644\u064a\u0647 \u0648\u0633\u0644\u0645', '\u0635\u064e\u0644\u0651\u064e\u0649 \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0644\u064e\u064a\u0652\u0647\u0650 \u0648\u064e\u0633\u064e\u0644\u0651\u064e\u0645\u064e'],
  ['\u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647', '\u0631\u064e\u0636\u0650\u064a\u064e \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0646\u0652\u0647\u064f'],
  ['\u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647\u0627', '\u0631\u064e\u0636\u0650\u064a\u064e \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0646\u0652\u0647\u064e\u0627'],
  ['\u0631\u0636\u064a \u0627\u0644\u0644\u0647 \u0639\u0646\u0647\u0645', '\u0631\u064e\u0636\u0650\u064a\u064e \u0627\u0644\u0644\u0651\u064e\u0647\u064f \u0639\u064e\u0646\u0652\u0647\u064f\u0645\u0652'],
  ['\u0633\u0628\u062d\u0627\u0646\u0647 \u0648\u062a\u0639\u0627\u0644\u0649', '\u0633\u064f\u0628\u0652\u062d\u064e\u0627\u0646\u064e\u0647\u064f \u0648\u064e\u062a\u064e\u0639\u064e\u0627\u0644\u064e\u0649'],
  ['\u062c\u0644 \u062c\u0644\u0627\u0644\u0647', '\u062c\u064e\u0644\u0651\u064e \u062c\u064e\u0644\u064e\u0627\u0644\u064f\u0647\u064f'],
  ['\u0627\u0644\u0642\u0631\u0622\u0646', '\u0627\u0644\u0652\u0642\u064f\u0631\u0652\u0622\u0646'],
  ['الله', 'اللّٰه'],
  ['الرحمن', 'الرَّحْمٰن'],
  ['الرحيم', 'الرَّحِيم'],
  ['مالك', 'مَالِك'],
  ['يوم', 'يَوْم'],
  ['الدين', 'الدِّين'],
  ['الصراط', 'الصِّرَاط'],
  ['المستقيم', 'الْمُسْتَقِيم']
]

const ARABIC_QURANIC_PAUSE_REPLACEMENTS = [
  [/[\u06D6\u06DA]/gu, '\u060c '],
  [/[\u06D7\u06D9\u06DB\u06DC]/gu, '. '],
  [/[\u06DD\u06DE]/gu, '. '],
  [/[\uFD3E\uFD3F]/gu, ' ']
]
const ARABIC_QURANIC_ANNOTATION_REGEX = /[\u06D6-\u06ED]/gu
const ARABIC_STANDALONE_NUMBER_REGEX = /(^|[^\p{L}])(?:[\u0660-\u0669\u06F0-\u06F90-9]+)(?=$|[^\p{L}])/gu

function normalizeBaseSpeechText(text) {
  let normalized = String(text || '')

  TAFSIR_SPEECH_REPLACEMENTS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement)
  })

  return normalized
    .replace(/[ـ]+/gu, '')
    .replace(/[“”"]/g, '')
    .replace(/\.{3,}/g, '…')
    .replace(/\(([^)]*?)\)/g, ' $1 ')
    .replace(/(?<!\d)\/(?!\d)/g, ' ')
    .replace(/([,:;!?])([^\s])/g, '$1 $2')
    .replace(/([.۔،؟!؛:…]){2,}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeTurkishOrthography(text) {
  let normalized = String(text || '')
    .normalize('NFKC')
    .replace(/[’`´‘‛]/g, "'")
    .replace(/[\u0300-\u036f]/g, '')

  // Sesi daha dogru uzatmak icin sapkali harfleri speech-only transliterasyona cevir.
  normalized = normalized
    .replace(/kâ/gi, 'kaa')
    .replace(/gâ/gi, 'gaa')
    .replace(/lâ/gi, 'laa')
    .replace(/â/gi, 'aa')
    .replace(/î/gi, 'ii')
    .replace(/û/gi, 'uu')

  // Kelime içi kesmeleri sadeleştir (te'vil -> tevil, Kur'an -> Kuran).
  normalized = normalized.replace(/([A-Za-zÇĞİÖŞÜçğıöşü])'([A-Za-zÇĞİÖŞÜçğıöşü])/g, '$1$2')
  // Osmanlıca tireli izafet kalıplarını birleştir (Ayet-i -> Ayeti, şerif-i -> şerifi).
  normalized = normalized.replace(/\b([A-Za-zÇĞİÖŞÜçğıöşü]+)-([ıiuüİIUÜ])\b/g, '$1$2')

  return normalized
}

function applyTurkishPronunciationLexicon(text) {
  let next = normalizeTurkishOrthography(text)
  EFFECTIVE_TR_PRONUNCIATION_LEXICON.forEach(([pattern, value]) => {
    next = next.replace(pattern, value)
  })
  return next
}

function normalizeArabicText(text, options = {}) {
  let normalized = String(text || '')
    .normalize('NFKC')
    .replace(/[\u0640]+/gu, '')

  ARABIC_QURANIC_PAUSE_REPLACEMENTS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement)
  })

  normalized = normalized
    .replace(ARABIC_QURANIC_ANNOTATION_REGEX, ' ')
    .replace(ARABIC_STANDALONE_NUMBER_REGEX, '$1')
    .replace(/[\u060C]+/gu, '\u060C ')
    .replace(/[\u061B]+/gu, '\u061B ')
    .replace(/[\u061F]+/gu, '\u061F ')

  if (options.aggressiveArabicNormalization === true) {
    normalized = normalized
      .replace(/[ٱأإآ]/gu, 'ا')
      .replace(/ى/gu, 'ي')
      .replace(/ؤ/gu, 'و')
      .replace(/ئ/gu, 'ي')
      .replace(/[ۖۗۘۙۚۛۜ۝۞]/gu, ' ')
  }

  return normalized
    .replace(/\s+/g, ' ')
    .trim()
}

function applyArabicDiacritization(text, options = {}) {
  const useDiacritics = options.useArabicDiacritics !== false
  let next = normalizeArabicText(text, options)

  if (!useDiacritics) return next

  ARABIC_DIACRITIC_LEXICON.forEach(([token, replacement]) => {
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(`(^|[^${ARABIC_CHAR_CLASS}])(${escapedToken})(?=$|[^${ARABIC_CHAR_CLASS}])`, 'gu')
    next = next.replace(pattern, (_, prefix) => `${prefix}${replacement}`)
  })
  return next
}

function detectSegmentLanguage(text) {
  const content = String(text || '')
  if (!content) return 'tr-TR'
  const arabicCount = (content.match(ARABIC_CHAR_REGEX_GLOBAL) || []).length
  const latinCount = (content.match(LATIN_TURKISH_CHAR_REGEX_GLOBAL) || []).length
  if (arabicCount > latinCount) return 'ar-SA'
  return 'tr-TR'
}

function splitByLanguage(text) {
  const source = String(text || '').trim()
  if (!source) return []

  const runs = source.match(ARABIC_RUN_SPLIT_REGEX) || []
  const rawParts = runs
    .map((chunk) => String(chunk || '').trim())
    .filter(Boolean)
    .map((chunk) => ({
      text: chunk,
      lang: ARABIC_CHAR_REGEX.test(chunk) ? 'ar-SA' : 'tr-TR'
    }))

  if (!rawParts.length) return [{ text: source, lang: detectSegmentLanguage(source) }]

  // Sadece noktalama/ayrac içeren chunk'ları onceki anlamsal parçaya ekleyelim.
  const parts = []
  rawParts.forEach((item) => {
    const hasArabic = ARABIC_CHAR_REGEX.test(item.text)
    const hasLatin = /[A-Za-zÇĞİÖŞÜçğıöşü]/u.test(item.text)
    if (!hasArabic && !hasLatin && parts.length) {
      const last = parts[parts.length - 1]
      last.text = `${last.text} ${item.text}`.trim()
      return
    }
    parts.push(item)
  })

  return parts
}

function splitLongText(text, maxLength = 220) {
  const source = String(text || '').trim()
  if (!source) return []
  if (source.length <= maxLength) return [source]

  const segments = source
    .split(/(?<=[.!?:;…۔،؛؟])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean)

  if (!segments.length) return [source]

  const output = []
  let current = ''
  segments.forEach((part) => {
    const candidate = current ? `${current} ${part}` : part
    if (candidate.length > maxLength && current) {
      output.push(current)
      current = part
      return
    }
    current = candidate
  })
  if (current) output.push(current)

  return output.length ? output : [source]
}

function getPauseMs(text, lang) {
  const safeText = String(text || '').trim()
  if (!safeText) return 150

  if (String(lang || '').toLowerCase().startsWith('ar')) {
    if (/[\u06DD\uFD3E\uFD3F]$/.test(safeText)) return 420
    if (/\u2026$/.test(safeText)) return 360
    if (/[\u061F]$/.test(safeText)) return 340
    if (/[\u061B]$/.test(safeText)) return 300
    if (/[\u060C]$/.test(safeText)) return 240
    if (/[.!:]$/.test(safeText)) return 320
    return 190
  }

  if (/…$/.test(safeText)) return 340
  if (/[.!?]$/.test(safeText)) return 280
  if (/[,;:]$/.test(safeText)) return 180
  return 150
}

function getRateMultiplier(text, lang) {
  const safeText = String(text || '').trim()
  if (!safeText) return 1

  if (String(lang || '').toLowerCase().startsWith('ar')) {
    const arabicCharCount = (safeText.match(ARABIC_CHAR_REGEX_GLOBAL) || []).length
    if (arabicCharCount > 100) return 0.76
    if (arabicCharCount > 56) return 0.8
    return 0.84
  }

  if (/\b\d+\.?\s*ayet\b/i.test(safeText)) return 0.93
  if (/…$/.test(safeText)) return 0.9
  if (/[!?]$/.test(safeText)) return 0.92
  if (/[:;]$/.test(safeText)) return 0.96
  return 1
}

export function buildTafsirSpeechQueue(text, options = {}) {
  const maxLength = Math.max(100, Math.min(320, Number(options.maxChunkLength) || 220))
  const normalized = normalizeBaseSpeechText(String(text || '').trim())
  if (!normalized) return []

  const langParts = splitByLanguage(normalized)
  const queue = []

  langParts.forEach((part) => {
    const chunkMaxLength = part.lang?.startsWith('ar') ? Math.min(maxLength, 160) : maxLength
    splitLongText(part.text, chunkMaxLength).forEach((chunk) => {
      const trimmed = chunk.trim()
      if (!trimmed) return
      const lang = part.lang || detectSegmentLanguage(trimmed)
      const preparedText = lang.startsWith('ar')
        ? applyArabicDiacritization(trimmed, options)
        : applyTurkishPronunciationLexicon(trimmed)
      const pauseMs = getPauseMs(preparedText, lang)
      const rateMultiplier = getRateMultiplier(preparedText, lang)
      queue.push({
        text: preparedText,
        lang,
        pauseMs,
        rateMultiplier
      })
    })
  })

  if (!queue.length) {
    const lang = detectSegmentLanguage(normalized)
    return [{
      text: lang.startsWith('ar')
        ? applyArabicDiacritization(normalized, options)
        : applyTurkishPronunciationLexicon(normalized),
      lang,
      pauseMs: getPauseMs(normalized, lang),
      rateMultiplier: 1
    }]
  }

  return queue
}

export function getTafsirVoices(lang = 'tr') {
  const synthesis = getSpeechSynthesisInstance()
  if (!synthesis) return []

  const target = String(lang || 'tr').toLocaleLowerCase('tr-TR')
  const filterByLang = (voice) => {
    if (target.startsWith('ar')) {
      return isArabicVoice(voice) && !isLikelyFemaleVoice(voice)
    }

    return isTurkishVoice(voice) && isLikelyMaleVoice(voice) && !isLikelyFemaleVoice(voice)
  }

  return (synthesis.getVoices() || [])
    .filter(filterByLang)
    .map((voice) => ({
      id: `${voice.name}__${voice.lang}`,
      name: voice.name,
      lang: voice.lang,
      default: Boolean(voice.default)
    }))
}

export function subscribeTafsirVoices(onChange, lang = 'tr') {
  const synthesis = getSpeechSynthesisInstance()
  if (!synthesis || typeof onChange !== 'function') return () => {}

  const emit = () => onChange(getTafsirVoices(lang))
  emit()

  synthesis.addEventListener?.('voiceschanged', emit)
  return () => synthesis.removeEventListener?.('voiceschanged', emit)
}

export function resolveTafsirVoice(voiceName) {
  const synthesis = getSpeechSynthesisInstance()
  if (!synthesis) return null

  const voices = (synthesis.getVoices() || []).filter((voice) => isTurkishVoice(voice))
  const normalizedTarget = normalizeVoiceName(voiceName)

  if (normalizedTarget) {
    const exactMatch = voices.find((voice) => (
      normalizeVoiceName(voice.name) === normalizedTarget
      && isLikelyMaleVoice(voice)
      && !isLikelyFemaleVoice(voice)
    ))
    if (exactMatch) return exactMatch
  }

  const maleMatch = voices.find((voice) => isLikelyMaleVoice(voice) && !isLikelyFemaleVoice(voice))
  if (maleMatch) return maleMatch

  return null
}

export function resolveTafsirVoiceByLanguage(lang, voiceName) {
  const synthesis = getSpeechSynthesisInstance()
  if (!synthesis) return null

  const targetLang = String(lang || 'tr-TR').toLocaleLowerCase('tr-TR')
  const isArabicTarget = targetLang.startsWith('ar')
  const normalizedTargetName = normalizeVoiceName(voiceName)
  const voices = synthesis.getVoices() || []
  const filtered = voices.filter((voice) => (isArabicTarget ? isArabicVoice(voice) : isTurkishVoice(voice)))

  if (normalizedTargetName) {
    const exact = filtered.find((voice) => {
      if (normalizeVoiceName(voice.name) !== normalizedTargetName) return false
      if (isLikelyFemaleVoice(voice)) return false
      return isArabicTarget ? true : isLikelyMaleVoice(voice)
    })
    if (exact) return exact
  }

  const allowed = filtered.filter((voice) => (
    !isLikelyFemaleVoice(voice)
    && (isArabicTarget || isLikelyMaleVoice(voice))
  ))

  const scoreVoice = (voice) => {
    const voiceLang = String(voice?.lang || '').toLowerCase()
    let score = 0
    if (isArabicTarget) {
      if (voiceLang.startsWith('ar')) score += 50
      if (/ar-(sa|eg|jo|ae)\b/.test(voiceLang)) score += 10
    } else if (voiceLang.startsWith('tr')) {
      score += 50
    }
    if (voice?.default) score += 10
    if (isLikelyMaleVoice(voice) && !isLikelyFemaleVoice(voice)) score += 8
    if (isLikelyFemaleVoice(voice)) score -= 4
    return score
  }

  if (allowed.length) {
    return allowed
      .slice()
      .sort((a, b) => scoreVoice(b) - scoreVoice(a))[0]
  }

  return null
}

export function stripHtmlForSpeech(html) {
  const source = String(html || '').trim()
  if (!source) return ''

  const prepared = source
    .replace(/<br\s*\/?>/gi, '. ')
    .replace(/<\/p>/gi, '. ')
    .replace(/<\/li>/gi, '. ')
    .replace(/<\/h[1-6]>/gi, '. ')
    .replace(/<li>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')

  return normalizeBaseSpeechText(prepared)
}

export function estimateTafsirSpeechDuration(text, rate = 1) {
  const normalizedRate = Math.min(1.5, Math.max(0.7, Number(rate) || 1))
  const safeText = String(text || '').trim()
  if (!safeText) return 0

  const charsPerSecond = 14
  return Math.max(2, safeText.length / (charsPerSecond * normalizedRate))
}

function pickGoogleTranslateSampleText(text, maxLength = 180) {
  const normalized = normalizeBaseSpeechText(String(text || '').trim())
  if (!normalized) return ''

  const firstSentence = normalized
    .split(/[.!?؟؛۔…]/u)
    .map((part) => part.trim())
    .find(Boolean) || normalized
  return firstSentence.length > maxLength ? firstSentence.slice(0, maxLength).trim() : firstSentence
}

export function getGoogleTranslateTtsUrl(text, options = {}) {
  const sample = pickGoogleTranslateSampleText(text, Number(options.maxLength) || 180)
  if (!sample) return ''

  const lang = String(options.lang || 'tr').toLowerCase().startsWith('ar') ? 'ar' : 'tr'
  const query = encodeURIComponent(sample)
  return `https://translate.googleapis.com/translate_tts?ie=UTF-8&client=gtx&tl=${lang}&q=${query}`
}

export function getGoogleTranslateTtsFallbackUrl(text, options = {}) {
  const sample = pickGoogleTranslateSampleText(text, Number(options.maxLength) || 180)
  if (!sample) return ''

  const lang = String(options.lang || 'tr').toLowerCase().startsWith('ar') ? 'ar' : 'tr'
  const query = encodeURIComponent(sample)
  return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${query}`
}

export function releaseGeneratedTafsirAudio(generatedSegments) {
  if (!Array.isArray(generatedSegments)) return
  generatedSegments.forEach((segment) => {
    const url = String(segment?.url || '')
    if (!url || /^https?:\/\//i.test(url)) return
    try {
      URL.revokeObjectURL(url)
    } catch {
      // noop
    }
  })
}

const PIPER_TR_MALE_VOICES = [
  'tr_TR-fahrettin-medium',
  'tr_TR-fettah-medium',
  'tr_TR-fahrettin-low',
  'tr_TR-fettah-low'
]

const PIPER_ENGINE_VOICE_MAP = {
  piper: 'tr_TR-fahrettin-medium',
  sherpa: 'ar_JO-kareem-medium',
  coqui: 'ar_JO-kareem-low'
}
const PIPER_LANG_VOICE_MAP = {
  tr: 'tr_TR-fahrettin-medium',
  ar: 'ar_JO-kareem-medium'
}

let piperEnginePromise = null
let piperVoicesPromise = null

function resolveTafsirEngine(engine) {
  const value = String(engine || '').trim().toLowerCase()
  if (value === 'sherpa' || value === 'coqui') return value
  return 'piper'
}

async function loadPiperModule() {
  if (!piperModulePromise) {
    piperModulePromise = import(/* @vite-ignore */ PIPER_CDN_URL)
  }
  return piperModulePromise
}

async function getPiperEngine() {
  if (!piperEnginePromise) {
    piperEnginePromise = (async () => {
      const module = await loadPiperModule()
      const voiceProvider = new module.HuggingFaceVoiceProvider()
      const onnxRuntime = new module.OnnxWebWorkerRuntime({ basePath: '/onnx/' })
      return new module.PiperWebWorkerEngine({ onnxRuntime, voiceProvider })
    })()
  }
  return piperEnginePromise
}

async function getPiperVoiceMap() {
  if (!piperVoicesPromise) {
    piperVoicesPromise = (async () => {
      const module = await loadPiperModule()
      const provider = new module.HuggingFaceVoiceProvider()
      const voices = await provider.list()
      return voices && typeof voices === 'object' ? voices : {}
    })()
  }
  return piperVoicesPromise
}

function pickPiperVoice(voices, engine) {
  const preferred = PIPER_ENGINE_VOICE_MAP[resolveTafsirEngine(engine)]
  if (preferred && voices[preferred]) return preferred

  for (const voiceId of PIPER_TR_MALE_VOICES) {
    if (voices[voiceId]) return voiceId
  }

  const first = Object.keys(voices)[0]
  return first || null
}

function pickPiperVoiceByLanguage(voices, lang, engine) {
  const isArabic = String(lang || '').toLowerCase().startsWith('ar')
  const preferred = isArabic ? PIPER_LANG_VOICE_MAP.ar : PIPER_LANG_VOICE_MAP.tr
  if (preferred && voices[preferred]) return preferred

  if (!isArabic) {
    for (const voiceId of PIPER_TR_MALE_VOICES) {
      if (voices[voiceId]) return voiceId
    }
    return null
  }

  return pickPiperVoice(voices, engine)
}

async function generatePiperSegment(engine, text, voice, options = {}) {
  const synthesisOptions = {
    length_scale: Math.max(0.72, Math.min(1.7, Number(options.length_scale) || 1)),
    noise_scale: Math.max(0.2, Math.min(0.8, Number(options.noise_scale) || 0.36)),
    noise_w: Math.max(0.2, Math.min(0.8, Number(options.noise_w) || 0.38))
  }

  try {
    return await engine.generate(text, voice, 0, synthesisOptions)
  } catch {
    return engine.generate(text, voice, 0)
  }
}

export async function synthesizePiperTafsirAudio(text, options = {}) {
  const queue = buildTafsirSpeechQueue(String(text || '').trim(), {
    maxChunkLength: 200,
    useArabicDiacritics: options.useArabicDiacritics !== false,
    aggressiveArabicNormalization: options.aggressiveArabicNormalization === true
  })
  if (!queue.length) return null

  try {
    const voices = await getPiperVoiceMap()
    const engine = await getPiperEngine()

    const generatedSegments = []
    for (const segment of queue) {
      const selectedVoice = pickPiperVoiceByLanguage(voices, segment.lang, options.engine)
      if (!selectedVoice) continue

      const rateMultiplier = Math.max(0.65, Math.min(1.3, Number(segment.rateMultiplier) || 1))
      const result = await generatePiperSegment(engine, segment.text, selectedVoice, {
        length_scale: 1 / rateMultiplier,
        noise_scale: segment.lang?.startsWith('ar')
          ? (Number(options.arabicNoiseScale) || 0.34)
          : (Number(options.turkishNoiseScale) || 0.38),
        noise_w: segment.lang?.startsWith('ar')
          ? (Number(options.arabicNoiseW) || 0.36)
          : (Number(options.turkishNoiseW) || 0.4)
      })
      const audioBlob = result?.file
      if (!audioBlob) continue

      const durationMs = Number(result?.duration || 0)
      generatedSegments.push({
        url: URL.createObjectURL(audioBlob),
        text: segment.text,
        voice: selectedVoice,
        lang: segment.lang,
        pauseAfterMs: Number(segment.pauseMs) || 0,
        duration: durationMs > 0 ? durationMs / 1000 : estimateTafsirSpeechDuration(segment.text, rateMultiplier)
      })
    }

    return generatedSegments.length ? generatedSegments : null
  } catch {
    return null
  }
}
