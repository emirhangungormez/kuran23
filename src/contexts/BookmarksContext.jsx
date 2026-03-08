import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { useSettings } from './SettingsContext'
import { supabase } from '../infrastructure/supabaseClient'

const BookmarksContext = createContext()
const BOOKMARKS_STORAGE_KEY_BASE = 'quran_bookmarks'
const HISTORY_LIMIT = 20
const EMPTY_HISTORY = { surahs: [], verses: [] }

function normalizeMeta(value) {
    if (!value) return null
    if (typeof value === 'object') return value
    try {
        return JSON.parse(value)
    } catch {
        return null
    }
}

function normalizeHistory(value) {
    const history = value && typeof value === 'object' ? value : EMPTY_HISTORY
    const surahs = Array.isArray(history.surahs) ? history.surahs.slice(0, HISTORY_LIMIT) : []
    const verses = Array.isArray(history.verses) ? history.verses.slice(0, HISTORY_LIMIT) : []
    return { surahs, verses }
}

function getBookmarksStorageKey(userId) {
    return userId ? `${BOOKMARKS_STORAGE_KEY_BASE}_${userId}` : `${BOOKMARKS_STORAGE_KEY_BASE}_guest`
}

function safeParse(raw) {
    try {
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

function createDefaultBookmarks(history = EMPTY_HISTORY) {
    return {
        surahs: [],
        verses: [],
        lastPage: null,
        stringBookmark: null,
        history: normalizeHistory(history)
    }
}

function toRemoteBookmarks(rows = []) {
    const bookmarks = {
        surahs: [],
        verses: [],
        lastPage: null,
        stringBookmark: null
    }

    for (const row of rows) {
        const meta = normalizeMeta(row.metadata)
        if (row.item_type === 'surah' && meta) {
            bookmarks.surahs.push(meta)
        } else if (row.item_type === 'verse' && meta) {
            bookmarks.verses.push(meta)
        } else if (row.item_type === 'last_read') {
            bookmarks.lastPage = meta
        } else if (row.item_type === 'string_bookmark') {
            bookmarks.stringBookmark = meta
        }
    }

    return bookmarks
}

async function upsertRemoteBookmark(userId, itemId, itemType, metadata) {
    const payload = {
        user_id: userId,
        item_id: itemId,
        item_type: itemType,
        metadata: metadata || null,
        surah_id: metadata?.surah_id ? parseInt(metadata.surah_id, 10) : (metadata?.id && itemType === 'surah' ? parseInt(metadata.id, 10) : null),
        verse_number: metadata?.verse_number ? parseInt(metadata.verse_number, 10) : null,
    }

    await supabase
        .from('user_bookmarks')
        .upsert(payload, { onConflict: 'user_id,item_id,item_type' })
}

async function removeRemoteBookmark(userId, itemId, itemType) {
    await supabase
        .from('user_bookmarks')
        .delete()
        .eq('user_id', userId)
        .eq('item_id', itemId)
        .eq('item_type', itemType)
}

export function BookmarksProvider({ children }) {
    const { user, setIsAuthOpen } = useAuth()
    const { settings, updateSettings } = useSettings()
    const userId = user?.id || ''
    const storageKey = getBookmarksStorageKey(userId)

    const [bookmarks, setBookmarks] = useState(() => createDefaultBookmarks(settings?.recentHistory))

    // Load local cache when account changes to prevent history bleed between users.
    useEffect(() => {
        const defaults = createDefaultBookmarks(settings?.recentHistory)
        const parsed = safeParse(localStorage.getItem(storageKey))

        if (!parsed || typeof parsed !== 'object') {
            setBookmarks(defaults)
            return
        }

        setBookmarks({
            ...defaults,
            surahs: Array.isArray(parsed.surahs) ? parsed.surahs : [],
            verses: Array.isArray(parsed.verses) ? parsed.verses : [],
            lastPage: parsed.lastPage || null,
            stringBookmark: parsed.stringBookmark || null
        })
    }, [storageKey])

    // Keep history source of truth in settings.recentHistory (synced to Supabase via SettingsContext).
    useEffect(() => {
        const normalized = normalizeHistory(settings?.recentHistory)
        setBookmarks(prev => {
            const currentSerialized = JSON.stringify(normalizeHistory(prev.history))
            const nextSerialized = JSON.stringify(normalized)
            if (currentSerialized === nextSerialized) return prev
            return { ...prev, history: normalized }
        })
    }, [settings?.recentHistory])

    // Fetch bookmarks and remote history from Supabase on login.
    useEffect(() => {
        let active = true

        const loadBookmarks = async () => {
            if (!userId) return

            const [{ data: bookmarkRows }, { data: settingsRow }] = await Promise.all([
                supabase
                    .from('user_bookmarks')
                    .select('item_id,item_type,metadata,surah_id,verse_number')
                    .eq('user_id', userId),
                supabase
                    .from('user_settings')
                    .select('settings_json')
                    .eq('user_id', userId)
                    .maybeSingle()
            ])

            if (!active) return

            const mapped = toRemoteBookmarks(bookmarkRows || [])
            const remoteHistory = normalizeHistory(settingsRow?.settings_json?.recentHistory)

            setBookmarks({
                ...createDefaultBookmarks(remoteHistory),
                ...mapped,
                history: remoteHistory
            })

            updateSettings({ recentHistory: remoteHistory })
        }

        loadBookmarks()
        return () => { active = false }
    }, [userId, updateSettings])

    // Persist bookmark core data with user-specific local key.
    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify({
            surahs: bookmarks.surahs,
            verses: bookmarks.verses,
            lastPage: bookmarks.lastPage,
            stringBookmark: bookmarks.stringBookmark
        }))
    }, [bookmarks.surahs, bookmarks.verses, bookmarks.lastPage, bookmarks.stringBookmark, storageKey])

    const saveLastPage = useCallback((pageInfo) => {
        const meta = { ...pageInfo, savedAt: new Date().toISOString() }
        setBookmarks(prev => ({ ...prev, lastPage: meta }))

        if (userId) {
            upsertRemoteBookmark(userId, 'last_read', 'last_read', meta)
        }
    }, [userId])

    const setStringBookmark = useCallback((pageInfo) => {
        const meta = pageInfo ? { ...pageInfo, savedAt: new Date().toISOString() } : null
        setBookmarks(prev => ({ ...prev, stringBookmark: meta }))

        if (!userId) return

        if (meta) {
            upsertRemoteBookmark(userId, 'string_bookmark', 'string_bookmark', meta)
        } else {
            removeRemoteBookmark(userId, 'string_bookmark', 'string_bookmark')
        }
    }, [userId])

    const toggleSurah = useCallback((surah) => {
        if (!userId) {
            setIsAuthOpen(true)
            return
        }

        const meta = {
            id: surah.id,
            name: surah.name,
            name_original: surah.name_original || surah.nameAr,
            verse_count: surah.verse_count || surah.ayahCount,
            type: surah.type,
            savedAt: new Date().toISOString()
        }

        const exists = bookmarks.surahs.some(s => s.id === surah.id)

        setBookmarks(prev => ({
            ...prev,
            surahs: exists
                ? prev.surahs.filter(s => s.id !== surah.id)
                : [...prev.surahs, meta]
        }))

        if (exists) {
            removeRemoteBookmark(userId, `surah-${surah.id}`, 'surah')
        } else {
            upsertRemoteBookmark(userId, `surah-${surah.id}`, 'surah', meta)
        }
    }, [bookmarks.surahs, userId, setIsAuthOpen])

    const toggleVerse = useCallback((verse, surahId, surahName) => {
        if (!userId) {
            setIsAuthOpen(true)
            return
        }

        const verseToStore = {
            ...verse,
            surah_id: parseInt(surahId, 10),
            verse_number: parseInt(verse.verse_number || verse.ayah, 10)
        }
        const currentVerseId = verseToStore.id || `${verseToStore.surah_id}-${verseToStore.verse_number}`

        const meta = {
            ...verseToStore,
            id: currentVerseId,
            surah_name: surahName,
            savedAt: new Date().toISOString()
        }

        const exists = bookmarks.verses.some(v => v.id === currentVerseId)

        setBookmarks(prev => ({
            ...prev,
            verses: exists
                ? prev.verses.filter(v => v.id !== currentVerseId)
                : [...prev.verses, meta]
        }))

        if (exists) {
            removeRemoteBookmark(userId, currentVerseId, 'verse')
        } else {
            upsertRemoteBookmark(userId, currentVerseId, 'verse', meta)
        }
    }, [bookmarks.verses, userId, setIsAuthOpen])

    const addToHistory = useCallback((item, type) => {
        if (type !== 'surahs' && type !== 'verses') return

        let nextHistory = null

        setBookmarks(prev => {
            const currentHistory = normalizeHistory(prev.history)
            const list = currentHistory[type] || []
            const filtered = list.filter((i) => {
                if (type === 'surahs') return i.no !== item.no
                return i.id !== (item.id || `${item.surahId || item.surah_id}-${item.ayah || item.verse_number}`)
            })

            const newItem = {
                ...item,
                id: item.id || (type === 'verses' ? `${item.surahId || item.surah_id}-${item.ayah || item.verse_number}` : item.no),
                visitedAt: new Date().toISOString()
            }

            nextHistory = {
                ...currentHistory,
                [type]: [newItem, ...filtered].slice(0, HISTORY_LIMIT)
            }

            return { ...prev, history: nextHistory }
        })

        if (nextHistory) {
            updateSettings({ recentHistory: nextHistory })
        }
    }, [updateSettings])

    const clearHistory = useCallback((type) => {
        if (type !== 'surahs' && type !== 'verses') return

        let nextHistory = null

        setBookmarks(prev => {
            const currentHistory = normalizeHistory(prev.history)
            nextHistory = { ...currentHistory, [type]: [] }
            return { ...prev, history: nextHistory }
        })

        if (nextHistory) {
            updateSettings({ recentHistory: nextHistory })
        }
    }, [updateSettings])

    const isSurahBookmarked = useCallback((id) => bookmarks.surahs.some(s => parseInt(s.id, 10) === parseInt(id, 10)), [bookmarks.surahs])

    const isVerseBookmarked = useCallback((surahId, verseNumber) => {
        return bookmarks.verses.some(v =>
            v.id === `${surahId}-${verseNumber}` ||
            (parseInt(v.surah_id, 10) === parseInt(surahId, 10) && parseInt(v.verse_number, 10) === parseInt(verseNumber, 10))
        )
    }, [bookmarks.verses])

    return (
        <BookmarksContext.Provider value={{
            bookmarks,
            toggleSurah,
            toggleVerse,
            isSurahBookmarked,
            isVerseBookmarked,
            saveLastPage,
            setStringBookmark,
            addToHistory,
            clearHistory
        }}>
            {children}
        </BookmarksContext.Provider>
    )
}

export function useBookmarks() {
    const context = useContext(BookmarksContext)
    if (!context) throw new Error('useBookmarks must be used within BookmarksProvider')
    return context
}
