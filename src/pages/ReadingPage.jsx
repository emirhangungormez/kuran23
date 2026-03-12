import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPage } from '../services/api'
import { surahs as allSurahs } from '../data/quranData'
import RealRopeBookmark from '../components/RealRopeBookmark'
import { useBookmarks } from '../contexts/BookmarksContext'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import CustomSelect from '../components/CustomSelect'
import DiacriticsToggle from '../components/DiacriticsToggle'
import RamadanStatus from '../components/RamadanStatus'
import GlobalNav from '../components/GlobalNav'
import usePlayerStore from '../stores/usePlayerStore'
import { useShallow } from 'zustand/react/shallow'
import { getTurkishAudioUrl, isTurkishPlaylistSupported } from '../services/audio'
import {
    buildVerseShareText,
    copyToClipboard,
    getAppUrl,
    getXShareUrl,
    openShareWindow
} from '../utils/share'
import {
    getArabicFontFamily,
    getArabicFontSize,
    getTranslationFontSize,
    getTranscriptionFontSize
} from '../utils/typography'
import { normalizeArabicDisplayText, resolveArabicTextVisibility } from '../utils/textEncoding'
import { getVerseTextByMode, normalizeTextMode } from '../utils/textMode'
import './ReadingPage.css'

const JUZ_START_PAGES = [
    1, 22, 42, 62, 82, 102, 122, 142, 162, 182,
    202, 222, 242, 262, 282, 302, 322, 342, 362, 382,
    402, 422, 442, 462, 482, 502, 522, 542, 562, 582
];

export default function ReadingPage() {
    const { page } = useParams()
    const navigate = useNavigate()
    const { saveLastPage, bookmarks, setStringBookmark, toggleVerse, isVerseBookmarked } = useBookmarks()
    const { settings, updateSettings } = useSettings()
    const { isLoggedIn, setIsAuthOpen } = useAuth()
    const parsedPage = Number.parseInt(page || '', 10)
    const lastSavedPage = Number.parseInt(bookmarks?.lastPage?.pageNumber || '', 10)
    const fallbackPage = Number.isInteger(lastSavedPage) && lastSavedPage >= 1 && lastSavedPage <= 604 ? lastSavedPage : 1
    const currentPage = Number.isInteger(parsedPage) && parsedPage >= 1 && parsedPage <= 604 ? parsedPage : fallbackPage
    const [copiedVerseKey, setCopiedVerseKey] = useState('')

    const {
        playSingle,
        playPlaylist,
        togglePlay,
        isPlaying,
        currentTrackIndex,
        playlist,
        meta,
        mode,
        playbackSpeed,
        setPlaybackSpeed,
        setMeta,
        loadPlaylist,
        constructTurkishPagePlaylist
    } = usePlayerStore(useShallow((state) => ({
        playSingle: state.playSingle,
        playPlaylist: state.playPlaylist,
        togglePlay: state.togglePlay,
        isPlaying: state.isPlaying,
        currentTrackIndex: state.currentTrackIndex,
        playlist: state.playlist,
        meta: state.meta,
        mode: state.mode,
        playbackSpeed: state.playbackSpeed,
        setPlaybackSpeed: state.setPlaybackSpeed,
        setMeta: state.setMeta,
        loadPlaylist: state.loadPlaylist,
        constructTurkishPagePlaylist: state.constructTurkishPagePlaylist
    })))

    // Derived state for local highlighting
    const isPagePlaying = (mode === 'playlist' || mode === 'single') && meta.pageNumber === currentPage && meta.context === 'page'
    const currentVerseAudio = isPagePlaying && playlist[currentTrackIndex] ? playlist[currentTrackIndex].audio : null


    const primaryAuthorId = settings.coreAuthorIds[0] || settings.defaultAuthorId
    const {
        data: verses = [],
        isLoading: loading,
        error: queryError
    } = useQuery({
        queryKey: ['page', currentPage, primaryAuthorId, settings.defaultReciterId, settings.textMode],
        queryFn: () => getPage(currentPage, primaryAuthorId, settings.defaultReciterId, settings.textMode),
        enabled: currentPage >= 1 && currentPage <= 604,
        staleTime: 1000 * 60 * 60 * 24 // 24 hours
    })
    const pageVerses = useMemo(() => {
        if (!Array.isArray(verses) || verses.length === 0) return []
        const filtered = verses.filter(v => parseInt(v?.page) === currentPage)
        return filtered.length > 0 ? filtered : verses
    }, [verses, currentPage])
    const playablePageTracks = useMemo(
        () => pageVerses.filter(v => Number(v?.verse_number) > 0 && !!v?.audio),
        [pageVerses]
    )
    const turkishPageTracks = useMemo(
        () => constructTurkishPagePlaylist(pageVerses, settings),
        [constructTurkishPagePlaylist, pageVerses, settings.defaultTurkishReciterId]
    )
    const error = queryError ? "Sayfa yüklenirken bir hata oluştu." : null

    const arabicFontFamily = getArabicFontFamily(settings.arabicFont)
    const arabicFontSize = getArabicFontSize(settings)
    const translationFontSize = getTranslationFontSize(settings)
    const transcriptionFontSize = getTranscriptionFontSize(settings)
    const textMode = normalizeTextMode(settings.textMode, settings.showTajweed)
    const showDiacritics = textMode !== 'plain'

    useEffect(() => {
        if (String(currentPage) !== String(page || '')) {
            navigate(`/oku/${currentPage}`, { replace: true })
        }
    }, [page, currentPage, navigate])

    useEffect(() => {
        if (pageVerses.length > 0) {
            saveLastPage({
                pageNumber: currentPage,
                juzNumber: pageVerses[0].juz_number,
                surahName: pageVerses[0].surah?.name || "",
                surahId: pageVerses[0].surah?.id
            })
        }
    }, [pageVerses, currentPage, saveLastPage])

    useEffect(() => {
        if (!copiedVerseKey) return
        const timer = setTimeout(() => setCopiedVerseKey(''), 1800)
        return () => clearTimeout(timer)
    }, [copiedVerseKey])

    // Isolated Idle Prep
    useEffect(() => {
        const isCorrectPage = meta.pageNumber === currentPage && meta.context === 'page'

        if (!isPlaying && !isCorrectPage && pageVerses.length > 0) {
            const firstVerse = pageVerses[0]
            const trackList = playablePageTracks
            const sData = allSurahs.find(s => s.no === parseInt(firstVerse.surah?.id))
            const metaData = {
                surahNameAr: sData?.nameAr || firstVerse.surah?.name_original,
                surahNameTr: sData?.nameTr || firstVerse.surah?.name,
                surahNameEn: sData?.nameEn || firstVerse.surah?.name_en,
                surahType: sData?.type || (firstVerse.surah?.revelation_place === 'makkah' ? 'Mekki' : 'Medeni'),
                ayahCount: sData?.ayahCount || firstVerse.surah?.verse_count,
                playingType: 'arabic',
                link: `/oku/${currentPage}`,
                pageNumber: currentPage,
                juzNumber: firstVerse.juz_number,
                surahId: sData?.no || parseInt(firstVerse.surah?.id),
                ayahNo: 0,
                context: 'page'
            }
            if (trackList.length > 0) {
                loadPlaylist(trackList, 0, metaData)
            } else {
                setMeta(metaData)
            }
        }
    }, [pageVerses, playablePageTracks, isPlaying, meta.pageNumber, meta.context, currentPage, loadPlaylist, setMeta])

    // Removed local audio effects

    const togglePlayPage = (targetType) => {
        const type = targetType || 'arabic'

        if (isPagePlaying && meta.playingType === type) {
            togglePlay()
        } else {
            if (type === 'turkish') {
                const currentSurahId = parseInt(pageVerses[0]?.surah?.id)
                const surahData = allSurahs.find(s => s.no === currentSurahId)
                if (!surahData) return

                const metaData = {
                    surahNameAr: surahData.nameAr,
                    surahNameTr: surahData.nameTr,
                    surahNameEn: surahData.nameEn,
                    surahType: surahData.type,
                    ayahCount: surahData.ayahCount,
                    playingType: 'turkish',
                    link: `/oku/${currentPage}`,
                    pageNumber: currentPage,
                    juzNumber: pageVerses[0].juz_number,
                    surahId: currentSurahId,
                    autoAdvance: true,
                    context: 'page',
                    startAyah: pageVerses[0].verse_number,
                    verseData: pageVerses
                }

                if (isTurkishPlaylistSupported(settings.defaultTurkishReciterId)) {
                    if (turkishPageTracks.length > 0) {
                        playPlaylist(turkishPageTracks, 0, metaData)
                    }
                } else {
                    const url = getTurkishAudioUrl(settings.defaultTurkishReciterId, currentSurahId, 0)
                    playSingle(url, metaData)
                }
            } else {
                // Arabic (Verse by Verse / Page Playlist)
                const sData = allSurahs.find(s => s.no === parseInt(pageVerses[0]?.surah?.id))
                const metaData = {
                    surahNameAr: sData?.nameAr || pageVerses[0]?.surah?.name_original,
                    surahNameTr: sData?.nameTr || pageVerses[0]?.surah?.name,
                    surahNameEn: sData?.nameEn || pageVerses[0]?.surah?.name_en,
                    surahType: sData?.type || (pageVerses[0]?.surah?.revelation_place === 'makkah' ? 'Mekki' : 'Medeni'),
                    ayahCount: sData?.ayahCount || pageVerses[0]?.surah?.verse_count,
                    playingType: 'arabic',
                    link: `/oku/${currentPage}`,
                    pageNumber: currentPage,
                    juzNumber: pageVerses[0].juz_number,
                    surahId: sData?.no || parseInt(pageVerses[0]?.surah?.id),
                    ayahNo: 0,
                    context: 'page'
                }
                const trackList = playablePageTracks
                if (trackList.length > 0) {
                    playPlaylist(trackList, 0, metaData)
                }
            }
        }
    }

    const playVerse = (audioSrc, vNo, sId, type = 'arabic') => {
        // Must start playlist
        const sData = allSurahs.find(s => s.no === parseInt(sId))
        const metaData = {
            surahNameAr: sData?.nameAr || pageVerses[0]?.surah?.name_original,
            surahNameTr: sData?.nameTr || pageVerses[0]?.surah?.name,
            surahNameEn: sData?.nameEn || pageVerses[0]?.surah?.name_en,
            surahType: sData?.type || (pageVerses[0]?.surah?.revelation_place === 'makkah' ? 'Mekki' : 'Medeni'),
            ayahCount: sData?.ayahCount || pageVerses[0]?.surah?.verse_count,
            playingType: type,
            link: `/oku/${currentPage}`,
            pageNumber: currentPage,
            juzNumber: pageVerses[0].juz_number,
            surahId: sData?.no || parseInt(sId),
            ayahNo: 0,
            context: 'page'
        }

        if (type === 'arabic') {
            const trackList = playablePageTracks
            const idx = trackList.findIndex(t => t.audio === audioSrc)
            if (idx !== -1) {
                playPlaylist(trackList, idx, metaData)
            }
        } else {
            if (isTurkishPlaylistSupported(settings.defaultTurkishReciterId)) {
                const trackList = turkishPageTracks
                const idx = trackList.findIndex((track) => track.ayah === vNo && track.surahId === sId)
                if (idx !== -1) {
                    playPlaylist(trackList, idx, metaData)
                }
            } else {
                const url = getTurkishAudioUrl(settings.defaultTurkishReciterId, sId, 0)
                playSingle(url, metaData)
            }
        }
    }

    const handleCopyVerse = async (verseItem) => {
        const verseKey = `${verseItem.surah.id}-${verseItem.verse_number}`
        const text = buildVerseShareText({
            surahName: verseItem.surah?.name || `Sure ${verseItem.surah?.id}`,
            ayahNo: verseItem.verse_number,
            arabicText: verseItem.verse || '',
            translationText: verseItem.translation?.text || '',
            includeLink: true,
            path: `/sure/${verseItem.surah.id}/${verseItem.verse_number}`
        })
        const ok = await copyToClipboard(text)
        setCopiedVerseKey(ok ? verseKey : `error-${verseKey}`)
    }

    const handleShareVerseX = (verseItem) => {
        const path = `/sure/${verseItem.surah.id}/${verseItem.verse_number}`
        const label = `${verseItem.surah?.name || `Sure ${verseItem.surah?.id}`} ${verseItem.verse_number}. ayet`
        openShareWindow(getXShareUrl(label, getAppUrl(path)))
    }

    const handleNativeShareVerse = async (verseItem) => {
        const path = `/sure/${verseItem.surah.id}/${verseItem.verse_number}`
        const url = getAppUrl(path)
        const title = `${verseItem.surah?.name || `Sure ${verseItem.surah?.id}`} ${verseItem.verse_number}. ayet`
        const text = buildVerseShareText({
            surahName: verseItem.surah?.name || `Sure ${verseItem.surah?.id}`,
            ayahNo: verseItem.verse_number,
            arabicText: verseItem.verse || '',
            translationText: verseItem.translation?.text || '',
            includeLink: false
        })

        if (navigator.share) {
            try {
                await navigator.share({ title, text, url })
                return
            } catch {
                // Fallback below.
            }
        }

        handleShareVerseX(verseItem)
    }

    const currentJuz = pageVerses.length > 0 ? pageVerses[0].juz_number : Math.floor((currentPage - 2) / 20) + 2

    const handlePageChange = (p) => {
        if (p < 1 || p > 604) return
        navigate(`/oku/${p}`)
    }

    const handleJuzChange = (j) => {
        const p = JUZ_START_PAGES[j - 1]
        navigate(`/oku/${p}`)
    }

    const toggleDiacritics = () => {
        updateSettings({ textMode: showDiacritics ? 'plain' : 'uthmani' })
    }

    const sections = useMemo(() => {
        const groups = []
        let currentGroup = null

        pageVerses.forEach(v => {
            if (!currentGroup || currentGroup.surah.id !== v.surah.id) {
                currentGroup = {
                    surah: v.surah,
                    verses: []
                }
                groups.push(currentGroup)
            }
            currentGroup.verses.push(v)
        })
        return groups
    }, [pageVerses])

    const juzOptions = Array.from({ length: 30 }, (_, i) => ({
        value: i + 1,
        label: `${i + 1}. Cüz`
    }))

    const pageOptions = Array.from({ length: 604 }, (_, i) => ({
        value: i + 1,
        label: `${i + 1}. Sayfa`
    }))

    const isStringBookmarked = bookmarks?.stringBookmark?.pageNumber === currentPage

    const toggleStringBookmark = () => {
        if (!isLoggedIn) {
            setIsAuthOpen(true)
            return
        }

        if (isStringBookmarked) {
            setStringBookmark(null)
        } else {
            const currentData = pageVerses.length > 0 ? pageVerses[0] : null
            setStringBookmark({
                pageNumber: currentPage,
                juzNumber: currentData?.juz_number || Math.floor((currentPage - 2) / 20) + 1,
                surahName: currentData?.surah?.name || ""
            })
        }
    }

    return (
        <div className="page reading-view">
            <GlobalNav />
            <div className="page-content">

                <header className="page-header-row reading-nav-header">
                    <Link to="/" className="back-link hidden-mobile">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        <span>Ana Sayfa</span>
                    </Link>

                    <div className="reading-header-center">
                        <div className="reading-selectors">
                            <CustomSelect value={currentJuz} onChange={handleJuzChange} options={juzOptions} />
                            <CustomSelect value={currentPage} onChange={handlePageChange} options={pageOptions} />
                        </div>
                        <div className="reading-actions">
                            <div className="audio-control-group">
                                <button className={`surah-audio-btn arabic ${isPagePlaying && isPlaying && meta.playingType === 'arabic' ? 'playing' : ''}`} onClick={() => togglePlayPage('arabic')}>
                                    {isPagePlaying && isPlaying && meta.playingType === 'arabic' ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                    )}
                                    Arapça
                                </button>
                                <button className={`surah-audio-btn turkish ${isPagePlaying && isPlaying && meta.playingType === 'turkish' ? 'playing' : ''}`} onClick={() => togglePlayPage('turkish')}>
                                    {isPagePlaying && isPlaying && meta.playingType === 'turkish' ? (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                    ) : (
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                    )}
                                    Türkçe
                                </button>
                            </div>
                            <div className="page-secondary-actions reading-secondary-actions">
                                <button className="speed-toggle" onClick={() => {
                                    const speeds = [1, 1.25, 1.5, 2]
                                    const nextSpeed = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length] || 1
                                    setPlaybackSpeed(nextSpeed)
                                }}>
                                    {playbackSpeed}x
                                </button>
                                <button
                                    className={`surah-audio-btn player-toggle ${settings.isPlayerVisible ? 'bg-active' : ''}`}
                                    onClick={() => {
                                        const nextState = !settings.isPlayerVisible
                                        updateSettings({ isPlayerVisible: nextState })

                                        // If opening and not playing, refresh metadata to current page
                                        if (nextState && mode === 'none' && !isPlaying && pageVerses.length > 0) {
                                            const firstVerse = pageVerses[0]
                                            const trackList = pageVerses.filter(v => v.audio)
                                            const metaData = {
                                                surahNameAr: firstVerse.surah?.name_original,
                                                surahNameTr: firstVerse.surah?.name,
                                                surahNameEn: firstVerse.surah?.name_en,
                                                surahType: allSurahs.find(s => s.no === parseInt(firstVerse.surah?.id))?.type || (firstVerse.surah?.revelation_place === 'makkah' ? 'Mekki' : 'Medeni'),
                                                ayahCount: firstVerse.surah?.verse_count,
                                                playingType: 'arabic',
                                                link: `/oku/${currentPage}`,
                                                pageNumber: currentPage,
                                                juzNumber: firstVerse.juz_number,
                                                surahId: parseInt(firstVerse.surah?.id),
                                                context: 'page'
                                            }
                                            if (trackList.length > 0) {
                                                loadPlaylist(trackList, 0, metaData)
                                            } else {
                                                setMeta(metaData)
                                            }
                                        }
                                    }}
                                    title="Oynatıcıyı Göster/Gizle"
                                    style={{ width: '40px', padding: 0, justifyContent: 'center' }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                                    </svg>
                                </button>
                                <DiacriticsToggle
                                    enabled={showDiacritics}
                                    onToggle={toggleDiacritics}
                                    className="diacritics-header-btn"
                                />
                            </div>
                        </div>
                    </div>
                </header>

                <div className="reading-main-content">
                    {loading && !pageVerses.length ? (
                        <div className="loading-state">
                            <p>Sayfa yükleniyor...</p>
                        </div>
                    ) : error ? (
                        <div className="empty-state">
                            <h2>Hata</h2>
                            <p>{error}</p>
                        </div>
                    ) : (
                        <div className="reading-list">
                            {sections.map((section) => (
                                <div key={section.surah.id} className="reading-section">
                                    {section.verses[0].verse_number === 1 ? (
                                        <div className="surah-page-header reading-surah-header">
                                            <span className="surah-page-no">{section.surah.id}</span>
                                            <div className="surah-page-titles">
                                                <h1 className="surah-page-name-ar" dir="rtl">{resolveArabicTextVisibility(section.surah.name_original || '', showDiacritics)}</h1>
                                                <div className="surah-title-row">
                                                    <h2 className="surah-page-name">{section.surah.name}</h2>
                                                    {allSurahs.find(s => s.no === parseInt(section.surah.id))?.type && (
                                                        <span className={`surah-type-badge ${allSurahs.find(s => s.no === parseInt(section.surah.id)).type.toLowerCase()}`}>
                                                            {allSurahs.find(s => s.no === parseInt(section.surah.id)).type}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="surah-mini-header">
                                            {section.surah.name} Suresi Devamı
                                        </div>
                                    )}

                                    {section.verses.map((v) => {
                                        const trAudioUrl = getTurkishAudioUrl(settings.defaultTurkishReciterId, v.surah.id, v.verse_number)
                                        const verseDisplayHtml = normalizeArabicDisplayText(getVerseTextByMode(v, textMode))
                                        const isActiveAr = meta?.playingType === 'arabic' && v.audio && v.audio === currentVerseAudio
                                        const isActiveTr = meta?.playingType === 'turkish' && currentVerseAudio === trAudioUrl
                                        const isActiveRow = (isActiveAr || isActiveTr)
                                        const verseKey = `${v.surah.id}-${v.verse_number}`
                                        const isCopied = copiedVerseKey === verseKey
                                        const isSaved = isVerseBookmarked(v.surah.id, v.verse_number)
                                        const isFallback = Boolean(v.isFallback)
                                        const verseTranscription = (v.transcription || v.transcription_en || '').trim()

                                        return (
                                            <div
                                                key={v.id}
                                                className={`split-verse-row ${isActiveRow ? 'active-verse' : ''}`}
                                            >
                                                <div className="arabic-side" dir="rtl">
                                                    <div className="verse-ar-wrap">
                                                        <p
                                                            className="verse-ar-text"
                                                            style={{
                                                                fontSize: `${arabicFontSize}px`,
                                                                fontFamily: arabicFontFamily
                                                            }}
                                                            dangerouslySetInnerHTML={{ __html: verseDisplayHtml + `<span class="verse-num-badge">${v.verse_number}</span>` }}
                                                        />
                                                        <div className="verse-ar-actions">
                                                            <button
                                                                className={`verse-play-btn ${isActiveAr && isPlaying ? 'playing' : ''}`}
                                                                onClick={() => v.audio && playVerse(v.audio, v.verse_number, v.surah.id, 'arabic')}
                                                            >
                                                                {isActiveAr && isPlaying ? (
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                                                ) : (
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                                                )}
                                                            </button>
                                                            <Link
                                                                to={`/sure/${v.surah.id}/${v.verse_number}`}
                                                                className="verse-link-btn"
                                                                title="Ayet Sayfasına Git"
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="9 18 15 12 9 6" />
                                                                </svg>
                                                            </Link>
                                                        </div>
                                                    </div>
                                                    {verseTranscription && (
                                                        <p
                                                            className="verse-ar-transcription"
                                                            dir="ltr"
                                                            style={{ fontSize: `${Math.max(11, transcriptionFontSize)}px` }}
                                                        >
                                                            {verseTranscription}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="meal-side hover-action-side">
                                                    <div className="meal-side-header flex items-center justify-between pointer-events-none">
                                                        <span className="meta-info">
                                                            {section.surah.name}, {v.verse_number}. Ayet • {v.translation?.author?.name || v.translation?.author || 'Meal'}
                                                            {isFallback && <span className="fallback-chip">fallback</span>}
                                                        </span>
                                                        <div className="meal-actions pointer-events-auto display-flex gap-2">
                                                            <button
                                                                className={`verse-play-btn ${isActiveTr && isPlaying ? 'playing' : ''}`}
                                                                onClick={(e) => { e.preventDefault(); playVerse(trAudioUrl, v.verse_number, v.surah.id, 'turkish'); }}
                                                                title="Türkçe Mealini Dinle"
                                                            >
                                                                {isActiveTr && isPlaying ? (
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                                                ) : (
                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                                                )}
                                                            </button>
                                                            <Link title="Ayet Sayfasına Git" to={`/sure/${v.surah.id}/${v.verse_number}`} className="verse-link-btn inline-flex">
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <polyline points="9 18 15 12 9 6" />
                                                                </svg>
                                                            </Link>
                                                            <button
                                                                className={`verse-link-btn ${isCopied ? 'active' : ''}`}
                                                                onClick={(e) => { e.preventDefault(); handleCopyVerse(v) }}
                                                                title="Arapça + meal kopyala"
                                                            >
                                                                {isCopied ? (
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <polyline points="20 6 9 17 4 12" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                                                    </svg>
                                                                )}
                                                            </button>
                                                            <button
                                                                className="verse-link-btn"
                                                                onClick={(e) => { e.preventDefault(); handleNativeShareVerse(v) }}
                                                                title="Paylaş"
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <circle cx="18" cy="5" r="3" />
                                                                    <circle cx="6" cy="12" r="3" />
                                                                    <circle cx="18" cy="19" r="3" />
                                                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                                                </svg>
                                                            </button>
                                                            <button
                                                                className="verse-link-btn"
                                                                onClick={(e) => { e.preventDefault(); handleShareVerseX(v) }}
                                                                title="X'te paylaş"
                                                            >
                                                                <span style={{ fontSize: '11px', fontWeight: 700 }}>X</span>
                                                            </button>
                                                            <button
                                                                className={`verse-link-btn ${isSaved ? 'active' : ''}`}
                                                                onClick={(e) => { e.preventDefault(); toggleVerse(v, v.surah.id, v.surah.name) }}
                                                                title={isSaved ? 'Kayıtlı ayet' : 'Ayeti kaydet'}
                                                            >
                                                                {isSaved ? (
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                                                        <path d="M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2z" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                                                    </svg>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <p className="verse-tr-text" style={{ fontSize: `${translationFontSize}px` }}>{v.translation?.text}</p>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="reading-footer">
                    <button
                        className="reading-nav-btn"
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        Önceki Sayfa
                    </button>

                    <button
                        className="reading-nav-btn"
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === 604}
                    >
                        Sonraki Sayfa
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    </button>
                </div>
            </div>

            {/* Real Rope Bookmark - Moved to bottom to ensure maximum z-index priority */}
            <div className="rope-bookmark-wrapper">
                <RealRopeBookmark
                    isBookmarked={isStringBookmarked}
                    onToggle={toggleStringBookmark}
                />
            </div>

            {/* Integrated Player Removed - Now in App.jsx */}
        </div>
    )
}




