import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import GlobalNav from '../components/GlobalNav'
import { formatTafsirRichText } from '../utils/tafsirFormatting'
import {
  getBookById,
  getSurahTitle,
  splitIntoSections
} from '../data/libraryBooks'
import {
  getAyahNumbersFromManifest,
  getRawTafsirHtml,
  getSurahIdsFromManifest,
  loadLibraryManifest,
  loadLibrarySurah
} from '../services/libraryContent'
import './TefsirlerPage.css'

export default function LibraryBookPage() {
  const { bookId } = useParams()
  const [activeDesign, setActiveDesign] = useState('sectioned')
  const [activeScope, setActiveScope] = useState('verse')
  const [activeSurahId, setActiveSurahId] = useState(1)
  const [activeAyahNo, setActiveAyahNo] = useState(1)
  const [pageIndex, setPageIndex] = useState(0)
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
  const [dragStartX, setDragStartX] = useState(null)
  const [dragOffset, setDragOffset] = useState(0)

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
  const pages = useMemo(
    () => (sections.length ? sections : [{ title: '', bodyHtml: '<p>Bu seçim için tefsir bulunamadı.</p>' }]),
    [sections]
  )
  const sidebarItems = useMemo(() => {
    if (effectiveScope === 'verse') {
      return availableAyahs.map((ayah) => ({
        id: `ayet-${ayah}`,
        label: `${ayah}. ayet`,
        ayahNo: ayah
      }))
    }

    return pages
      .map((page, index) => ({ id: `bolum-${index + 1}`, label: page.title, index }))
      .filter((item) => item.label)
  }, [availableAyahs, effectiveScope, pages])
  const currentReferenceLabel = useMemo(() => {
    if (effectiveScope === 'surah') return getSurahTitle(resolvedSurahId)
    return `${getSurahTitle(resolvedSurahId)} · ${resolvedAyahNo}. ayet`
  }, [effectiveScope, resolvedAyahNo, resolvedSurahId])
  const currentSurahIndex = useMemo(
    () => availableSurahIds.findIndex((surahId) => Number(surahId) === Number(resolvedSurahId)),
    [availableSurahIds, resolvedSurahId]
  )
  const nextSurahId = currentSurahIndex >= 0 ? availableSurahIds[currentSurahIndex + 1] || null : null
  const nextSurahAyahs = useMemo(
    () => (nextSurahId ? getAyahNumbersFromManifest(manifest, book?.sourceId || book?.id, nextSurahId) : []),
    [book?.id, book?.sourceId, manifest, nextSurahId]
  )
  const nextVerseTarget = useMemo(() => {
    if (effectiveScope !== 'verse') return null

    const currentAyahIndex = availableAyahs.findIndex((ayah) => Number(ayah) === Number(resolvedAyahNo))
    if (currentAyahIndex >= 0 && currentAyahIndex < availableAyahs.length - 1) {
      const ayahNo = availableAyahs[currentAyahIndex + 1]
      return {
        surahId: resolvedSurahId,
        ayahNo,
        label: `${getSurahTitle(resolvedSurahId)} · ${ayahNo}. ayet`
      }
    }

    if (!nextSurahId || !nextSurahAyahs.length) return null

    return {
      surahId: nextSurahId,
      ayahNo: nextSurahAyahs[0],
      label: `${getSurahTitle(nextSurahId)} · ${nextSurahAyahs[0]}. ayet`
    }
  }, [availableAyahs, effectiveScope, nextSurahAyahs, nextSurahId, resolvedAyahNo, resolvedSurahId])
  const nextSurahTarget = useMemo(() => {
    if (effectiveScope !== 'surah' || !nextSurahId) return null
    return {
      surahId: nextSurahId,
      label: getSurahTitle(nextSurahId)
    }
  }, [effectiveScope, nextSurahId])

  const boundedPageIndex = Math.max(0, Math.min(pageIndex, pages.length - 1))
  const currentPage = pages[boundedPageIndex]
  const prevPage = pages[boundedPageIndex - 1] || null
  const canGoPrev = boundedPageIndex > 0
  const canGoNext = boundedPageIndex < pages.length - 1

  useEffect(() => {
    if (activeDesign !== 'sectioned') return

    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return

    const sectionNodes = Array.from(document.querySelectorAll('.tefsir-section-card[data-section-index]'))
    if (!sectionNodes.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (!visibleEntries.length) return

        const index = Number(visibleEntries[0].target.getAttribute('data-section-index') || 0)
        if (Number.isFinite(index)) setActiveSectionIndex(index)
      },
      {
        rootMargin: '-12% 0px -70% 0px',
        threshold: [0.15, 0.35, 0.6]
      }
    )

    sectionNodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [activeDesign, boundedPageIndex, pages])

  const handlePointerDown = (event) => {
    setDragStartX(event.clientX)
    setDragOffset(0)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handlePointerMove = (event) => {
    if (dragStartX === null) return
    const delta = event.clientX - dragStartX
    setDragOffset(Math.max(-220, Math.min(220, delta)))
  }

  const handlePointerUp = (event) => {
    if (dragStartX === null) return
    if (dragOffset <= -90 && canGoNext) setPageIndex((value) => Math.min(value + 1, pages.length - 1))
    if (dragOffset >= 90 && canGoPrev) setPageIndex((value) => Math.max(value - 1, 0))
    setDragStartX(null)
    setDragOffset(0)
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const resetReaderPosition = () => {
    setPageIndex(0)
    setActiveSectionIndex(0)
  }

  const handleDesignChange = (event) => {
    setActiveDesign(event.target.value)
    resetReaderPosition()
  }

  const handleScopeChange = (event) => {
    setActiveScope(event.target.value)
    resetReaderPosition()
  }

  const handleSurahChange = (event) => {
    setActiveSurahId(Number(event.target.value))
    resetReaderPosition()
  }

  const handleAyahChange = (event) => {
    setActiveAyahNo(Number(event.target.value))
    resetReaderPosition()
  }

  const handleSidebarItemClick = (item) => {
    if (effectiveScope === 'verse' && item.ayahNo) {
      setActiveAyahNo(item.ayahNo)
      resetReaderPosition()
      window.scrollTo?.({ top: 0, behavior: 'smooth' })
      return
    }

    if (activeDesign === 'flip') {
      setPageIndex(item.index)
      return
    }

    setActiveSectionIndex(item.index)
    const sectionElement = document.getElementById(`bolum-${item.index + 1}`)
    sectionElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleReaderAdvance = () => {
    if (effectiveScope === 'verse' && nextVerseTarget) {
      setActiveSurahId(nextVerseTarget.surahId)
      setActiveAyahNo(nextVerseTarget.ayahNo)
      resetReaderPosition()
      window.scrollTo?.({ top: 0, behavior: 'smooth' })
      return
    }

    if (effectiveScope === 'surah' && nextSurahTarget) {
      setActiveSurahId(nextSurahTarget.surahId)
      resetReaderPosition()
      window.scrollTo?.({ top: 0, behavior: 'smooth' })
    }
  }

  const dragRatio = Math.max(-1, Math.min(1, dragOffset / 220))
  const rightPageTransform = `translateX(${dragOffset}px) rotateY(${dragRatio * -52}deg)`
  const isReaderLoading = isManifestLoading || isSurahLoading
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
                  <label>
                    Mod
                    <select value={activeDesign} onChange={handleDesignChange}>
                      <option value="sectioned">Bölüm bölüm</option>
                      <option value="flip">Sayfa çevirme</option>
                    </select>
                  </label>
                  <label>
                    Görünüm
                    <select value={effectiveScope} onChange={handleScopeChange}>
                      <option value="verse">Ayet bazlı</option>
                      <option value="surah">Sûre bazlı</option>
                    </select>
                  </label>
                  <label>
                    Sûre
                    <select value={resolvedSurahId} onChange={handleSurahChange}>
                      {availableSurahIds.map((surahId) => (
                        <option key={surahId} value={surahId}>{getSurahTitle(surahId)}</option>
                      ))}
                    </select>
                  </label>
                  {effectiveScope === 'verse' && (
                    <label>
                      Ayet
                      <select value={resolvedAyahNo} onChange={handleAyahChange}>
                        {availableAyahs.map((ayah) => (
                          <option key={ayah} value={ayah}>{ayah}. ayet</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <div className="reader-sidebar-block">
                  <p className="reader-sidebar-title">{effectiveScope === 'verse' ? 'Ayetler' : 'İçindekiler'}</p>
                  <div className="reader-sidebar-sections">
                    {sidebarItems.map((item) => (
                      <button
                        key={item.id}
                        className={effectiveScope === 'verse' ? (resolvedAyahNo === item.ayahNo ? 'active' : '') : (activeSectionIndex === item.index ? 'active' : '')}
                        onClick={() => handleSidebarItemClick(item)}
                      >
                        {item.label}
                      </button>
                    ))}
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
                  <small className="reader-kicker">{currentReferenceLabel}</small>
                </div>

                <div className="reader-toolbar">
                  <label>
                    Okuma Modu
                    <select value={activeDesign} onChange={handleDesignChange}>
                      <option value="sectioned">Bölüm bölüm</option>
                      <option value="flip">Sayfa çevirme</option>
                    </select>
                  </label>
                  <label>
                    Görünüm
                    <select value={effectiveScope} onChange={handleScopeChange}>
                      <option value="verse">Ayet bazlı</option>
                      <option value="surah">Sûre bazlı</option>
                    </select>
                  </label>
                  <label>
                    Sûre
                    <select value={resolvedSurahId} onChange={handleSurahChange}>
                      {availableSurahIds.map((surahId) => (
                        <option key={surahId} value={surahId}>{getSurahTitle(surahId)}</option>
                      ))}
                    </select>
                  </label>
                  {effectiveScope === 'verse' && (
                    <label>
                      Ayet
                      <select value={resolvedAyahNo} onChange={handleAyahChange}>
                        {availableAyahs.map((ayah) => (
                          <option key={ayah} value={ayah}>{ayah}. ayet</option>
                        ))}
                      </select>
                    </label>
                  )}
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
                ) : activeDesign === 'sectioned' ? (
                  <section className="tefsir-sections">
                    {sections.map((section, index) => (
                      <article
                        key={`${section.title}-${index}`}
                        id={`bolum-${index + 1}`}
                        data-section-index={index}
                        className="tefsir-section-card"
                      >
                        {section.title && <span className="tefsir-section-index">{String(index + 1).padStart(2, '0')}</span>}
                        {section.title && <h3>{section.title}</h3>}
                        <div className="tefsirler-rich" dangerouslySetInnerHTML={{ __html: section.bodyHtml }} />
                      </article>
                    ))}
                  </section>
                ) : (
                  <section className="tefsir-flip-wrapper">
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
                              {prevPage.title && <h3>{prevPage.title}</h3>}
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
                          {currentPage?.title && <h3>{currentPage.title}</h3>}
                          <div className="tefsirler-rich" dangerouslySetInnerHTML={{ __html: currentPage?.bodyHtml || '' }} />
                        </article>
                      </div>
                    </div>

                    <div className="flipbook-actions">
                      <button disabled={!canGoPrev} onClick={() => setPageIndex((value) => Math.max(value - 1, 0))}>Önceki</button>
                      <span>{boundedPageIndex + 1} / {pages.length}</span>
                      <button disabled={!canGoNext} onClick={() => setPageIndex((value) => Math.min(value + 1, pages.length - 1))}>Sonraki</button>
                    </div>
                  </section>
                )}

                {(nextVerseTarget || nextSurahTarget) && (
                  <div className="reader-next-nav">
                    <span className="reader-next-nav-label">
                      {effectiveScope === 'verse' ? 'Sonraki ayet' : 'Sonraki sûre'}
                    </span>
                    <button type="button" className="reader-next-nav-link" onClick={handleReaderAdvance}>
                      <strong>{effectiveScope === 'verse' ? nextVerseTarget?.label : nextSurahTarget?.label}</strong>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M13 5l7 7-7 7" /></svg>
                    </button>
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
