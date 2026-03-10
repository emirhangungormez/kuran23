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

export function getTafsirVoices() {
  const synthesis = getSpeechSynthesisInstance()
  if (!synthesis) return []

  const voices = synthesis.getVoices() || []
  return voices
    .filter((voice) => {
      const lang = String(voice.lang || '').toLocaleLowerCase('tr-TR')
      const name = normalizeVoiceName(voice.name)
      return lang.startsWith('tr') || name.includes('turk') || name.includes('türk')
    })
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

  const voices = synthesis.getVoices() || []
  const normalizedTarget = normalizeVoiceName(voiceName)

  if (normalizedTarget) {
    const exactMatch = voices.find((voice) => normalizeVoiceName(voice.name) === normalizedTarget)
    if (exactMatch) return exactMatch
  }

  const turkishMatch = voices.find((voice) => String(voice.lang || '').toLocaleLowerCase('tr-TR').startsWith('tr'))
  return turkishMatch || voices[0] || null
}

export function stripHtmlForSpeech(html) {
  const source = String(html || '').trim()
  if (!source) return ''

  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    const parser = new window.DOMParser()
    const doc = parser.parseFromString(`<div>${source}</div>`, 'text/html')
    const text = doc.body?.textContent || ''
    return text.replace(/\s+/g, ' ').trim()
  }

  return source
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function estimateTafsirSpeechDuration(text, rate = 1) {
  const normalizedRate = Math.min(1.5, Math.max(0.7, Number(rate) || 1))
  const safeText = String(text || '').trim()
  if (!safeText) return 0

  const charsPerSecond = 14
  return Math.max(2, safeText.length / (charsPerSecond * normalizedRate))
}
