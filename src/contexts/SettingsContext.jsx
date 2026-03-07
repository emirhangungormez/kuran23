import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { getArabicFontFamily, getArabicPrimaryFont } from '../utils/typography'
import { supabase } from '../infrastructure/supabaseClient'

const SettingsContext = createContext()

export function SettingsProvider({ children }) {
    const { user } = useAuth()
    const [settings, setSettings] = useState(() => {
        const defaultActiveIds = [52, 14, 15, 19, 26, 51, 2, 1, 32, 109, 112, 113, 110, 111, 10, 4, 5, 24, 23]
        const defaults = {
            defaultAuthorId: 77, // Diyanet İşleri
            coreAuthorIds: [77, 21], // Ana Mealler
            selectedAuthorIds: defaultActiveIds, // Diğer Aktif Mealler
            defaultReciterId: 7, // Mishari Rashid al-`Afasy
            defaultTurkishReciterId: 1015, // Seyfullah Kartal (Meali)
            showTajweed: false,
            fontSize: 18,
            arabicFont: 'QuranFoundationHafs',
            arabicScale: 1.5,
            translationScale: 1,
            transcriptionScale: 0.72,
            tafsirSource: 'manual', // manual or diyanet
            profileIcon: 'muessis',
            theme: 'light',
            userName: 'Misafir Kullanıcı',
            userBio: 'Kuran-ı Kerim okuyucusu',
            hatimCount: 0,
            readingJourneys: [],
            isPlayerVisible: false,
            isPlayerMinimized: false
        }
        try {
            const saved = localStorage.getItem('quran_settings')
            if (!saved) return defaults
            const parsed = JSON.parse(saved)
            return { ...defaults, ...parsed }
        } catch {
            return defaults
        }
    })

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

    // Update and hydrate settings when user logs in
    useEffect(() => {
        let active = true

        const hydrate = async () => {
            if (!user?.id) return

            const { data } = await supabase
                .from('user_settings')
                .select('settings_json')
                .eq('user_id', user.id)
                .maybeSingle()

            if (!active) return

            const remoteSettings = data?.settings_json && typeof data.settings_json === 'object'
                ? data.settings_json
                : {}

            setSettings(prev => ({
                ...prev,
                ...remoteSettings,
                userName: user.full_name || user.username || prev.userName,
                userBio: user.bio || prev.userBio || 'Kuran-ı Kerim okuyucusu',
                profileIcon: user.profile_icon || prev.profileIcon || 'muessis',
                hatimCount: user.hatim_count || prev.hatimCount || 0
            }))
        }

        hydrate()
        return () => { active = false }
    }, [user])

    // LocalStorage sync
    useEffect(() => {
        localStorage.setItem('quran_settings', JSON.stringify(settings))
        document.documentElement.setAttribute('data-theme', settings.theme)
        document.documentElement.style.setProperty('--arabic-font-family', getArabicFontFamily(settings.arabicFont))
        document.documentElement.setAttribute('data-arabic-font', settings.arabicFont)

        if (document.fonts?.load) {
            const primaryFont = getArabicPrimaryFont(settings.arabicFont)
            document.fonts.load(`32px "${primaryFont}"`).catch(() => { })
        }
    }, [settings])

    // Supabase sync
    useEffect(() => {
        if (!user?.id) return undefined
        const timer = setTimeout(() => {
            supabase
                .from('user_settings')
                .upsert({
                    user_id: user.id,
                    settings_json: settings
                }, { onConflict: 'user_id' })
        }, 2000)
        return () => clearTimeout(timer)
    }, [settings, user])

    const updateSettings = useCallback((updates) => {
        setSettings(prev => ({
            ...prev,
            ...updates
        }))
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
