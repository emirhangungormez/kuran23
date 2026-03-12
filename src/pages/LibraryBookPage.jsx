import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import GlobalNav from '../components/GlobalNav'
import { useSettings } from '../contexts/SettingsContext'
import { formatTafsirRichText } from '../utils/tafsirFormatting'
import { normalizeArabicDisplayText, resolveArabicTextVisibility } from '../utils/textEncoding'
import { getVerseTextByMode, normalizeTextMode } from '../utils/textMode'
import {
  getArabicFontFamily,
  getArabicFontSize,
  getTranslationFontSize,
  getTranscriptionFontSize
} from '../utils/typography'
import {
  getBookById,
  getSurahTitle,
  splitIntoSections
} from '../data/libraryBooks'
import { surahs as quranSurahs } from '../data/quranData'
import { getSurah, getVerse } from '../services/api'
import {
  getAyahNumbersFromManifest,
  getRawTafsirHtml,
  getSurahIdsFromManifest,
  loadLibraryManifest,
  loadLibrarySurah
} from '../services/libraryContent'
import { isTafsirSpeechSupported, stripHtmlForSpeech } from '../services/tafsirSpeech'
import usePlayerStore from '../stores/usePlayerStore'
import './TefsirlerPage.css'
import './LibraryMobile.css'

function getPlainSurahTitleLabel(surahId) {
  return getSurahTitle(surahId).replace(/\s*\(\d+\)$/, '')
}

function getAyahMarkerNumber(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return null

  const text = String(node.textContent || '').replace(/\s+/g, ' ').trim()
  if (!/^\d+([-–]\d+)?$/.test(text)) return null

  const tagName = node.tagName?.toLowerCase()
  if (
    node.classList?.contains('tafsir-ayah-marker') ||
    tagName === 'h1' ||
    tagName === 'h2' ||
    tagName === 'h3' ||
    tagName === 'h4' ||
    tagName === 'p'
  ) {
    const match = text.match(/\d+/)
    return match ? Number(match[0]) : null
  }

  return null
}

function buildSpeechSegmentText(parts) {
  return parts
    .map((part) => String(part || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('. ')
}

function countSpeechWords(text) {
  return (String(text || '').match(/[\p{L}\p{N}]+/gu) || []).length
}

function highlightSpokenWordsInHtml(html, progressRatio) {
  const source = String(html || '').trim()
  if (!source || typeof window === 'undefined') return source
  const safeRatio = Number.isFinite(progressRatio) ? Math.max(0, Math.min(1, progressRatio)) : 0

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div id="speech-highlight-root">${source}</div>`, 'text/html')
    const root = doc.getElementById('speech-highlight-root')
    if (!root) return source

    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, null)
    const textNodes = []
    while (walker.nextNode()) {
      const node = walker.currentNode
      if (!node?.textContent?.trim()) continue
      textNodes.push(node)
    }

    const isWordToken = (value) => /[\p{L}\p{N}]/u.test(String(value || ''))
    const wordsPerNode = textNodes.map((node) => {
      const parts = String(node.textContent || '').split(/(\s+)/)
      const words = parts.filter((part) => isWordToken(part))
      return { node, parts, wordCount: words.length }
    })
    const totalWords = wordsPerNode.reduce((sum, entry) => sum + entry.wordCount, 0)
    if (!totalWords) return source

    const targetWordCount = Math.max(0, Math.min(totalWords, Math.floor(totalWords * safeRatio)))
    let wordCursor = 0

    wordsPerNode.forEach(({ node, parts }) => {
      const fragment = doc.createDocumentFragment()
      parts.forEach((part) => {
        const isWord = isWordToken(part)
        if (!isWord) {
          fragment.appendChild(doc.createTextNode(part))
          return
        }

        const span = doc.createElement('span')
        span.textContent = part
        span.className = 'tefsir-spoken-word'
        span.dataset.wordIndex = String(wordCursor + 1)
        span.dataset.wordTotal = String(totalWords)

        if (wordCursor < targetWordCount) {
          span.classList.add('spoken')
        } else if (wordCursor === targetWordCount) {
          span.classList.add('speaking')
        }

        wordCursor += 1
        fragment.appendChild(span)
      })

      node.parentNode?.replaceChild(fragment, node)
    })

    return root.innerHTML
  } catch {
    return source
  }
}

export default function LibraryBookPage() {
  const { bookId } = useParams()
  const [activeScope, setActiveScope] = useState('verse')
  const [activeSurahId, setActiveSurahId] = useState(1)
  const [activeAyahNo, setActiveAyahNo] = useState(1)
  const [expandedSurahIds, setExpandedSurahIds] = useState(null)
  const { settings, updateSettings } = useSettings()
  const playerMode = usePlayerStore((state) => state.mode)
  const playerMeta = usePlayerStore((state) => state.meta)
  const playerTrackIndex = usePlayerStore((state) => state.currentTrackIndex)
  const playerIsPlaying = usePlayerStore((state) => state.isPlaying)
  const playerCurrentTime = usePlayerStore((state) => state.currentTime)
  const playerDuration = usePlayerStore((state) => state.duration)
  const playTafsirPlaylist = usePlayerStore((state) => state.playTafsirPlaylist)
  const seekTafsirSpeechByRatio = usePlayerStore((state) => state.seekTafsirSpeechByRatio)
  const stopPlayback = usePlayerStore((state) => state.stopPlayback)
  const togglePlay = usePlayerStore((state) => state.togglePlay)

  const book = useMemo(() => getBookById(bookId), [bookId])
  const isTafsirBook = book?.category === 'tefsir'

  const {
    data: manifest,
    isLoading: isManifestLoading,
    error: manifestError
  } = useQuery({
    queryKey: ['library-manifest'],
    queryFn: loadLibraryManifest,
    staleTime: 1000 * 60 * 60 * 12
  })

  const availableSurahIds = useMemo(
    () => (isTafsirBook ? getSurahIdsFromManifest(manifest, book?.sourceId || book?.id) : []),
    [book?.id, book?.sourceId, isTafsirBook, manifest]
  )
  const resolvedSurahId = useMemo(() => {
    if (!availableSurahIds.length) return 1
    return availableSurahIds.includes(Number(activeSurahId)) ? Number(activeSurahId) : availableSurahIds[0]
  }, [activeSurahId, availableSurahIds])
  const availableAyahs = useMemo(
    () => (isTafsirBook ? getAyahNumbersFromManifest(manifest, book?.sourceId || book?.id, resolvedSurahId) : []),
    [book?.id, book?.sourceId, isTafsirBook, manifest, resolvedSurahId]
  )
  const canUseVerseScope = availableAyahs.length > 0
  const effectiveScope = canUseVerseScope ? activeScope : 'surah'
  const tafsirMealAuthorId = Number(settings.tafsirVerseAuthorId || settings.defaultAuthorId || 77)
  const resolvedAyahNo = useMemo(() => {
    if (!availableAyahs.length) return 1
    return availableAyahs.includes(Number(activeAyahNo)) ? Number(activeAyahNo) : availableAyahs[0]
  }, [activeAyahNo, availableAyahs])

  const {
    data: surahData,
    isLoading: isSurahLoading,
    error: surahError
  } = useQuery({
    queryKey: ['library-surah', book?.sourceId || book?.id, resolvedSurahId],
    queryFn: () => loadLibrarySurah({ bookId: book?.sourceId || book?.id, surahId: resolvedSurahId }),
    enabled: Boolean(isTafsirBook && (book?.sourceId || book?.id) && resolvedSurahId && availableSurahIds.length),
    staleTime: 1000 * 60 * 60 * 12
  })

  const {
    data: selectedVerse,
    isLoading: isVerseLoading
  } = useQuery({
    queryKey: ['library-reader-verse', resolvedSurahId, resolvedAyahNo, tafsirMealAuthorId],
    queryFn: () => getVerse(resolvedSurahId, resolvedAyahNo, tafsirMealAuthorId),
    enabled: Boolean(isTafsirBook && effectiveScope === 'verse' && resolvedSurahId && resolvedAyahNo),
    staleTime: 1000 * 60 * 60 * 12
  })

  const {
    data: selectedSurah,
    isLoading: isSelectedSurahLoading
  } = useQuery({
    queryKey: ['library-reader-surah', resolvedSurahId, tafsirMealAuthorId],
    queryFn: () => getSurah(resolvedSurahId, tafsirMealAuthorId),
    enabled: Boolean(isTafsirBook && effectiveScope === 'surah' && resolvedSurahId),
    staleTime: 1000 * 60 * 60 * 12
  })

  const rawTafsirHtml = useMemo(() => {
    if (!book || book.category !== 'tefsir') return ''
    return getRawTafsirHtml({
      scope: effectiveScope,
      surahData,
      surahId: resolvedSurahId,
      ayahNo: resolvedAyahNo
    })
  }, [book, effectiveScope, resolvedAyahNo, resolvedSurahId, surahData])

  const formattedHtml = useMemo(
    () => formatTafsirRichText(rawTafsirHtml, { context: effectiveScope, surahId: resolvedSurahId, ayahNo: resolvedAyahNo }),
    [effectiveScope, rawTafsirHtml, resolvedAyahNo, resolvedSurahId]
  )

  const sections = useMemo(() => splitIntoSections(formattedHtml), [formattedHtml])
  const displaySections = useMemo(
    () => (sections.length ? sections : [{ title: '', bodyHtml: '<p>Bu seçim için tefsir bulunamadı.</p>' }]),
    [sections]
  )
  const surahNavigationItems = useMemo(
    () =>
      availableSurahIds.map((surahId) => ({
        surahId,
        label: getPlainSurahTitleLabel(surahId),
        numberLabel: `${surahId}.`,
        ayahs: getAyahNumbersFromManifest(manifest, book?.sourceId || book?.id, surahId)
      })),
    [availableSurahIds, book?.id, book?.sourceId, manifest]
  )
  const currentReferenceLabel = useMemo(() => {
    if (effectiveScope === 'surah') return getPlainSurahTitleLabel(resolvedSurahId)
    return `${getPlainSurahTitleLabel(resolvedSurahId)} · ${resolvedAyahNo}. ayet`
  }, [effectiveScope, resolvedAyahNo, resolvedSurahId])
  const readerSurahDetails = useMemo(() => {
    const fallback = quranSurahs.find((item) => Number(item.no) === Number(resolvedSurahId)) || null
    const fromApi = selectedSurah || null
    const surahNo = Number(fallback?.no || fromApi?.id || resolvedSurahId || 0)
    const surahNameAr = normalizeArabicDisplayText(fromApi?.name_original || fallback?.nameAr || '')
    const surahNameTr = fromApi?.name || fallback?.nameTr || getPlainSurahTitleLabel(surahNo || resolvedSurahId)
    const surahNameEn = fromApi?.name_en || fallback?.nameEn || ''
    const ayahCount = Number(fromApi?.verse_count || fallback?.ayahCount || 0) || 0

    let surahType = fallback?.type || ''
    if (!surahType && typeof fromApi?.revelation_place === 'string') {
      const normalizedPlace = fromApi.revelation_place.toLowerCase()
      surahType = normalizedPlace.includes('makk') ? 'Mekki' : 'Medeni'
    }

    return {
      surahNo,
      surahNameAr,
      surahNameTr,
      surahNameEn,
      ayahCount,
      surahType
    }
  }, [resolvedSurahId, selectedSurah])
  const currentSurahIndex = useMemo(
    () => availableSurahIds.findIndex((surahId) => Number(surahId) === Number(resolvedSurahId)),
    [availableSurahIds, resolvedSurahId]
  )
  const prevSurahId = currentSurahIndex > 0 ? availableSurahIds[currentSurahIndex - 1] || null : null
  const nextSurahId = currentSurahIndex >= 0 ? availableSurahIds[currentSurahIndex + 1] || null : null
  const prevSurahAyahs = useMemo(
    () => (prevSurahId ? getAyahNumbersFromManifest(manifest, book?.sourceId || book?.id, prevSurahId) : []),
    [book?.id, book?.sourceId, manifest, prevSurahId]
  )
  const nextSurahAyahs = useMemo(
    () => (nextSurahId ? getAyahNumbersFromManifest(manifest, book?.sourceId || book?.id, nextSurahId) : []),
    [book?.id, book?.sourceId, manifest, nextSurahId]
  )
  const previousVerseTarget = useMemo(() => {
    if (effectiveScope !== 'verse') return null

    const currentAyahIndex = availableAyahs.findIndex((ayah) => Number(ayah) === Number(resolvedAyahNo))
    if (currentAyahIndex > 0) {
      const ayahNo = availableAyahs[currentAyahIndex - 1]
      return {
        surahId: resolvedSurahId,
        ayahNo,
        label: `${getPlainSurahTitleLabel(resolvedSurahId)} · ${ayahNo}. ayet`
      }
    }

    if (!prevSurahId || !prevSurahAyahs.length) return null

    const ayahNo = prevSurahAyahs[prevSurahAyahs.length - 1]
    return {
      surahId: prevSurahId,
      ayahNo,
      label: `${getPlainSurahTitleLabel(prevSurahId)} · ${ayahNo}. ayet`
    }
  }, [availableAyahs, effectiveScope, prevSurahAyahs, prevSurahId, resolvedAyahNo, resolvedSurahId])
  const nextVerseTarget = useMemo(() => {
    if (effectiveScope !== 'verse') return null

    const currentAyahIndex = availableAyahs.findIndex((ayah) => Number(ayah) === Number(resolvedAyahNo))
    if (currentAyahIndex >= 0 && currentAyahIndex < availableAyahs.length - 1) {
      const ayahNo = availableAyahs[currentAyahIndex + 1]
      return {
        surahId: resolvedSurahId,
        ayahNo,
        label: `${getPlainSurahTitleLabel(resolvedSurahId)} · ${ayahNo}. ayet`
      }
    }

    if (!nextSurahId || !nextSurahAyahs.length) return null

    return {
      surahId: nextSurahId,
      ayahNo: nextSurahAyahs[0],
      label: `${getPlainSurahTitleLabel(nextSurahId)} · ${nextSurahAyahs[0]}. ayet`
    }
  }, [availableAyahs, effectiveScope, nextSurahAyahs, nextSurahId, resolvedAyahNo, resolvedSurahId])
  const previousSurahTarget = useMemo(() => {
    if (effectiveScope !== 'surah' || !prevSurahId) return null
    return {
      surahId: prevSurahId,
      label: getPlainSurahTitleLabel(prevSurahId)
    }
  }, [effectiveScope, prevSurahId])
  const nextSurahTarget = useMemo(() => {
    if (effectiveScope !== 'surah' || !nextSurahId) return null
    return {
      surahId: nextSurahId,
      label: getPlainSurahTitleLabel(nextSurahId)
    }
  }, [effectiveScope, nextSurahId])
  const visibleExpandedSurahIds = useMemo(() => {
    if (expandedSurahIds !== null) return expandedSurahIds
    return effectiveScope === 'verse' ? [resolvedSurahId] : []
  }, [effectiveScope, expandedSurahIds, resolvedSurahId])
  const textMode = normalizeTextMode(settings.textMode, settings.showTajweed)
  const showDiacritics = textMode !== 'plain'
  const arabicFontFamily = getArabicFontFamily(settings.arabicFont)
  const arabicFontSize = getArabicFontSize(settings)
  const transcriptionFontSize = getTranscriptionFontSize(settings)
  const translationFontSize = getTranslationFontSize(settings)
  const selectedVerseArabicHtml = useMemo(
    () => normalizeArabicDisplayText(getVerseTextByMode(selectedVerse, textMode)),
    [selectedVerse, textMode]
  )
  const selectedSurahVerses = useMemo(() => selectedSurah?.verses || [], [selectedSurah])
  const surahContentBlocks = useMemo(() => {
    if (effectiveScope !== 'surah' || typeof window === 'undefined' || !formattedHtml) return []

    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(`<div id="root">${formattedHtml}</div>`, 'text/html')
      const root = doc.querySelector('#root')
      if (!root) return []
      const contentRoot =
        root.childElementCount === 1 && root.firstElementChild?.classList?.contains('tafsir-content-wrapper')
          ? root.firstElementChild
          : root

      const verseMap = new Map(selectedSurahVerses.map((verse) => [Number(verse.verse_number), verse]))
      const blocks = []
      let currentAyahNo = null
      let currentBodyHtml = ''

      const pushCurrent = () => {
        const normalizedBodyHtml = currentBodyHtml.trim()
        if (!normalizedBodyHtml && !currentAyahNo) return
        blocks.push({
          ayahNo: currentAyahNo,
          verse: currentAyahNo ? verseMap.get(currentAyahNo) || null : null,
          bodyHtml: normalizedBodyHtml
        })
      }

      Array.from(contentRoot.childNodes).forEach((node) => {
        const markerAyahNo = getAyahMarkerNumber(node)

        if (markerAyahNo) {
          pushCurrent()
          currentAyahNo = markerAyahNo
          currentBodyHtml = ''
          return
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          currentBodyHtml += node.outerHTML
        } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          currentBodyHtml += `<p>${node.textContent.trim()}</p>`
        }
      })

      pushCurrent()
      return blocks.filter((block) => block.ayahNo || block.bodyHtml)
    } catch {
      return []
    }
  }, [effectiveScope, formattedHtml, selectedSurahVerses])
  const tafsirSpeechSegments = useMemo(() => {
    if (!isTafsirBook || !formattedHtml) return []

    if (effectiveScope === 'surah' && surahContentBlocks.length > 0) {
      return surahContentBlocks
        .map((block, index) => {
          const spokenBody = stripHtmlForSpeech(block.bodyHtml)
          if (!spokenBody) return null

          const label = block.ayahNo
            ? `${getPlainSurahTitleLabel(resolvedSurahId)} · ${block.ayahNo}. ayet`
            : `${getPlainSurahTitleLabel(resolvedSurahId)} · giriş`
          const leadText = label

          return {
            text: buildSpeechSegmentText([leadText, spokenBody]),
            title: label,
            shortLabel: block.ayahNo ? `${block.ayahNo}. ayet` : 'Giriş',
            ayahNo: block.ayahNo || 0,
            sectionIndex: index,
            highlightLeadWordCount: countSpeechWords(leadText),
            highlightBodyWordCount: countSpeechWords(spokenBody)
          }
        })
        .filter(Boolean)
    }

    return displaySections
      .map((section, index) => {
        const spokenBody = stripHtmlForSpeech(section.bodyHtml)
        if (!spokenBody) return null

        const referenceLabel = `${getPlainSurahTitleLabel(resolvedSurahId)} · ${resolvedAyahNo}. ayet`
        const title = section.title || referenceLabel
        const leadText = buildSpeechSegmentText([referenceLabel, section.title])

        return {
          text: buildSpeechSegmentText([leadText, spokenBody]),
          title,
          shortLabel: section.title || `Bölüm ${index + 1}`,
          ayahNo: resolvedAyahNo,
          sectionIndex: index,
          highlightLeadWordCount: countSpeechWords(leadText),
          highlightBodyWordCount: countSpeechWords(spokenBody)
        }
      })
      .filter(Boolean)
  }, [displaySections, effectiveScope, formattedHtml, isTafsirBook, resolvedAyahNo, resolvedSurahId, surahContentBlocks])
  const isActiveTafsirPlayback = useMemo(() => (
    playerMode === 'tts'
    && playerMeta?.context === 'tafsir'
    && playerMeta?.bookId === (book?.id || '')
    && Number(playerMeta?.surahId || 0) === Number(resolvedSurahId)
    && playerMeta?.tafsirScope === effectiveScope
    && (effectiveScope !== 'verse' || Number(playerMeta?.tafsirAyahNo || 0) === Number(resolvedAyahNo))
  ), [book?.id, effectiveScope, playerMeta, playerMode, resolvedAyahNo, resolvedSurahId])
  const currentTafsirSegmentIndex = isActiveTafsirPlayback ? playerTrackIndex : -1
  const activeTrackProgressRatio = useMemo(() => {
    if (!isActiveTafsirPlayback || !playerDuration || playerDuration <= 0) return 0
    const ratio = Math.max(0, Math.min(1, playerCurrentTime / playerDuration))
    // Re-render frekansini dusurup titremeyi azaltmak icin adimlayalim.
    return Math.round(ratio * 32) / 32
  }, [isActiveTafsirPlayback, playerCurrentTime, playerDuration])
  const getSectionHighlightRatio = (index) => {
    if (!isActiveTafsirPlayback) return 0
    if (index < currentTafsirSegmentIndex) return 1
    if (index !== currentTafsirSegmentIndex) return 0

    const segment = tafsirSpeechSegments[index]
    if (!segment) return activeTrackProgressRatio

    const leadWordCount = Math.max(0, Number(segment.highlightLeadWordCount || 0))
    const bodyWordCount = Math.max(1, Number(segment.highlightBodyWordCount || 1))
    const totalWordCount = leadWordCount + bodyWordCount
    if (totalWordCount <= 0) return activeTrackProgressRatio

    const bodyRatio = ((activeTrackProgressRatio * totalWordCount) - leadWordCount) / bodyWordCount
    return Math.max(0, Math.min(1, bodyRatio))
  }
  const getSectionPlaybackState = (index) => {
    if (!isActiveTafsirPlayback) return 'idle'
    if (index < currentTafsirSegmentIndex) return 'spoken'
    if (index === currentTafsirSegmentIndex) return 'speaking'
    return 'idle'
  }
  const canPlayTafsirSpeech = isTafsirSpeechSupported() && tafsirSpeechSegments.length > 0
  const isTafsirSpeechPaused = isActiveTafsirPlayback && !playerIsPlaying
  const tafsirVoiceRate = Number(settings.tafsirVoiceRate || 1)
  const tafsirPlaybackMeta = useMemo(() => ({
    surahNameAr: book?.titleAr || '',
    surahNameTr: currentReferenceLabel,
    surahNameEn: book?.titleTr || '',
    surahType: effectiveScope === 'verse' ? 'Ayet Tefsiri' : 'Süre Tefsiri',
    ayahCount: tafsirSpeechSegments.length,
    playingType: 'turkish',
    link: `/kutuphane/${book?.id || ''}`,
    surahId: resolvedSurahId,
    ayahNo: 0,
    tafsirAyahNo: effectiveScope === 'verse' ? resolvedAyahNo : 0,
    context: 'tafsir',
    bookId: book?.id || '',
    tafsirScope: effectiveScope
  }), [book?.id, book?.titleAr, book?.titleTr, currentReferenceLabel, effectiveScope, resolvedAyahNo, resolvedSurahId, tafsirSpeechSegments.length])

  const resetReaderPosition = () => {
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  const handleTafsirListen = () => {
    if (!canPlayTafsirSpeech) return

    if (isActiveTafsirPlayback) {
      togglePlay()
      return
    }

    playTafsirPlaylist(tafsirSpeechSegments, 0, tafsirPlaybackMeta, settings)
  }

  const handleTafsirStop = () => {
    stopPlayback({ resetMode: true })
  }

  const handleTafsirWordClick = (event, sectionIndex) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return

    const token = target.closest('.tefsir-spoken-word')
    if (!(token instanceof HTMLElement)) return

    const wordIndex = Math.max(1, Number(token.dataset.wordIndex || 1))
    const wordTotal = Math.max(1, Number(token.dataset.wordTotal || 1))
    const wordRatio = Math.max(0, Math.min(1, (wordIndex - 1) / wordTotal))

    if (!isActiveTafsirPlayback || currentTafsirSegmentIndex !== sectionIndex) {
      playTafsirPlaylist(tafsirSpeechSegments, sectionIndex, tafsirPlaybackMeta, settings, { startRatio: wordRatio })
      return
    }

    seekTafsirSpeechByRatio(wordRatio)
  }

  const cycleTafsirVoiceRate = () => {
    const nextRate = tafsirVoiceRate === 1 ? 1.15 : tafsirVoiceRate === 1.15 ? 1.3 : tafsirVoiceRate === 1.3 ? 1.5 : 1
    updateSettings({ tafsirVoiceRate: nextRate })
  }

  const handleScopeChange = (scope) => {
    setActiveScope(scope)
    if (scope === 'verse') {
      setExpandedSurahIds((value) => (value === null ? [resolvedSurahId] : value))
    }
    resetReaderPosition()
  }

  const handleSurahSelect = (surahId) => {
    setActiveSurahId(surahId)
    setExpandedSurahIds((value) => {
      const current = value ?? []
      return current.includes(surahId) ? current : [...current, surahId]
    })
    resetReaderPosition()
  }

  const handleAyahSelect = (surahId, ayahNo) => {
    setActiveSurahId(surahId)
    setActiveAyahNo(ayahNo)
    setExpandedSurahIds((value) => {
      const current = value ?? []
      return current.includes(surahId) ? current : [...current, surahId]
    })
    resetReaderPosition()
  }

  const toggleSurahExpansion = (surahId) => {
    setExpandedSurahIds((value) => {
      const current = value ?? [resolvedSurahId]
      return current.includes(surahId) ? current.filter((id) => id !== surahId) : [...current, surahId]
    })
  }

  const handleReaderAdvance = () => {
    if (effectiveScope === 'verse' && nextVerseTarget) {
      setActiveSurahId(nextVerseTarget.surahId)
      setActiveAyahNo(nextVerseTarget.ayahNo)
      setExpandedSurahIds((value) => {
        const current = value ?? []
        return current.includes(nextVerseTarget.surahId) ? current : [...current, nextVerseTarget.surahId]
      })
      resetReaderPosition()
      return
    }

    if (effectiveScope === 'surah' && nextSurahTarget) {
      setActiveSurahId(nextSurahTarget.surahId)
      setExpandedSurahIds((value) => {
        const current = value ?? []
        return current.includes(nextSurahTarget.surahId) ? current : [...current, nextSurahTarget.surahId]
      })
      resetReaderPosition()
    }
  }
  const handleReaderRetreat = () => {
    if (effectiveScope === 'verse' && previousVerseTarget) {
      setActiveSurahId(previousVerseTarget.surahId)
      setActiveAyahNo(previousVerseTarget.ayahNo)
      setExpandedSurahIds((value) => {
        const current = value ?? []
        return current.includes(previousVerseTarget.surahId) ? current : [...current, previousVerseTarget.surahId]
      })
      resetReaderPosition()
      return
    }

    if (effectiveScope === 'surah' && previousSurahTarget) {
      setActiveSurahId(previousSurahTarget.surahId)
      setExpandedSurahIds((value) => {
        const current = value ?? []
        return current.includes(previousSurahTarget.surahId) ? current : [...current, previousSurahTarget.surahId]
      })
      resetReaderPosition()
    }
  }

  useEffect(() => {
    if (playerMode !== 'tts' || playerMeta?.context !== 'tafsir') return
    if (playerMeta?.bookId !== book?.id) return

    const hasScopeChanged = playerMeta?.tafsirScope !== effectiveScope
    const hasSurahChanged = Number(playerMeta?.surahId || 0) !== Number(resolvedSurahId)
    const hasAyahChanged = effectiveScope === 'verse' && Number(playerMeta?.tafsirAyahNo || 0) !== Number(resolvedAyahNo)

    if (hasScopeChanged || hasSurahChanged || hasAyahChanged) {
      stopPlayback({ resetMode: true })
    }
  }, [book?.id, effectiveScope, playerMeta, playerMode, resolvedAyahNo, resolvedSurahId, stopPlayback])

  useEffect(() => {
    if (!isActiveTafsirPlayback || currentTafsirSegmentIndex < 0) return
    const activeSection = document.getElementById(`bolum-${currentTafsirSegmentIndex + 1}`)
    activeSection?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [currentTafsirSegmentIndex, isActiveTafsirPlayback])
  const isReaderLoading = isManifestLoading || isSurahLoading || (effectiveScope === 'surah' && isSelectedSurahLoading)
  const readerErrorMessage = manifestError
    ? 'Kütüphane manifesti yüklenemedi.'
    : surahError
      ? 'Seçilen sûre içeriği yüklenemedi.'
      : ''

  if (!book) {
    return (
      <div className="page kutuphane-page book-detail-page">
        <GlobalNav />
        <div className="page-content">
          <div className="empty-state">
            <h2>Kitap bulunamadı</h2>
            <p>Seçilen kitap kaydı sistemde yok.</p>
            <Link to="/kutuphane" className="meal-quick-link">Kütüphaneye Dön</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page kutuphane-page book-detail-page">
      <GlobalNav />
      <div className="page-content">
        <section className="reader-panel">
          {isTafsirBook ? (
            <div className="book-reader-layout">
              <aside className="reader-sidebar hidden-mobile">
                <div className="reader-sidebar-intro">
                  <span className="reader-sidebar-brand">Kütüphane</span>
                  <strong>{book.titleTr}</strong>
                  <p>{book.authorTr}</p>
                  <small>{currentReferenceLabel}</small>
                </div>

                <div className="reader-sidebar-block reader-sidebar-controls">
                  <span className="reader-sidebar-title">Görünüm</span>
                  <div
                    className={`reader-scope-toggle ${effectiveScope === 'verse' ? 'scope-verse' : 'scope-surah'}`}
                    role="tablist"
                    aria-label="Görünüm seçimi"
                  >
                    <span className="reader-scope-toggle-indicator" aria-hidden="true" />
                    <button
                      type="button"
                      className={effectiveScope === 'verse' ? 'active' : ''}
                      onClick={() => handleScopeChange('verse')}
                    >
                      Ayet
                    </button>
                    <button
                      type="button"
                      className={effectiveScope === 'surah' ? 'active' : ''}
                      onClick={() => handleScopeChange('surah')}
                    >
                      Sûre
                    </button>
                  </div>
                </div>

                <div className="reader-sidebar-block">
                  <p className="reader-sidebar-title">İçindekiler</p>
                  <div className="reader-sidebar-sections">
                    {surahNavigationItems.map((item) => {
                      const isActiveSurah = Number(resolvedSurahId) === Number(item.surahId)
                      const isExpanded = effectiveScope === 'verse' && visibleExpandedSurahIds.includes(item.surahId)

                      return (
                        <div key={item.surahId} className={`reader-sidebar-group ${isActiveSurah ? 'active' : ''}`}>
                          <div className="reader-sidebar-group-row">
                            <button
                              type="button"
                              className={`reader-sidebar-surah ${isActiveSurah ? 'active' : ''}`}
                              onClick={() => handleSurahSelect(item.surahId)}
                            >
                              <span>{item.label}</span>
                              <span className="reader-sidebar-surah-no">{item.numberLabel}</span>
                            </button>
                            {item.ayahs.length > 0 && (
                              <button
                                type="button"
                                className={`reader-sidebar-toggle ${isExpanded ? 'open' : ''} ${effectiveScope !== 'verse' ? 'is-hidden' : ''}`}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  if (effectiveScope !== 'verse') return
                                  toggleSurahExpansion(item.surahId)
                                }}
                                aria-label={`${item.label} ayetlerini ${isExpanded ? 'gizle' : 'göster'}`}
                                aria-hidden={effectiveScope !== 'verse'}
                                tabIndex={effectiveScope !== 'verse' ? -1 : 0}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                              </button>
                            )}
                          </div>

                          {effectiveScope === 'verse' && isExpanded && item.ayahs.length > 0 && (
                            <div className="reader-sidebar-ayahs">
                              {item.ayahs.map((ayahNo) => (
                                <button
                                  key={`${item.surahId}-${ayahNo}`}
                                  type="button"
                                  className={Number(resolvedSurahId) === Number(item.surahId) && Number(resolvedAyahNo) === Number(ayahNo) ? 'active' : ''}
                                  onClick={() => handleAyahSelect(item.surahId, ayahNo)}
                                >
                                  {ayahNo}. ayet
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </aside>

              <div className="reader-main">
                <div className="reader-back-row">
                  <Link to="/kutuphane" className="back-link hidden-mobile">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    <span>Kütüphane</span>
                  </Link>
                </div>

                <div className="reader-head">
                  <div>
                    <small className="reader-overline">{book.authorTr}</small>
                    <h2>{book.titleTr}</h2>
                    <p>{book.titleAr}</p>
                  </div>
                  <div className="reader-head-side">
                    <small className="reader-kicker">{currentReferenceLabel}</small>
                  </div>
                </div>

                {effectiveScope === 'surah' && (
                  <div className="reader-surah-summary">
                    <span className="reader-surah-summary-no">{readerSurahDetails.surahNo}</span>
                    <div className="reader-surah-summary-content">
                      {readerSurahDetails.surahNameAr && (
                        <p className="reader-surah-summary-ar" dir="rtl">
                          {resolveArabicTextVisibility(readerSurahDetails.surahNameAr, showDiacritics)}
                        </p>
                      )}
                      <div className="reader-surah-summary-row">
                        <h3 className="reader-surah-summary-tr">{readerSurahDetails.surahNameTr}</h3>
                        {readerSurahDetails.surahType && (
                          <span className={`surah-type-badge ${readerSurahDetails.surahType.toLocaleLowerCase('tr-TR')}`}>
                            {readerSurahDetails.surahType.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="reader-surah-summary-meta">
                        {readerSurahDetails.surahNameEn || `Surah ${readerSurahDetails.surahNo}`}
                        {readerSurahDetails.ayahCount ? ` · ${readerSurahDetails.ayahCount} ayet` : ''}
                      </p>
                    </div>
                  </div>
                )}

                <div className="reader-audio-bar">
                  <div className="reader-audio-bar-copy">
                    <span className="reader-sidebar-title">Dinleme</span>
                    <strong>Tefsiri Türkçe seslendir</strong>
                  </div>
                  <div className="audio-control-group tafsir-audio-controls">
                    <button
                      type="button"
                      className={`surah-audio-btn turkish ${isActiveTafsirPlayback && playerIsPlaying ? 'playing' : ''}`}
                      onClick={handleTafsirListen}
                      disabled={!canPlayTafsirSpeech}
                    >
                      {isActiveTafsirPlayback && !isTafsirSpeechPaused ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                      )}
                      {isActiveTafsirPlayback ? (isTafsirSpeechPaused ? 'Devam Et' : 'Duraklat') : 'Türkçe'}
                    </button>
                    <button type="button" className="speed-toggle active" onClick={cycleTafsirVoiceRate}>
                      {tafsirVoiceRate.toFixed(2)}x
                    </button>
                    {isActiveTafsirPlayback && (
                      <button type="button" className="surah-audio-btn player-toggle" onClick={handleTafsirStop} title="Durdur">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <div className="reader-toolbar">
                  <span className="reader-sidebar-title">Görünüm</span>
                  <div
                    className={`reader-scope-toggle ${effectiveScope === 'verse' ? 'scope-verse' : 'scope-surah'}`}
                    role="tablist"
                    aria-label="Görünüm seçimi"
                  >
                    <span className="reader-scope-toggle-indicator" aria-hidden="true" />
                    <button
                      type="button"
                      className={effectiveScope === 'verse' ? 'active' : ''}
                      onClick={() => handleScopeChange('verse')}
                    >
                      Ayet
                    </button>
                    <button
                      type="button"
                      className={effectiveScope === 'surah' ? 'active' : ''}
                      onClick={() => handleScopeChange('surah')}
                    >
                      Sûre
                    </button>
                  </div>
                </div>

                {readerErrorMessage ? (
                  <div className="empty-state">
                    <h2>Yükleme hatası</h2>
                    <p>{readerErrorMessage}</p>
                  </div>
                ) : isReaderLoading ? (
                  <div className="empty-state">
                    <h2>İçerik yükleniyor</h2>
                    <p>Seçilen kitap ve sûre için tefsir getiriliyor.</p>
                  </div>
                ) : !availableSurahIds.length ? (
                  <div className="empty-state">
                    <h2>Veri bulunamadı</h2>
                    <p>Bu kitap için henüz kullanılabilir sûre verisi yok.</p>
                  </div>
                ) : !rawTafsirHtml ? (
                  <div className="empty-state">
                    <h2>İçerik bulunamadı</h2>
                    <p>Seçilen sûre/ayet için bu kitapta veri yok.</p>
                  </div>
                ) : (
                  <>
                    {effectiveScope === 'verse' && (
                      <section className="reader-verse-panel">
                        {isVerseLoading ? (
                          <div className="reader-verse-card reader-verse-card-loading">
                            <span className="reader-verse-label">Ayet Metni</span>
                            <p>Ayet yükleniyor...</p>
                          </div>
                        ) : selectedVerse ? (
                          <div className="reader-verse-card">
                            <div className="reader-verse-meta">
                              <span className="reader-verse-label">Ayet Metni</span>
                              <strong>{getPlainSurahTitleLabel(resolvedSurahId)} · {resolvedAyahNo}. ayet</strong>
                            </div>
                            <div
                              className="reader-verse-arabic"
                              style={{ fontSize: `${arabicFontSize}px`, fontFamily: arabicFontFamily }}
                              dangerouslySetInnerHTML={{ __html: selectedVerseArabicHtml }}
                            />
                            {selectedVerse.transcription && (
                              <p className="reader-verse-transcription" style={{ fontSize: `${transcriptionFontSize}px` }}>
                                {selectedVerse.transcription}
                              </p>
                            )}
                            <p className="reader-verse-translation" style={{ fontSize: `${translationFontSize}px` }}>
                              {selectedVerse.translation?.text || 'Bu ayet için Türkçe meal bulunamadı.'}
                            </p>
                          </div>
                        ) : null}
                      </section>
                    )}

                    <section className="tefsir-sections">
                      {effectiveScope === 'surah' && surahContentBlocks.length > 0
                        ? surahContentBlocks.map((block, index) => {
                          const verseArabicHtml = block.verse
                            ? normalizeArabicDisplayText(getVerseTextByMode(block.verse, textMode))
                            : ''
                          const sectionPlaybackState = getSectionPlaybackState(index)
                          const sectionBodyHtml = sectionPlaybackState === 'speaking'
                            ? highlightSpokenWordsInHtml(block.bodyHtml, getSectionHighlightRatio(index))
                            : block.bodyHtml

                          return (
                            <article
                              key={`surah-block-${block.ayahNo || 'intro'}-${index}`}
                              id={`bolum-${index + 1}`}
                              className={`tefsir-section-card ${sectionPlaybackState === 'speaking' ? 'is-speaking' : ''} ${sectionPlaybackState === 'spoken' ? 'is-spoken' : ''}`}
                            >
                              {block.verse && (
                                <div className="reader-inline-verse-card">
                                  <div className="reader-verse-meta">
                                    <span className="reader-verse-label">{block.verse.verse_number}. ayet</span>
                                    <strong>{getPlainSurahTitleLabel(resolvedSurahId)} · {block.verse.verse_number}. ayet</strong>
                                  </div>
                                  <div
                                    className="reader-verse-arabic"
                                    style={{ fontSize: `${arabicFontSize}px`, fontFamily: arabicFontFamily }}
                                    dangerouslySetInnerHTML={{ __html: verseArabicHtml }}
                                  />
                                  {block.verse.transcription && (
                                    <p className="reader-verse-transcription" style={{ fontSize: `${transcriptionFontSize}px` }}>
                                      {block.verse.transcription}
                                    </p>
                                  )}
                                  <p className="reader-verse-translation" style={{ fontSize: `${translationFontSize}px` }}>
                                    {block.verse.translation?.text || 'Bu ayet için Türkçe meal bulunamadı.'}
                                  </p>
                                </div>
                              )}
                              {block.bodyHtml && (
                                <div
                                  className="tefsirler-rich"
                                  onClick={sectionPlaybackState === 'speaking' ? (event) => handleTafsirWordClick(event, index) : undefined}
                                  dangerouslySetInnerHTML={{
                                    __html: sectionBodyHtml
                                  }}
                                />
                              )}
                            </article>
                          )
                        })
                        : displaySections.map((section, index) => {
                          const sectionPlaybackState = getSectionPlaybackState(index)
                          const sectionBodyHtml = sectionPlaybackState === 'speaking'
                            ? highlightSpokenWordsInHtml(section.bodyHtml, getSectionHighlightRatio(index))
                            : section.bodyHtml

                          return (
                            <article
                              key={`${section.title}-${index}`}
                              id={`bolum-${index + 1}`}
                              className={`tefsir-section-card ${sectionPlaybackState === 'speaking' ? 'is-speaking' : ''} ${sectionPlaybackState === 'spoken' ? 'is-spoken' : ''}`}
                            >
                              {section.title && <span className="tefsir-section-index">{String(index + 1).padStart(2, '0')}</span>}
                              {section.title && <h3>{section.title}</h3>}
                              <div
                                className="tefsirler-rich"
                                onClick={sectionPlaybackState === 'speaking' ? (event) => handleTafsirWordClick(event, index) : undefined}
                                dangerouslySetInnerHTML={{
                                  __html: sectionBodyHtml
                                }}
                              />
                            </article>
                          )
                        })}
                    </section>
                  </>
                )}

                {(previousVerseTarget || nextVerseTarget || previousSurahTarget || nextSurahTarget) && (
                  <div className="reader-next-nav">
                    <div className="reader-next-nav-grid">
                      {(effectiveScope === 'verse' ? previousVerseTarget : previousSurahTarget) ? (
                        <button type="button" className="reader-next-nav-link prev" onClick={handleReaderRetreat}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><path d="M11 19l-7-7 7-7" /></svg>
                          <span>
                            <span className="reader-next-nav-label">
                              {effectiveScope === 'verse' ? 'Önceki ayet' : 'Önceki sûre'}
                            </span>
                            <strong>{effectiveScope === 'verse' ? previousVerseTarget?.label : previousSurahTarget?.label}</strong>
                          </span>
                        </button>
                      ) : <span />}

                      {(effectiveScope === 'verse' ? nextVerseTarget : nextSurahTarget) ? (
                        <button type="button" className="reader-next-nav-link next" onClick={handleReaderAdvance}>
                          <span>
                            <span className="reader-next-nav-label">
                              {effectiveScope === 'verse' ? 'Sonraki ayet' : 'Sonraki sûre'}
                            </span>
                            <strong>{effectiveScope === 'verse' ? nextVerseTarget?.label : nextSurahTarget?.label}</strong>
                          </span>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 5l7 7-7 7" /></svg>
                        </button>
                      ) : <span />}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="reader-back-row">
                <Link to="/kutuphane" className="back-link hidden-mobile">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                  <span>Kütüphane</span>
                </Link>
              </div>

              <div className="reader-head">
                <div>
                  <small className="reader-overline">{book.authorTr}</small>
                  <h2>{book.titleTr}</h2>
                  <p>{book.titleAr}</p>
                </div>
                <small className="reader-kicker">{currentReferenceLabel}</small>
              </div>

              <div className="meal-reader-placeholder">
                <p><strong>{book.titleTr}</strong> için meal odaklı kitap sayfası sonraki adımda genişletilecek.</p>
                <p>Şu an meal okumaya ayet ekranından devam edebilirsin.</p>
                <Link to="/sure/1/1" className="meal-quick-link">Örnek Meal Sayfası</Link>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}




