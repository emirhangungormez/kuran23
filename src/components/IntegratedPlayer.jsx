import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useSettings } from '../contexts/SettingsContext'
import CustomSelect from './CustomSelect'
import { getReciters } from '../services/api'
import { isReciterSupported, getTurkishReciters } from '../services/audio'
import { resolveArabicTextVisibility } from '../utils/textEncoding'
import { normalizeTextMode } from '../utils/textMode'
import './IntegratedPlayer.css'

const DENSE_SEGMENT_THRESHOLD = 90
const DENSE_SEGMENT_TARGET = 60
const DESKTOP_PLAYER_EDGE_INSET = 24
const MOBILE_PLAYER_EDGE_INSET = 12
const DESKTOP_PLAYER_TOP_INSET = 88
const MOBILE_PLAYER_TOP_INSET = 76
const MOBILE_PLAYER_BOTTOM_INSET = 90

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
    const [dragPosition, setDragPosition] = useState(null)
    const [isDragging, setIsDragging] = useState(false)
    const playerRef = useRef(null)
    const progressFillRef = useRef(null)
    const dragStateRef = useRef(null)
    const dragFrameRef = useRef(0)
    const navigate = useNavigate()
    const { settings, updateSettings } = useSettings()
    const { data: availableReciters = [] } = useQuery({
        queryKey: ['reciters'],
        queryFn: getReciters,
        staleTime: 1000 * 60 * 60 * 24
    })

    const formatTime = (time) => {
        if (isNaN(time)) return '0:00'
        const mins = Math.floor(time / 60)
        const secs = Math.floor(time % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const remainingTime = duration - currentTime
    const isVeryLongSurah = verses.length > 50
    const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0
    const showDiacritics = normalizeTextMode(settings.textMode, settings.showTajweed) !== 'plain'
    const displaySurahNameAr = resolveArabicTextVisibility(surahNameAr, showDiacritics)
    const isTafsirContext = context === 'tafsir'
    const isPageContext = context === 'page'
    const showRepeatControl = context === 'playlist'
    const playbackLabel = playingType ? (playingType === 'arabic' ? 'Arapça' : 'Türkçe') : ''
    const playbackBadgeLabel = playingType ? (playingType === 'arabic' ? 'AR' : 'TR') : ''
    const playbackBadgeClass = playingType === 'arabic' ? 'lang-ar' : 'lang-tr'
    const hasInlineArabicMeta = !isPageContext && Boolean(displaySurahNameAr)
    const normalizedVolume = Math.max(0, Math.min(1, Number(volume || 0)))
    const playerDock = settings.playerDock || 'bottom-left'
    const resolvedAyahCount = Number.isFinite(Number(ayahCount)) && Number(ayahCount) > 0
        ? Number(ayahCount)
        : null
    const effectivePosition = dragPosition || settings.playerPosition || null
    const hasCustomPosition = Boolean(effectivePosition)
    const playerMetaText = isPageContext
        ? [surahNameEn, resolvedAyahCount ? `${resolvedAyahCount} ayet` : null].filter(Boolean).join(' / ')
        : (resolvedAyahCount ? `${resolvedAyahCount} ayet` : '')
    const reciterOptions = availableReciters
        .filter(r => isReciterSupported(r.id))
        .map(r => ({
            value: r.id,
            label: `${r.name} (${r.style || 'Standart'})`
        }))
    const turkishReciterOptions = getTurkishReciters().map(r => ({ value: r.id, label: r.name }))

    const pageSegmentsModel = useMemo(() => {
        if (context !== 'page' || !showSegments || verses.length === 0) return null

        const hasIntroTrack = verses[0]?.ayah === 0
        const firstVerseIdx = hasIntroTrack ? 1 : 0
        const entries = []

        for (let idx = firstVerseIdx; idx < verses.length; idx += 1) {
            const verse = verses[idx] || {}
            const resolvedAyahNo = verse.ayah || verse.verse_number || (hasIntroTrack ? idx : idx + 1)
            entries.push({
                startIdx: idx,
                endIdx: idx,
                ayahNo: resolvedAyahNo,
                label: `Ayet ${resolvedAyahNo}`
            })
        }

        if (entries.length > DENSE_SEGMENT_THRESHOLD) {
            const chunkSize = Math.max(2, Math.ceil(entries.length / DENSE_SEGMENT_TARGET))
            const condensed = []

            for (let idx = 0; idx < entries.length; idx += chunkSize) {
                const chunk = entries.slice(idx, idx + chunkSize)
                const first = chunk[0]
                const last = chunk[chunk.length - 1]
                const isSingleAyah = first.ayahNo === last.ayahNo

                condensed.push({
                    startIdx: first.startIdx,
                    endIdx: last.endIdx,
                    ayahNo: isSingleAyah ? `${first.ayahNo}` : `${first.ayahNo}-${last.ayahNo}`,
                    label: isSingleAyah ? `Ayet ${first.ayahNo}` : `Ayet ${first.ayahNo}-${last.ayahNo}`
                })
            }

            return {
                hasIntroTrack,
                isDense: true,
                entries: condensed
            }
        }

        return {
            hasIntroTrack,
            isDense: false,
            entries
        }
    }, [context, showSegments, verses])

    const pageSegments = useMemo(() => {
        if (!pageSegmentsModel) return []

        return pageSegmentsModel.entries.map((segment) => {
            let status = ''
            if (currentVerseIndex >= segment.startIdx && currentVerseIndex <= segment.endIdx) status = 'active'
            else if (currentVerseIndex > segment.endIdx) status = 'played'

            if (pageSegmentsModel.isDense) {
                return (
                    <button
                        type="button"
                        key={`segment-${segment.startIdx}`}
                        className={`verse-segment dense-segment ${status}`}
                        onClick={() => onSelectVerse(segment.startIdx)}
                        title={segment.label}
                        aria-label={segment.label}
                    />
                )
            }

            return (
                <VerseSegment
                    key={segment.startIdx}
                    idx={segment.startIdx}
                    status={status}
                    onClick={onSelectVerse}
                    ayahNo={segment.ayahNo}
                />
            )
        })
    }, [currentVerseIndex, onSelectVerse, pageSegmentsModel])

    useEffect(() => {
        const fillEl = progressFillRef.current
        if (!fillEl) return undefined

        const safeDuration = Math.max(0, Number(duration || 0))
        const safeCurrentTime = Math.max(0, Math.min(safeDuration, Number(currentTime || 0)))
        const baseRatio = safeDuration > 0 ? safeCurrentTime / safeDuration : 0
        const effectivePlaybackRate = context === 'tafsir' ? 1 : Math.max(0.25, Number(playbackSpeed || 1))

        fillEl.style.transform = `scaleX(${baseRatio})`

        if (!isPlaying || safeDuration <= 0) return undefined

        let frameId = 0
        const startedAt = performance.now()

        const render = (now) => {
            const elapsedSeconds = Math.max(0, (now - startedAt) / 1000)
            const visualTime = Math.min(safeDuration, safeCurrentTime + (elapsedSeconds * effectivePlaybackRate))
            const nextRatio = safeDuration > 0 ? (visualTime / safeDuration) : 0
            fillEl.style.transform = `scaleX(${nextRatio})`

            if (visualTime < safeDuration) {
                frameId = window.requestAnimationFrame(render)
            }
        }

        frameId = window.requestAnimationFrame(render)

        return () => {
            if (frameId) window.cancelAnimationFrame(frameId)
        }
    }, [context, currentTime, duration, isPlaying, playbackSpeed])

    useEffect(() => {
        if (dragStateRef.current) return
        setDragPosition(settings.playerPosition || null)
    }, [settings.playerPosition])

    const getPlayerViewportInsets = () => {
        const isMobileViewport = window.innerWidth <= 768

        return {
            left: isMobileViewport ? MOBILE_PLAYER_EDGE_INSET : DESKTOP_PLAYER_EDGE_INSET,
            right: isMobileViewport ? MOBILE_PLAYER_EDGE_INSET : DESKTOP_PLAYER_EDGE_INSET,
            top: isMobileViewport ? MOBILE_PLAYER_TOP_INSET : DESKTOP_PLAYER_TOP_INSET,
            bottom: isMobileViewport ? MOBILE_PLAYER_BOTTOM_INSET : DESKTOP_PLAYER_EDGE_INSET
        }
    }

    const clampDragPosition = (left, top, width, height) => {
        const viewportInsets = getPlayerViewportInsets()
        return {
            left: Math.min(
                Math.max(viewportInsets.left, left),
                Math.max(viewportInsets.left, window.innerWidth - width - viewportInsets.right)
            ),
            top: Math.min(
                Math.max(viewportInsets.top, top),
                Math.max(viewportInsets.top, window.innerHeight - height - viewportInsets.bottom)
            )
        }
    }

    const resolveDockFromPoint = (x, y) => {
        const horizontal = x <= (window.innerWidth / 2) ? 'left' : 'right'
        const vertical = y <= (window.innerHeight / 2) ? 'top' : 'bottom'
        return `${vertical}-${horizontal}`
    }

    const applyDragTransform = () => {
        const playerEl = playerRef.current
        const drag = dragStateRef.current
        if (!playerEl || !drag) return

        playerEl.style.transform = `translate3d(${drag.currentLeft - drag.originLeft}px, ${drag.currentTop - drag.originTop}px, 0)`
    }

    const clearDragTransform = () => {
        const playerEl = playerRef.current
        if (!playerEl) return

        playerEl.style.transform = ''
        playerEl.style.willChange = ''
    }

    useEffect(() => {
        const handlePointerMove = (event) => {
            const drag = dragStateRef.current
            if (!drag || event.pointerId !== drag.pointerId) return

            const deltaX = event.clientX - drag.startX
            const deltaY = event.clientY - drag.startY
            const movement = Math.hypot(deltaX, deltaY)

            if (!drag.hasMoved && movement < 8) return

            drag.hasMoved = true
            if (!drag.isVisualDrag) {
                drag.isVisualDrag = true
                setIsDragging(true)
            }

            const nextPosition = clampDragPosition(
                drag.originLeft + deltaX,
                drag.originTop + deltaY,
                drag.width,
                drag.height
            )
            drag.currentLeft = nextPosition.left
            drag.currentTop = nextPosition.top

            if (!dragFrameRef.current) {
                dragFrameRef.current = window.requestAnimationFrame(() => {
                    dragFrameRef.current = 0
                    applyDragTransform()
                })
            }
            event.preventDefault()
        }

        const handlePointerEnd = (event) => {
            const drag = dragStateRef.current
            if (!drag || event.pointerId !== drag.pointerId) return

            const deltaX = event.clientX - drag.startX
            const deltaY = event.clientY - drag.startY
            const finalPosition = drag.hasMoved
                ? clampDragPosition(
                    drag.originLeft + deltaX,
                    drag.originTop + deltaY,
                    drag.width,
                    drag.height
                )
                : { left: drag.originLeft, top: drag.originTop }

            if (dragFrameRef.current) {
                window.cancelAnimationFrame(dragFrameRef.current)
                dragFrameRef.current = 0
            }
            clearDragTransform()

            if (
                event.pointerType !== 'mouse'
                && drag.originLeft <= 28
                && deltaX <= -96
                && Math.abs(deltaY) < 42
            ) {
                updateSettings({ isPlayerVisible: false })
                setDragPosition(settings.playerPosition || null)
                setIsDragging(false)
                dragStateRef.current = null
                return
            }

            if (drag.hasMoved) {
                const nextDock = resolveDockFromPoint(
                    finalPosition.left + (drag.width / 2),
                    finalPosition.top + (drag.height / 2)
                )

                setDragPosition(finalPosition)
                updateSettings({
                    playerDock: nextDock,
                    playerPosition: finalPosition
                })
            } else {
                setDragPosition(settings.playerPosition || null)
            }

            setIsDragging(false)
            dragStateRef.current = null
        }

        window.addEventListener('pointermove', handlePointerMove, { passive: false })
        window.addEventListener('pointerup', handlePointerEnd)
        window.addEventListener('pointercancel', handlePointerEnd)

        return () => {
            window.removeEventListener('pointermove', handlePointerMove)
            window.removeEventListener('pointerup', handlePointerEnd)
            window.removeEventListener('pointercancel', handlePointerEnd)
            if (dragFrameRef.current) {
                window.cancelAnimationFrame(dragFrameRef.current)
                dragFrameRef.current = 0
            }
        }
    }, [settings.playerPosition, updateSettings])

    useEffect(() => {
        if (!isVisible) return undefined

        const syncViewportPosition = (persistPosition = false) => {
            const playerEl = playerRef.current
            const storedPosition = settings.playerPosition
            if (!playerEl || !storedPosition || dragStateRef.current) return

            const currentDisplayPosition = dragPosition || storedPosition
            const rect = playerEl.getBoundingClientRect()
            const nextPosition = clampDragPosition(storedPosition.left, storedPosition.top, rect.width, rect.height)
            const isDisplayPositionUnchanged = (
                nextPosition.left === currentDisplayPosition.left
                && nextPosition.top === currentDisplayPosition.top
            )
            const isStoredPositionUnchanged = (
                nextPosition.left === storedPosition.left
                && nextPosition.top === storedPosition.top
            )

            if (isDisplayPositionUnchanged && (!persistPosition || isStoredPositionUnchanged)) return

            if (!isDisplayPositionUnchanged) {
                setDragPosition(nextPosition)
            }

            if (!persistPosition || isStoredPositionUnchanged) return

            const nextDock = resolveDockFromPoint(
                nextPosition.left + (rect.width / 2),
                nextPosition.top + (rect.height / 2)
            )

            updateSettings({
                playerDock: nextDock,
                playerPosition: nextPosition
            })
        }

        const frameId = window.requestAnimationFrame(() => syncViewportPosition(false))
        const handleResize = () => syncViewportPosition(true)
        window.addEventListener('resize', handleResize)

        return () => {
            window.cancelAnimationFrame(frameId)
            window.removeEventListener('resize', handleResize)
        }
    }, [dragPosition, isExpanded, isVisible, settings.playerPosition, updateSettings])

    const handleDragStart = (event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return

        const playerEl = playerRef.current
        if (!playerEl) return

        const rect = playerEl.getBoundingClientRect()
        const originPosition = clampDragPosition(rect.left, rect.top, rect.width, rect.height)

        setDragPosition(originPosition)
        playerEl.style.willChange = 'transform'
        dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originLeft: originPosition.left,
            originTop: originPosition.top,
            width: rect.width,
            height: rect.height,
            currentLeft: originPosition.left,
            currentTop: originPosition.top,
            hasMoved: false,
            isVisualDrag: false
        }

        if (event.currentTarget.setPointerCapture) {
            event.currentTarget.setPointerCapture(event.pointerId)
        }
    }

    if (!isVisible) return null

    return (
        <div
            ref={playerRef}
            className={`integrated-player ${hasCustomPosition ? '' : `player-dock-${playerDock}`} ${isExpanded ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
            style={effectivePosition ? {
                left: `${effectivePosition.left}px`,
                top: `${effectivePosition.top}px`,
                right: 'auto',
                bottom: 'auto'
            } : undefined}
        >
            <div className="player-drag-row">
                <div
                    className="player-drag-handle"
                    onPointerDown={handleDragStart}
                    role="presentation"
                    aria-hidden="true"
                />
            </div>
            <div className="player-main-row">
                <div className="player-rich-info">
                    <div className="player-row-mid">
                        <span className={`player-surah-tr ${isPageContext ? '' : 'player-surah-title'}`}>
                            {isPageContext
                                ? `${juzNumber}. Cüz ${pageNumber}. Sayfa`
                                : `${surahNameTr}${ayahNo > 0 ? `:${ayahNo}` : ''}`
                            }
                        </span>
                        {surahType && (
                            <span className={`player-badge ${surahType.toLowerCase()}`}>
                                {surahType}
                            </span>
                        )}
                        {playbackBadgeLabel && (
                            <span className={`player-badge language ${playbackBadgeClass}`}>
                                {playbackBadgeLabel}
                            </span>
                        )}
                    </div>
                    <div className="player-row-bot">
                        {hasInlineArabicMeta && (
                            <span className="player-surah-ar-inline" dir="rtl">{displaySurahNameAr}</span>
                        )}
                        {hasInlineArabicMeta && playerMetaText && <span className="player-meta-separator">&middot;</span>}
                        {playerMetaText && (
                            <span className={isPageContext ? 'player-surah-meta' : 'player-surah-meta-info'}>
                                {playerMetaText}
                            </span>
                        )}
                    </div>
                </div>

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
                <div ref={progressFillRef} className="mini-progress-fill" style={{ transform: `scaleX(${progressRatio})` }} />
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
                            value={settings.defaultTurkishReciterId || 1014}
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
                            {normalizedVolume <= 0.01 ? (
                                <>
                                    <line x1="23" y1="9" x2="17" y2="15" />
                                    <line x1="17" y1="9" x2="23" y2="15" />
                                </>
                            ) : normalizedVolume < 0.34 ? (
                                <path d="M14.83 9.17a4 4 0 0 1 0 5.66" />
                            ) : normalizedVolume < 0.67 ? (
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.08" />
                            ) : (
                                <>
                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.08" />
                                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                                </>
                            )}
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
                    {!isTafsirContext && showRepeatControl && (
                        <button
                            type="button"
                            className={`repeat-badge ${isRepeat ? 'active' : ''}`}
                            onClick={onToggleRepeat}
                            title="Sürekli Çal"
                            aria-pressed={isRepeat}
                            aria-label="Sürekli Çal"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="17 1 21 5 17 9" />
                                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                <polyline points="7 23 3 19 7 15" />
                                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
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

                {showSegments && context === 'page' && pageSegmentsModel && (
                    <div className={`verse-segments-container ${pageSegmentsModel.isDense ? 'dense-mode' : (isVeryLongSurah ? 'grid-view' : '')}`}>
                        <button
                            type="button"
                            className={`intro-dot ${pageSegmentsModel.hasIntroTrack
                                ? (currentVerseIndex === 0 ? 'active' : (currentVerseIndex > 0 ? 'played' : ''))
                                : (currentVerseIndex === -1 ? 'active' : (currentVerseIndex > -1 ? 'played' : ''))
                                }`}
                            onClick={() => onSelectVerse(pageSegmentsModel.hasIntroTrack ? 0 : -1)}
                            title="Başlangıç / Sure Başlığı"
                            aria-label="Başlangıç / Sure Başlığı"
                        />

                        <div className="verse-segments">
                            {pageSegments}
                        </div>
                    </div>
                )}

                {showSegments && context === 'playlist' && verses.length > 0 && (() => {
                    const segments = []
                    let lastSurahId = null
                    verses.forEach((v, idx) => {
                        if (v.surahId !== lastSurahId) {
                            segments.push({ surahId: v.surahId, name: v.surahName, startIdx: idx })
                            lastSurahId = v.surahId
                        }
                    })

                    return (
                        <div className="verse-segments-container playlist-segments">
                            <div className="verse-segments">
                                {segments.map((seg, i) => {
                                    let status = ''
                                    if (currentVerseIndex >= seg.startIdx) {
                                        const nextSegStart = segments[i + 1]?.startIdx ?? Infinity
                                        if (currentVerseIndex < nextSegStart) status = 'active'
                                        else status = 'played'
                                    }
                                    return (
                                        <button
                                            type="button"
                                            key={`${seg.surahId}-${seg.startIdx}`}
                                            className={`verse-segment playlist-segment ${status}`}
                                            onClick={() => onSelectVerse(seg.startIdx)}
                                            title={seg.name}
                                            aria-label={seg.name || `Sure ${seg.surahId}`}
                                        />
                                    )
                                })}
                            </div>
                            <div className="playlist-seg-names">
                                {segments.map((seg, i) => {
                                    const nextSegStart = segments[i + 1]?.startIdx ?? Infinity
                                    const isActive = currentVerseIndex >= seg.startIdx && currentVerseIndex < nextSegStart
                                    return (
                                        <span
                                            key={`${seg.surahId}-${seg.startIdx}-name`}
                                            className={`playlist-seg-name ${isActive ? 'active' : ''}`}
                                        >
                                            {seg.name}
                                        </span>
                                    )
                                })}
                            </div>
                        </div>
                    )
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
