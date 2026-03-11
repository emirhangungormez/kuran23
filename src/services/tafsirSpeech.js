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
  'ocal'
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
  [/\bs\.a\.v\.\b|\bsav\b/gi, 'sallallahu aleyhi ve sellem'],
  [/\ba\.s\.\b|\bas\b/gi, 'aleyhisselam'],
  [/\br\.a\.\b|\bra\b/gi, 'radiyallahu anh'],
  [/\br\.anh[üu]m\b/gi, 'radiyallahu anhum'],
  [/k\.s\.|ks\b/gi, 'kuddise sirruh'],
  [/\bc\.c\.\b|\bcc\b/gi, 'celle celaluhu'],
  [/\bhz\.\b/gi, 'Hazreti'],
  [/\bM\.Ö\.\b/gi, 'milattan önce'],
  [/\bM\.S\.\b/gi, 'milattan sonra'],
  [/\bH\.\s*(\d+)\.\s*yüzyıl\b/gi, 'hicri $1. yüzyıl'],
  [/\bM\.\s*(\d+)\.\s*yüzyıl\b/gi, 'miladi $1. yüzyıl'],
  [/\bdr\./gi, 'doktor'],
  [/\bprof\./gi, 'profesör'],
  [/\bdoç\./gi, 'doçent'],
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
  [/\bkelâm\b/gi, 'kelam'],
  [/\bistiğfar\b/gi, 'istiğfar'],
  [/\bKur'an\b/gi, 'Kuran'],
  [/\brahmân\b/gi, 'rahmaan'],
  [/\brahîm\b/gi, 'rahiim']
]

const ARABIC_DIACRITIC_LEXICON = [
  [/\bالله\b/gu, 'اللّٰه'],
  [/\bالرحمن\b/gu, 'الرَّحْمٰن'],
  [/\bالرحيم\b/gu, 'الرَّحِيم'],
  [/\bمالك\b/gu, 'مَالِك'],
  [/\bيوم\b/gu, 'يَوْم'],
  [/\bالدين\b/gu, 'الدِّين'],
  [/\bالصراط\b/gu, 'الصِّرَاط'],
  [/\bالمستقيم\b/gu, 'الْمُسْتَقِيم']
]

function normalizeBaseSpeechText(text) {
  let normalized = String(text || '')

  TAFSIR_SPEECH_REPLACEMENTS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement)
  })

  return normalized
    .replace(/[ـ]+/gu, '')
    .replace(/[“”"]/g, '')
    .replace(/\(([^)]*?)\)/g, ' $1 ')
    .replace(/\/+?/g, ' ')
    .replace(/([,:;!?])([^\s])/g, '$1 $2')
    .replace(/([.۔،]){2,}/g, '$1')
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
  TR_PRONUNCIATION_LEXICON.forEach(([pattern, value]) => {
    next = next.replace(pattern, value)
  })
  return next
}

function normalizeArabicText(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/[ـ]+/gu, '')
    .replace(/[ٱأإآ]/gu, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/ؤ/gu, 'و')
    .replace(/ئ/gu, 'ي')
    .replace(/[ۖۗۘۙۚۛۜ۝۞]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function applyArabicDiacritization(text, options = {}) {
  const useDiacritics = options.useArabicDiacritics !== false
  let next = normalizeArabicText(text)

  if (!useDiacritics) return next

  ARABIC_DIACRITIC_LEXICON.forEach(([pattern, value]) => {
    next = next.replace(pattern, value)
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
  const parts = runs
    .map((chunk) => String(chunk || '').trim())
    .filter(Boolean)
    .map((chunk) => ({
      text: chunk,
      lang: ARABIC_CHAR_REGEX.test(chunk) ? 'ar-SA' : 'tr-TR'
    }))

  if (!parts.length) return [{ text: source, lang: detectSegmentLanguage(source) }]
  return parts
}

function splitLongText(text, maxLength = 220) {
  const source = String(text || '').trim()
  if (!source) return []
  if (source.length <= maxLength) return [source]

  const segments = source
    .split(/(?<=[.!?:;۔،])\s+/u)
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
    if (/[۝﴿﴾]$/.test(safeText)) return 420
    if (/[؟]$/.test(safeText)) return 320
    if (/[؛]$/.test(safeText)) return 280
    if (/[،]$/.test(safeText)) return 220
    if (/[.!:]$/.test(safeText)) return 280
    return 170
  }

  if (/[.!?]$/.test(safeText)) return 280
  if (/[,;:]$/.test(safeText)) return 180
  return 150
}

export function buildTafsirSpeechQueue(text, options = {}) {
  const maxLength = Math.max(100, Math.min(320, Number(options.maxChunkLength) || 220))
  const normalized = normalizeBaseSpeechText(String(text || '').trim())
  if (!normalized) return []

  const langParts = splitByLanguage(normalized)
  const queue = []

  langParts.forEach((part) => {
    splitLongText(part.text, maxLength).forEach((chunk) => {
      const trimmed = chunk.trim()
      if (!trimmed) return
      const lang = part.lang || detectSegmentLanguage(trimmed)
      const preparedText = lang.startsWith('ar')
        ? applyArabicDiacritization(trimmed, options)
        : applyTurkishPronunciationLexicon(trimmed)
      const pauseMs = getPauseMs(preparedText, lang)
      const rateMultiplier = lang.startsWith('ar')
        ? 0.82
        : (/\b\d+\.?\s*ayet\b/i.test(preparedText) ? 0.93 : 1)
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

export function getTafsirVoices() {
  const synthesis = getSpeechSynthesisInstance()
  if (!synthesis) return []

  return (synthesis.getVoices() || [])
    .filter((voice) => isTurkishVoice(voice) && !isLikelyFemaleVoice(voice))
    .map((voice) => ({
      id: `${voice.name}__${voice.lang}`,
      name: voice.name,
      lang: voice.lang,
      default: Boolean(voice.default)
    }))
}

export function subscribeTafsirVoices(onChange) {
  const synthesis = getSpeechSynthesisInstance()
  if (!synthesis || typeof onChange !== 'function') return () => {}

  const emit = () => onChange(getTafsirVoices())
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
    const exactMatch = voices.find((voice) => normalizeVoiceName(voice.name) === normalizedTarget && !isLikelyFemaleVoice(voice))
    if (exactMatch) return exactMatch
  }

  const maleMatch = voices.find((voice) => isLikelyMaleVoice(voice) && !isLikelyFemaleVoice(voice))
  if (maleMatch) return maleMatch

  const neutralMatch = voices.find((voice) => !isLikelyFemaleVoice(voice))
  return neutralMatch || null
}

export function resolveTafsirVoiceByLanguage(lang, voiceName) {
  const synthesis = getSpeechSynthesisInstance()
  if (!synthesis) return null

  const targetLang = String(lang || 'tr-TR').toLocaleLowerCase('tr-TR')
  const normalizedTargetName = normalizeVoiceName(voiceName)
  const voices = synthesis.getVoices() || []
  const filtered = voices.filter((voice) => targetLang.startsWith('ar') ? isArabicVoice(voice) : isTurkishVoice(voice))

  if (normalizedTargetName) {
    const exact = filtered.find((voice) => normalizeVoiceName(voice.name) === normalizedTargetName && !isLikelyFemaleVoice(voice))
    if (exact) return exact
  }

  const scoreVoice = (voice) => {
    const voiceLang = String(voice?.lang || '').toLowerCase()
    let score = 0
    if (targetLang.startsWith('ar')) {
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

  if (filtered.length) {
    return filtered
      .slice()
      .sort((a, b) => scoreVoice(b) - scoreVoice(a))[0]
  }

  return targetLang.startsWith('ar') ? resolveTafsirVoice('') : resolveTafsirVoice(voiceName)
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

  const firstSentence = normalized.split(/[.!?]/).map((part) => part.trim()).find(Boolean) || normalized
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

const PIPER_ENGINE_VOICE_MAP = {
  piper: 'tr_TR-dfki-medium',
  sherpa: 'ar_JO-kareem-medium',
  coqui: 'ar_JO-kareem-low'
}
const PIPER_LANG_VOICE_MAP = {
  tr: 'tr_TR-dfki-medium',
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
  if (voices['tr_TR-dfki-medium']) return 'tr_TR-dfki-medium'
  const first = Object.keys(voices)[0]
  return first || null
}

function pickPiperVoiceByLanguage(voices, lang, engine) {
  const isArabic = String(lang || '').toLowerCase().startsWith('ar')
  const preferred = isArabic ? PIPER_LANG_VOICE_MAP.ar : PIPER_LANG_VOICE_MAP.tr
  if (preferred && voices[preferred]) return preferred
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
    useArabicDiacritics: options.useArabicDiacritics !== false
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
