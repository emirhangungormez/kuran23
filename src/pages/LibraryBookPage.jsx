import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import GlobalNav from '../components/GlobalNav'
import { formatTafsirRichText } from '../utils/tafsirFormatting'
import {
  getBookById,
  getBookSourceData,
  getSurahIds,
  getAyahNumbers,
  splitIntoSections,
  getSurahTitle
} from '../data/libraryBooks'
import './TefsirlerPage.css'

export default function LibraryBookPage() {
  const { bookId } = useParams()
  const [activeDesign, setActiveDesign] = useState('sectioned')
  const [activeScope, setActiveScope] = useState('verse')
  const [activeSurahId, setActiveSurahId] = useState(1)
  const [activeAyahNo, setActiveAyahNo] = useState(1)
  const [pageIndex, setPageIndex] = useState(0)
  const [dragStartX, setDragStartX] = useState(null)
  const [dragOffset, setDragOffset] = useState(0)

  const book = useMemo(() => getBookById(bookId), [bookId])
  const sourceData = useMemo(() => getBookSourceData(book), [book])
  const availableSurahIds = useMemo(() => getSurahIds(sourceData), [sourceData])
  const availableAyahs = useMemo(() => getAyahNumbers(sourceData, activeSurahId), [sourceData, activeSurahId])

  useEffect(() => {
    if (!availableSurahIds.length) return
    if (!availableSurahIds.includes(Number(activeSurahId))) setActiveSurahId(availableSurahIds[0])
  }, [availableSurahIds, activeSurahId])

  useEffect(() => {
    if (!availableAyahs.length) {
      setActiveAyahNo(1)
      return
    }
    if (!availableAyahs.includes(Number(activeAyahNo))) setActiveAyahNo(availableAyahs[0])
  }, [availableAyahs, activeAyahNo])

  useEffect(() => {
    setPageIndex(0)
  }, [bookId, activeDesign, activeScope, activeSurahId, activeAyahNo])

  const rawTafsirHtml = useMemo(() => {
    if (!book || book.category !== 'tefsir') return ''
    if (activeScope === 'surah') return sourceData?.surah?.[activeSurahId] || ''
    return sourceData?.verse?.[`${activeSurahId}:${activeAyahNo}`] || ''
  }, [book, activeScope, sourceData, activeSurahId, activeAyahNo])

  const formattedHtml = useMemo(
    () => formatTafsirRichText(rawTafsirHtml, { context: activeScope, surahId: activeSurahId, ayahNo: activeAyahNo }),
    [rawTafsirHtml, activeScope, activeSurahId, activeAyahNo]
  )

  const sections = useMemo(() => splitIntoSections(formattedHtml), [formattedHtml])
  const pages = useMemo(
    () => (sections.length ? sections : [{ title: '1. Bölüm', bodyHtml: '<p>Bu seçim için tefsir bulunamadı.</p>' }]),
    [sections]
  )

  const sidebarItems = useMemo(
    () => pages.map((page, index) => ({ id: `bolum-${index + 1}`, label: page.title, index })),
    [pages]
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

  const handleSidebarItemClick = (index) => {
    if (activeDesign === 'flip') {
      setPageIndex(index)
      return
    }
    const sectionElement = document.getElementById(`bolum-${index + 1}`)
    sectionElement?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const dragRatio = Math.max(-1, Math.min(1, dragOffset / 220))
  const rightPageTransform = `translateX(${dragOffset}px) rotateY(${dragRatio * -52}deg)`

  if (!book) {
    return (
      <div className="page kutuphane-page">
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
    <div className="page kutuphane-page">
      <GlobalNav />
      <div className="page-content">
        <div className="page-header-row">
          <Link to="/kutuphane" className="back-link hidden-mobile">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            <span>Kütüphane</span>
          </Link>
        </div>

        <section className="reader-panel">
          <div className="reader-head">
            <div>
              <h2>{book.titleTr}</h2>
              <p>{book.titleAr}</p>
            </div>
            <small className="reader-kicker">
              Türkçe çeviri · {book.category === 'meal' ? 'Meal' : 'Tefsir'}
            </small>
          </div>

          {book.category === 'meal' ? (
            <div className="meal-reader-placeholder">
              <p><strong>{book.titleTr}</strong> için meal odaklı kitap sayfası sonraki adımda genişletilecek.</p>
              <p>Şu an meal okumaya ayet ekranından devam edebilirsin.</p>
              <Link to="/sure/1/1" className="meal-quick-link">Örnek Meal Sayfası</Link>
            </div>
          ) : !rawTafsirHtml ? (
            <div className="empty-state">
              <h2>İçerik bulunamadı</h2>
              <p>Seçilen sûre/ayet için bu kitapta veri yok.</p>
            </div>
          ) : (
            <div className="book-reader-layout">
              <aside className="reader-sidebar hidden-mobile">
                <div className="reader-sidebar-block">
                  <p className="reader-sidebar-title">İçindekiler</p>
                  <div className="reader-sidebar-sections">
                    {sidebarItems.map((item) => (
                      <button
                        key={item.id}
                        className={activeDesign === 'flip' && boundedPageIndex === item.index ? 'active' : ''}
                        onClick={() => handleSidebarItemClick(item.index)}
                      >
                        {item.index + 1}. {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </aside>

              <div className="reader-main">
                <div className="reader-toolbar">
                  <label>
                    Okuma Modu
                    <select value={activeDesign} onChange={(event) => setActiveDesign(event.target.value)}>
                      <option value="sectioned">Bölüm bölüm</option>
                      <option value="flip">Sayfa çevirme</option>
                    </select>
                  </label>

                  <label>
                    Görünüm
                    <select value={activeScope} onChange={(event) => setActiveScope(event.target.value)}>
                      <option value="verse">Ayet bazlı</option>
                      <option value="surah">Sûre bazlı</option>
                    </select>
                  </label>

                  <label>
                    Sûre
                    <select value={activeSurahId} onChange={(event) => setActiveSurahId(Number(event.target.value))}>
                      {availableSurahIds.map((surahId) => (
                        <option key={surahId} value={surahId}>{getSurahTitle(surahId)}</option>
                      ))}
                    </select>
                  </label>

                  {activeScope === 'verse' && (
                    <label>
                      Ayet
                      <select value={activeAyahNo} onChange={(event) => setActiveAyahNo(Number(event.target.value))}>
                        {availableAyahs.map((ayah) => (
                          <option key={ayah} value={ayah}>{ayah}. ayet</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                {activeDesign === 'sectioned' ? (
                  <section className="tefsir-sections">
                    {sections.map((section, index) => (
                      <article key={`${section.title}-${index}`} id={`bolum-${index + 1}`} className="tefsir-section-card">
                        <h3>{section.title}</h3>
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
                      <button disabled={!canGoPrev} onClick={() => setPageIndex((value) => Math.max(value - 1, 0))}>Önceki</button>
                      <span>{boundedPageIndex + 1} / {pages.length}</span>
                      <button disabled={!canGoNext} onClick={() => setPageIndex((value) => Math.min(value + 1, pages.length - 1))}>Sonraki</button>
                    </div>
                  </section>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
