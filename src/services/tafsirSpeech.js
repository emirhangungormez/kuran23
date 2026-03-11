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
  [/şeyh/gi, 'seyh']
]

function normalizeArabicSpeechFragments(text) {
  let normalized = String(text || '')

  TAFSIR_SPEECH_REPLACEMENTS.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement)
  })

  return normalized
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/gu, '')
    .replace(/[“”"]/g, '')
    .replace(/\(([^)]*?)\)/g, ' $1 ')
    .replace(/\/+?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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

export function stripHtmlForSpeech(html) {
  const source = String(html || '').trim()
  if (!source) return ''

  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    const parser = new window.DOMParser()
    const doc = parser.parseFromString(`<div>${source}</div>`, 'text/html')
    const text = doc.body?.textContent || ''
    return normalizeArabicSpeechFragments(text)
  }

  return normalizeArabicSpeechFragments(
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

const PIPER_ENGINE_VOICE_MAP = {
  piper: 'tr_TR-dfki-medium',
  sherpa: 'ar_JO-kareem-medium',
  coqui: 'ar_JO-kareem-low'
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

export async function synthesizePiperTafsirAudio(text, options = {}) {
  const normalizedText = normalizeArabicSpeechFragments(String(text || '').trim())
  if (!normalizedText) return null

  try {
    const voices = await getPiperVoiceMap()
    const selectedVoice = pickPiperVoice(voices, options.engine)
    if (!selectedVoice) return null

    const engine = await getPiperEngine()
    const result = await engine.generate(normalizedText, selectedVoice, 0)
    const audioBlob = result?.file
    if (!audioBlob) return null

    const durationMs = Number(result?.duration || 0)
    return {
      url: URL.createObjectURL(audioBlob),
      voice: selectedVoice,
      duration: durationMs > 0 ? durationMs / 1000 : estimateTafsirSpeechDuration(normalizedText, options.rate || 1)
    }
  } catch {
    return null
  }
}
