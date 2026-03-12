import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSurah, getSurahInfo, getDiyanetSurahInfo } from '../services/api'
import { useBookmarks } from '../contexts/BookmarksContext'
import { useSettings } from '../contexts/SettingsContext'
import BookmarkButton from '../components/BookmarkButton'
import DiacriticsToggle from '../components/DiacriticsToggle'
import UserAvatar from '../components/UserAvatar'
import ThemeToggle from '../components/ThemeToggle'
import RamadanStatus from '../components/RamadanStatus'
import GlobalNav from '../components/GlobalNav'
import { surahs } from '../data/quranData'
import {
    TAFSIR_SOURCES,
    TAFSIR_SOURCE_MAP,
    extractSourceSpecificTafsir,
    getManualSurahSourceTafsir
} from '../data/tafsirSources'
import usePlayerStore from '../stores/usePlayerStore'
import { useShallow } from 'zustand/react/shallow'
import useUsageTracker from '../hooks/useUsageTracker'
import { normalizeArabicDisplayText, normalizeTafsirText, resolveArabicTextVisibility } from '../utils/textEncoding'
import { getVerseTextByMode, normalizeTextMode } from '../utils/textMode'
import { formatTafsirRichText } from '../utils/tafsirFormatting'
import {
    buildSurahShareText,
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
import './SurahPage.css'

import { getSurahAudioUrl, getVerseAudioUrl, getTurkishAudioUrl, isArabicPlaylistSupported, isTurkishPlaylistSupported } from '../services/audio'

export default function SurahPage() {
    const { id } = useParams()
    const [activeTab, setActiveTab] = useState('ayetler')
    const [tefsirTab, setTefsirTab] = useState('kuran23')
    const [diyanetSurahInfo, setDiyanetSurahInfo] = useState(null)
    const [diyanetInfoErrorMessage, setDiyanetInfoErrorMessage] = useState('')
    const [copyStatus, setCopyStatus] = useState('idle')
    const { isSurahBookmarked, toggleSurah, addToHistory } = useBookmarks()
    const { settings, updateSettings } = useSettings()

    useUsageTracker({ surahId: id, enabled: true })


    // Use Global Player
    const {
        playSingle,
        playPlaylist,
        togglePlay,
        isPlaying,
        currentTime,
        duration,
        meta,
        mode,
        playbackSpeed,
        setPlaybackSpeed,
        setMeta,
        currentTrackIndex,
        playlist
    } = usePlayerStore(useShallow((state) => ({
        playSingle: state.playSingle,
        playPlaylist: state.playPlaylist,
        togglePlay: state.togglePlay,
        isPlaying: state.isPlaying,
        currentTime: state.currentTime,
        duration: state.duration,
        meta: state.meta,
        mode: state.mode,
        playbackSpeed: state.playbackSpeed,
        setPlaybackSpeed: state.setPlaybackSpeed,
        setMeta: state.setMeta,
        currentTrackIndex: state.currentTrackIndex,
        playlist: state.playlist
    })))

    // Derived state
    const isSurahPlaying = (mode === 'single' || mode === 'playlist') && meta.surahId === parseInt(id) && meta.context === 'surah'
    const playingType = isSurahPlaying ? meta.playingType : null

    const surahMeta = surahs.find(s => s.no === parseInt(id))
    const arabicFontFamily = getArabicFontFamily(settings.arabicFont)
    const arabicFontSize = getArabicFontSize(settings)
    const translationFontSize = getTranslationFontSize(settings)
    const transcriptionFontSize = getTranscriptionFontSize(settings)
    const textMode = normalizeTextMode(settings.textMode, settings.showTajweed)
    const showDiacritics = textMode !== 'plain'

    const primaryAuthorId = settings.coreAuthorIds[0] || settings.defaultAuthorId

    const { data: surah, isLoading: loading } = useQuery({
        queryKey: ['surah', id, primaryAuthorId],
        queryFn: () => getSurah(id, primaryAuthorId),
        staleTime: 1000 * 60 * 60 * 24 // Cache for 24 hours
    })

    const { data: surahInfo } = useQuery({
        queryKey: ['surahInfo', id],
        queryFn: () => getSurahInfo(id),
        staleTime: 1000 * 60 * 60 * 24
    })

    const { data: diyanetInfo, isLoading: isDiyanetInfoLoading, isError: isDiyanetInfoError } = useQuery({
        queryKey: ['diyanetSurahInfo', id],
        queryFn: () => getDiyanetSurahInfo(id),
        enabled: activeTab === 'tefsir' && tefsirTab === 'diyanet',
        staleTime: 1000 * 60 * 60 * 24
    })
    const displaySurahNameAr = resolveArabicTextVisibility(surah?.name_original || '', showDiacritics)

    const selectedTafsirSource = useMemo(
        () => TAFSIR_SOURCE_MAP[tefsirTab] || TAFSIR_SOURCE_MAP.kuran23,
        [tefsirTab]
    )

    const sourceFocusedSurahInfo = useMemo(() => {
        if (tefsirTab === 'kuran23' || tefsirTab === 'diyanet') return ''

        const manual = getManualSurahSourceTafsir(tefsirTab, id)
        if (manual) return manual

        if (!surahInfo?.text) return ''
        return extractSourceSpecificTafsir(surahInfo.text, tefsirTab)
    }, [surahInfo, tefsirTab, id])

    useEffect(() => {
        if (diyanetInfo) {
            if (diyanetInfo.error) {
                setDiyanetInfoErrorMessage('Diyanet tefsirine şu anda erişilemiyor. Lütfen kısa süre sonra tekrar deneyin.')
                setDiyanetSurahInfo(null)
                return
            }
            if (diyanetInfo.chapter_info && diyanetInfo.chapter_info.text) {
                setDiyanetSurahInfo({
                    text: diyanetInfo.chapter_info.text,
                    source: diyanetInfo.chapter_info.source || 'Diyanet / Quran.com'
                });
                setDiyanetInfoErrorMessage('')
            } else if (diyanetInfo.data && (diyanetInfo.data.description || diyanetInfo.data.text)) {
                setDiyanetSurahInfo({
                    text: diyanetInfo.data.description || diyanetInfo.data.text,
                    source: 'Diyanet İşleri Başkanlığı'
                });
                setDiyanetInfoErrorMessage('')
            } else {
                setDiyanetSurahInfo(null);
                setDiyanetInfoErrorMessage('')
            }
        } else {
            setDiyanetSurahInfo(null);
            setDiyanetInfoErrorMessage('')
        }
    }, [diyanetInfo])

    useEffect(() => {
        if (surah) {
            addToHistory({
                no: surah.id,
                nameAr: surah.name_original,
                nameTr: surah.name,
                ayahCount: surah.verse_count,
                type: surahs.find(s => s.no === parseInt(id))?.type || (surah.revelation_place === 'makkah' ? 'Mekki' : 'Medeni')
            }, 'surahs')
        }
    }, [surah, id, addToHistory])

    useEffect(() => {
        if (copyStatus === 'idle') return
        const timer = setTimeout(() => setCopyStatus('idle'), 1800)
        return () => clearTimeout(timer)
    }, [copyStatus])

    // Isolated Idle Prep
    useEffect(() => {
        const isCurrentSurah = meta.surahId === parseInt(id) && meta.context === 'surah'

        if (!isPlaying && !isCurrentSurah && surah) {
            setMeta({
                surahNameAr: surah.name_original,
                surahNameTr: surah.name,
                surahNameEn: surah.name_en,
                surahType: surahs.find(s => s.no === parseInt(surah.id))?.type || (surah.revelation_place === 'makkah' ? 'Mekki' : 'Medeni'),
                ayahCount: surah.verse_count,
                playingType: 'arabic',
                link: `/sure/${surah.id}`,
                surahId: parseInt(surah.id),
                pageNumber: surah.verses && surah.verses[0] ? surah.verses[0].page : 0,
                context: 'surah'
            })
        }
    }, [surah, id, isPlaying, meta.surahId, meta.context, setMeta])

    // Removed local audio effects

    const togglePlaySurah = async (targetType) => {
        const type = targetType || 'arabic'
        const isArabic = type === 'arabic'

        // Ensure player is visible
        if (!settings.isPlayerVisible) {
            updateSettings({ isPlayerVisible: true })
        }

        const targetUrl = isArabic
            ? getSurahAudioUrl(settings.defaultReciterId, id)
            : getTurkishAudioUrl(settings.defaultTurkishReciterId, id, 0)

        if (!targetUrl) return

        if (isSurahPlaying && playingType === type && isPlaying) {
            togglePlay()
        } else {
            const metaData = {
                surahNameAr: surah.name_original,
                surahNameTr: surah.name,
                surahNameEn: surah.name_en,
                surahType: surahs.find(s => s.no === parseInt(id))?.type || (surah.revelation_place === 'makkah' ? 'Mekki' : 'Medeni'),
                ayahCount: surah.verse_count,
                playingType: type,
                link: `/sure/${id}`,
                surahId: parseInt(id),
                ayahNo: 0,
                pageNumber: 0,
                context: 'surah'
            }
            if (isArabic) {
                const reciterId = settings.defaultReciterId
                if (isArabicPlaylistSupported(reciterId)) {
                    const tracks = []
                    const idNum = parseInt(id)
                    tracks.push({ audio: getVerseAudioUrl(reciterId, idNum, 0), ayah: 0 })
                    for (let i = 1; i <= surah.verse_count; i++) {
                        tracks.push({ audio: getVerseAudioUrl(reciterId, idNum, i), ayah: i })
                    }
                    playPlaylist(tracks, 0, metaData)
                } else {
                    const arabicUrl = getSurahAudioUrl(reciterId, id)
                    playSingle(arabicUrl, metaData)
                }
            } else {
                const turkishReciterId = settings.defaultTurkishReciterId
                if (isTurkishPlaylistSupported(turkishReciterId)) {
                    // Turkish uses Diyanet verse-by-verse playlist
                    const tracks = []
                    const idNum = parseInt(id)
                    // Head (Surah info: name, verses count)
                    tracks.push({ audio: getTurkishAudioUrl(turkishReciterId, idNum, 0), ayah: 0 })
                    // Ayahs
                    for (let i = 1; i <= surah.verse_count; i++) {
                        tracks.push({ audio: getTurkishAudioUrl(turkishReciterId, idNum, i), ayah: i })
                    }
                    playPlaylist(tracks, 0, metaData)
                } else {
                    // Acikkuran single track (Whole Surah)
                    playSingle(targetUrl, metaData)
                }
            }
        }
    }

    const surahPath = `/sure/${id}`

    const buildSurahClipboard = () =>
        buildSurahShareText({
            surahName: surah?.name || `Sure ${id}`,
            surahNo: surah?.id || id,
            ayahCount: surah?.verse_count || 0,
            includeLink: true,
            path: surahPath
        })

    const handleCopySurah = async () => {
        const ok = await copyToClipboard(buildSurahClipboard())
        setCopyStatus(ok ? 'ok' : 'error')
    }

    const handleShareSurahX = () => {
        const text = `${surah?.name || `Sure ${id}`} suresini Kuran23'te oku`
        openShareWindow(getXShareUrl(text, getAppUrl(surahPath)))
    }

    const handleNativeShare = async () => {
        const url = getAppUrl(surahPath)
        const title = `${surah?.name || `Sure ${id}`} Suresi`
        const text = buildSurahClipboard()

        if (navigator.share) {
            try {
                await navigator.share({ title, text, url })
                return
            } catch {
                // Fallback below.
            }
        }

        handleShareSurahX()
    }
    const toggleDiacritics = () => {
        updateSettings({ textMode: showDiacritics ? 'plain' : 'uthmani' })
    }

    if (loading && !surah) {
        return (
            <div className="page surah-page">
                <div className="page-content">
                    <div className="loading-state">
                        <p>Yükleniyor...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!surah) {
        return (
            <div className="page surah-page">
                <div className="page-content">
                    <Link to="/" className="back-link">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        <span>Ana Sayfa</span>
                    </Link>
                    <div className="empty-state">
                        <h2>Sure bulunamadı</h2>
                        <p>Veriler henüz yüklenmemiş olabilir.</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="page surah-page">
            <GlobalNav />
            <div className="page-content">

                <div className="page-header-row">
                    <Link to="/" className="back-link hidden-mobile">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        <span>Ana Sayfa</span>
                    </Link>
                    <div className="page-header-actions">
                        <div className="audio-control-group">
                            <button
                                className={`surah-audio-btn arabic ${isSurahPlaying && playingType === 'arabic' && isPlaying ? 'playing' : ''}`}
                                onClick={() => togglePlaySurah('arabic')}
                                title="Arapça Dinle"
                            >
                                {isSurahPlaying && playingType === 'arabic' && isPlaying ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                )}
                                Arapça
                            </button>
                            <button
                                className={`surah-audio-btn turkish ${isSurahPlaying && playingType === 'turkish' && isPlaying ? 'playing' : ''}`}
                                onClick={() => togglePlaySurah('turkish')}
                                title="Türkçe Dinle"
                            >
                                {isSurahPlaying && playingType === 'turkish' && isPlaying ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                )}
                                Türkçe
                            </button>
                            <button className="speed-toggle" onClick={() => {
                                const speeds = [1, 1.25, 1.5, 2]
                                const nextSpeed = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length] || 1
                                setPlaybackSpeed(nextSpeed)
                            }}>
                                {playbackSpeed}x
                            </button>
                        </div>
                        <button
                            className={`surah-audio-btn player-toggle ${settings.isPlayerVisible ? 'bg-active' : ''}`}
                            onClick={() => {
                                updateSettings({ isPlayerVisible: !settings.isPlayerVisible })
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
                        <button
                            className={`surah-audio-btn player-toggle ${copyStatus === 'ok' ? 'bg-active' : ''}`}
                            onClick={handleCopySurah}
                            title="Sure bağlantısını kopyala"
                            style={{ width: '40px', padding: 0, justifyContent: 'center' }}
                        >
                            {copyStatus === 'ok' ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                            )}
                        </button>
                        <button
                            className="surah-audio-btn player-toggle"
                            onClick={handleNativeShare}
                            title="Paylaş"
                            style={{ width: '40px', padding: 0, justifyContent: 'center' }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="18" cy="5" r="3" />
                                <circle cx="6" cy="12" r="3" />
                                <circle cx="18" cy="19" r="3" />
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                            </svg>
                        </button>
                        <button
                            className="surah-audio-btn player-toggle"
                            onClick={handleShareSurahX}
                            title="X'te paylaş"
                            style={{ width: '40px', padding: 0, justifyContent: 'center', fontWeight: 700 }}
                        >
                            X
                        </button>
                        <BookmarkButton
                            isBookmarked={isSurahBookmarked(surah.id)}
                            onToggle={() => toggleSurah(surah)}
                        />
                    </div>
                </div>

                {/* Surah header */}
                <div className="surah-page-header">
                    <span className="surah-page-no">{surah.id}</span>
                    <div className="surah-page-titles">
                        <h1 className="surah-page-name-ar" dir="rtl">{displaySurahNameAr}</h1>
                        <div className="surah-title-row">
                            <h2 className="surah-page-name">{surah.name}</h2>
                            {surahMeta?.type && (
                                <span className={`surah-type-badge ${surahMeta.type.toLowerCase()}`}>
                                    {surahMeta.type}
                                </span>
                            )}
                        </div>
                        <p className="surah-page-meta">{surah.name_en} · {surah.verse_count} ayet</p>
                    </div>
                </div>

                <div className="section-divider" />

                {/* Surah Tabs */}
                <div className="surah-tabs">
                    <button
                        className={`surah-tab ${activeTab === 'ayetler' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ayetler')}
                    >
                        Ayetler
                    </button>
                    <button
                        className={`surah-tab ${activeTab === 'tefsir' ? 'active' : ''}`}
                        onClick={() => setActiveTab('tefsir')}
                    >
                        Tefsir
                    </button>
                </div>

                {/* Verses List */}
                {activeTab === 'ayetler' && (
                    <div className="verse-list-page">
                        {surah.verses && surah.verses.map((v, i) => {
                            const verseArabicHtml = normalizeArabicDisplayText(getVerseTextByMode(v, textMode))
                            const isActiveVerse = isSurahPlaying && playingType && (
                                mode === 'playlist'
                                    ? playlist[currentTrackIndex]?.ayah === v.verse_number
                                    : Math.floor((currentTime / (duration || 1)) * (surah.verses?.length || 0)) === i
                            )
                            return (
                                <Link
                                    key={v.id}
                                    to={`/sure/${surah.id}/${v.verse_number}`}
                                    className={`verse-row ${isActiveVerse ? 'active-verse' : ''}`}
                                    style={{ animationDelay: `${Math.min(i * 0.02, 0.5)}s` }}
                                >
                                    <span className="verse-row-no">{v.verse_number}</span>
                                    <div className="verse-row-content">
                                        <p
                                            className="verse-row-ar"
                                            dir="rtl"
                                            style={{
                                                fontSize: `${arabicFontSize}px`,
                                                fontFamily: arabicFontFamily
                                            }}
                                            dangerouslySetInnerHTML={{ __html: verseArabicHtml }}
                                        />
                                        {v.transcription && (
                                            <p
                                                className="verse-row-transcription"
                                                style={{ fontSize: `${Math.max(12, transcriptionFontSize)}px` }}
                                            >
                                                {v.transcription}
                                            </p>
                                        )}
                                        {v.translation && (
                                            <p
                                                className="verse-row-tr"
                                                style={{ fontSize: `${translationFontSize}px` }}
                                            >
                                                {v.translation.text}
                                            </p>
                                        )}
                                        {v.isFallback && (
                                            <span className="fallback-chip">fallback</span>
                                        )}
                                    </div>
                                    <svg className="verse-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                </Link>
                            )
                        })}
                    </div>
                )}

                {activeTab === 'tefsir' && (
                    <div className="surah-info-content">
                        <div className="surah-info-tabs">
                            {TAFSIR_SOURCES.map((source) => (
                                <button
                                    key={source.id}
                                    className={`surah-info-subtab ${tefsirTab === source.id ? 'active' : ''}`}
                                    onClick={() => setTefsirTab(source.id)}
                                    title={normalizeTafsirText(source.tabLabel)}
                                >
                                    {normalizeTafsirText(source.shortLabel)}
                                </button>
                            ))}
                        </div>

                        {tefsirTab === 'kuran23' && (
                            <>
                                {surahInfo ? (
                                    <div className="surah-info-card animate-fade-up">
                                        <div
                                            className="surah-info-html"
                                            dangerouslySetInnerHTML={{ __html: formatTafsirRichText(surahInfo.text, { context: 'surah', surahId: id }) }}
                                        />
                                        <div className="surah-info-source">
                                            {normalizeTafsirText(surahInfo.source)}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <p>Kuran23 tefsiri bu sure için henüz hazırlanmamıştır.</p>
                                    </div>
                                )}
                            </>
                        )}

                        {tefsirTab === 'diyanet' && (
                            <>
                                {isDiyanetInfoLoading ? (
                                    <div className="loading-state-mini">
                                        <div className="loading-spinner-mini" />
                                        <p>Diyanet tefsiri yükleniyor...</p>
                                    </div>
                                ) : diyanetSurahInfo ? (() => {
                                    const biblioMarkers = ['BİBLİYOGRAFYA', 'KAYNAKÇA', 'Bibliyografya'];
                                    let rawText = diyanetSurahInfo.text;
                                    let biblioHTML = null;
                                    for (const marker of biblioMarkers) {
                                        const idx = rawText.indexOf(marker);
                                        if (idx !== -1) {
                                            const tagStart = rawText.lastIndexOf('<', idx);
                                            let bib = rawText.substring(tagStart);
                                            bib = bib.replace(/<[^>]*>\s*(BİBLİYOGRAFYA|KAYNAKÇA|Bibliyografya)[^<]*<\/[^>]*>/gi, '');
                                            bib = bib.replace(/(BİBLİYOGRAFYA|KAYNAKÇA|Bibliyografya)\s*(<br\s*\/?>)?\s*/gi, '');
                                            bib = bib.replace(/^(\s*<br\s*\/?>\s*|\s*<p>\s*<\/p>\s*|\s*:\s*<br\s*\/?>\s*)+/gi, '');
                                            bib = bib.replace(/^\s*:\s*/g, '');
                                            biblioHTML = bib;
                                            rawText = rawText.substring(0, tagStart);
                                            break;
                                        }
                                    }

                                    const mainText = rawText
                                        .replace(/(<br\s*\/?>\s*){2,}/gi, '</p><p>')
                                        .replace(/<p>\s*<\/p>/gi, '')
                                        .replace(/<h4>\s*(<br\s*\/?>\s*)*<\/h4>/gi, '')
                                        .replace(/style="text-indent:[^"]*"/gi, '');

                                    return (
                                        <div className="surah-info-card animate-fade-up">
                                            <div
                                                className="surah-info-html"
                                                dangerouslySetInnerHTML={{ __html: formatTafsirRichText(mainText, { context: 'surah', surahId: id }) }}
                                            />
                                            <div className="surah-info-source diyanet-source-card">
                                                <div className="source-content">
                                                    {biblioHTML && (
                                                        <div
                                                            className="source-biblio"
                                                            dangerouslySetInnerHTML={{ __html: formatTafsirRichText(biblioHTML, { context: 'surah', surahId: id }) }}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })() : (
                                    <div className="empty-state">
                                        <p>{isDiyanetInfoError ? 'Diyanet tefsiri alınamadı.' : (diyanetInfoErrorMessage || 'Bu sure için Diyanet tefsiri bulunamadı.')}</p>
                                    </div>
                                )}
                            </>
                        )}

                        {tefsirTab !== 'kuran23' && tefsirTab !== 'diyanet' && (
                            <>
                                {sourceFocusedSurahInfo ? (
                                    <div className="surah-info-card animate-fade-up">
                                        <div
                                            className="surah-info-html"
                                            dangerouslySetInnerHTML={{ __html: formatTafsirRichText(sourceFocusedSurahInfo, { context: 'surah', surahId: id }) }}
                                        />
                                        <div className="surah-info-source">
                                            {normalizeTafsirText(selectedTafsirSource.sourceLabel)}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <p>Bu kaynak için sure tefsiri hazırlanıyor.</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
            {/* Integrated Player Removed - Now Global */}
        </div>
    )
}







