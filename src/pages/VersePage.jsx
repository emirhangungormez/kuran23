import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getVerse, getTranslations, getVerseWords, getTafsir, getDiyanetTafsir, getReciters } from '../services/api'
import { useBookmarks } from '../contexts/BookmarksContext'
import { useSettings } from '../contexts/SettingsContext'
import usePlayerStore from '../stores/usePlayerStore'
import BookmarkButton from '../components/BookmarkButton'
import CustomSelect from '../components/CustomSelect'
import UserAvatar from '../components/UserAvatar'
import ThemeToggle from '../components/ThemeToggle'
import RamadanStatus from '../components/RamadanStatus'
import GlobalNav from '../components/GlobalNav'
import { surahs } from '../data/quranData'
import {
    TAFSIR_SOURCES,
    TAFSIR_SOURCE_MAP,
    extractSourceSpecificTafsir,
    getManualVerseSourceTafsir
} from '../data/tafsirSources'
import { useShallow } from 'zustand/react/shallow'
import { calculateWordEbced, calculateVerseEbced } from '../utils/ebced'
import { normalizeArabicDisplayText, normalizeTafsirText } from '../utils/textEncoding'
import { formatTafsirRichText } from '../utils/tafsirFormatting'
import useUsageTracker from '../hooks/useUsageTracker'
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
import './VersePage.css'

import { getVerseAudioUrl, getTurkishAudioUrl, isTurkishPlaylistSupported, isReciterSupported, getTurkishReciters } from '../services/audio'

export default function VersePage() {
    const { surahId, ayahNo } = useParams()
    const [activeTab, setActiveTab] = useState('meal')
    const [tefsirTab, setTefsirTab] = useState('kuran23')
    const [diyanetTafsir, setDiyanetTafsir] = useState(null)
    const [diyanetTafsirErrorMessage, setDiyanetTafsirErrorMessage] = useState('')
    const [selectedWord, setSelectedWord] = useState(null)
    const [copyStatus, setCopyStatus] = useState('idle')
    const { bookmarks, isVerseBookmarked, toggleVerse, addToHistory } = useBookmarks()
    const { settings, updateSettings } = useSettings()

    useUsageTracker({ surahId, ayahNo, enabled: true })

    // Use Global Player
    const {
        playSingle,
        togglePlay,
        isPlaying,
        meta,
        mode,
        singleSource,
        playbackSpeed,
        setPlaybackSpeed,
        setMeta,
        currentTrackIndex,
        playPlaylist
    } = usePlayerStore(useShallow((state) => ({
        playSingle: state.playSingle,
        playPlaylist: state.playPlaylist,
        togglePlay: state.togglePlay,
        isPlaying: state.isPlaying,
        meta: state.meta,
        mode: state.mode,
        singleSource: state.singleSource,
        playbackSpeed: state.playbackSpeed,
        setPlaybackSpeed: state.setPlaybackSpeed,
        setMeta: state.setMeta,
        currentTrackIndex: state.currentTrackIndex
    })))

    const isVersePlaying = (mode === 'single' || mode === 'playlist') && meta.surahId === parseInt(surahId) && meta.ayahNo === parseInt(ayahNo) && meta.context === 'verse'
    const playingType = isVersePlaying ? meta.playingType : null

    const surahMeta = surahs.find(s => s.no === parseInt(surahId))
    const { data: availableReciters = [] } = useQuery({
        queryKey: ['reciters'],
        queryFn: getReciters,
        staleTime: 1000 * 60 * 60 * 24
    })

    const reciterOptions = availableReciters
        .filter(r => isReciterSupported(r.id))
        .map(r => ({
            value: r.id,
            label: `${r.name} (${r.style || 'Standart'})`
        }))

    const turkishReciterOptions = getTurkishReciters().map(r => ({
        value: r.id,
        label: r.name
    }))

    const { data: verse, isLoading: loadingVerse } = useQuery({
        queryKey: ['verse', surahId, ayahNo, settings.defaultAuthorId, settings.showTajweed],
        queryFn: () => getVerse(surahId, ayahNo, settings.defaultAuthorId, settings.showTajweed),
        staleTime: 1000 * 60 * 60 * 24
    })

    const { data: allTranslations, isLoading: loadingTrans } = useQuery({
        queryKey: ['translations', surahId, ayahNo],
        queryFn: () => getTranslations(surahId, ayahNo),
        staleTime: 1000 * 60 * 60 * 24
    })

    const { data: words } = useQuery({
        queryKey: ['words', surahId, ayahNo],
        queryFn: () => getVerseWords(surahId, ayahNo),
        staleTime: 1000 * 60 * 60 * 24
    })

    const wordsWithEbced = useMemo(() => {
        if (!Array.isArray(words)) return []

        return words.map((word) => {
            const analysis = calculateWordEbced(word?.arabic || '')
            return {
                ...word,
                ebcedTotal: analysis.total,
                ebcedLetters: analysis.letters,
                ebcedLetterCount: analysis.letterCount,
                ebcedUnknownCount: analysis.unknownCount
            }
        })
    }, [words])

    const verseEbced = useMemo(() => {
        const arabicWords = wordsWithEbced.map((word) => word?.arabic || '')
        return calculateVerseEbced(arabicWords)
    }, [wordsWithEbced])

    const arabicFontFamily = getArabicFontFamily(settings.arabicFont)
    const arabicFontSize = getArabicFontSize(settings)
    const translationFontSize = getTranslationFontSize(settings)
    const transcriptionFontSize = getTranscriptionFontSize(settings)
    const verseArabicHtml = settings.showTajweed
        ? normalizeArabicDisplayText(verse?.verse || '')
        : normalizeArabicDisplayText(verse?.verse_simplified || verse?.verse || '')

    const primaryTranslationText = useMemo(() => {
        if (Array.isArray(allTranslations)) {
            const core = allTranslations.find((item) => settings.coreAuthorIds.includes(item.authorId))
            if (core?.text) return core.text
        }
        return verse?.translation?.text || ''
    }, [allTranslations, settings.coreAuthorIds, verse?.translation?.text])

    const { data: tafsir } = useQuery({
        queryKey: ['tafsir', surahId, ayahNo],
        queryFn: () => getTafsir(surahId, ayahNo),
        staleTime: 1000 * 60 * 60 * 24
    })

    const { data: diyanetTafsirData, isLoading: isDiyanetTafsirLoading, isError: isDiyanetTafsirError } = useQuery({
        queryKey: ['diyanetTafsir', surahId, ayahNo],
        queryFn: () => getDiyanetTafsir(surahId, ayahNo),
        enabled: activeTab === 'tefsir' && tefsirTab === 'diyanet',
        staleTime: 1000 * 60 * 60 * 24
    })

    const selectedTafsirSource = useMemo(
        () => TAFSIR_SOURCE_MAP[tefsirTab] || TAFSIR_SOURCE_MAP.kuran23,
        [tefsirTab]
    )

    const sourceFocusedVerseTafsir = useMemo(() => {
        if (tefsirTab === 'kuran23' || tefsirTab === 'diyanet') return ''

        const manual = getManualVerseSourceTafsir(tefsirTab, surahId, ayahNo)
        if (manual) return manual

        if (!tafsir?.text) return ''
        return extractSourceSpecificTafsir(tafsir.text, tefsirTab)
    }, [tafsir, tefsirTab, surahId, ayahNo])

    const loading = loadingVerse || loadingTrans

    useEffect(() => {
        // Diyanet tefsiri formatla
        if (diyanetTafsirData?.error) {
            setDiyanetTafsir(null);
            setDiyanetTafsirErrorMessage('Diyanet tefsirine şu anda erişilemiyor. Lütfen kısa süre sonra tekrar deneyin.');
        } else if (diyanetTafsirData && diyanetTafsirData.data && diyanetTafsirData.data.text) {
            setDiyanetTafsir({
                text: diyanetTafsirData.data.text,
                source: diyanetTafsirData.data.source || "Diyanet İşleri Başkanlığı - Kur'an Yolu"
            });
            setDiyanetTafsirErrorMessage('');
        } else {
            setDiyanetTafsir(null);
            setDiyanetTafsirErrorMessage('');
        }
    }, [diyanetTafsirData])

    useEffect(() => {
        if (copyStatus === 'idle') return
        const timer = setTimeout(() => setCopyStatus('idle'), 1800)
        return () => clearTimeout(timer)
    }, [copyStatus])

    useEffect(() => {
        // Reset selected word on verse change
        setSelectedWord(null)

        if (verse) {
            const sData = surahs.find(s => s.no === parseInt(surahId))
            addToHistory({
                id: `${surahId}-${ayahNo}`,
                surahId: parseInt(surahId),
                ayah: parseInt(ayahNo),
                surahTr: sData?.nameTr || `Sure ${surahId}`,
                text: verse.verse,
                textTr: verse.translation?.text || ""
            }, 'verses')
        }
    }, [verse, surahId, ayahNo, addToHistory])

    // Isolated Idle Prep
    useEffect(() => {
        const isCorrectVerse = meta.surahId === parseInt(surahId) && meta.ayahNo === parseInt(ayahNo) && meta.context === 'verse'

        if (!isPlaying && !isCorrectVerse && verse) {
            setMeta({
                surahNameAr: verse.surah?.name_original,
                surahNameTr: verse.surah?.name,
                surahNameEn: verse.surah?.name_en,
                surahType: surahs.find(s => s.no === parseInt(surahId))?.type || (verse.surah?.revelation_place === 'makkah' ? 'Mekki' : 'Medeni'),
                ayahCount: verse.surah?.verse_count,
                playingType: 'arabic',
                link: `/sure/${surahId}/${ayahNo}`,
                surahId: parseInt(surahId),
                pageNumber: verse.page,
                ayahNo: parseInt(ayahNo),
                context: 'verse',
                verseData: [verse]
            })
        }
    }, [verse, isPlaying, meta.surahId, meta.ayahNo, meta.context, surahId, ayahNo, setMeta])

    // Removed local playback speed effect

    const toggleVersePlay = async (targetType) => {
        const type = targetType || 'arabic'
        const isArabic = type === 'arabic'

        // Ensure player is visible
        if (!settings.isPlayerVisible) {
            updateSettings({ isPlayerVisible: true })
        }

        const arabicUrl = getVerseAudioUrl(settings.defaultReciterId, surahId, ayahNo)
        let turkishUrl = getTurkishAudioUrl(settings.defaultTurkishReciterId, surahId, ayahNo)

        const targetUrl = isArabic ? arabicUrl : turkishUrl

        if (isVersePlaying && playingType === type && isPlaying) {
            togglePlay()
        } else {
            const sData = surahs.find(s => s.no === parseInt(surahId))
            const metaData = {
                surahNameAr: sData?.nameAr || verse.surah?.name_original,
                surahNameTr: sData?.nameTr || verse.surah?.name,
                surahNameEn: sData?.nameEn || verse.surah?.name_en,
                surahType: sData?.type || (verse.surah?.revelation_place === 'makkah' ? 'Mekki' : 'Medeni'),
                ayahCount: sData?.ayahCount || verse.surah?.verse_count,
                playingType: type,
                link: `/sure/${surahId}/${ayahNo}`,
                surahId: parseInt(surahId),
                ayahNo: parseInt(ayahNo),
                pageNumber: 0,
                context: 'verse'
            }

            if (!isArabic && isTurkishPlaylistSupported(settings.defaultTurkishReciterId)) {
                // Better UX: Play from this verse to the end of the surah as a playlist
                const tracks = []
                const curAyah = parseInt(ayahNo)
                const maxAyah = sData?.ayahCount || verse.surah?.verse_count || 0

                for (let i = curAyah; i <= maxAyah; i++) {
                    tracks.push({
                        audio: getTurkishAudioUrl(settings.defaultTurkishReciterId, surahId, i),
                        ayah: i,
                        surahId: parseInt(surahId)
                    })
                }
                playPlaylist(tracks, 0, metaData)
            } else {
                playSingle(targetUrl, metaData)
            }
        }
    }

    // Removed local audio end effect and cycleSpeed (now global)

    const versePath = `/sure/${surahId}/${ayahNo}`

    const buildClipboardText = () =>
        buildVerseShareText({
            surahName: verse?.surah?.name || `Sure ${surahId}`,
            ayahNo,
            arabicText: verse?.verse || '',
            translationText: primaryTranslationText,
            includeLink: true,
            path: versePath
        })

    const handleCopyVerse = async () => {
        const ok = await copyToClipboard(buildClipboardText())
        setCopyStatus(ok ? 'ok' : 'error')
    }

    const handleShareToX = () => {
        const summary = `${verse?.surah?.name || `Sure ${surahId}`} ${ayahNo}. ayet`
        openShareWindow(getXShareUrl(summary, getAppUrl(versePath)))
    }

    const handleNativeShare = async () => {
        const url = getAppUrl(versePath)
        const title = `${verse?.surah?.name || `Sure ${surahId}`} ${ayahNo}. ayet`
        const text = buildClipboardText()

        if (navigator.share) {
            try {
                await navigator.share({ title, text, url })
                return
            } catch (_e) {
                // Fallback below.
            }
        }

        handleShareToX()
    }

    if (loading && !verse) {
        return (
            <div className="page verse-page">
                <div className="page-content">
                    <div className="loading-state">
                        <p>Yükleniyor...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!verse) {
        return (
            <div className="page verse-page"><div className="page-content">
                <Link to="/" className="back-link">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    <span>Ana Sayfa</span>
                </Link>
                <div className="empty-state"><h2>Ayet bulunamadı</h2><p>Veriler henüz yüklenmemiş olabilir.</p></div>
            </div></div>
        )
    }

    const prevAyah = parseInt(ayahNo) > 1 ? parseInt(ayahNo) - 1 : null
    const totalVerses = surahMeta?.ayahCount || verse.surah?.verse_count || 999
    const nextAyah = parseInt(ayahNo) < totalVerses ? parseInt(ayahNo) + 1 : null

    return (
        <div className="page verse-page">
            <GlobalNav backTo={`/sure/${surahId}`} backLabel={verse.surah?.name || `Sure ${surahId}`} />
            <div className="page-content">

                <div className="page-header-row">
                    <Link to={`/sure/${surahId}`} className="back-link hidden-mobile">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        <span>{verse.surah?.name || `Sure ${surahId}`}</span>
                    </Link>
                    <div className="page-header-actions">
                        <div className="audio-reciter-selects">
                            <CustomSelect
                                value={settings.defaultReciterId}
                                onChange={(val) => updateSettings({ defaultReciterId: val })}
                                options={reciterOptions}
                                prefix="Arapça: "
                                className="audio-mini-select"
                            />
                            <CustomSelect
                                value={settings.defaultTurkishReciterId || 1015}
                                onChange={(val) => updateSettings({ defaultTurkishReciterId: val })}
                                options={turkishReciterOptions}
                                prefix="Türkçe: "
                                className="audio-mini-select"
                            />
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
                        <div className="audio-control-group">
                            <button
                                className={`surah-audio-btn arabic ${isVersePlaying && playingType === 'arabic' && isPlaying ? 'playing' : ''}`}
                                onClick={() => toggleVersePlay('arabic')}
                                title="Arapça Dinle"
                            >
                                {isVersePlaying && playingType === 'arabic' && isPlaying ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                )}
                                Arapça
                            </button>
                            <button
                                className={`surah-audio-btn turkish ${isVersePlaying && playingType === 'turkish' && isPlaying ? 'playing' : ''}`}
                                onClick={() => toggleVersePlay('turkish')}
                                title="Türkçe Dinle"
                            >
                                {isVersePlaying && playingType === 'turkish' && isPlaying ? (
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
                            className={`surah-audio-btn player-toggle ${copyStatus === 'ok' ? 'bg-active' : ''}`}
                            onClick={handleCopyVerse}
                            title="Arapça + meal kopyala"
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
                            onClick={handleShareToX}
                            title="X'te paylaş"
                            style={{ width: '40px', padding: 0, justifyContent: 'center', fontWeight: 700 }}
                        >
                            X
                        </button>
                        <BookmarkButton
                            isBookmarked={isVerseBookmarked(surahId, ayahNo)}
                            onToggle={() => toggleVerse(verse, surahId, verse.surah?.name)}
                        />
                    </div>
                </div>



                {/* Verse header */}
                <div className="verse-page-header">
                    <div className="surah-title-row" style={{ justifyContent: 'center', marginBottom: '16px' }}>
                        <p className="verse-page-ref" style={{ marginBottom: 0 }}>{verse.surah?.name} · {verse.verse_number}. Ayet</p>
                        {surahMeta?.type && (
                            <span className={`surah-type-badge ${surahMeta.type.toLowerCase()}`}>
                                {surahMeta.type}
                            </span>
                        )}
                    </div>
                    <div
                        className="verse-page-arabic"
                        dir="rtl"
                        style={{
                            fontSize: `${arabicFontSize}px`,
                            fontFamily: arabicFontFamily
                        }}
                        dangerouslySetInnerHTML={{ __html: verseArabicHtml }}
                    />
                    {verse.transcription && (
                        <p className="verse-page-transcription" style={{ fontSize: `${transcriptionFontSize}px` }}>
                            {verse.transcription}
                        </p>
                    )}
                </div>

                <div className="section-divider" />

                {/* Tabs */}
                <div className="verse-tabs">
                    <button className={`verse-tab ${activeTab === 'meal' ? 'active' : ''}`} onClick={() => setActiveTab('meal')}>Meal</button>
                    <button className={`verse-tab ${activeTab === 'tefsir' ? 'active' : ''}`} onClick={() => setActiveTab('tefsir')}>Tefsir</button>
                    <button className={`verse-tab ${activeTab === 'kelime' ? 'active' : ''}`} onClick={() => setActiveTab('kelime')}>Kelime Analiz</button>
                    <button className={`verse-tab ${activeTab === 'mealler' ? 'active' : ''}`} onClick={() => setActiveTab('mealler')}>Tüm Mealler</button>
                </div>

                {/* Tab: Meal */}
                {activeTab === 'meal' && allTranslations && (
                    <div className="verse-meal-section">
                        {allTranslations
                            .filter(t => settings.coreAuthorIds.includes(t.authorId))
                            .map(t => (
                                <div key={t.id} className="verse-meal-card">
                                    <p
                                        className="verse-meal-text"
                                        style={{ fontSize: `${translationFontSize}px` }}
                                    >
                                        {t.text}
                                    </p>
                                    <span className="verse-meal-author">
                                        — {t.author?.name || 'Bilinmeyen'}
                                    </span>
                                    {t.footnotes && t.footnotes.length > 0 && (
                                        <div className="verse-footnotes">
                                            {t.footnotes.map(fn => (
                                                <div key={fn.id} className="verse-footnote">
                                                    <span className="verse-footnote-no">[{fn.number}]</span>
                                                    <span className="verse-footnote-text">{fn.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))
                        }
                    </div>
                )}

                {/* Tab: Tefsir */}
                {activeTab === 'tefsir' && (
                    <div className="verse-tafsir-section">
                        <div className="tafsir-subtabs">
                            {TAFSIR_SOURCES.map((source) => (
                                <button
                                    key={source.id}
                                    className={`tafsir-subtab ${tefsirTab === source.id ? 'active' : ''}`}
                                    onClick={() => setTefsirTab(source.id)}
                                    title={normalizeTafsirText(source.tabLabel)}
                                >
                                    {normalizeTafsirText(source.shortLabel)}
                                </button>
                            ))}
                        </div>

                        {tefsirTab === 'diyanet' ? (
                            isDiyanetTafsirLoading ? (
                                <div className="loading-state-mini">
                                    <div className="loading-spinner-mini" />
                                    <p>Diyanet tefsiri yükleniyor...</p>
                                </div>
                            ) : (
                                <div className="verse-tafsir-section">
                                    {diyanetTafsir && diyanetTafsir.text ? (
                                        <div className="tafsir-card">
                                            <div className="tafsir-html" dangerouslySetInnerHTML={{ __html: formatTafsirRichText(diyanetTafsir.text) }} />
                                            <div className="tafsir-source">
                                                {normalizeTafsirText(diyanetTafsir.source)}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="empty-state">
                                            <p>{isDiyanetTafsirError ? 'Diyanet tefsiri alınamadı.' : (diyanetTafsirErrorMessage || 'Bu ayet için Diyanet tefsiri bulunamadı.')}</p>
                                        </div>
                                    )}
                                </div>
                            )
                        ) : (tefsirTab === 'kuran23' ? tafsir?.text : sourceFocusedVerseTafsir) ? (
                            <div className="tafsir-card">
                                <div
                                    className="tafsir-html"
                                    dangerouslySetInnerHTML={{
                                        __html: formatTafsirRichText(tefsirTab === 'kuran23' ? tafsir.text : sourceFocusedVerseTafsir)
                                    }}
                                />
                                <div className="tafsir-source">
                                    {tefsirTab === 'kuran23'
                                        ? normalizeTafsirText(tafsir?.source || '')
                                        : normalizeTafsirText(selectedTafsirSource.sourceLabel)}
                                </div>
                            </div>
                        ) : (
                            <div className="empty-state">
                                <p>
                                    {tefsirTab === 'kuran23'
                                        ? 'Bu ayet için tefsir içeriği hazırlanmaktadır, yakında eklenecektir.'
                                        : 'Bu kaynak için ayet tefsiri hazırlanıyor.'}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab: Word analysis */}
                {activeTab === 'kelime' && (
                    <div className="verse-words-section">
                        {wordsWithEbced.length > 0 ? (
                            <>
                                <div className="words-grid" dir="rtl">
                                    {wordsWithEbced.map(w => (
                                        <button
                                            key={w.id}
                                            className={`word-card ${selectedWord?.id === w.id ? 'selected' : ''}`}
                                            onClick={() => setSelectedWord(selectedWord?.id === w.id ? null : w)}
                                        >
                                            <span className="word-arabic">{w.arabic}</span>
                                            <span className="word-tr">{w.translation_tr}</span>
                                            <span className="word-ebced-chip">Ebced {w.ebcedTotal}</span>
                                        </button>
                                    ))}
                                </div>

                                <div className="ebced-summary-card ebced-summary-card-bottom">
                                    <div className="ebced-summary-item">
                                        <span className="ebced-summary-label">Ayet Toplam Ebced</span>
                                        <strong className="ebced-summary-value">{verseEbced.total}</strong>
                                    </div>
                                    <div className="ebced-summary-meta">
                                        <span>{wordsWithEbced.length} kelime</span>
                                        <span>{verseEbced.letterCount} harf</span>
                                    </div>
                                </div>
                                <p className="ebced-summary-note ebced-summary-note-bottom">
                                    Hesap, hareke ve uzatma isaretleri temizlenmis sade harfler uzerinden yapilir.
                                </p>

                                {selectedWord && (
                                    <div className="word-detail" dir="ltr">
                                        <h4 className="word-detail-title">Kelime Detayi</h4>
                                        <div className="word-detail-arabic" dir="rtl">{selectedWord.arabic}</div>
                                        <div className="word-detail-grid">
                                            <div className="word-detail-item">
                                                <span className="word-detail-label">Okunus (TR)</span>
                                                <span className="word-detail-value">{selectedWord.transcription_tr || '-'}</span>
                                            </div>
                                            <div className="word-detail-item">
                                                <span className="word-detail-label">Okunus (EN)</span>
                                                <span className="word-detail-value">{selectedWord.transcription_en || '-'}</span>
                                            </div>
                                            <div className="word-detail-item">
                                                <span className="word-detail-label">Anlam (TR)</span>
                                                <span className="word-detail-value">{selectedWord.translation_tr || '-'}</span>
                                            </div>
                                            <div className="word-detail-item">
                                                <span className="word-detail-label">Anlam (EN)</span>
                                                <span className="word-detail-value">{selectedWord.translation_en || '-'}</span>
                                            </div>
                                            <div className="word-detail-item">
                                                <span className="word-detail-label">Ebced (Kelime)</span>
                                                <span className="word-detail-value">{selectedWord.ebcedTotal}</span>
                                            </div>
                                            <div className="word-detail-item">
                                                <span className="word-detail-label">Harf Sayisi</span>
                                                <span className="word-detail-value">{selectedWord.ebcedLetterCount}</span>
                                            </div>
                                        </div>

                                        {Array.isArray(selectedWord.ebcedLetters) && selectedWord.ebcedLetters.length > 0 && (
                                            <div className="word-ebced-breakdown">
                                                <span className="word-root-label">Harf Analizi:</span>
                                                <div className="word-ebced-letters" dir="rtl">
                                                    {selectedWord.ebcedLetters.map((item, index) => (
                                                        <span key={`${selectedWord.id}-${index}`} className="word-ebced-letter">
                                                            <span className="word-ebced-char">{item.char}</span>
                                                            <span className="word-ebced-value">{item.value}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {selectedWord.root && (
                                            <div className="word-root-info">
                                                <span className="word-root-label">Kok:</span>
                                                <span className="word-root-arabic" dir="rtl">{selectedWord.root.arabic}</span>
                                                <span className="word-root-latin">({selectedWord.root.latin})</span>
                                                {selectedWord.root.mean_tr && (
                                                    <p className="word-root-mean">{selectedWord.root.mean_tr}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="empty-state">
                                <p>Bu ayet için kelime bazlı veri bulunamadı.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab: All translations */}
                {activeTab === 'mealler' && allTranslations && (
                    <div className="verse-translations-section">
                        {allTranslations
                            .filter(t => settings.selectedAuthorIds.includes(t.authorId))
                            .map(t => (
                                <div key={t.id} className="translation-card">
                                    <p className="translation-text" style={{ fontSize: `${translationFontSize}px` }}>{t.text}</p>
                                    <span className="translation-author">
                                        — {t.author?.name || 'Bilinmeyen'}
                                        {t.author?.description && <span className="translation-desc"> ({t.author.description})</span>}
                                    </span>
                                    {t.footnotes && t.footnotes.length > 0 && (
                                        <div className="translation-footnotes">
                                            {t.footnotes.map(fn => (
                                                <p key={fn.id} className="translation-footnote">
                                                    <span>[{fn.number}]</span> {fn.text}
                                                </p>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>
                )}

                <div className="section-divider" />

                {/* Navigation */}
                <div className="verse-nav">
                    {prevAyah ? (
                        <Link to={`/sure/${surahId}/${prevAyah}`} className="verse-nav-btn nav-prev">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                            {prevAyah}. Ayet
                        </Link>
                    ) : <span />}
                    {nextAyah ? (
                        <Link to={`/sure/${surahId}/${nextAyah}`} className="verse-nav-btn nav-next">
                            {nextAyah}. Ayet
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                        </Link>
                    ) : <span />}
                </div>
            </div>
        </div>
    )
}
