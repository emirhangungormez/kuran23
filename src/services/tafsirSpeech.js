import { EdgeTTS, listVoices } from 'edge-tts-universal/browser'

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

function isEdgeBrowser() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Edg(A|iOS)?\//.test(ua)
}

let cachedEdgeVoicesPromise = null

async function getEdgeVoices() {
  if (!cachedEdgeVoicesPromise) {
    cachedEdgeVoicesPromise = listVoices().catch(() => [])
  }
  return cachedEdgeVoicesPromise
}

function pickEdgeMaleTurkishVoice(voices) {
  const list = Array.isArray(voices) ? voices : []
  const maleTurkish = list.find((voice) => {
    const locale = String(voice?.Locale || '').toLowerCase()
    return locale === 'tr-tr' && String(voice?.Gender || '').toLowerCase() === 'male'
  })
  if (maleTurkish?.ShortName) return maleTurkish.ShortName

  const anyMale = list.find((voice) => String(voice?.Gender || '').toLowerCase() === 'male')
  if (anyMale?.ShortName) return anyMale.ShortName

  const turkishAny = list.find((voice) => String(voice?.Locale || '').toLowerCase() === 'tr-tr')
  return turkishAny?.ShortName || 'tr-TR-AhmetNeural'
}

function toEdgeRate(rate) {
  const normalized = Math.min(1.5, Math.max(0.7, Number(rate) || 1))
  const delta = Math.round((normalized - 1) * 100)
  return `${delta >= 0 ? '+' : ''}${delta}%`
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
  [/بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ/gu, 'Bismillahirrahmanirrahim'],
  [/ٱلْحَمْدُ لِلَّٰهِ/gu, 'Elhamdulillah'],
  [/إِنْ شَاءَ اللَّهُ|إن شاء الله/gu, 'insallah'],
  [/مَا شَاءَ اللَّهُ|ما شاء الله/gu, 'masallah'],
  [/لَا إِلٰهَ إِلَّا ٱللَّٰهُ|لا إله إلا الله/gu, 'la ilahe illallah'],
  [/صلى الله عليه وسلم/gu, 'sallallahu aleyhi ve sellem'],
  [/رضي الله عنه/gu, 'radiyallahu anh'],
  [/رضي الله عنها/gu, 'radiyallahu anha'],
  [/رضي الله عنهم/gu, 'radiyallahu anhum'],
  [/رحمه الله/gu, 'rahmetullahi aleyh'],
  [/عز وجل/gu, 'azze ve celle'],
  [/جل جلاله/gu, 'celle celaluhu'],
  [/سبحانه وتعالى/gu, 'subhanehu ve teala'],
  [/ﷺ/gu, 'sallallahu aleyhi ve sellem'],
  [/ؓ/gu, 'radiyallahu anh'],
  [/ؒ/gu, 'rahmetullahi aleyh']
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

function estimateDurationFromSubtitles(subtitle = []) {
  if (!Array.isArray(subtitle) || subtitle.length === 0) return 0
  const last = subtitle[subtitle.length - 1]
  const total = Number(last?.offset || 0) + Number(last?.duration || 0)
  return total > 0 ? total / 10_000_000 : 0
}

export function isEdgeTafsirTtsSupported() {
  return typeof window !== 'undefined' && isEdgeBrowser()
}

export async function synthesizeEdgeTafsirAudio(text, options = {}) {
  if (!isEdgeTafsirTtsSupported()) return null

  const normalizedText = String(text || '').trim()
  if (!normalizedText) return null

  const voices = await getEdgeVoices()
  const selectedVoice = pickEdgeMaleTurkishVoice(voices)
  const rate = toEdgeRate(options.rate || 1)

  const tts = new EdgeTTS(normalizedText, selectedVoice, {
    rate,
    volume: '+0%',
    pitch: '+0Hz'
  })
  const result = await tts.synthesize()
  const audioBlob = result?.audio
  if (!audioBlob) return null

  const objectUrl = URL.createObjectURL(audioBlob)
  const subtitleDuration = estimateDurationFromSubtitles(result?.subtitle || [])
  return {
    url: objectUrl,
    voice: selectedVoice,
    duration: subtitleDuration || estimateTafsirSpeechDuration(normalizedText, options.rate || 1)
  }
}
