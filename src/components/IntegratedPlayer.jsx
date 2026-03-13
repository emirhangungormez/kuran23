import React, { memo, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import CustomSelect from './CustomSelect'
import { getPage } from '../services/api'
import {
    buildTurkishPagePlaylistTracks,
    getArabicReciters,
    getSurahAudioUrl,
    getTurkishAudioUrl,
    getTurkishReciters,
    getVerseAudioUrl,
    isReciterSupported,
    isTurkishPlaylistSupported,
    resolveTurkishVersePlaybackAyah
} from '../services/audio'
import usePlayerStore from '../stores/usePlayerStore'
import { resolveArabicTextVisibility } from '../utils/textEncoding'
import { normalizeTextMode } from '../utils/textMode'
import './IntegratedPlayer.css'

const DENSE_SEGMENT_THRESHOLD = 90
const DENSE_SEGMENT_TARGET = 60
const DESKTOP_PLAYER_EDGE_INSET = 24
const MOBILE_PLAYER_EDGE_INSET = 12
const DESKTOP_PLAYER_TOP_INSET = 88
const MOBILE_PLAYER_TOP_INSET = 76
const MOBILE_PLAYER_BOTTOM_INSET = 76
const MOBILE_PLAYER_DRAG_EXCLUDE_SELECTOR = '.custom-select-dropdown, input[type="range"]'

function normalizeReciterLabel(label) {
    return String(label || '')
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim()
}

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
    surahId,
    pageNumber,
    juzNumber,
    startAyah,
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
    const playSingle = usePlayerStore((state) => state.playSingle)
    const playPlaylist = usePlayerStore((state) => state.playPlaylist)
    const loadPlaylist = usePlayerStore((state) => state.loadPlaylist)
    const stopPlayback = usePlayerStore((state) => state.stopPlayback)

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
    const reciterOptions = getArabicReciters()
        .filter(r => isReciterSupported(r.id))
        .map(r => ({
            value: r.id,
            label: normalizeReciterLabel(r.name),
            featured: Boolean(r.featured)
        }))
    const turkishReciterOptions = getTurkishReciters().map(r => ({
        value: r.id,
        label: normalizeReciterLabel(r.name)
    }))

    const playPlaylistForCurrentState = (tracks, startIndex, metaData) => {
        if (!Array.isArray(tracks) || tracks.length === 0) return
        const safeIndex = Math.min(Math.max(0, startIndex), tracks.length - 1)
        if (isPlaying) {
            playPlaylist(tracks, safeIndex, metaData)
        } else {
            loadPlaylist(tracks, safeIndex, metaData)
        }
    }

    const buildPlayerMeta = (nextPlayingType, extra = {}) => ({
        surahNameAr,
        surahNameTr,
        surahNameEn,
        surahType,
        ayahCount: resolvedAyahCount || Number(ayahCount || 0),
        playingType: nextPlayingType,
        link,
        surahId: Number(surahId || 0),
        ayahNo: Number(ayahNo || 0),
        pageNumber: Number(pageNumber || 0),
        juzNumber: Number(juzNumber || 0),
        context,
        ...(Number(startAyah || 0) > 0 ? { startAyah: Number(startAyah) } : {}),
        ...extra
    })

    const restartPlaybackForReciterChange = async (targetType, nextSettings) => {
        if (isTafsirContext || context === 'playlist' || playingType !== targetType) return

        const safeSurahId = Number(surahId || 0)
        const safeAyahNo = Number(ayahNo || 0)
        const safeAyahCount = Number(resolvedAyahCount || ayahCount || 0)
        const safeCurrentIndex = Math.max(0, Number(currentVerseIndex || 0))
        const primaryAuthorId = nextSettings.coreAuthorIds?.[0] || nextSettings.defaultAuthorId || 77

        if (context === 'surah') {
            if (targetType === 'arabic') {
                if (verses.length > 0) {
                    const tracks = verses
                        .map((track, index) => {
                            const trackAyah = Number(track?.ayah ?? track?.verse_number ?? index)
                            const trackSurahId = Number(track?.surahId ?? track?.surah?.id ?? safeSurahId)
                            if (!trackSurahId || !Number.isFinite(trackAyah)) return null
                            return { ...track, audio: getVerseAudioUrl(nextSettings.defaultReciterId, trackSurahId, trackAyah) }
                        })
                        .filter(Boolean)

                    playPlaylistForCurrentState(tracks, safeCurrentIndex, buildPlayerMeta('arabic'))
                    return
                }

                if (safeSurahId) {
                    playSingle(getSurahAudioUrl(nextSettings.defaultReciterId, safeSurahId), buildPlayerMeta('arabic'))
                }
                return
            }

            if (isTurkishPlaylistSupported(nextSettings.defaultTurkishReciterId)) {
                const tracks = verses.length > 0
                    ? verses
                        .map((track, index) => {
                            const trackAyah = Number(track?.ayah ?? track?.verse_number ?? index)
                            const trackSurahId = Number(track?.surahId ?? track?.surah?.id ?? safeSurahId)
                            if (!trackSurahId || !Number.isFinite(trackAyah)) return null
                            return { ...track, audio: getTurkishAudioUrl(nextSettings.defaultTurkishReciterId, trackSurahId, trackAyah) }
                        })
                        .filter(Boolean)
                    : Array.from({ length: Math.max(0, safeAyahCount) + 1 }, (_, index) => ({
                        audio: getTurkishAudioUrl(nextSettings.defaultTurkishReciterId, safeSurahId, index),
                        ayah: index,
                        surahId: safeSurahId
                    }))

                playPlaylistForCurrentState(tracks, safeCurrentIndex, buildPlayerMeta('turkish'))
                return
            }

            if (safeSurahId) {
                playSingle(
                    getTurkishAudioUrl(nextSettings.defaultTurkishReciterId, safeSurahId, 0),
                    buildPlayerMeta('turkish', { startAyah: 0 })
                )
            }
            return
        }

        if (context === 'verse') {
            if (!safeSurahId || !safeAyahNo) return

            if (targetType === 'arabic') {
                playSingle(getVerseAudioUrl(nextSettings.defaultReciterId, safeSurahId, safeAyahNo), buildPlayerMeta('arabic'))
                return
            }

            if (isTurkishPlaylistSupported(nextSettings.defaultTurkishReciterId) && safeAyahCount >= safeAyahNo) {
                const playbackStartAyah = resolveTurkishVersePlaybackAyah(
                    nextSettings.defaultTurkishReciterId,
                    safeSurahId,
                    safeAyahNo
                )
                const tracks = []
                for (let ayahIndex = playbackStartAyah || safeAyahNo; ayahIndex <= safeAyahCount; ayahIndex += 1) {
                    tracks.push({
                        audio: getTurkishAudioUrl(nextSettings.defaultTurkishReciterId, safeSurahId, ayahIndex),
                        ayah: ayahIndex,
                        surahId: safeSurahId
                    })
                }
                playPlaylistForCurrentState(tracks, 0, buildPlayerMeta('turkish'))
                return
            }

            playSingle(getTurkishAudioUrl(nextSettings.defaultTurkishReciterId, safeSurahId, safeAyahNo), buildPlayerMeta('turkish'))
            return
        }

        if (context === 'page' && pageNumber) {
            let pageTracks = Array.isArray(verses) ? verses : []

            if (pageTracks.length === 0) {
                pageTracks = await getPage(pageNumber, primaryAuthorId, nextSettings.defaultReciterId, nextSettings.textMode)
            }

            if (!Array.isArray(pageTracks) || pageTracks.length === 0) return

            if (targetType === 'arabic') {
                const tracks = pageTracks
                    .map((track) => {
                        const trackSurahId = Number(track?.surah?.id ?? track?.surahId ?? safeSurahId)
                        const trackAyah = Number(track?.verse_number ?? track?.ayah)
                        if (!trackSurahId || !trackAyah) return null
                        return { ...track, audio: getVerseAudioUrl(nextSettings.defaultReciterId, trackSurahId, trackAyah) }
                    })
                    .filter(Boolean)

                playPlaylistForCurrentState(tracks, safeCurrentIndex, buildPlayerMeta('arabic', { startAyah: 0 }))
                return
            }

            if (isTurkishPlaylistSupported(nextSettings.defaultTurkishReciterId)) {
                const tracks = buildTurkishPagePlaylistTracks(nextSettings.defaultTurkishReciterId, pageTracks)

                const fallbackStartAyah = Number(startAyah || pageTracks[0]?.verse_number || pageTracks[0]?.ayah || 0)
                const restartIndex = verses.length > 0
                    ? safeCurrentIndex
                    : Math.max(0, pageTracks.findIndex((track) => Number(track?.verse_number ?? track?.ayah) === fallbackStartAyah))

                playPlaylistForCurrentState(
                    tracks,
                    restartIndex,
                    buildPlayerMeta('turkish', { startAyah: fallbackStartAyah, autoAdvance: true })
                )
                return
            }

            const fallbackSurahId = Number(pageTracks[0]?.surah?.id ?? pageTracks[0]?.surahId ?? safeSurahId)
            const fallbackStartAyah = Number(startAyah || pageTracks[0]?.verse_number || pageTracks[0]?.ayah || 0)
            if (fallbackSurahId) {
                playSingle(
                    getTurkishAudioUrl(nextSettings.defaultTurkishReciterId, fallbackSurahId, 0),
                    buildPlayerMeta('turkish', { startAyah: fallbackStartAyah, autoAdvance: true })
                )
            }
        }
    }

    const handleArabicReciterChange = async (value) => {
        const nextSettings = { ...settings, defaultReciterId: value }
        updateSettings({ defaultReciterId: value })
        try {
            await restartPlaybackForReciterChange('arabic', nextSettings)
        } catch (error) {
            console.error('Arabic reciter switch failed:', error)
        }
    }

    const handleTurkishReciterChange = async (value) => {
        const nextSettings = { ...settings, defaultTurkishReciterId: value }
        updateSettings({ defaultTurkishReciterId: value })
        try {
            await restartPlaybackForReciterChange('turkish', nextSettings)
        } catch (error) {
            console.error('Turkish reciter switch failed:', error)
        }
    }

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

    const getMobileAnchoredTop = (height) => {
        const viewportInsets = getPlayerViewportInsets()
        return Math.max(
            viewportInsets.top,
            window.innerHeight - height - viewportInsets.bottom
        )
    }

    const clampDragPosition = (left, top, width, height, options = {}) => {
        const { allowHorizontalOverflow = false } = options
        const viewportInsets = getPlayerViewportInsets()
        return {
            left: allowHorizontalOverflow
                ? Math.min(
                    window.innerWidth + width,
                    Math.max(-width, left)
                )
                : Math.min(
                    Math.max(viewportInsets.left, left),
                    Math.max(viewportInsets.left, window.innerWidth - width - viewportInsets.right)
                ),
            top: Math.min(
                Math.max(viewportInsets.top, top),
                Math.max(viewportInsets.top, window.innerHeight - height - viewportInsets.bottom)
            )
        }
    }

    const shouldDismissPlayerOnSwipe = (rawLeft, width, deltaX, deltaY, pointerType) => {
        if (pointerType === 'mouse' || window.innerWidth > 768) return false

        const horizontalDistance = Math.abs(deltaX)
        const verticalDistance = Math.abs(deltaY)
        if (horizontalDistance < 72 || horizontalDistance <= (verticalDistance * 1.2)) return false

        const visibleLeft = Math.max(0, rawLeft)
        const visibleRight = Math.min(window.innerWidth, rawLeft + width)
        const visibleWidth = Math.max(0, visibleRight - visibleLeft)
        const visibleRatio = width > 0 ? (visibleWidth / width) : 1

        return visibleRatio <= 0.62
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

    const canStartMobileDragFromTarget = (target) => {
        if (!(target instanceof Element)) return true
        return !target.closest(MOBILE_PLAYER_DRAG_EXCLUDE_SELECTOR)
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

            const isMobileSwipeDrag = event.pointerType !== 'mouse' && window.innerWidth <= 768
            const nextPosition = clampDragPosition(
                drag.originLeft + deltaX,
                isMobileSwipeDrag ? getMobileAnchoredTop(drag.height) : (drag.originTop + deltaY),
                drag.width,
                drag.height,
                { allowHorizontalOverflow: isMobileSwipeDrag }
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
            const isMobileSwipeDrag = event.pointerType !== 'mouse' && window.innerWidth <= 768
            const rawFinalPosition = drag.hasMoved
                ? clampDragPosition(
                    drag.originLeft + deltaX,
                    isMobileSwipeDrag ? getMobileAnchoredTop(drag.height) : (drag.originTop + deltaY),
                    drag.width,
                    drag.height,
                    { allowHorizontalOverflow: isMobileSwipeDrag }
                )
                : { left: drag.originLeft, top: drag.originTop }
            const finalPosition = drag.hasMoved
                ? clampDragPosition(
                    drag.originLeft + deltaX,
                    isMobileSwipeDrag ? getMobileAnchoredTop(drag.height) : (drag.originTop + deltaY),
                    drag.width,
                    drag.height
                )
                : { left: drag.originLeft, top: drag.originTop }
            const normalizedFinalPosition = (
                isMobileSwipeDrag
                    ? { ...finalPosition, top: getMobileAnchoredTop(drag.height) }
                    : finalPosition
            )

            if (dragFrameRef.current) {
                window.cancelAnimationFrame(dragFrameRef.current)
                dragFrameRef.current = 0
            }
            clearDragTransform()

            if (shouldDismissPlayerOnSwipe(rawFinalPosition.left, drag.width, deltaX, deltaY, event.pointerType)) {
                stopPlayback({ resetMode: true })
                updateSettings({ isPlayerVisible: false })
                setDragPosition(settings.playerPosition || null)
                setIsDragging(false)
                dragStateRef.current = null
                return
            }

            if (drag.hasMoved) {
                const nextDock = resolveDockFromPoint(
                    normalizedFinalPosition.left + (drag.width / 2),
                    normalizedFinalPosition.top + (drag.height / 2)
                )

                setDragPosition(normalizedFinalPosition)
                updateSettings({
                    playerDock: nextDock,
                    playerPosition: normalizedFinalPosition
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
            const isMobileViewport = window.innerWidth <= 768
            const nextPosition = clampDragPosition(
                storedPosition.left,
                isMobileViewport ? getMobileAnchoredTop(rect.height) : storedPosition.top,
                rect.width,
                rect.height
            )
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

            if ((!persistPosition && !isMobileViewport) || isStoredPositionUnchanged) return

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
        const isMobileViewport = event.pointerType !== 'mouse' && window.innerWidth <= 768
        const originPosition = clampDragPosition(
            rect.left,
            isMobileViewport ? getMobileAnchoredTop(rect.height) : rect.top,
            rect.width,
            rect.height
        )

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

    }

    const handleContainerPointerDown = (event) => {
        if (event.pointerType === 'mouse' || window.innerWidth > 768) return
        if (!canStartMobileDragFromTarget(event.target)) return
        handleDragStart(event)
    }

    const handleGripPointerDown = (event) => {
        event.stopPropagation()
        if (event.pointerType !== 'mouse' && window.innerWidth <= 768) return
        handleDragStart(event)
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
            onPointerDownCapture={handleContainerPointerDown}
        >
            <div className="player-drag-row">
                <div
                    className="player-drag-handle"
                    onPointerDown={handleGripPointerDown}
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
                    </div>
                    {(hasInlineArabicMeta || playerMetaText) && (
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
                    )}
                    {(surahType || playbackBadgeLabel) && (
                        <div className="player-row-submeta">
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
                    )}
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
                            onChange={(val) => { void handleArabicReciterChange(val) }}
                            options={reciterOptions}
                            prefix="Arapça: "
                            className="player-reciter-select"
                        />
                        <CustomSelect
                            value={settings.defaultTurkishReciterId || 1014}
                            onChange={(val) => { void handleTurkishReciterChange(val) }}
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

