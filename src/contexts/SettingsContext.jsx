import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { getArabicFontFamily, getArabicPrimaryFont } from '../utils/typography'
import { supabase } from '../infrastructure/supabaseClient'
import { modeToLegacyTajweed, normalizeTextMode } from '../utils/textMode'

const SettingsContext = createContext()
const SETTINGS_STORAGE_KEY_BASE = 'quran_settings'
const DEFAULT_ACTIVE_IDS = [52, 14, 15, 19, 26, 51, 2, 1, 32, 109, 112, 113, 110, 111, 10, 4, 5, 24, 23]
const GUEST_PROFILE_DEFAULTS = {
    userName: '',
    userBio: '',
    profileIcon: 'muessis',
    hatimCount: 0
}

function createDefaultSettings() {
    return {
        defaultAuthorId: 77, // Diyanet Isleri
        tafsirVerseAuthorId: 77, // Tefsir icindeki ayet meali
        coreAuthorIds: [77, 21], // Ana mealler
        selectedAuthorIds: DEFAULT_ACTIVE_IDS, // Diger aktif mealler
        defaultReciterId: 7, // Mishari Rashid al-`Afasy
        defaultTurkishReciterId: 1015, // Seyfullah Kartal (Meali)
        tafsirVoiceName: '',
        tafsirVoiceRate: 1,
        textMode: 'uthmani',
        showTajweed: false,
        fontSize: 18,
        arabicFont: 'QuranFoundationHafs',
        arabicScale: 1.5,
        translationScale: 1,
        transcriptionScale: 0.72,
        tafsirSource: 'manual', // manual or diyanet
        profileIcon: 'muessis',
        theme: 'light',
        userName: '',
        userBio: '',
        hatimCount: 0,
        readingJourneys: [],
        recentHistory: { surahs: [], verses: [] },
        isPlayerVisible: false,
        isPlayerMinimized: false
    }
}

function normalizeSettingsPayload(defaults, payload = {}) {
    const merged = { ...defaults, ...(payload && typeof payload === 'object' ? payload : {}) }
    const resolvedTextMode = normalizeTextMode(merged.textMode, Boolean(merged.showTajweed))
    const resolvedTafsirVerseAuthorId = Number(merged.tafsirVerseAuthorId || merged.defaultAuthorId || defaults.tafsirVerseAuthorId)
    return {
        ...merged,
        tafsirVerseAuthorId: resolvedTafsirVerseAuthorId,
        textMode: resolvedTextMode,
        showTajweed: modeToLegacyTajweed(resolvedTextMode)
    }
}

function getSettingsStorageKey(userId) {
    return userId ? `${SETTINGS_STORAGE_KEY_BASE}_${userId}` : `${SETTINGS_STORAGE_KEY_BASE}_guest`
}

function safeParse(raw) {
    try {
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

export function SettingsProvider({ children }) {
    const { user } = useAuth()
    const userId = user?.id || ''
    const storageKey = getSettingsStorageKey(userId)
    const [settings, setSettings] = useState(() => createDefaultSettings())

    // Auto-show integrated player when playback starts from global store.
    useEffect(() => {
        const handlePlayerVisible = () => {
            setSettings(prev => (
                prev.isPlayerVisible
                    ? prev
                    : { ...prev, isPlayerVisible: true }
            ))
        }

        document.addEventListener('playerVisible', handlePlayerVisible)
        return () => document.removeEventListener('playerVisible', handlePlayerVisible)
    }, [])

    // Hydrate settings by current user key, then merge remote settings for logged-in user.
    useEffect(() => {
        let active = true

        const hydrate = async () => {
            const defaults = createDefaultSettings()
            const localParsed = safeParse(localStorage.getItem(storageKey))
            const localSettings = normalizeSettingsPayload(defaults, localParsed)

            if (!userId) {
                setSettings({
                    ...localSettings,
                    ...GUEST_PROFILE_DEFAULTS
                })
                return
            }

            // Apply local user cache immediately to prevent old user bleed.
            setSettings({
                ...localSettings,
                userName: user.full_name || user.username || localSettings.userName || '',
                userBio: user.bio || localSettings.userBio || '',
                profileIcon: user.profile_icon || localSettings.profileIcon || 'muessis',
                hatimCount: user.hatim_count || localSettings.hatimCount || 0
            })

            const { data } = await supabase
                .from('user_settings')
                .select('settings_json')
                .eq('user_id', userId)
                .maybeSingle()

            if (!active) return

            const remoteSettings = data?.settings_json && typeof data.settings_json === 'object'
                ? data.settings_json
                : {}

            setSettings({
                ...normalizeSettingsPayload(defaults, localSettings),
                ...normalizeSettingsPayload(defaults, remoteSettings),
                userName: user.full_name || user.username || localSettings.userName || '',
                userBio: user.bio || localSettings.userBio || '',
                profileIcon: user.profile_icon || localSettings.profileIcon || 'muessis',
                hatimCount: user.hatim_count || localSettings.hatimCount || 0
            })
        }

        hydrate()
        return () => { active = false }
    }, [storageKey, userId, user?.full_name, user?.username, user?.bio, user?.profile_icon, user?.hatim_count])

    // LocalStorage sync
    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(settings))
        // Keep legacy key for non-react modules that still read this key.
        localStorage.setItem(SETTINGS_STORAGE_KEY_BASE, JSON.stringify(settings))

        document.documentElement.setAttribute('data-theme', settings.theme)
        document.documentElement.style.setProperty('--arabic-font-family', getArabicFontFamily(settings.arabicFont))
        document.documentElement.setAttribute('data-arabic-font', settings.arabicFont)
        const themeMeta = document.querySelector('meta[name="theme-color"]')
        if (themeMeta) {
            const themeColor = settings.theme === 'dark'
                ? '#121212'
                : settings.theme === 'sepia'
                    ? '#f4eee1'
                    : '#ffffff'
            themeMeta.setAttribute('content', themeColor)
        }

        if (document.fonts?.load) {
            const primaryFont = getArabicPrimaryFont(settings.arabicFont)
            document.fonts.load(`32px "${primaryFont}"`).catch(() => { })
        }
    }, [settings, storageKey])

    // Supabase sync
    useEffect(() => {
        if (!userId) return undefined
        const timer = setTimeout(() => {
            supabase
                .from('user_settings')
                .upsert({
                    user_id: userId,
                    settings_json: settings
                }, { onConflict: 'user_id' })
        }, 2000)
        return () => clearTimeout(timer)
    }, [settings, userId])

    const updateSettings = useCallback((updates) => {
        setSettings(prev => {
            const nextUpdates = typeof updates === 'function' ? updates(prev) : updates
            const merged = { ...prev, ...(nextUpdates || {}) }
            const textMode = normalizeTextMode(
                merged.textMode,
                typeof nextUpdates?.showTajweed === 'boolean' ? nextUpdates.showTajweed : merged.showTajweed
            )
            return {
                ...merged,
                textMode,
                showTajweed: modeToLegacyTajweed(textMode)
            }
        })
    }, [])

    const toggleTheme = () => {
        updateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })
    }

    const toggleAuthor = (id) => {
        setSettings(prev => {
            const exists = prev.selectedAuthorIds.includes(id)
            return {
                ...prev,
                selectedAuthorIds: exists
                    ? prev.selectedAuthorIds.filter(aid => aid !== id)
                    : [...prev.selectedAuthorIds, id]
            }
        })
    }

    return (
        <SettingsContext.Provider value={{
            settings,
            updateSettings,
            toggleTheme,
            toggleAuthor
        }}>
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    const context = useContext(SettingsContext)
    if (!context) throw new Error('useSettings must be used within SettingsProvider')
    return context
}
