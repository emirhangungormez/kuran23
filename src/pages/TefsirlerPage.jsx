import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import GlobalNav from '../components/GlobalNav'
import { ALL_BOOKS } from '../data/libraryBooks'
import './TefsirlerPage.css'
import './LibraryMobile.css'

const LIBRARY_SECTIONS = {
  tefsir: {
    title: 'Tefsirler',
    description: 'Klasik ve modern tefsir seçkileri'
  },
  meal: {
    title: 'Mealler',
    description: 'Türkçe meal ve karşılaştırmalı çeviri kitapları'
  }
}

export default function TefsirlerPage() {
  const [activeFilter, setActiveFilter] = useState('all')

  const sections = useMemo(() => {
    const orderedKeys = ['tefsir', 'meal']
    return orderedKeys
      .filter((key) => activeFilter === 'all' || activeFilter === key)
      .map((key) => ({
        key,
        ...LIBRARY_SECTIONS[key],
        books: ALL_BOOKS.filter((book) => book.category === key)
      }))
  }, [activeFilter])

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

        <section className="kutuphane-hero minimal-hero">
          <h1>Kur’an Kütüphanesi</h1>
          <div className="kutuphane-filters">
            <button className={activeFilter === 'all' ? 'active' : ''} onClick={() => setActiveFilter('all')}>Tümü</button>
            <button className={activeFilter === 'tefsir' ? 'active' : ''} onClick={() => setActiveFilter('tefsir')}>Tefsir</button>
            <button className={activeFilter === 'meal' ? 'active' : ''} onClick={() => setActiveFilter('meal')}>Meal</button>
          </div>
        </section>

        {sections.map((section) => (
          <section key={section.key} className={`library-section minimal-library-list category-${section.key}`}>
            <div className="library-section-head">
              <div className="library-section-copy">
                <span className="library-section-kicker">Kütüphane</span>
                <h2>{section.title}</h2>
                <p>{section.description}</p>
              </div>
              <span className="library-section-count">{section.books.length} kitap</span>
            </div>
            <div className="library-books-grid compact-grid">
              {section.books.map(renderCard)}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
