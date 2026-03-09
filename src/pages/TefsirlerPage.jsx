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

const TEFSIR_BOOK_META = {
  celaleyn: { titleAr: 'تفسير الجلالين', authorAr: 'جلال الدين المحلي - جلال الدين السيوطي' },
  beydavi: { titleAr: 'أنوار التنزيل', authorAr: 'البيضاوي' },
  nesefi: { titleAr: 'مدارك التنزيل', authorAr: 'النسفي' },
  kurtubi: { titleAr: 'الجامع لاحكام القرآن', authorAr: 'القرطبي' },
  ibn_cevzi: { titleAr: 'زاد المسير', authorAr: 'ابن الجوزي' },
  suyuti_durrul_mensur: { titleAr: 'الدر المنثور', authorAr: 'جلال الدين السيوطي' },
  ebussuud: { titleAr: 'إرشاد العقل السليم', authorAr: 'أبو السعود' },
  razi: { titleAr: 'مفاتيح الغيب', authorAr: 'فخر الدين الرازي' },
  taberi: { titleAr: 'جامع البيان', authorAr: 'الطبري' },
  ruhulbeyan: { titleAr: 'روح البيان', authorAr: 'إسماعيل حقي' },
  elmalili_orijinal: { titleAr: 'حق ديني قرآن ديلي', authorAr: 'محمد حمدي يازر' },
  elmalili_sadelestirilmis: { titleAr: 'حق ديني قرآن ديلي', authorAr: 'محمد حمدي يازر' },
  besairul_kuran: { titleAr: 'بصائر القرآن', authorAr: 'مؤلف معاصر' },
  ibn_kesir: { titleAr: 'تفسير ابن كثير', authorAr: 'ابن كثير' },
  fizilalil_kuran: { titleAr: 'في ظلال القرآن', authorAr: 'سيد قطب' },
  tefhimul_kuran: { titleAr: 'تفهيم القرآن', authorAr: 'أبو الأعلى المودودي' }
}

const MEAL_BOOKS = [
  {
    id: 'meal-diyanet',
    category: 'meal',
    titleTr: 'Kurani Kerim ve Turkce Meali',
    titleAr: 'القرآن الكريم',
    authorTr: 'Diyanet Isleri Baskanligi',
    authorAr: 'رئاسة الشؤون الدينية',
    hasTrTranslation: true,
    description: 'Modern Turkce meal yaklasimi'
  },
  {
    id: 'meal-elmalili',
    category: 'meal',
    titleTr: 'Hak Dini Kuran Dili (Meal)',
    titleAr: 'حق ديني قرآن ديلي',
    authorTr: 'Elmalili Hamdi Yazir',
    authorAr: 'ألماليلي حمدي يازر',
    hasTrTranslation: true,
    description: 'Klasik Osmanli-Turkce dilin modern aktarimi'
  },
  {
    id: 'meal-uzlasimli',
    category: 'meal',
    titleTr: 'Karsilastirmali Turkce Mealler',
    titleAr: 'ترجمات تركية مقارنة',
    authorTr: 'Coklu meal seckisi',
    authorAr: 'اختيار متعدد',
    hasTrTranslation: true,
    description: 'Ayni ayet icin birden fazla meal okuma'
  }
]

const TEFSIR_BOOKS = LIBRARY_SOURCES.map((source) => {
  const meta = TEFSIR_BOOK_META[source.id] || {}
  return {
    id: source.id,
    sourceId: source.id,
    category: 'tefsir',
    titleTr: source.tabLabel,
    titleAr: meta.titleAr || 'كتاب التفسير',
    authorTr: source.shortLabel,
    authorAr: meta.authorAr || 'مفسر',
    hasTrTranslation: true,
    description: 'TR ceviri ile okunabilir tefsir metni'
  }
})

const ALL_BOOKS = [...TEFSIR_BOOKS, ...MEAL_BOOKS]

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
  if (typeof window === 'undefined') return [{ title: '1. Bolum', bodyHtml: formattedHtml }]

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div id="root">${formattedHtml}</div>`, 'text/html')
    const root = doc.querySelector('#root')
    if (!root) return [{ title: '1. Bolum', bodyHtml: formattedHtml }]

    const sections = []
    let current = null

    const pushCurrent = () => {
      if (!current) return
      const normalized = (current.bodyHtml || '').trim()
      if (!normalized) return
      sections.push({
        title: current.title || `${sections.length + 1}. Bolum`,
        bodyHtml: normalized
      })
    }

    Array.from(root.childNodes).forEach((node) => {
      const tagName = node.nodeType === Node.ELEMENT_NODE ? node.tagName.toLowerCase() : ''
      const isHeading = tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4'

      if (isHeading) {
        pushCurrent()
        current = {
          title: (node.textContent || '').trim() || `${sections.length + 1}. Bolum`,
          bodyHtml: ''
        }
        return
      }

      if (!current) {
        current = { title: '1. Bolum', bodyHtml: '' }
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        current.bodyHtml += node.outerHTML
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        current.bodyHtml += `<p>${node.textContent.trim()}</p>`
      }
    })

    pushCurrent()
    return sections.length ? sections : [{ title: '1. Bolum', bodyHtml: formattedHtml }]
  } catch {
    return [{ title: '1. Bolum', bodyHtml: formattedHtml }]
  }
}

function getSurahTitle(surahId) {
  const match = allSurahs.find((surah) => Number(surah.no) === Number(surahId))
  if (!match) return `Sure ${surahId}`
  return `${match.nameTr} (${match.no})`
}

export default function TefsirlerPage() {
  const [activeFilter, setActiveFilter] = useState('all')
  const [activeBookId, setActiveBookId] = useState(TEFSIR_BOOKS[0]?.id || '')
  const [activeDesign, setActiveDesign] = useState('sectioned')
  const [activeScope, setActiveScope] = useState('verse')
  const [activeSurahId, setActiveSurahId] = useState(1)
  const [activeAyahNo, setActiveAyahNo] = useState(1)
  const [pageIndex, setPageIndex] = useState(0)
  const [dragStartX, setDragStartX] = useState(null)
  const [dragOffset, setDragOffset] = useState(0)

  const filteredBooks = useMemo(() => {
    if (activeFilter === 'all') return ALL_BOOKS
    return ALL_BOOKS.filter((book) => book.category === activeFilter)
  }, [activeFilter])

  const tefsirBooks = useMemo(
    () => filteredBooks.filter((book) => book.category === 'tefsir'),
    [filteredBooks]
  )

  const mealBooks = useMemo(
    () => filteredBooks.filter((book) => book.category === 'meal'),
    [filteredBooks]
  )

  useEffect(() => {
    if (!filteredBooks.length) return
    const exists = filteredBooks.some((book) => book.id === activeBookId)
    if (!exists) setActiveBookId(filteredBooks[0].id)
  }, [filteredBooks, activeBookId])

  const activeBook = useMemo(
    () => ALL_BOOKS.find((book) => book.id === activeBookId) || null,
    [activeBookId]
  )

  const sourceData = useMemo(() => {
    if (!activeBook || activeBook.category !== 'tefsir') return { surah: {}, verse: {} }
    return LIBRARY_CONTENT[activeBook.sourceId] || { surah: {}, verse: {} }
  }, [activeBook])

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
  }, [activeBookId, activeDesign, activeScope, activeSurahId, activeAyahNo])

  const rawTafsirHtml = useMemo(() => {
    if (!activeBook || activeBook.category !== 'tefsir') return ''
    if (activeScope === 'surah') {
      return sourceData?.surah?.[activeSurahId] || ''
    }
    return sourceData?.verse?.[`${activeSurahId}:${activeAyahNo}`] || ''
  }, [activeBook, activeScope, activeSurahId, activeAyahNo, sourceData])

  const formattedHtml = useMemo(
    () => formatTafsirRichText(rawTafsirHtml, { context: activeScope, surahId: activeSurahId, ayahNo: activeAyahNo }),
    [rawTafsirHtml, activeScope, activeSurahId, activeAyahNo]
  )

  const sections = useMemo(() => splitIntoSections(formattedHtml), [formattedHtml])
  const pages = useMemo(
    () => (sections.length ? sections : [{ title: '1. Bolum', bodyHtml: '<p>Bu secim icin tefsir bulunamadi.</p>' }]),
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
    <div className="page tefsirler-page kutuphane-page">
      <GlobalNav />
      <div className="page-content">
        <div className="page-header-row">
          <Link to="/" className="back-link hidden-mobile">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            <span>Ana Sayfa</span>
          </Link>
        </div>

        <section className="kutuphane-hero">
          <h1>Kur'an Kutuphanesi</h1>
          <p>Tefsir ve meal kitaplarini filtreleyin, kitap kapagi uzerinden secin, Arapca baslik ve TR ceviri bilgisiyle okuyun.</p>
          <div className="kutuphane-filters">
            <button className={activeFilter === 'all' ? 'active' : ''} onClick={() => setActiveFilter('all')}>Tumu</button>
            <button className={activeFilter === 'tefsir' ? 'active' : ''} onClick={() => setActiveFilter('tefsir')}>Tefsir</button>
            <button className={activeFilter === 'meal' ? 'active' : ''} onClick={() => setActiveFilter('meal')}>Meal</button>
          </div>
        </section>

        {tefsirBooks.length > 0 && (
          <section className="library-section">
            <div className="library-section-head">
              <div>
                <h2>Tefsir Kitaplari</h2>
                <p>"Kur'ani hic dusunmuyorlar mi?"</p>
              </div>
              <span aria-hidden="true">&rarr;</span>
            </div>
            <div className="library-books-grid">
              {tefsirBooks.map((book) => (
                <button
                  key={book.id}
                  className={`library-book-card tefsir ${activeBookId === book.id ? 'active' : ''}`}
                  onClick={() => setActiveBookId(book.id)}
                >
                  <div className="book-cover tefsir-cover">
                    <span className="book-cover-ar">{book.titleAr}</span>
                    <strong className="book-cover-tr">{book.titleTr}</strong>
                    <small className="book-cover-author">{book.authorTr}</small>
                    {book.hasTrTranslation && <em className="book-cover-badge">TR CEVIRI VAR</em>}
                  </div>
                  <div className="book-caption">
                    <strong>{book.titleTr}</strong>
                    <p>{book.authorTr}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {mealBooks.length > 0 && (
          <section className="library-section">
            <div className="library-section-head">
              <div>
                <h2>Meal Kitaplari</h2>
                <p>"Allah'in sozunu anlayarak oku"</p>
              </div>
              <span aria-hidden="true">&rarr;</span>
            </div>
            <div className="library-books-grid">
              {mealBooks.map((book) => (
                <button
                  key={book.id}
                  className={`library-book-card meal ${activeBookId === book.id ? 'active' : ''}`}
                  onClick={() => setActiveBookId(book.id)}
                >
                  <div className="book-cover meal-cover">
                    <span className="book-cover-ar">{book.titleAr}</span>
                    <strong className="book-cover-tr">{book.titleTr}</strong>
                    <small className="book-cover-author">{book.authorTr}</small>
                    {book.hasTrTranslation && <em className="book-cover-badge">TR CEVIRI VAR</em>}
                  </div>
                  <div className="book-caption">
                    <strong>{book.titleTr}</strong>
                    <p>{book.authorTr}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="reader-panel">
          <div className="reader-head">
            <div>
              <h2>{activeBook?.titleTr || 'Kitap seciniz'}</h2>
              <p>{activeBook?.titleAr || ''}</p>
            </div>
            <div className="reader-badges">
              <span className="badge-translation">TR CEVIRI MEVCUT</span>
              <span className={`badge-category ${activeBook?.category || ''}`}>{activeBook?.category === 'meal' ? 'MEAL' : 'TEFSIR'}</span>
            </div>
          </div>

          {!activeBook ? (
            <div className="empty-state">
              <h2>Kitap seciniz</h2>
              <p>Devam etmek icin bir kitap kartina tiklayin.</p>
            </div>
          ) : activeBook.category === 'meal' ? (
            <div className="meal-reader-placeholder">
              <p><strong>{activeBook.titleTr}</strong> secili. Bu kitaplarin okuma ekrani bir sonraki adimda meal odakli panelle acilacak.</p>
              <p>Simdilik meal okumak icin ayet ekranini kullanabilirsiniz.</p>
              <Link to="/sure/1/1" className="meal-quick-link">Ornek Meal Sayfasini Ac</Link>
            </div>
          ) : !rawTafsirHtml ? (
            <div className="empty-state">
              <h2>Icerik bulunamadi</h2>
              <p>Secilen sure/ayet icin bu kitapta veri yok.</p>
            </div>
          ) : (
            <>
              <div className="reader-toolbar">
                <label>
                  Okuma Modu
                  <select value={activeDesign} onChange={(event) => setActiveDesign(event.target.value)}>
                    <option value="sectioned">Bolum Bolum</option>
                    <option value="flip">Sayfa Cevirme</option>
                  </select>
                </label>

                <label>
                  Gorunum
                  <select value={activeScope} onChange={(event) => setActiveScope(event.target.value)}>
                    <option value="verse">Ayet Bazli</option>
                    <option value="surah">Sure Bazli</option>
                  </select>
                </label>

                <label>
                  Sure
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
                    <article key={`${section.title}-${index}`} className="tefsir-section-card">
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
                          <div className="flipbook-placeholder">On sayfa yok</div>
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
                    <button disabled={!canGoPrev} onClick={() => setPageIndex((value) => Math.max(value - 1, 0))}>Onceki</button>
                    <span>{boundedPageIndex + 1} / {pages.length}</span>
                    <button disabled={!canGoNext} onClick={() => setPageIndex((value) => Math.min(value + 1, pages.length - 1))}>Sonraki</button>
                  </div>
                </section>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
