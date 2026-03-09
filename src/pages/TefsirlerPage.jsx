import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import GlobalNav from '../components/GlobalNav'
import { ALL_BOOKS } from '../data/libraryBooks'
import './TefsirlerPage.css'

export default function TefsirlerPage() {
  const [activeFilter, setActiveFilter] = useState('all')

  const filteredBooks = useMemo(() => {
    if (activeFilter === 'all') return ALL_BOOKS
    return ALL_BOOKS.filter((book) => book.category === activeFilter)
  }, [activeFilter])

  const tefsirBooks = filteredBooks.filter((book) => book.category === 'tefsir')
  const mealBooks = filteredBooks.filter((book) => book.category === 'meal')

  const renderCard = (book) => (
    <Link key={book.id} to={`/kutuphane/${book.id}`} className={`library-book-card ${book.category}`}>
      <div className={`book-cover ${book.category === 'meal' ? 'meal-cover' : 'tefsir-cover'}`}>
        <span className="book-cover-ar">{book.titleAr}</span>
        <div className="book-cover-meta">
          <strong className="book-cover-tr">{book.titleTr}</strong>
          <small className="book-cover-author">{book.authorTr}</small>
        </div>
        {book.hasTrTranslation && <em className="book-cover-badge">TR ÇEVİRİ</em>}
      </div>
      <div className="book-caption">
        <strong>{book.titleTr}</strong>
        <p>{book.authorTr}</p>
      </div>
    </Link>
  )

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
          <h1>Kur’an Kütüphanesi</h1>
          <p>Tefsir ve meal kitaplarını filtreleyin. Her kitap kendi özel sayfasında açılır.</p>
          <div className="kutuphane-filters">
            <button className={activeFilter === 'all' ? 'active' : ''} onClick={() => setActiveFilter('all')}>Tümü</button>
            <button className={activeFilter === 'tefsir' ? 'active' : ''} onClick={() => setActiveFilter('tefsir')}>Tefsir</button>
            <button className={activeFilter === 'meal' ? 'active' : ''} onClick={() => setActiveFilter('meal')}>Meal</button>
          </div>
        </section>

        {tefsirBooks.length > 0 && (
          <section className="library-section">
            <div className="library-section-head">
              <div>
                <h2>Tefsir Kitapları</h2>
                <p>"Kur’an’ı hiç düşünmüyorlar mı?"</p>
              </div>
            </div>
            <div className="library-books-grid compact-grid">
              {tefsirBooks.map(renderCard)}
            </div>
          </section>
        )}

        {mealBooks.length > 0 && (
          <section className="library-section">
            <div className="library-section-head">
              <div>
                <h2>Meal Kitapları</h2>
                <p>"Allah’ın sözünü anlayarak oku"</p>
              </div>
            </div>
            <div className="library-books-grid compact-grid">
              {mealBooks.map(renderCard)}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
