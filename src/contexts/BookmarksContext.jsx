import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'

const BookmarksContext = createContext()

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
        } catch (e) {
            return defaults
        }
    })

    // Fetch bookmarks from backend on login
    useEffect(() => {
        if (user) {
            fetch(`/api/sync.php?action=get_userdata&user_id=${user.id}`)
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.bookmarks) {
                        setBookmarks(prev => ({
                            ...data.bookmarks,
                            history: prev.history // Keep local history for now
                        }))
                    }
                })
        }
    }, [user])

    useEffect(() => {
        localStorage.setItem('quran_bookmarks', JSON.stringify(bookmarks))
    }, [bookmarks])

    const saveLastPage = useCallback((pageInfo) => {
        const meta = { ...pageInfo, savedAt: new Date().toISOString() };
        setBookmarks(prev => ({ ...prev, lastPage: meta }));

        if (user) {
            fetch(`/api/sync.php?action=toggle_bookmark&user_id=${user.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_id: 'last_read',
                    item_type: 'last_read',
                    metadata: meta
                })
            });
        }
    }, [user])

    const setStringBookmark = useCallback((pageInfo) => {
        const meta = pageInfo ? { ...pageInfo, savedAt: new Date().toISOString() } : null;
        setBookmarks(prev => ({ ...prev, stringBookmark: meta }));

        if (user) {
            fetch(`/api/sync.php?action=toggle_bookmark&user_id=${user.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_id: 'string_bookmark',
                    item_type: 'string_bookmark',
                    metadata: meta
                })
            });
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
        };

        setBookmarks(prev => {
            const exists = prev.surahs.find(s => s.id === surah.id);
            return {
                ...prev,
                surahs: exists
                    ? prev.surahs.filter(s => s.id !== surah.id)
                    : [...prev.surahs, meta]
            };
        });

        if (user) {
            fetch(`/api/sync.php?action=toggle_bookmark&user_id=${user.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_id: `surah-${surah.id}`,
                    item_type: 'surah',
                    metadata: meta
                })
            });
        }
    }, [user, setIsAuthOpen])

    const toggleVerse = useCallback((verse, surahId, surahName) => {
        if (!user) {
            setIsAuthOpen(true)
            return
        }

        const verseToStore = {
            ...verse,
            surah_id: parseInt(surahId),
            verse_number: parseInt(verse.verse_number || verse.ayah)
        };
        const currentVerseId = verseToStore.id || `${verseToStore.surah_id}-${verseToStore.verse_number}`;

        const meta = {
            ...verseToStore,
            id: currentVerseId,
            surah_name: surahName,
            savedAt: new Date().toISOString()
        };

        setBookmarks(prev => {
            const exists = prev.verses.find(v => v.id === currentVerseId);
            return {
                ...prev,
                verses: exists
                    ? prev.verses.filter(v => v.id !== currentVerseId)
                    : [...prev.verses, meta]
            };
        });

        if (user) {
            fetch(`/api/sync.php?action=toggle_bookmark&user_id=${user.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    item_id: currentVerseId,
                    item_type: 'verse',
                    metadata: meta
                })
            });
        }
    }, [user, setIsAuthOpen])

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
