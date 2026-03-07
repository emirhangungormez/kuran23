import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../infrastructure/supabaseClient'

const BookmarksContext = createContext()

function normalizeMeta(value) {
    if (!value) return null
    if (typeof value === 'object') return value
    try {
        return JSON.parse(value)
    } catch {
        return null
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
    const [bookmarks, setBookmarks] = useState(() => {
        const defaults = {
            surahs: [],
            verses: [],
            lastPage: null,
            stringBookmark: null,
            history: { surahs: [], verses: [] }
        }

        try {
            const saved = localStorage.getItem('quran_bookmarks')
            if (!saved) return defaults
            const parsed = JSON.parse(saved)
            return {
                ...defaults,
                ...parsed,
                history: parsed.history || defaults.history
            }
        } catch {
            return defaults
        }
    })

    // Fetch bookmarks from Supabase on login
    useEffect(() => {
        let active = true

        const loadBookmarks = async () => {
            if (!user?.id) return

            const { data } = await supabase
                .from('user_bookmarks')
                .select('item_id,item_type,metadata,surah_id,verse_number')
                .eq('user_id', user.id)

            if (!active) return

            const mapped = toRemoteBookmarks(data || [])
            setBookmarks(prev => ({
                ...mapped,
                history: prev.history // Keep local history for now
            }))
        }

        loadBookmarks()
        return () => { active = false }
    }, [user])

    useEffect(() => {
        localStorage.setItem('quran_bookmarks', JSON.stringify(bookmarks))
    }, [bookmarks])

    const saveLastPage = useCallback((pageInfo) => {
        const meta = { ...pageInfo, savedAt: new Date().toISOString() }
        setBookmarks(prev => ({ ...prev, lastPage: meta }))

        if (user?.id) {
            upsertRemoteBookmark(user.id, 'last_read', 'last_read', meta)
        }
    }, [user])

    const setStringBookmark = useCallback((pageInfo) => {
        const meta = pageInfo ? { ...pageInfo, savedAt: new Date().toISOString() } : null
        setBookmarks(prev => ({ ...prev, stringBookmark: meta }))

        if (!user?.id) return

        if (meta) {
            upsertRemoteBookmark(user.id, 'string_bookmark', 'string_bookmark', meta)
        } else {
            removeRemoteBookmark(user.id, 'string_bookmark', 'string_bookmark')
        }
    }, [user])

    const toggleSurah = useCallback((surah) => {
        if (!user) {
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
            removeRemoteBookmark(user.id, `surah-${surah.id}`, 'surah')
        } else {
            upsertRemoteBookmark(user.id, `surah-${surah.id}`, 'surah', meta)
        }
    }, [bookmarks.surahs, user, setIsAuthOpen])

    const toggleVerse = useCallback((verse, surahId, surahName) => {
        if (!user) {
            setIsAuthOpen(true)
            return
        }

        const verseToStore = {
            ...verse,
            surah_id: parseInt(surahId),
            verse_number: parseInt(verse.verse_number || verse.ayah)
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
            removeRemoteBookmark(user.id, currentVerseId, 'verse')
        } else {
            upsertRemoteBookmark(user.id, currentVerseId, 'verse', meta)
        }
    }, [bookmarks.verses, user, setIsAuthOpen])

    const addToHistory = useCallback((item, type) => {
        setBookmarks(prev => {
            const currentHistory = prev.history || { surahs: [], verses: [] }
            const list = currentHistory[type] || []
            const filtered = list.filter(i => {
                if (type === 'surahs') return i.no !== item.no
                return i.id !== (item.id || `${item.surahId || item.surah_id}-${item.ayah || item.verse_number}`)
            })
            const newItem = {
                ...item,
                id: item.id || (type === 'verses' ? `${item.surahId || item.surah_id}-${item.ayah || item.verse_number}` : item.no),
                visitedAt: new Date().toISOString()
            }
            const newList = [newItem, ...filtered].slice(0, 20)
            return { ...prev, history: { ...currentHistory, [type]: newList } }
        })
    }, [])

    const clearHistory = useCallback((type) => {
        setBookmarks(prev => ({
            ...prev,
            history: { ...prev.history, [type]: [] }
        }))
    }, [])

    const isSurahBookmarked = useCallback((id) => bookmarks.surahs.some(s => parseInt(s.id) === parseInt(id)), [bookmarks.surahs])

    const isVerseBookmarked = useCallback((surahId, verseNumber) => {
        return bookmarks.verses.some(v =>
            v.id === `${surahId}-${verseNumber}` ||
            (parseInt(v.surah_id) === parseInt(surahId) && parseInt(v.verse_number) === parseInt(verseNumber))
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
