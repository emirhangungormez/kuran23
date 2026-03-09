import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import GlobalNav from '../components/GlobalNav'
import { TAFSIR_SOURCES } from '../data/tafsirSources'
import { TEFSIRKUTUPHANESI_FATIHA_DATA } from '../data/tefsirkutuphanesiFatihaData'
import { surahs as allSurahs } from '../data/quranData'
import { formatTafsirRichText } from '../utils/tafsirFormatting'
import './TefsirlerPage.css'

const LIBRARY_SOURCES = TAFSIR_SOURCES.filter((source) => source.id !== 'kuran23' && source.id !== 'diyanet')
const LIBRARY_CONTENT = TEFSIRKUTUPHANESI_FATIHA_DATA?.content || {}

function getSurahIds(sourceData) {
  const ids = new Set()

  Object.keys(sourceData?.surah || {}).forEach((key) => {
    const parsed = Number(key)
    if (Number.isInteger(parsed) && parsed > 0) ids.add(parsed)
  })

  Object.keys(sourceData?.verse || {}).forEach((key) => {
    const [sid] = String(key).split(':')
    const parsed = Number(sid)
    if (Number.isInteger(parsed) && parsed > 0) ids.add(parsed)
  })

  return Array.from(ids).sort((a, b) => a - b)
}

function getAyahNumbers(sourceData, surahId) {
  return Object.keys(sourceData?.verse || {})
    .map((key) => {
      const [sid, ayah] = String(key).split(':')
      return Number(sid) === Number(surahId) ? Number(ayah) : null
    })
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((a, b) => a - b)
}

function splitIntoSections(formattedHtml) {
  if (!formattedHtml) return []
  if (typeof window === 'undefined') return [{ title: '1. Bölüm', bodyHtml: formattedHtml }]

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div id="root">${formattedHtml}</div>`, 'text/html')
    const root = doc.querySelector('#root')
    if (!root) return [{ title: '1. Bölüm', bodyHtml: formattedHtml }]

    const sections = []
    let current = null

    const pushCurrent = () => {
      if (!current) return
      const normalized = (current.bodyHtml || '').trim()
      if (!normalized) return
      sections.push({
        title: current.title || `${sections.length + 1}. Bölüm`,
        bodyHtml: normalized
      })
    }

    Array.from(root.childNodes).forEach((node) => {
      const tagName = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toLowerCase() : ''
      const isHeading = tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4'

      if (isHeading) {
        pushCurrent()
        current = {
          title: (node.textContent || '').trim() || `${sections.length + 1}. Bölüm`,
          bodyHtml: ''
        }
        return
      }

      if (!current) {
        current = {
          title: '1. Bölüm',
          bodyHtml: ''
        }
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        current.bodyHtml += node.outerHTML
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        current.bodyHtml += `<p>${node.textContent.trim()}</p>`
      }
    })

    pushCurrent()
    return sections.length ? sections : [{ title: '1. Bölüm', bodyHtml: formattedHtml }]
  } catch {
    return [{ title: '1. Bölüm', bodyHtml: formattedHtml }]
  }
}

function getSurahTitle(surahId) {
  const match = allSurahs.find((surah) => Number(surah.no) === Number(surahId))
  if (!match) return `Sure ${surahId}`
  return `${match.nameTr} (${match.no})`
}

export default function TefsirlerPage() {
  const [activeDesign, setActiveDesign] = useState('sectioned')
  const [activeSourceId, setActiveSourceId] = useState(LIBRARY_SOURCES[0]?.id || '')
  const [activeScope, setActiveScope] = useState('verse')
  const [activeSurahId, setActiveSurahId] = useState(1)
  const [activeAyahNo, setActiveAyahNo] = useState(1)
  const [pageIndex, setPageIndex] = useState(0)
  const [dragStartX, setDragStartX] = useState(null)
  const [dragOffset, setDragOffset] = useState(0)

  const sourceMeta = useMemo(
    () => LIBRARY_SOURCES.find((source) => source.id === activeSourceId) || null,
    [activeSourceId]
  )

  const sourceData = useMemo(
    () => LIBRARY_CONTENT[activeSourceId] || { surah: {}, verse: {} },
    [activeSourceId]
  )

  const availableSurahIds = useMemo(() => getSurahIds(sourceData), [sourceData])
  const availableAyahs = useMemo(() => getAyahNumbers(sourceData, activeSurahId), [sourceData, activeSurahId])

  useEffect(() => {
    if (!availableSurahIds.length) return
    if (!availableSurahIds.includes(Number(activeSurahId))) {
      setActiveSurahId(availableSurahIds[0])
    }
  }, [availableSurahIds, activeSurahId])

  useEffect(() => {
    if (!availableAyahs.length) {
      setActiveAyahNo(1)
      return
    }
    if (!availableAyahs.includes(Number(activeAyahNo))) {
      setActiveAyahNo(availableAyahs[0])
    }
  }, [availableAyahs, activeAyahNo])

  useEffect(() => {
    setPageIndex(0)
  }, [activeDesign, activeSourceId, activeScope, activeSurahId, activeAyahNo])

  const rawTafsirHtml = useMemo(() => {
    if (activeScope === 'surah') {
      return sourceData?.surah?.[activeSurahId] || ''
    }
    return sourceData?.verse?.[`${activeSurahId}:${activeAyahNo}`] || ''
  }, [activeScope, activeSurahId, activeAyahNo, sourceData])

  const formattedHtml = useMemo(
    () => formatTafsirRichText(rawTafsirHtml, { context: activeScope, surahId: activeSurahId, ayahNo: activeAyahNo }),
    [rawTafsirHtml, activeScope, activeSurahId, activeAyahNo]
  )

  const sections = useMemo(() => splitIntoSections(formattedHtml), [formattedHtml])
  const pages = useMemo(
    () => (sections.length ? sections : [{ title: '1. Bölüm', bodyHtml: '<p>Bu seçim için tefsir bulunamadı.</p>' }]),
    [sections]
  )

  const boundedPageIndex = Math.max(0, Math.min(pageIndex, pages.length - 1))
  const currentPage = pages[boundedPageIndex]
  const prevPage = pages[boundedPageIndex - 1] || null
  const canGoPrev = boundedPageIndex > 0
  const canGoNext = boundedPageIndex < pages.length - 1

  const handlePointerDown = (event) => {
    setDragStartX(event.clientX)
    setDragOffset(0)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event) => {
    if (dragStartX === null) return
    const delta = event.clientX - dragStartX
    const clamped = Math.max(-220, Math.min(220, delta))
    setDragOffset(clamped)
  }

  const handlePointerUp = (event) => {
    if (dragStartX === null) return

    if (dragOffset <= -90 && canGoNext) {
      setPageIndex((value) => Math.min(value + 1, pages.length - 1))
    } else if (dragOffset >= 90 && canGoPrev) {
      setPageIndex((value) => Math.max(value - 1, 0))
    }

    setDragStartX(null)
    setDragOffset(0)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const dragRatio = Math.max(-1, Math.min(1, dragOffset / 220))
  const rightPageTransform = `translateX(${dragOffset}px) rotateY(${dragRatio * -52}deg)`

  return (
    <div className="page tefsirler-page">
      <GlobalNav />
      <div className="page-content">
        <div className="page-header-row">
          <Link to="/" className="back-link hidden-mobile">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            <span>Ana Sayfa</span>
          </Link>

          <div className="tefsirler-design-switch">
            <button
              className={`tefsirler-design-btn ${activeDesign === 'sectioned' ? 'active' : ''}`}
              onClick={() => setActiveDesign('sectioned')}
            >
              Liste Tasarım
            </button>
            <button
              className={`tefsirler-design-btn ${activeDesign === 'flip' ? 'active' : ''}`}
              onClick={() => setActiveDesign('flip')}
            >
              Kitap Çevirme
            </button>
          </div>
        </div>

        <section className="tefsirler-hero">
          <p className="tefsirler-hero-tag">Tefsir Kütüphanesi</p>
          <h1>Tüm Tefsirleri Kitap Gibi Oku</h1>
          <p>Her kaynak tek bir düzenle sunulur. Başlıklar otomatik numaralanır, ayet/sure tekrarları sadeleştirilir.</p>
        </section>

        <section className="tefsirler-shelf">
          {LIBRARY_SOURCES.map((source) => {
            const active = source.id === activeSourceId
            return (
              <button
                key={source.id}
                className={`tefsir-book-card ${active ? 'active' : ''}`}
                onClick={() => setActiveSourceId(source.id)}
              >
                <span className="book-spine">{source.bookId || '--'}</span>
                <div className="book-body">
                  <strong>{source.shortLabel}</strong>
                  <small>{source.tabLabel}</small>
                </div>
              </button>
            )
          })}
        </section>

        <section className="tefsirler-toolbar">
          <label>
            Görünüm
            <select value={activeScope} onChange={(event) => setActiveScope(event.target.value)}>
              <option value="verse">Ayet Bazlı</option>
              <option value="surah">Sure Bazlı</option>
            </select>
          </label>

          <label>
            Sure
            <select
              value={activeSurahId}
              onChange={(event) => setActiveSurahId(Number(event.target.value))}
            >
              {availableSurahIds.map((surahId) => (
                <option key={surahId} value={surahId}>
                  {getSurahTitle(surahId)}
                </option>
              ))}
            </select>
          </label>

          {activeScope === 'verse' && (
            <label>
              Ayet
              <select
                value={activeAyahNo}
                onChange={(event) => setActiveAyahNo(Number(event.target.value))}
              >
                {availableAyahs.map((ayah) => (
                  <option key={ayah} value={ayah}>
                    {ayah}. ayet
                  </option>
                ))}
              </select>
            </label>
          )}
        </section>

        {!rawTafsirHtml ? (
          <div className="empty-state">
            <h2>Seçilen içerik bulunamadı</h2>
            <p>Bu kaynakta seçilen sure/ayet için veri henüz eklenmemiş.</p>
          </div>
        ) : activeDesign === 'sectioned' ? (
          <section className="tefsir-sections">
            <div className="tefsir-reading-meta">
              <span>{sourceMeta?.tabLabel || 'Kaynak'}</span>
              <span>{getSurahTitle(activeSurahId)}</span>
              {activeScope === 'verse' && <span>{activeAyahNo}. ayet</span>}
            </div>

            {sections.map((section, index) => (
              <article key={`${section.title}-${index}`} className="tefsir-section-card">
                <h2>{section.title}</h2>
                <div
                  className="tefsirler-rich"
                  dangerouslySetInnerHTML={{ __html: section.bodyHtml }}
                />
              </article>
            ))}
          </section>
        ) : (
          <section className="tefsir-flip-wrapper">
            <div className="tefsir-reading-meta">
              <span>{sourceMeta?.tabLabel || 'Kaynak'}</span>
              <span>{getSurahTitle(activeSurahId)}</span>
              {activeScope === 'verse' && <span>{activeAyahNo}. ayet</span>}
            </div>

            <div className="flipbook-stage">
              <div
                className="flipbook"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              >
                <article className="flipbook-page flipbook-left">
                  {prevPage ? (
                    <>
                      <h3>{prevPage.title}</h3>
                      <div className="tefsirler-rich" dangerouslySetInnerHTML={{ __html: prevPage.bodyHtml }} />
                    </>
                  ) : (
                    <div className="flipbook-placeholder">Ön sayfa yok</div>
                  )}
                </article>

                <article
                  className={`flipbook-page flipbook-right ${dragStartX !== null ? 'dragging' : ''}`}
                  style={{
                    transform: rightPageTransform,
                    transformOrigin: dragOffset < 0 ? 'left center' : 'right center'
                  }}
                >
                  <h3>{currentPage?.title}</h3>
                  <div className="tefsirler-rich" dangerouslySetInnerHTML={{ __html: currentPage?.bodyHtml || '' }} />
                </article>
              </div>
            </div>

            <div className="flipbook-actions">
              <button disabled={!canGoPrev} onClick={() => setPageIndex((value) => Math.max(value - 1, 0))}>
                Önceki
              </button>
              <span>{boundedPageIndex + 1} / {pages.length}</span>
              <button disabled={!canGoNext} onClick={() => setPageIndex((value) => Math.min(value + 1, pages.length - 1))}>
                Sonraki
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

