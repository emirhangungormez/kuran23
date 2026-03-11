import { create } from 'zustand'
import { surahs } from '../data/quranData'
import { getPage } from '../services/api'
import { getSurahAudioUrl, getVerseAudioUrl, getTurkishAudioUrl, isTurkishPlaylistSupported } from '../services/audio'
import {
    buildTafsirSpeechQueue,
    estimateTafsirSpeechDuration,
    isTafsirSpeechSupported,
    releaseGeneratedTafsirAudio,
    resolveTafsirVoice,
    resolveTafsirVoiceByLanguage,
    synthesizePiperTafsirAudio
} from '../services/tafsirSpeech'
import { normalizeTextMode } from '../utils/textMode'

const DEFAULT_PLAYBACK_SETTINGS = {
    coreAuthorIds: [77],
    defaultAuthorId: 77,
    defaultReciterId: 7,
    defaultTurkishReciterId: 1014,
    tafsirVoiceName: '',
    tafsirSpeechEngine: 'piper',
    tafsirVoiceRate: 1,
    textMode: 'uthmani',
    showTajweed: false
}

function resolvePlaybackSettings(settings) {
    const withDefaults = (value) => ({ ...DEFAULT_PLAYBACK_SETTINGS, ...value })
    const normalizePayload = (value) => {
        const base = withDefaults(value)
        const textMode = normalizeTextMode(base.textMode, Boolean(base.showTajweed))
        const resolvedTurkishReciterId = Number(base.defaultTurkishReciterId || DEFAULT_PLAYBACK_SETTINGS.defaultTurkishReciterId || 1014)
        return {
            ...base,
            defaultTurkishReciterId: resolvedTurkishReciterId === 1015 ? 1014 : resolvedTurkishReciterId,
            textMode,
            showTajweed: textMode === 'tajweed'
        }
    }

    if (settings && typeof settings === 'object') {
        return normalizePayload(settings)
    }

    try {
        const raw = localStorage.getItem('quran_settings')
        if (!raw) return DEFAULT_PLAYBACK_SETTINGS
        const parsed = JSON.parse(raw)
        return normalizePayload(parsed)
    } catch {
        return DEFAULT_PLAYBACK_SETTINGS
    }
}

function resolveActiveTrackIndex(state) {
    if (!state || state.mode !== 'playlist' || !Array.isArray(state.playlist) || state.playlist.length === 0) {
        return state?.currentTrackIndex ?? 0
    }

    const audioSrc = globalAudio.currentSrc || globalAudio.src || ''
    if (!audioSrc) return state.currentTrackIndex

    const matchedIndex = state.playlist.findIndex((track) => {
        const trackSrc = track?.audio
        if (!trackSrc) return false
        try {
            return new URL(trackSrc, window.location.href).href === audioSrc
        } catch {
            return trackSrc === audioSrc || audioSrc.endsWith(trackSrc)
        }
    })

    return matchedIndex >= 0 ? matchedIndex : state.currentTrackIndex
}

// Global Audio Element Instance
const globalAudio = new Audio()
globalAudio.preload = 'auto'
const generatedPreloadAudio = new Audio()
generatedPreloadAudio.preload = 'auto'
let lastPageAudioRecoveryKey = ''
let activeSpeechProgressTimer = null
let activeSpeechStartedAt = 0
let activeSpeechElapsed = 0
let activeSpeechDuration = 0
let activeGeneratedAudioUrl = ''
let activeSpeechSessionId = 0
let activeSpeechSegmentDelayTimer = null
let activeGeneratedSegments = []
let activeGeneratedSegmentIndex = -1
let preloadedGeneratedSegmentIndex = -1

function getGeneratedSegmentDuration(segment) {
    const runtime = Number(segment?.runtimeDuration || 0)
    if (runtime > 0) return runtime
    return Math.max(0, Number(segment?.duration || 0))
}

function getGeneratedSegmentsTotalDuration() {
    if (!Array.isArray(activeGeneratedSegments) || !activeGeneratedSegments.length) return 0
    return activeGeneratedSegments.reduce(
        (sum, segment) => sum + getGeneratedSegmentDuration(segment) + (Math.max(0, Number(segment?.pauseAfterMs || 0)) / 1000),
        0
    )
}

function getGeneratedElapsedBefore(index) {
    if (!Array.isArray(activeGeneratedSegments) || index <= 0) return 0
    return activeGeneratedSegments
        .slice(0, index)
        .reduce((sum, segment) => sum + getGeneratedSegmentDuration(segment) + (Math.max(0, Number(segment?.pauseAfterMs || 0)) / 1000), 0)
}

function clearGeneratedAudioUrl() {
    releaseGeneratedTafsirAudio(activeGeneratedSegments)
    activeGeneratedSegments = []
    activeGeneratedSegmentIndex = -1
    preloadedGeneratedSegmentIndex = -1
    activeGeneratedAudioUrl = ''
    generatedPreloadAudio.pause()
    generatedPreloadAudio.src = ''
}

function getSpeechSynthesisEngine() {
    if (!isTafsirSpeechSupported()) return null
    return window.speechSynthesis
}

function clearSpeechProgressTimer() {
    if (activeSpeechProgressTimer) {
        window.clearInterval(activeSpeechProgressTimer)
        activeSpeechProgressTimer = null
    }
}

function clearSpeechDelayTimer() {
    if (!activeSpeechSegmentDelayTimer) return
    window.clearTimeout(activeSpeechSegmentDelayTimer)
    activeSpeechSegmentDelayTimer = null
}

function playGeneratedSegmentAt(index) {
    return playGeneratedSegmentAtWithOffset(index, 0)
}

function playGeneratedSegmentAtWithOffset(index, startOffsetSeconds = 0) {
    if (!Array.isArray(activeGeneratedSegments) || index < 0 || index >= activeGeneratedSegments.length) return false
    const segment = activeGeneratedSegments[index]
    if (!segment?.url) return false

    activeGeneratedSegmentIndex = index
    activeGeneratedAudioUrl = segment.url
    globalAudio.src = segment.url
    globalAudio.load()
    globalAudio.playbackRate = 1
    const desiredOffset = Math.max(0, Number(startOffsetSeconds || 0))
    if (desiredOffset > 0) {
        const applyOffset = () => {
            const maxOffset = Math.max(0, Number(globalAudio.duration || desiredOffset) - 0.05)
            globalAudio.currentTime = Math.min(maxOffset, desiredOffset)
        }
        globalAudio.addEventListener('loadedmetadata', applyOffset, { once: true })
    }
    safePlayAudio(() => {
        usePlayerStore.getState().setIsPlaying(false)
    })
    preloadGeneratedSegment(index + 1)
    return true
}

function preloadGeneratedSegment(index) {
    if (!Array.isArray(activeGeneratedSegments) || index < 0 || index >= activeGeneratedSegments.length) {
        preloadedGeneratedSegmentIndex = -1
        generatedPreloadAudio.pause()
        generatedPreloadAudio.src = ''
        return
    }

    const segment = activeGeneratedSegments[index]
    const nextUrl = String(segment?.url || '')
    if (!nextUrl) {
        preloadedGeneratedSegmentIndex = -1
        return
    }

    if (preloadedGeneratedSegmentIndex === index && generatedPreloadAudio.src === nextUrl) return
    preloadedGeneratedSegmentIndex = index
    generatedPreloadAudio.src = nextUrl
    generatedPreloadAudio.load()
}

function playPreloadedGeneratedSegment(index) {
    if (!Array.isArray(activeGeneratedSegments) || index < 0 || index >= activeGeneratedSegments.length) return false
    if (preloadedGeneratedSegmentIndex !== index) return false

    const segment = activeGeneratedSegments[index]
    const preloadedUrl = generatedPreloadAudio.currentSrc || generatedPreloadAudio.src || segment?.url || ''
    if (!preloadedUrl) return false

    activeGeneratedSegmentIndex = index
    activeGeneratedAudioUrl = segment.url
    globalAudio.src = preloadedUrl
    // Preloaded URL'de tekrar load() cagirmamak gecis boslugunu azaltir.
    globalAudio.playbackRate = 1
    safePlayAudio(() => {
        usePlayerStore.getState().setIsPlaying(false)
    })
    preloadGeneratedSegment(index + 1)
    return true
}

function resolveGeneratedSegmentForAbsoluteTime(targetSeconds) {
    const safeTarget = Math.max(0, Number(targetSeconds || 0))
    if (!Array.isArray(activeGeneratedSegments) || !activeGeneratedSegments.length) {
        return { segmentIndex: 0, offsetSeconds: 0 }
    }

    let cursor = 0
    for (let index = 0; index < activeGeneratedSegments.length; index += 1) {
        const segment = activeGeneratedSegments[index]
        const duration = getGeneratedSegmentDuration(segment)
        const pause = Math.max(0, Number(segment?.pauseAfterMs || 0)) / 1000

        if (safeTarget <= cursor + duration) {
            return {
                segmentIndex: index,
                offsetSeconds: Math.max(0, safeTarget - cursor)
            }
        }
        cursor += duration

        if (safeTarget <= cursor + pause) {
            return {
                segmentIndex: Math.min(index + 1, activeGeneratedSegments.length - 1),
                offsetSeconds: 0
            }
        }
        cursor += pause
    }

    const lastIndex = activeGeneratedSegments.length - 1
    const lastDuration = getGeneratedSegmentDuration(activeGeneratedSegments[lastIndex])
    return {
        segmentIndex: lastIndex,
        offsetSeconds: Math.max(0, lastDuration - 0.2)
    }
}

function startSpeechProgressTimer() {
    clearSpeechProgressTimer()
    activeSpeechStartedAt = Date.now()
    activeSpeechProgressTimer = window.setInterval(() => {
        const state = usePlayerStore.getState()
        if (state.mode !== 'tts' || !state.isPlaying) return
        const elapsedSeconds = activeSpeechElapsed + ((Date.now() - activeSpeechStartedAt) / 1000)
        state.setCurrentTime(Math.min(activeSpeechDuration, elapsedSeconds))
    }, 180)
}

function stopSpeechPlayback() {
    const synthesis = getSpeechSynthesisEngine()
    activeSpeechSessionId += 1
    clearSpeechProgressTimer()
    clearSpeechDelayTimer()
    clearGeneratedAudioUrl()
    activeSpeechStartedAt = 0
    activeSpeechElapsed = 0
    activeSpeechDuration = 0
    if (!synthesis) return
    synthesis.cancel()
}

function pauseSpeechPlayback() {
    const synthesis = getSpeechSynthesisEngine()
    clearSpeechDelayTimer()
    if (!synthesis || !synthesis.speaking) return
    activeSpeechElapsed += activeSpeechStartedAt ? ((Date.now() - activeSpeechStartedAt) / 1000) : 0
    activeSpeechStartedAt = 0
    clearSpeechProgressTimer()
    synthesis.pause()
}

function resumeSpeechPlayback() {
    const synthesis = getSpeechSynthesisEngine()
    if (!synthesis || !synthesis.paused) return false
    synthesis.resume()
    startSpeechProgressTimer()
    return true
}

function safePlayAudio(onFail) {
    globalAudio.muted = false
    const playPromise = globalAudio.play()

    if (!playPromise || typeof playPromise.catch !== 'function') return

    playPromise.catch(async (err) => {
        // iOS/PWA unlock fallback: try muted start once, then retry normal playback.
        try {
            globalAudio.muted = true
            await globalAudio.play()
            globalAudio.pause()
            globalAudio.muted = false
            await globalAudio.play()
        } catch (unlockErr) {
            globalAudio.muted = false
            if (typeof onFail === 'function') onFail(unlockErr || err)
        }
    })
}

function normalizeAudioUrl(url) {
    if (!url || typeof url !== 'string') return ''
    const trimmed = url.trim()
    if (!trimmed) return ''
    const secure = trimmed.replace(/^http:\/\//i, 'https://')
    if (secure.includes('://verses.quran.com/')) {
        return secure.replace('://verses.quran.com/', '://everyayah.com/data/')
    }
    return secure
}

function resolveTafsirSpeechRate(settings) {
    return Math.min(1.5, Math.max(0.7, Number(settings?.tafsirVoiceRate) || 1))
}

function resolveTafsirSpeechEngine() {
    return 'piper'
}

function withTimeout(promise, timeoutMs, message) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error(message || 'Operation timeout')), timeoutMs)
        })
    ])
}

const usePlayerStore = create((set, get) => ({
    audioRef: { current: globalAudio },

    // State
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    playbackSpeed: 1,
    isRepeat: false,

    // Playlist / Queue
    mode: 'none', // 'single', 'playlist', 'tts', 'none'
    playlist: [], // Array of verse objects { audio, ... }
    currentTrackIndex: 0,
    singleSource: null,

    // Metadata for UI
    meta: {
        surahNameAr: '',
        surahNameTr: '',
        surahNameEn: '',
        surahType: '',
        ayahCount: 0,
        playingType: '', // 'arabic', 'turkish'
        link: '/',
        surahId: 0,
        verseData: [], // For segments visualization
        pageNumber: 0,
        juzNumber: 0,
        context: 'none' // 'surah', 'verse', 'page'
    },
    loadingNextPage: false,
    isAudioInitialized: false,

    // Actions
    setAudioInitialized: (val) => set({ isAudioInitialized: val }),
    setIsPlaying: (playing) => set({ isPlaying: playing }),
    setCurrentTime: (time) => set({ currentTime: time }),
    setDuration: (duration) => set({ duration }),
    setVolume: (volume) => {
        globalAudio.volume = volume
        set({ volume })
    },
    setPlaybackSpeed: (speed) => {
        globalAudio.playbackRate = speed
        set({ playbackSpeed: speed })
    },
    toggleRepeat: () => set((state) => ({ isRepeat: !state.isRepeat })),
    setMode: (mode) => set({ mode }),
    setPlaylist: (playlist) => set({ playlist }),
    setCurrentTrackIndex: (index) => set({ currentTrackIndex: index }),
    setSingleSource: (source) => set({ singleSource: source }),
    setMeta: (newMeta) => set((state) => {
        const nextMeta = typeof newMeta === 'function' ? newMeta(state.meta) : { ...state.meta, ...newMeta };
        const updates = { meta: nextMeta };

        // If we're setting a specific context (surah, page, verse) while mode is 'none',
        // update mode to that context to reflect the focused content and stop idle-prep loops.
        if (state.mode === 'none' && nextMeta.context && nextMeta.context !== 'none') {
            updates.mode = nextMeta.context;
        }

        return updates;
    }),
    setLoadingNextPage: (loading) => set({ loadingNextPage: loading }),
    stopPlayback: ({ resetMode = false } = {}) => {
        globalAudio.pause()
        stopSpeechPlayback()
        set((state) => ({
            isPlaying: false,
            currentTime: 0,
            duration: 0,
            mode: resetMode ? 'none' : state.mode
        }))
    },

    // Playback Methods
    playSingle: (url, metadata) => {
        stopSpeechPlayback()
        set({
            mode: 'single',
            singleSource: url,
            meta: typeof metadata === 'function' ? metadata(get().meta) : metadata,
            playlist: [],
            isPlaying: true
        })

        globalAudio.src = normalizeAudioUrl(url)
        globalAudio.load()
        globalAudio.playbackRate = get().playbackSpeed
        safePlayAudio((e) => {
            console.error("Play error:", e)
            set({ isPlaying: false })
        })

        // Settings context update usually handled inside component, but we'll emit a custom event or let components subscribe
        document.dispatchEvent(new CustomEvent('playerVisible'))
    },

    playPlaylist: (tracks, startIndex = 0, metadata) => {
        stopSpeechPlayback()
        set({
            mode: 'playlist',
            playlist: tracks,
            currentTrackIndex: startIndex,
            meta: typeof metadata === 'function' ? metadata(get().meta) : metadata,
            isPlaying: true
        })

        const track = tracks[startIndex]
        if (track && track.audio) {
            globalAudio.src = normalizeAudioUrl(track.audio)
            globalAudio.load()
            globalAudio.playbackRate = get().playbackSpeed
            safePlayAudio((e) => {
                console.error("Playlist play error:", e)
                set({ isPlaying: false })
            })
            document.dispatchEvent(new CustomEvent('playerVisible'))
        }
    },

    loadPlaylist: (tracks, startIndex = 0, metadata) => {
        stopSpeechPlayback()
        set({
            mode: 'playlist',
            playlist: tracks,
            currentTrackIndex: startIndex,
            meta: typeof metadata === 'function' ? metadata(get().meta) : metadata,
            isPlaying: false
        })

        const track = tracks[startIndex]
        if (track && track.audio) {
            globalAudio.src = normalizeAudioUrl(track.audio)
            globalAudio.load()
            globalAudio.playbackRate = get().playbackSpeed
        }
    },

    playTafsirTrackAtIndex: async (idx, settings, options = {}) => {
        const state = get()
        if (idx < 0 || idx >= state.playlist.length) {
            set({ isPlaying: false })
            return
        }

        globalAudio.pause()
        const track = state.playlist[idx]
        const text = String(track?.text || '').trim()
        if (!text) {
            set({ isPlaying: false })
            return
        }

        stopSpeechPlayback()

        const resolvedSettings = resolvePlaybackSettings(settings)
        const rate = resolveTafsirSpeechRate(resolvedSettings)
        const selectedEngine = resolveTafsirSpeechEngine()

        try {
            const piperResult = await withTimeout(
                synthesizePiperTafsirAudio(text, {
                    rate,
                    engine: selectedEngine,
                    useArabicDiacritics: true
                }),
                25000,
                'Piper TTS timeout'
            )

            if (Array.isArray(piperResult) && piperResult.length > 0) {
                activeGeneratedSegments = piperResult
                const totalDuration = getGeneratedSegmentsTotalDuration()
                set({
                    mode: 'tts',
                    currentTrackIndex: idx,
                    currentTime: 0,
                    duration: Math.max(1, totalDuration),
                    isPlaying: true
                })
                const requestedRatio = Math.max(0, Math.min(1, Number(options?.startRatio) || 0))
                if (requestedRatio > 0) {
                    const targetPosition = resolveGeneratedSegmentForAbsoluteTime(totalDuration * requestedRatio)
                    playGeneratedSegmentAtWithOffset(targetPosition.segmentIndex, targetPosition.offsetSeconds)
                } else {
                    playGeneratedSegmentAt(0)
                }
                document.dispatchEvent(new CustomEvent('playerVisible'))
                return
            }
        } catch {
            // Fallback to system speech below.
        }

        const synthesis = getSpeechSynthesisEngine()
        if (!synthesis) {
            set({ isPlaying: false })
            return
        }

        const queue = buildTafsirSpeechQueue(text, { maxChunkLength: 220 })
        if (!queue.length) {
            set({ isPlaying: false })
            return
        }

        const duration = estimateTafsirSpeechDuration(text, rate)
        const totalChars = queue.reduce((sum, segment) => sum + Math.max(1, segment.text.length), 0)
        let completedChars = 0
        const sessionId = ++activeSpeechSessionId
        const preferredVoice = resolveTafsirVoice(resolvedSettings.tafsirVoiceName)
        const fallbackLang = preferredVoice?.lang || 'tr-TR'

        activeSpeechElapsed = 0
        activeSpeechDuration = duration

        set({
            mode: 'tts',
            currentTrackIndex: idx,
            currentTime: 0,
            duration,
            isPlaying: true
        })

        const finishTrack = () => {
            const activeState = get()
            if (sessionId !== activeSpeechSessionId || activeState.mode !== 'tts' || activeState.currentTrackIndex !== idx) return

            clearSpeechProgressTimer()
            clearSpeechDelayTimer()
            activeState.setCurrentTime(duration)
            if (idx < activeState.playlist.length - 1) {
                activeState.playTafsirTrackAtIndex(idx + 1, resolvedSettings)
                return
            }

            set({ isPlaying: false })
        }

        const failTrack = () => {
            if (sessionId !== activeSpeechSessionId) return
            clearSpeechProgressTimer()
            clearSpeechDelayTimer()
            set({ isPlaying: false })
        }

        const speakSegment = (segmentIndex) => {
            if (sessionId !== activeSpeechSessionId) return
            const segment = queue[segmentIndex]
            if (!segment) {
                finishTrack()
                return
            }

            const utterance = new window.SpeechSynthesisUtterance(segment.text)
            const segmentVoice = resolveTafsirVoiceByLanguage(segment.lang || fallbackLang, resolvedSettings.tafsirVoiceName)
            utterance.lang = segmentVoice?.lang || segment.lang || fallbackLang
            const segmentRate = Math.min(1.4, Math.max(0.65, rate * Number(segment.rateMultiplier || 1)))
            utterance.rate = segmentRate
            utterance.pitch = 1
            utterance.volume = 1
            if (segmentVoice) utterance.voice = segmentVoice

            utterance.onboundary = (event) => {
                const activeState = get()
                if (sessionId !== activeSpeechSessionId || activeState.mode !== 'tts' || activeState.currentTrackIndex !== idx) return
                const localChars = Math.max(0, Math.min(segment.text.length, Number(event.charIndex) || 0))
                const progress = Math.max(0, Math.min(1, (completedChars + localChars) / Math.max(1, totalChars)))
                activeState.setCurrentTime(duration * progress)
            }

            utterance.onend = () => {
                if (sessionId !== activeSpeechSessionId) return
                completedChars += Math.max(1, segment.text.length)
                const delayMs = Math.max(0, Number(segment.pauseMs || 0))
                if (delayMs > 0) {
                    activeSpeechSegmentDelayTimer = window.setTimeout(() => {
                        activeSpeechSegmentDelayTimer = null
                        speakSegment(segmentIndex + 1)
                    }, delayMs)
                    return
                }
                speakSegment(segmentIndex + 1)
            }

            utterance.onerror = failTrack
            synthesis.speak(utterance)
        }

        speakSegment(0)
        startSpeechProgressTimer()
        document.dispatchEvent(new CustomEvent('playerVisible'))
    },

    playTafsirPlaylist: (tracks, startIndex = 0, metadata, settings, options = {}) => {
        const safeTracks = Array.isArray(tracks) ? tracks.filter((track) => String(track?.text || '').trim()) : []
        if (!safeTracks.length) {
            set({ isPlaying: false })
            return
        }

        globalAudio.pause()
        stopSpeechPlayback()

        set({
            mode: 'tts',
            playlist: safeTracks,
            currentTrackIndex: Math.min(Math.max(startIndex, 0), safeTracks.length - 1),
            meta: typeof metadata === 'function' ? metadata(get().meta) : metadata,
            singleSource: null,
            isPlaying: true
        })

        get().playTafsirTrackAtIndex(
            Math.min(Math.max(startIndex, 0), safeTracks.length - 1),
            settings,
            options
        )
    },

    togglePlay: () => {
        const state = get()
        if (state.mode === 'tts') {
            if (activeGeneratedAudioUrl) {
                if (state.isPlaying) {
                    clearSpeechDelayTimer()
                    globalAudio.pause()
                    set({ isPlaying: false })
                } else {
                    if (globalAudio.ended && activeGeneratedSegments.length > 0) {
                        const nextIndex = Math.min(activeGeneratedSegments.length - 1, Math.max(0, activeGeneratedSegmentIndex + 1))
                        if (!playPreloadedGeneratedSegment(nextIndex) && !playGeneratedSegmentAt(nextIndex)) {
                            safePlayAudio(() => set({ isPlaying: false }))
                        }
                    } else {
                        safePlayAudio(() => set({ isPlaying: false }))
                    }
                    set({ isPlaying: true })
                }
                return
            }

            const synthesis = getSpeechSynthesisEngine()
            if (!synthesis) {
                set({ isPlaying: false })
                return
            }

            if (state.isPlaying && synthesis.speaking && !synthesis.paused) {
                pauseSpeechPlayback()
                set({ isPlaying: false })
                return
            }

            if (!state.isPlaying && resumeSpeechPlayback()) {
                set({ isPlaying: true })
                return
            }

            if (state.playlist.length > 0) {
                state.playTafsirTrackAtIndex(state.currentTrackIndex, resolvePlaybackSettings())
            }
            return
        }

        if (state.isPlaying) {
            globalAudio.pause()
            set({ isPlaying: false })
        } else {
            const hasSource = globalAudio.src && globalAudio.src !== window.location.href && globalAudio.src !== '';

            if (hasSource) {
                safePlayAudio(() => set({ isPlaying: false }))
                set({ isPlaying: true })
            } else if (state.mode === 'playlist' && state.playlist.length > 0) {
                const track = state.playlist[state.currentTrackIndex]
                if (track && track.audio) {
                    globalAudio.src = normalizeAudioUrl(track.audio)
                    safePlayAudio(() => set({ isPlaying: false }))
                    set({ isPlaying: true })
                }
            } else if (state.mode === 'single' && state.singleSource) {
                globalAudio.src = normalizeAudioUrl(state.singleSource)
                safePlayAudio(() => set({ isPlaying: false }))
                set({ isPlaying: true })
            }
        }
    },

    seek: (time) => {
        globalAudio.currentTime = time
        set({ currentTime: time })
    },

    seekTafsirSpeechByRatio: (ratio) => {
        const state = get()
        if (state.mode !== 'tts') return

        const safeRatio = Math.max(0, Math.min(1, Number(ratio) || 0))
        const totalDuration = Math.max(0, Number(state.duration || getGeneratedSegmentsTotalDuration() || 0))
        if (totalDuration <= 0) return

        if (activeGeneratedSegments.length > 0) {
            const targetSeconds = safeRatio * totalDuration
            const targetPosition = resolveGeneratedSegmentForAbsoluteTime(targetSeconds)
            clearSpeechDelayTimer()

            if (targetPosition.segmentIndex === activeGeneratedSegmentIndex && globalAudio.src) {
                const segmentBase = getGeneratedElapsedBefore(targetPosition.segmentIndex)
                try {
                    globalAudio.currentTime = Math.max(0, Number(targetPosition.offsetSeconds || 0))
                    state.setCurrentTime(Math.min(totalDuration, segmentBase + Number(targetPosition.offsetSeconds || 0)))
                    if (!state.isPlaying) {
                        safePlayAudio(() => set({ isPlaying: false }))
                        set({ isPlaying: true })
                    }
                } catch {
                    playGeneratedSegmentAtWithOffset(targetPosition.segmentIndex, targetPosition.offsetSeconds)
                    set({ isPlaying: true })
                }
                return
            }

            playGeneratedSegmentAtWithOffset(targetPosition.segmentIndex, targetPosition.offsetSeconds)
            set({ isPlaying: true })
            return
        }

        // SpeechSynthesis fallback modunda yalnizca lineer seek simule edilir.
        state.seek(totalDuration * safeRatio)
    },

    playTrackAtIndex: (idx) => {
        const state = get()
        if (idx >= 0 && idx < state.playlist.length) {
            stopSpeechPlayback()
            set({ currentTrackIndex: idx, isPlaying: true })
            const track = state.playlist[idx]
            if (track && track.audio) {
                globalAudio.src = normalizeAudioUrl(track.audio)
                globalAudio.playbackRate = state.playbackSpeed
                safePlayAudio(() => set({ isPlaying: false }))
            }
        }
    },

    playNext: async (settings) => {
        const state = get()
        const resolvedSettings = resolvePlaybackSettings(settings)
        const activeTrackIndex = resolveActiveTrackIndex(state)

        if (state.mode === 'tts') {
            if (activeTrackIndex < state.playlist.length - 1) {
                state.playTafsirTrackAtIndex(activeTrackIndex + 1, resolvedSettings)
            } else {
                set({ isPlaying: false })
            }
            return
        }

        if (activeTrackIndex !== state.currentTrackIndex) {
            set({ currentTrackIndex: activeTrackIndex })
        }

        if (activeTrackIndex < state.playlist.length - 1) {
            state.playTrackAtIndex(activeTrackIndex + 1)
        } else {
            // In page reading flow, auto-advance should move to the next page's first verse.
            if (state.mode === 'playlist' && state.meta.context === 'page') {
                await state.playNextPage(resolvedSettings)
                return
            }

            if (state.isRepeat && state.playlist.length > 0) {
                state.playTrackAtIndex(0)
                return
            }
            if (state.mode === 'playlist') {
                if (state.meta.context === 'surah') {
                    state.playNextSurah(resolvedSettings)
                } else {
                    set({ isPlaying: false })
                }
            } else {
                set({ isPlaying: false })
            }
        }
    },

    playPrevious: () => {
        const state = get()
        if (state.mode === 'tts') {
            if (state.currentTrackIndex > 0) {
                state.playTafsirTrackAtIndex(state.currentTrackIndex - 1, resolvePlaybackSettings())
            } else {
                state.playTafsirTrackAtIndex(0, resolvePlaybackSettings())
            }
            return
        }
        if (state.currentTrackIndex > 0) {
            const prevIdx = state.currentTrackIndex - 1
            set({ currentTrackIndex: prevIdx, isPlaying: true })
            const track = state.playlist[prevIdx]
            if (track && track.audio) {
                globalAudio.src = normalizeAudioUrl(track.audio)
                safePlayAudio(() => set({ isPlaying: false }))
            }
        }
    },

    // High-Level Navigation (Requires passing settings snapshot)
    playNextSurah: (settings) => {
        const state = get()
        const meta = state.meta
        if (!meta.surahId) {
            set({ isPlaying: false })
            return
        }

        const nextId = parseInt(meta.surahId) + 1
        if (nextId > 114) {
            set({ isPlaying: false })
            return
        }

        const nextSurah = surahs.find(s => s.no === nextId)
        if (!nextSurah) {
            set({ isPlaying: false })
            return
        }

        const playingType = meta.playingType || 'arabic'
        const newMeta = {
            surahNameAr: nextSurah.nameAr,
            surahNameTr: nextSurah.nameTr,
            surahNameEn: nextSurah.nameEn,
            surahType: nextSurah.type,
            ayahCount: nextSurah.ayahCount,
            playingType: playingType,
            link: `/sure/${nextId}`,
            surahId: nextId,
            ayahNo: 0,
            pageNumber: 0,
            context: 'surah'
        }

        if (playingType === 'turkish') {
            if (isTurkishPlaylistSupported(settings.defaultTurkishReciterId)) {
                const tracks = []
                tracks.push({ audio: getTurkishAudioUrl(settings.defaultTurkishReciterId, nextId, 0), ayah: 0 })
                for (let i = 1; i <= nextSurah.ayahCount; i++) {
                    tracks.push({ audio: getTurkishAudioUrl(settings.defaultTurkishReciterId, nextId, i), ayah: i })
                }
                state.playPlaylist(tracks, 0, newMeta)
            } else {
                const url = getTurkishAudioUrl(settings.defaultTurkishReciterId, nextId, 0)
                state.playSingle(url, newMeta)
            }
        } else {
            const url = getSurahAudioUrl(settings.defaultReciterId, nextId)
            state.playSingle(url, newMeta)
        }
    },

    playPreviousSurah: (settings) => {
        const state = get()
        const meta = state.meta
        if (!meta.surahId) return

        const prevId = parseInt(meta.surahId) - 1
        if (prevId < 1) return

        const prevSurah = surahs.find(s => s.no === prevId)
        if (!prevSurah) return

        const playingType = meta.playingType || 'arabic'
        const newMeta = {
            surahNameAr: prevSurah.nameAr,
            surahNameTr: prevSurah.nameTr,
            surahNameEn: prevSurah.nameEn,
            surahType: prevSurah.type,
            ayahCount: prevSurah.ayahCount,
            playingType: playingType,
            link: `/sure/${prevId}`,
            surahId: prevId,
            ayahNo: 0,
            pageNumber: 0,
            context: 'surah'
        }

        if (playingType === 'turkish') {
            if (isTurkishPlaylistSupported(settings.defaultTurkishReciterId)) {
                const tracks = []
                tracks.push({ audio: getTurkishAudioUrl(settings.defaultTurkishReciterId, prevId, 0), ayah: 0 })
                for (let i = 1; i <= prevSurah.ayahCount; i++) {
                    tracks.push({ audio: getTurkishAudioUrl(settings.defaultTurkishReciterId, prevId, i), ayah: i })
                }
                state.playPlaylist(tracks, 0, newMeta)
            } else {
                const url = getTurkishAudioUrl(settings.defaultTurkishReciterId, prevId, 0)
                state.playSingle(url, newMeta)
            }
        } else {
            const url = getSurahAudioUrl(settings.defaultReciterId, prevId)
            state.playSingle(url, newMeta)
        }
    },

    playNextPage: async (settings) => {
        const state = get()
        const resolvedSettings = resolvePlaybackSettings(settings)
        const meta = state.meta
        const startPage = parseInt(meta.pageNumber || 0)

        if (startPage >= 604 || state.loadingNextPage) return

        set({ loadingNextPage: true })
        try {
            const nextPage = startPage + 1
            const primaryAuthorId = resolvedSettings.coreAuthorIds[0] || resolvedSettings.defaultAuthorId
            const nextVerses = await getPage(nextPage, primaryAuthorId, resolvedSettings.defaultReciterId, resolvedSettings.textMode)

            if (nextVerses && nextVerses.length > 0) {
                const playingType = meta.playingType || 'arabic'
                let newTracks = []
                let singleUrl = null

                if (playingType === 'arabic') {
                    newTracks = nextVerses.map(v => ({
                        ...v,
                        audio: v.audio || getVerseAudioUrl(resolvedSettings.defaultReciterId, v.surah?.id || meta.surahId || 1, v.verse_number)
                    })).filter(v => v.audio)
                } else {
                    if (isTurkishPlaylistSupported(resolvedSettings.defaultTurkishReciterId)) {
                        newTracks = state.constructTurkishPagePlaylist(nextVerses, resolvedSettings)
                    } else {
                        const nextSurahId = parseInt(nextVerses[0].surah?.id)
                        singleUrl = getTurkishAudioUrl(resolvedSettings.defaultTurkishReciterId, nextSurahId, 0)
                    }
                }

                const sData = surahs.find(s => s.no === parseInt(nextVerses[0].surah?.id))
                const newMeta = {
                    surahNameAr: sData?.nameAr || nextVerses[0].surah?.name_original,
                    surahNameTr: sData?.nameTr || nextVerses[0].surah?.name,
                    surahNameEn: sData?.nameEn || nextVerses[0].surah?.name_en,
                    surahType: sData?.type || (nextVerses[0].surah?.revelation_place === 'makkah' ? 'Mekki' : 'Medeni'),
                    ayahCount: sData?.ayahCount || nextVerses[0].surah?.verse_count,
                    playingType: playingType,
                    pageNumber: nextPage,
                    juzNumber: nextVerses[0].juz_number,
                    link: `/oku/${nextPage}`,
                    surahId: sData?.no || parseInt(nextVerses[0].surah?.id),
                    ayahNo: 0,
                    context: 'page',
                    startAyah: playingType === 'turkish' ? nextVerses[0].verse_number : 0,
                    autoAdvance: playingType === 'turkish'
                }

                if (newTracks.length > 0) {
                    state.playPlaylist(newTracks, 0, newMeta)
                } else if (playingType === 'turkish' && singleUrl) {
                    state.playSingle(singleUrl, newMeta)
                } else {
                    set({ isPlaying: false })
                }
            }
        } catch (err) {
            console.error("Next page error:", err)
        } finally {
            set({ loadingNextPage: false })
        }
    },

    playPreviousPage: async (settings) => {
        const state = get()
        const resolvedSettings = resolvePlaybackSettings(settings)
        const meta = state.meta
        const startPage = parseInt(meta.pageNumber || 0)

        if (startPage <= 1 || state.loadingNextPage) return

        set({ loadingNextPage: true })
        try {
            const prevPage = startPage - 1
            const primaryAuthorId = resolvedSettings.coreAuthorIds[0] || resolvedSettings.defaultAuthorId
            const prevVerses = await getPage(prevPage, primaryAuthorId, resolvedSettings.defaultReciterId, resolvedSettings.textMode)

            if (prevVerses && prevVerses.length > 0) {
                const playingType = meta.playingType || 'arabic'
                let newTracks = []
                let singleUrl = null

                if (playingType === 'arabic') {
                    newTracks = prevVerses.map(v => ({
                        ...v,
                        audio: v.audio || getVerseAudioUrl(resolvedSettings.defaultReciterId, v.surah?.id || meta.surahId || 1, v.verse_number)
                    })).filter(v => v.audio)
                } else {
                    if (isTurkishPlaylistSupported(resolvedSettings.defaultTurkishReciterId)) {
                        newTracks = state.constructTurkishPagePlaylist(prevVerses, resolvedSettings)
                    } else {
                        const prevSurahId = parseInt(prevVerses[0].surah?.id)
                        singleUrl = getTurkishAudioUrl(resolvedSettings.defaultTurkishReciterId, prevSurahId, 0)
                    }
                }

                const sData = surahs.find(s => s.no === parseInt(prevVerses[0].surah?.id))
                const newMeta = {
                    surahNameAr: sData?.nameAr || prevVerses[0].surah?.name_original,
                    surahNameTr: sData?.nameTr || prevVerses[0].surah?.name,
                    surahNameEn: sData?.nameEn || prevVerses[0].surah?.name_en,
                    surahType: sData?.type || (prevVerses[0].surah?.revelation_place === 'makkah' ? 'Mekki' : 'Medeni'),
                    ayahCount: sData?.ayahCount || prevVerses[0].surah?.verse_count,
                    playingType: playingType,
                    pageNumber: prevPage,
                    juzNumber: prevVerses[0].juz_number,
                    link: `/oku/${prevPage}`,
                    surahId: sData?.no || parseInt(prevVerses[0].surah?.id),
                    ayahNo: 0,
                    context: 'page',
                    startAyah: playingType === 'turkish' ? prevVerses[0].verse_number : 0,
                    autoAdvance: playingType === 'turkish'
                }

                if (newTracks.length > 0) {
                    state.playPlaylist(newTracks, 0, newMeta)
                } else if (playingType === 'turkish' && singleUrl) {
                    state.playSingle(singleUrl, newMeta)
                } else {
                    set({ isPlaying: false })
                }
            }
        } catch (err) {
            console.error("Prev page error:", err)
        } finally {
            set({ loadingNextPage: false })
        }
    },

    playNextVerse: (settings) => {
        const state = get()
        const meta = state.meta
        if (!meta.surahId || !meta.ayahNo) return

        let nextAyah = meta.ayahNo + 1
        let nextSurahId = meta.surahId

        if (nextAyah > meta.ayahCount) {
            nextSurahId = meta.surahId + 1
            nextAyah = 1
            if (nextSurahId > 114) return
        }

        const nextSurah = surahs.find(s => s.no === nextSurahId)
        if (!nextSurah) return

        const playingType = meta.playingType || 'arabic'
        const url = playingType === 'turkish'
            ? getTurkishAudioUrl(settings.defaultTurkishReciterId, nextSurahId, nextAyah)
            : getVerseAudioUrl(settings.defaultReciterId, nextSurahId, nextAyah)

        const newMeta = {
            ...meta,
            surahNameAr: nextSurah.nameAr,
            surahNameTr: nextSurah.nameTr,
            surahNameEn: nextSurah.nameEn,
            surahType: nextSurah.type,
            ayahCount: nextSurah.ayahCount,
            playingType: playingType,
            link: `/sure/${nextSurahId}/${nextAyah}`,
            surahId: nextSurahId,
            ayahNo: nextAyah,
            pageNumber: 0,
            context: 'verse'
        }
        state.playSingle(url, newMeta)
    },

    playPreviousVerse: (settings) => {
        const state = get()
        const meta = state.meta
        if (!meta.surahId || !meta.ayahNo) return

        let prevAyah = meta.ayahNo - 1
        let prevSurahId = meta.surahId

        if (prevAyah < 1) {
            prevSurahId = meta.surahId - 1
            if (prevSurahId < 1) return
            const prevSurah = surahs.find(s => s.no === prevSurahId)
            prevAyah = prevSurah.ayahCount
        }

        const targetSurah = surahs.find(s => s.no === prevSurahId)
        if (!targetSurah) return

        const playingType = meta.playingType || 'arabic'
        const url = playingType === 'turkish'
            ? getTurkishAudioUrl(settings.defaultTurkishReciterId, prevSurahId, prevAyah)
            : getVerseAudioUrl(settings.defaultReciterId, prevSurahId, prevAyah)

        const newMeta = {
            surahNameAr: targetSurah.nameAr,
            surahNameTr: targetSurah.nameTr,
            surahNameEn: targetSurah.nameEn,
            surahType: targetSurah.type,
            ayahCount: targetSurah.ayahCount,
            playingType: playingType,
            link: `/sure/${prevSurahId}/${prevAyah}`,
            surahId: prevSurahId,
            ayahNo: prevAyah,
            pageNumber: 0,
            context: 'verse'
        }
        state.playSingle(url, newMeta)
    },

    constructTurkishPagePlaylist: (verses, settings) => {
        const tracks = []
        if (isTurkishPlaylistSupported(settings.defaultTurkishReciterId)) {
            verses.forEach(v => {
                tracks.push({
                    audio: getTurkishAudioUrl(settings.defaultTurkishReciterId, v.surah.id, v.verse_number),
                    ayah: v.verse_number,
                    surahId: v.surah.id
                })
            })
        }
        return tracks
    },

    skipNext: (settings) => {
        const state = get()
        const resolvedSettings = resolvePlaybackSettings(settings)
        const meta = state.meta

        if (meta.context === 'playlist' && meta.playlistSegments) {
            let currentSegmentIdx = meta.playlistSegments.findIndex(seg =>
                state.currentTrackIndex >= seg.startTrackIdx &&
                state.currentTrackIndex < seg.startTrackIdx + seg.count
            )
            if (currentSegmentIdx !== -1 && currentSegmentIdx < meta.playlistSegments.length - 1) {
                state.playTrackAtIndex(meta.playlistSegments[currentSegmentIdx + 1].startTrackIdx)
                return
            } else if (currentSegmentIdx === meta.playlistSegments.length - 1) {
                set({ isPlaying: false })
                return
            }
        }

        if (meta.context === 'page') {
            if (state.mode === 'playlist' && state.playlist.length > 0) {
                const nextIdx = state.currentTrackIndex + 1
                if (nextIdx < state.playlist.length) {
                    state.playTrackAtIndex(nextIdx)
                } else {
                    state.playNextPage(resolvedSettings)
                }
            }
        } else if (meta.context === 'tafsir' || state.mode === 'tts') {
            const nextIdx = state.currentTrackIndex + 1
            if (nextIdx < state.playlist.length) {
                state.playTafsirTrackAtIndex(nextIdx, resolvedSettings)
            }
        } else if (meta.context === 'verse' || meta.ayahNo > 0) {
            state.playNextVerse(resolvedSettings)
        } else {
            state.playNextSurah(resolvedSettings)
        }
    },

    skipPrevious: (settings) => {
        const state = get()
        const resolvedSettings = resolvePlaybackSettings(settings)
        const meta = state.meta

        if (meta.context === 'playlist' && meta.playlistSegments) {
            let currentSegmentIdx = meta.playlistSegments.findIndex(seg =>
                state.currentTrackIndex >= seg.startTrackIdx &&
                state.currentTrackIndex < seg.startTrackIdx + seg.count
            )
            let seg = meta.playlistSegments[currentSegmentIdx]

            if (seg && state.currentTrackIndex > seg.startTrackIdx + 1) {
                state.playTrackAtIndex(seg.startTrackIdx)
                return
            } else if (currentSegmentIdx > 0) {
                state.playTrackAtIndex(meta.playlistSegments[currentSegmentIdx - 1].startTrackIdx)
                return
            } else if (currentSegmentIdx === 0) {
                state.playTrackAtIndex(0)
                return
            }
        }

        if (meta.context === 'page') {
            if (state.mode === 'playlist' && state.playlist.length > 0) {
                const prevIdx = state.currentTrackIndex - 1
                if (prevIdx >= 0) {
                    state.playTrackAtIndex(prevIdx)
                }
            }
        } else if (meta.context === 'tafsir' || state.mode === 'tts') {
            const prevIdx = Math.max(0, state.currentTrackIndex - 1)
            state.playTafsirTrackAtIndex(prevIdx, resolvedSettings)
        } else if (meta.context === 'verse' || meta.ayahNo > 0) {
            state.playPreviousVerse(resolvedSettings)
        } else {
            state.playPreviousSurah(resolvedSettings)
        }
    }
}))

// Event listeners attachment wrapper
export const initAudioListeners = (settingsFunction) => {
    const audio = globalAudio

    // Prevent multiple bound listeners to avoid memory leaks and double renders (Strict Mode)
    if (usePlayerStore.getState().isAudioInitialized) return;
    usePlayerStore.getState().setAudioInitialized(true);

    audio.addEventListener('timeupdate', () => {
        const state = usePlayerStore.getState()
        if (state.mode === 'tts' && activeGeneratedSegments.length > 0 && activeGeneratedSegmentIndex >= 0) {
            const elapsedBefore = getGeneratedElapsedBefore(activeGeneratedSegmentIndex)
            const progressTime = Math.min(
                state.duration || Infinity,
                Math.max(0, elapsedBefore + Number(audio.currentTime || 0))
            )
            state.setCurrentTime(progressTime)
            return
        }
        state.setCurrentTime(audio.currentTime)
    })

    audio.addEventListener('loadedmetadata', () => {
        const state = usePlayerStore.getState()
        if (state.mode === 'tts' && activeGeneratedSegments.length > 0 && activeGeneratedSegmentIndex >= 0) {
            const segment = activeGeneratedSegments[activeGeneratedSegmentIndex]
            if (segment) {
                segment.runtimeDuration = Number(audio.duration || segment.duration || 0)
            }
            state.setDuration(Math.max(1, getGeneratedSegmentsTotalDuration()))
            return
        }

        state.setDuration(audio.duration)

        // Smart Seek for Turkish Surah Audio
        if (state.meta.playingType === 'turkish' && state.meta.startAyah > 1 && state.meta.ayahCount > 0) {
            const ratio = (state.meta.startAyah - 1) / state.meta.ayahCount
            const seekTo = audio.duration * ratio
            audio.currentTime = seekTo

            state.setMeta(prev => ({ ...prev, startAyah: 0 }))
        }
    })

    audio.addEventListener('ended', () => {
        const state = usePlayerStore.getState()
        const settings = settingsFunction ? settingsFunction() : null

        if (state.mode === 'tts' && activeGeneratedSegments.length > 0 && activeGeneratedSegmentIndex >= 0) {
            const currentSegment = activeGeneratedSegments[activeGeneratedSegmentIndex]
            const nextIndex = activeGeneratedSegmentIndex + 1
            const pauseMs = Math.max(0, Number(currentSegment?.pauseAfterMs || 0))

            if (nextIndex < activeGeneratedSegments.length) {
                const startNextSegment = () => {
                    if (!playPreloadedGeneratedSegment(nextIndex) && !playGeneratedSegmentAt(nextIndex)) {
                        state.playNext(settings)
                    }
                }
                clearSpeechDelayTimer()
                if (pauseMs > 0) {
                    activeSpeechSegmentDelayTimer = window.setTimeout(() => {
                        activeSpeechSegmentDelayTimer = null
                        startNextSegment()
                    }, pauseMs)
                } else {
                    startNextSegment()
                }
                return
            }
        }

        if (state.mode === 'playlist') {
            state.playNext(settings)
        } else if (state.mode === 'tts') {
            state.playNext(settings)
        } else if (state.mode === 'single' && state.meta.autoAdvance) {
            if (state.meta.context === 'page') {
                state.playNextPage(settings)
            } else {
                state.playNextSurah(settings)
            }
        } else {
            state.setIsPlaying(false)
        }
    })

    audio.addEventListener('error', (e) => {
        const state = usePlayerStore.getState()
        const settings = settingsFunction ? settingsFunction() : null
        console.error("Audio Global Error:", e)
        // In page-reading mode, skipping on error causes silent rapid page jumps on some mobile devices.
        // Stop playback and wait for explicit user action instead.
        if (state.meta?.context === 'page') {
            const track = state.mode === 'playlist' ? state.playlist[state.currentTrackIndex] : null
            const surahId = track?.surah?.id || track?.surahId || state.meta?.surahId
            const ayahNo = track?.verse_number || track?.ayah
            const playingType = state.meta?.playingType || 'arabic'
            const recoveryKey = `${playingType}:${surahId || 0}:${ayahNo || 0}`

            // Try one deterministic fallback per ayah to recover from bad/blocked URLs on mobile.
            if (surahId && ayahNo && lastPageAudioRecoveryKey !== recoveryKey) {
                lastPageAudioRecoveryKey = recoveryKey
                const fallback = playingType === 'turkish'
                    ? getTurkishAudioUrl(settings?.defaultTurkishReciterId || 1014, surahId, ayahNo)
                    : getVerseAudioUrl(settings?.defaultReciterId || 7, surahId, ayahNo)
                const normalizedFallback = normalizeAudioUrl(fallback)
                const currentSrc = normalizeAudioUrl(globalAudio.currentSrc || globalAudio.src || '')

                if (normalizedFallback && normalizedFallback !== currentSrc) {
                    globalAudio.src = normalizedFallback
                    globalAudio.load()
                    safePlayAudio(() => state.setIsPlaying(false))
                    return
                }
            }

            state.setIsPlaying(false)
            return
        }

        if (state.mode === 'playlist') {
            state.playNext(settings)
        } else {
            state.setIsPlaying(false)
        }
    })

    audio.addEventListener('play', () => {
        const state = usePlayerStore.getState()
        if (audio.playbackRate !== state.playbackSpeed) {
            audio.playbackRate = state.playbackSpeed
        }
        lastPageAudioRecoveryKey = ''
    })
}

export default usePlayerStore

