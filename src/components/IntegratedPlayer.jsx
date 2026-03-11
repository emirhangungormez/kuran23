import React, { useState, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSettings } from '../contexts/SettingsContext'
import CustomSelect from './CustomSelect'
import { getReciters } from '../services/api'
import { isReciterSupported, getTurkishReciters } from '../services/audio'
import { resolveArabicTextVisibility } from '../utils/textEncoding'
import { normalizeTextMode } from '../utils/textMode'
import './IntegratedPlayer.css'

// Helper component for individual verse segments to optimize performance
const VerseSegment = memo(({ idx, status, onClick, ayahNo }) => {
    return (
        <button
            type="button"
            className={`verse-segment ${status}`}
            onClick={() => onClick(idx)}
            title={`Ayet ${ayahNo}`}
            aria-label={`Ayet ${ayahNo}`}
        />
    )
})

export default function IntegratedPlayer({
    isPlaying,
    onTogglePlay,
    currentTime,
    duration,
    volume,
    onVolumeChange,
    playbackSpeed,
    onSpeedChange,
    isRepeat,
    onToggleRepeat,
    verses = [],
    currentVerseIndex = 0,
    onSelectVerse,
    surahNameAr,
    surahNameTr,
    surahNameEn,
    surahType,
    ayahCount,
    playingType,
    showSegments = true,
    isVisible = true,
    link = '/',
    skipNext,
    skipPrevious,
    ayahNo,
    pageNumber,
    juzNumber,
    context
}) {
    const [isExpanded, setIsExpanded] = useState(false)
    const navigate = useNavigate()
    const { settings, updateSettings } = useSettings()
    const { data: availableReciters = [] } = useQuery({
        queryKey: ['reciters'],
        queryFn: getReciters,
        staleTime: 1000 * 60 * 60 * 24
    })

    if (!isVisible) return null;

    const formatTime = (time) => {
        if (isNaN(time)) return "0:00"
        const mins = Math.floor(time / 60)
        const secs = Math.floor(time % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const remainingTime = duration - currentTime
    const isVeryLongSurah = verses.length > 50
    const showDiacritics = normalizeTextMode(settings.textMode, settings.showTajweed) !== 'plain'
    const displaySurahNameAr = resolveArabicTextVisibility(surahNameAr, showDiacritics)
    const isTafsirContext = context === 'tafsir'
    const reciterOptions = availableReciters
        .filter(r => isReciterSupported(r.id))
        .map(r => ({
            value: r.id,
            label: `${r.name} (${r.style || 'Standart'})`
        }))
    const turkishReciterOptions = getTurkishReciters().map(r => ({ value: r.id, label: r.name }))

    return (
        <div className={`integrated-player ${isExpanded ? 'active' : ''}`}>
            <div className="player-main-row">
                {/* The original play button is replaced by the new center controls */}
                <div className="player-rich-info">
                    <div className="player-row-top">
                        <span className="player-surah-ar" dir="rtl">{displaySurahNameAr}</span>
                    </div>
                    <div className="player-row-mid">
                        <span className="player-surah-tr">
                            {context === 'page'
                                ? `${juzNumber}. Cüz ${pageNumber}. Sayfa`
                                : `${surahNameTr}${ayahNo > 0 ? `:${ayahNo}` : ''}`
                            }
                        </span>
                        {surahType && (
                            <span className={`player-badge ${surahType.toLowerCase()}`}>
                                {surahType}
                            </span>
                        )}
                    </div>
                    <div className="player-row-bot">
                        <span className="player-surah-meta">
                            {surahNameEn} · {ayahCount} ayet {playingType && `(${playingType === 'arabic' ? 'Arapça' : 'Türkçe'})`}
                        </span>
                    </div>
                </div>

                {/* Center Controls */}
                <div className="player-center-controls">
                    <div className="player-main-controls">
                        <button className="control-btn" onClick={skipPrevious} title="Önceki" aria-label="Önceki">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
                        </button>

                        <button
                            className="control-btn play-btn"
                            onClick={onTogglePlay}
                            title={isPlaying ? 'Durdur' : 'Oynat'}
                            aria-label={isPlaying ? 'Durdur' : 'Oynat'}
                        >
                            {isPlaying ? (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                    <rect x="6" y="4" width="4" height="16" rx="1" />
                                    <rect x="14" y="4" width="4" height="16" rx="1" />
                                </svg>
                            ) : (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M5 3l14 9-14 9V3z" />
                                </svg>
                            )}
                        </button>

                        <button className="control-btn" onClick={skipNext} title="Sonraki" aria-label="Sonraki">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
                        </button>
                    </div>

                    <div className="player-side-actions">
                        <button
                            className="control-btn side-control go-to-source"
                            onClick={() => navigate(link)}
                            title="Sayfaya Git"
                            aria-label="Sayfaya Git"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                        </button>

                        <button
                            className="control-btn side-control toggle-expand"
                            onClick={() => setIsExpanded(!isExpanded)}
                            title={isExpanded ? 'Küçült' : 'Genişlet'}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? 'Paneli küçült' : 'Paneli genişlet'}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="18 15 12 9 6 15" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <div className="player-mini-progress">
                <div className="mini-progress-fill" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
            </div>

            <div className="player-expanded-content">
                {!isTafsirContext && (
                    <div className="player-reciter-row">
                        <CustomSelect
                            value={settings.defaultReciterId}
                            onChange={(val) => updateSettings({ defaultReciterId: val })}
                            options={reciterOptions}
                            prefix="Arapça: "
                            className="player-reciter-select"
                        />
                        <CustomSelect
                            value={settings.defaultTurkishReciterId || 1015}
                            onChange={(val) => updateSettings({ defaultTurkishReciterId: val })}
                            options={turkishReciterOptions}
                            prefix="Türkçe: "
                            className="player-reciter-select"
                        />
                    </div>
                )}
                <div className="player-top-controls">
                    <div className="player-volume-box">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.08" />
                        </svg>
                        <input
                            type="range"
                            className="player-volume-slider"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                        />
                    </div>
                    {!isTafsirContext && (
                        <button
                            type="button"
                            className={`repeat-badge ${isRepeat ? 'active' : ''}`}
                            onClick={onToggleRepeat}
                            title="Sürekli Çal"
                            aria-pressed={isRepeat}
                            aria-label="Sürekli Çal"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="17 1 21 5 17 9"></polyline>
                                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                                <polyline points="7 23 3 19 7 15"></polyline>
                                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
                            </svg>
                            {isRepeat && <span style={{ fontSize: '10px' }}>Sürekli Çal</span>}
                        </button>
                    )}
                    <button
                        type="button"
                        className="speed-badge"
                        onClick={onSpeedChange}
                        title="Oynatma Hızı"
                        aria-label="Oynatma Hızı"
                    >
                        {playbackSpeed}x
                    </button>
                </div>

                {showSegments && context === 'page' && (() => {
                    const hasIntroTrack = verses[0]?.ayah === 0;

                    return (
                        <div className={`verse-segments-container ${isVeryLongSurah ? 'grid-view' : ''}`}>
                            <button
                                type="button"
                                className={`intro-dot ${hasIntroTrack
                                    ? (currentVerseIndex === 0 ? 'active' : (currentVerseIndex > 0 ? 'played' : ''))
                                    : (currentVerseIndex === -1 ? 'active' : (currentVerseIndex > -1 ? 'played' : ''))
                                    }`}
                                onClick={() => onSelectVerse(hasIntroTrack ? 0 : -1)}
                                title="Başlangıç / Sure Başlığı"
                                aria-label="Başlangıç / Sure Başlığı"
                            />

                            <div className="verse-segments">
                                {verses.map((v, idx) => {
                                    if (hasIntroTrack && idx === 0) return null;

                                    let status = "";
                                    if (idx === currentVerseIndex) status = "active";
                                    else if (idx < currentVerseIndex) status = "played";

                                    return (
                                        <VerseSegment
                                            key={idx}
                                            idx={idx}
                                            status={status}
                                            onClick={onSelectVerse}
                                            ayahNo={v.ayah || v.verse_number || (hasIntroTrack ? idx : idx + 1)}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                {/* Playlist surah segments */}
                {showSegments && context === 'playlist' && verses.length > 0 && (() => {
                    // verses here holds the playlist tracks; group by surahId using segmentIndex stored on each track
                    // We gather unique surah groups and show one segment per surah
                    const segments = [];
                    let lastSurahId = null;
                    verses.forEach((v, idx) => {
                        if (v.surahId !== lastSurahId) {
                            segments.push({ surahId: v.surahId, name: v.surahName, startIdx: idx });
                            lastSurahId = v.surahId;
                        }
                    });

                    return (
                        <div className="verse-segments-container playlist-segments">
                            <div className="verse-segments">
                                {segments.map((seg, i) => {
                                    let status = '';
                                    if (currentVerseIndex >= seg.startIdx) {
                                        const nextSegStart = segments[i + 1]?.startIdx ?? Infinity;
                                        if (currentVerseIndex < nextSegStart) status = 'active';
                                        else status = 'played';
                                    }
                                    return (
                                        <button
                                            type="button"
                                            key={seg.surahId}
                                            className={`verse-segment playlist-segment ${status}`}
                                            onClick={() => onSelectVerse(seg.startIdx)}
                                            title={seg.name}
                                            aria-label={seg.name || `Sure ${seg.surahId}`}
                                        />
                                    );
                                })}
                            </div>
                            <div className="playlist-seg-names">
                                {segments.map((seg, i) => {
                                    const nextSegStart = segments[i + 1]?.startIdx ?? Infinity;
                                    const isActive = currentVerseIndex >= seg.startIdx && currentVerseIndex < nextSegStart;
                                    return (
                                        <span
                                            key={seg.surahId}
                                            className={`playlist-seg-name ${isActive ? 'active' : ''}`}
                                        >
                                            {seg.name}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })()}

                {showSegments && context === 'tafsir' && verses.length > 0 && (
                    <div className="verse-segments-container playlist-segments">
                        <div className="verse-segments">
                            {verses.map((segment, idx) => {
                                let status = ''
                                if (idx === currentVerseIndex) status = 'active'
                                else if (idx < currentVerseIndex) status = 'played'

                                return (
                                    <button
                                        type="button"
                                        key={`${segment.title || 'segment'}-${idx}`}
                                        className={`verse-segment playlist-segment ${status}`}
                                        onClick={() => onSelectVerse(idx)}
                                        title={segment.title || `Bölüm ${idx + 1}`}
                                        aria-label={segment.title || `Bölüm ${idx + 1}`}
                                    />
                                )
                            })}
                        </div>
                        <div className="playlist-seg-names">
                            {verses.map((segment, idx) => (
                                <span
                                    key={`${segment.title || 'segment-name'}-${idx}`}
                                    className={`playlist-seg-name ${idx === currentVerseIndex ? 'active' : ''}`}
                                >
                                    {segment.shortLabel || segment.title || `Bölüm ${idx + 1}`}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="time-row">
                    <span>{formatTime(currentTime)}</span>
                    <span>-{formatTime(remainingTime)}</span>
                </div>
            </div>
        </div>
    )
}


