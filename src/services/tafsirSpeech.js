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

const TAFSIR_SPEECH_REPLACEMENTS = [
  [/s\.a\.v\.|sav\b/gi, 'sallallahu aleyhi ve sellem'],
  [/a\.s\.|as\b/gi, 'aleyhisselam'],
  [/r\.a\.|ra\b/gi, 'radiyallahu anh'],
  [/r\.anh[üu]m/gi, 'radiyallahu anhum'],
  [/k\.s\.|ks\b/gi, 'kuddise sirruh'],
  [/c\.c\.|cc\b/gi, 'celle celaluhu'],
  [/hz\./gi, 'Hazreti'],
  [/sûre/gi, 'sure'],
  [/âyet/gi, 'ayet'],
  [/teâlâ/gi, 'teala'],
  [/şeyh/gi, 'seyh'],
  [/\bh\.\s*(\d+)\.\s*yüzyıl\b/gi, 'hicri $1. yüzyıl'],
  [/\bm\.\s*(\d+)\.\s*yüzyıl\b/gi, 'miladi $1. yüzyıl'],
  [/\bdr\./gi, 'doktor'],
  [/\bprof\./gi, 'profesör']
]

const TR_PRONUNCIATION_LEXICON = [
  [/\bmüteşabih\b/gi, 'müteşaabih'],
  [/\bnüzul\b/gi, 'nüzûl'],
  [/\bte'vil\b/gi, 'tevil'],
  [/\btev'il\b/gi, 'tevil'],
  [/\bfıkıh\b/gi, 'fıkıh'],
  [/\bkelâm\b/gi, 'kelam'],
  [/\bistiğfar\b/gi, 'istiğfar'],
  [/\brahmân\b/gi, 'rahman'],
  [/\brahîm\b/gi, 'rahim']
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

function applyTurkishPronunciationLexicon(text) {
  let next = String(text || '')
  TR_PRONUNCIATION_LEXICON.forEach(([pattern, value]) => {
    next = next.replace(pattern, value)
  })
  return next
}

function applyArabicDiacritization(text) {
  let next = String(text || '')
  ARABIC_DIACRITIC_LEXICON.forEach(([pattern, value]) => {
    next = next.replace(pattern, value)
  })
  return next
}

function detectSegmentLanguage(text) {
  const content = String(text || '')
  if (!content) return 'tr-TR'
  const arabicCount = (content.match(/[\u0600-\u06FF]/gu) || []).length
  const latinCount = (content.match(/[A-Za-zÇĞİÖŞÜçğıöşü]/g) || []).length
  if (arabicCount > latinCount) return 'ar-SA'
  return 'tr-TR'
}

function splitByLanguage(text) {
  const source = String(text || '')
  if (!source) return []

  const parts = []
  let buffer = ''
  let activeLang = null

  for (const char of source) {
    const isArabicChar = /[\u0600-\u06FF]/u.test(char)
    const isLatinChar = /[A-Za-zÇĞİÖŞÜçğıöşü]/.test(char)
    const nextLang = isArabicChar ? 'ar-SA' : (isLatinChar ? 'tr-TR' : activeLang || 'tr-TR')
    if (!activeLang) {
      activeLang = nextLang
      buffer = char
      continue
    }

    if (nextLang === activeLang) {
      buffer += char
      continue
    }

    if (buffer.trim()) parts.push({ text: buffer.trim(), lang: activeLang })
    buffer = char
    activeLang = nextLang
  }

  if (buffer.trim()) parts.push({ text: buffer.trim(), lang: activeLang || detectSegmentLanguage(buffer) })
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
        ? applyArabicDiacritization(trimmed)
        : applyTurkishPronunciationLexicon(trimmed)
      const pauseMs = /[.!?؟:؛۔]$/.test(preparedText) ? 280 : 150
      const rateMultiplier = /\b\d+\.?\s*ayet\b/i.test(preparedText) ? 0.93 : 1
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
      text: lang.startsWith('ar') ? applyArabicDiacritization(normalized) : applyTurkishPronunciationLexicon(normalized),
      lang,
      pauseMs: 220,
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
  const filtered = voices.filter((voice) => {
    if (targetLang.startsWith('ar')) return isArabicVoice(voice)
    return isTurkishVoice(voice)
  })

  if (normalizedTargetName) {
    const exact = filtered.find((voice) => normalizeVoiceName(voice.name) === normalizedTargetName && !isLikelyFemaleVoice(voice))
    if (exact) return exact
  }

  const maleMatch = filtered.find((voice) => isLikelyMaleVoice(voice) && !isLikelyFemaleVoice(voice))
  if (maleMatch) return maleMatch

  const neutral = filtered.find((voice) => !isLikelyFemaleVoice(voice))
  if (neutral) return neutral

  return targetLang.startsWith('ar') ? resolveTafsirVoice('') : resolveTafsirVoice(voiceName)
}

export function stripHtmlForSpeech(html) {
  const source = String(html || '').trim()
  if (!source) return ''

  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    const parser = new window.DOMParser()
    const doc = parser.parseFromString(`<div>${source}</div>`, 'text/html')
    const text = doc.body?.textContent || ''
    return normalizeBaseSpeechText(text)
  }

  return normalizeBaseSpeechText(
    source
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
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
    length_scale: Math.max(0.75, Math.min(1.45, Number(options.length_scale) || 1)),
    noise_scale: Math.max(0.3, Math.min(1.2, Number(options.noise_scale) || 0.667)),
    noise_w: Math.max(0.3, Math.min(1.2, Number(options.noise_w) || 0.8))
  }

  try {
    return await engine.generate(text, voice, 0, synthesisOptions)
  } catch {
    return engine.generate(text, voice, 0)
  }
}

export async function synthesizePiperTafsirAudio(text, options = {}) {
  const queue = buildTafsirSpeechQueue(String(text || '').trim(), { maxChunkLength: 200 })
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
        noise_scale: 0.667,
        noise_w: 0.8
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
