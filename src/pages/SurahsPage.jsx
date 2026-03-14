import { useState } from 'react'
import { Link } from 'react-router-dom'
import GlobalNav from '../components/GlobalNav'
import BookmarkButton from '../components/BookmarkButton'
import { useBookmarks } from '../contexts/BookmarksContext'
import { useAuth } from '../contexts/AuthContext'
import { surahs } from '../data/quranData'
import { getSurahRevelationOrder } from '../data/surahRevelationOrder'
import { normalizeArabicDisplayText } from '../utils/textEncoding'
import './SurahsPage.css'

function toBookmarkPayload(surah) {
    return {
        id: surah.no,
        name: surah.nameTr,
        name_original: surah.nameAr,
        verse_count: surah.ayahCount,
        type: surah.type
    }
}

export default function SurahsPage() {
    const [sortMode, setSortMode] = useState('mushaf')
    const { bookmarks, toggleSurah, isSurahBookmarked } = useBookmarks()
    const { isLoggedIn } = useAuth()

    const sortedSurahs = [...surahs].sort((left, right) => {
        if (sortMode === 'revelation') {
            return getSurahRevelationOrder(left.no) - getSurahRevelationOrder(right.no) || left.no - right.no
        }

        return left.no - right.no
    })

    return (
        <div className="page surahs-page">
            <GlobalNav />
            <div className="page-content">
                <div className="page-header-row hidden-mobile">
                    <Link to="/" className="back-link">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                        <span>Ana Sayfa</span>
                    </Link>
                </div>

                <section className="surahs-hero">
                    <div className="surahs-hero-copy">
                        <span className="surahs-kicker">114 Sure</span>
                        <h1 className="surahs-title">Sureler</h1>
                        <p className="surahs-subtitle">
                            Kur&apos;an surelerini Mushaf sırasına veya iniş sırasına göre gez.{' '}
                            {isLoggedIn ? (
                                <span>{bookmarks.surahs.length} kaydın profilinde senkron durur.</span>
                            ) : (
                                <span>
                                    Kaydetmek için <Link to="/giris" className="surahs-inline-link">profil girişi</Link> yapabilirsin.
                                </span>
                            )}
                        </p>
                    </div>

                    <div className="surahs-toolbar">
                        <span className="surahs-toolbar-label">Listeleme</span>
                        <div className="surahs-sort-toggle" role="tablist" aria-label="Sure listeleme sırasını seç">
                            <button
                                type="button"
                                className={`surahs-sort-btn ${sortMode === 'mushaf' ? 'active' : ''}`}
                                onClick={() => setSortMode('mushaf')}
                                aria-pressed={sortMode === 'mushaf'}
                            >
                                Sıralanış sırası
                            </button>
                            <button
                                type="button"
                                className={`surahs-sort-btn ${sortMode === 'revelation' ? 'active' : ''}`}
                                onClick={() => setSortMode('revelation')}
                                aria-pressed={sortMode === 'revelation'}
                            >
                                İniş sırası
                            </button>
                        </div>
                    </div>
                </section>

                <div className="surahs-summary-bar">
                    <span>
                        {sortMode === 'revelation'
                            ? 'Liste nüzul sırasına göre dizildi.'
                            : 'Liste Mushaf sırasına göre dizildi.'}
                    </span>
                    <span>{bookmarks.surahs.length} kayıtlı sure</span>
                </div>

                <section className="surahs-list" aria-label="Sure listesi">
                    {sortedSurahs.map((surah, index) => {
                        const revelationOrder = getSurahRevelationOrder(surah.no)
                        const isSaved = isSurahBookmarked(surah.no)

                        return (
                            <article
                                key={surah.no}
                                className={`surahs-card ${isSaved ? 'is-saved' : ''}`}
                                style={{ animationDelay: `${Math.min(index, 14) * 0.03}s` }}
                            >
                                <Link to={`/sure/${surah.no}`} className="surahs-card-link">
                                    <div className="surahs-rank-pill">
                                        <span className="surahs-rank-label">{sortMode === 'revelation' ? 'İniş' : 'Sure'}</span>
                                        <strong className="surahs-rank-value">
                                            {sortMode === 'revelation' ? revelationOrder : surah.no}
                                        </strong>
                                    </div>

                                    <div className="surahs-card-main">
                                        <div className="surahs-card-head">
                                            <div className="surahs-card-titles">
                                                <h2>{surah.nameTr}</h2>
                                                <p>{surah.nameEn}</p>
                                            </div>
                                            <span className="surahs-card-ar" dir="rtl">
                                                {normalizeArabicDisplayText(surah.nameAr)}
                                            </span>
                                        </div>

                                        <div className="surahs-card-meta">
                                            <span>{surah.ayahCount} ayet</span>
                                            <span className={`surahs-type-badge ${surah.type.toLowerCase()}`}>{surah.type}</span>
                                            <span className="surahs-secondary-order">
                                                {sortMode === 'revelation' ? `Mushaf ${surah.no}` : `İniş ${revelationOrder}`}
                                            </span>
                                        </div>
                                    </div>
                                </Link>

                                <div className="surahs-card-action">
                                    <BookmarkButton
                                        isBookmarked={isSaved}
                                        onToggle={() => toggleSurah(toBookmarkPayload(surah))}
                                    />
                                </div>
                            </article>
                        )
                    })}
                </section>
            </div>
        </div>
    )
}
