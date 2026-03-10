import { useMemo, useState } from 'react'
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
  const [activeScope, setActiveScope] = useState('verse')
  const [activeSurahId, setActiveSurahId] = useState(1)
  const [activeAyahNo, setActiveAyahNo] = useState(1)
  const [expandedSurahIds, setExpandedSurahIds] = useState([])

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
  const displaySections = useMemo(
    () => (sections.length ? sections : [{ title: '', bodyHtml: '<p>Bu seçim için tefsir bulunamadı.</p>' }]),
    [sections]
  )
  const surahNavigationItems = useMemo(
    () =>
      availableSurahIds.map((surahId) => ({
        surahId,
        label: getSurahTitle(surahId),
        ayahs: getAyahNumbersFromManifest(manifest, book?.sourceId || book?.id, surahId)
      })),
    [availableSurahIds, book?.id, book?.sourceId, manifest]
  )
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

  const resetReaderPosition = () => {
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  const handleScopeChange = (event) => {
    setActiveScope(event.target.value)
    resetReaderPosition()
  }

  const handleSurahChange = (event) => {
    const surahId = Number(event.target.value)
    setActiveSurahId(surahId)
    setExpandedSurahIds((value) => (value.includes(surahId) ? value : [...value, surahId]))
    resetReaderPosition()
  }

  const handleSurahSelect = (surahId) => {
    setActiveSurahId(surahId)
    setExpandedSurahIds((value) => (value.includes(surahId) ? value : [...value, surahId]))
    resetReaderPosition()
  }

  const handleAyahSelect = (surahId, ayahNo) => {
    setActiveSurahId(surahId)
    setActiveAyahNo(ayahNo)
    setExpandedSurahIds((value) => (value.includes(surahId) ? value : [...value, surahId]))
    resetReaderPosition()
  }

  const toggleSurahExpansion = (surahId) => {
    setExpandedSurahIds((value) =>
      value.includes(surahId) ? value.filter((id) => id !== surahId) : [...value, surahId]
    )
  }

  const handleReaderAdvance = () => {
    if (effectiveScope === 'verse' && nextVerseTarget) {
      setActiveSurahId(nextVerseTarget.surahId)
      setActiveAyahNo(nextVerseTarget.ayahNo)
      setExpandedSurahIds((value) =>
        value.includes(nextVerseTarget.surahId) ? value : [...value, nextVerseTarget.surahId]
      )
      resetReaderPosition()
      return
    }

    if (effectiveScope === 'surah' && nextSurahTarget) {
      setActiveSurahId(nextSurahTarget.surahId)
      setExpandedSurahIds((value) =>
        value.includes(nextSurahTarget.surahId) ? value : [...value, nextSurahTarget.surahId]
      )
      resetReaderPosition()
    }
  }
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
                </div>

                <div className="reader-sidebar-block">
                  <p className="reader-sidebar-title">İçindekiler</p>
                  <div className="reader-sidebar-sections">
                    {surahNavigationItems.map((item) => {
                      const isActiveSurah = Number(resolvedSurahId) === Number(item.surahId)
                      const isExpanded = effectiveScope === 'verse' && (isActiveSurah || expandedSurahIds.includes(item.surahId))

                      return (
                        <div key={item.surahId} className={`reader-sidebar-group ${isActiveSurah ? 'active' : ''}`}>
                          <div className="reader-sidebar-group-row">
                            <button
                              type="button"
                              className={`reader-sidebar-surah ${isActiveSurah ? 'active' : ''}`}
                              onClick={() => handleSurahSelect(item.surahId)}
                            >
                              {item.label}
                            </button>
                            {effectiveScope === 'verse' && item.ayahs.length > 0 && (
                              <button
                                type="button"
                                className={`reader-sidebar-toggle ${isExpanded ? 'open' : ''}`}
                                onClick={() => toggleSurahExpansion(item.surahId)}
                                aria-label={`${item.label} ayetlerini ${isExpanded ? 'gizle' : 'göster'}`}
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
                  <small className="reader-kicker">{currentReferenceLabel}</small>
                </div>

                <div className="reader-toolbar">
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
                  <section className="tefsir-sections">
                    {displaySections.map((section, index) => (
                      <article
                        key={`${section.title}-${index}`}
                        id={`bolum-${index + 1}`}
                        className="tefsir-section-card"
                      >
                        {section.title && <span className="tefsir-section-index">{String(index + 1).padStart(2, '0')}</span>}
                        {section.title && <h3>{section.title}</h3>}
                        <div className="tefsirler-rich" dangerouslySetInnerHTML={{ __html: section.bodyHtml }} />
                      </article>
                    ))}
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
