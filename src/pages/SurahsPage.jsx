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

    const helperText = sortMode === 'revelation'
        ? 'Kutudaki sayı iniş sırasını gösterir.'
        : 'Kur\'an sureleri sıralanış sırasına göre listeleniyor.'

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

                <section className="surahs-panel">
                    <div className="surahs-panel-head">
                        <div className="surahs-panel-copy">
                            <h1 className="surahs-panel-title">Tüm Sureler</h1>
                            <p className="surahs-panel-note">{helperText}</p>
                            <p className="surahs-panel-sync">
                                {isLoggedIn
                                    ? `${bookmarks.surahs.length} kaydedilen sure profilinde senkron görünür.`
                                    : 'Kaydetmek için profil girişi yapabilirsin.'}
                            </p>
                        </div>

                        <div className="surahs-sorter">
                            <span className="surahs-sort-label">Listeleme</span>
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
                    </div>

                    <section className="surahs-grid" aria-label="Sure listesi">
                        {sortedSurahs.map((surah, index) => {
                            const revelationOrder = getSurahRevelationOrder(surah.no)
                            const isSaved = isSurahBookmarked(surah.no)
                            const visibleNumber = sortMode === 'revelation' ? revelationOrder : surah.no

                            return (
                                <article
                                    key={surah.no}
                                    className={`surahs-directory-card ${isSaved ? 'is-saved' : ''}`}
                                    style={{ animationDelay: `${Math.min(index, 15) * 0.03}s` }}
                                >
                                    <Link to={`/sure/${surah.no}`} className="surahs-directory-link">
                                        <span className="surahs-directory-no">{visibleNumber}</span>

                                        <div className="surahs-directory-info">
                                            <span className="surahs-directory-name-ar" dir="rtl">
                                                {normalizeArabicDisplayText(surah.nameAr)}
                                            </span>
                                            <span className="surahs-directory-name-tr">{surah.nameTr}</span>
                                        </div>

                                        <div className="surahs-directory-meta">
                                            <span className="surahs-directory-ayah">{surah.ayahCount} Ayet</span>
                                            <span className={`surah-type-badge ${surah.type.toLowerCase()}`}>
                                                {surah.type.toLocaleUpperCase('tr-TR')}
                                            </span>
                                        </div>
                                    </Link>

                                    <div className="surahs-directory-save">
                                        <BookmarkButton
                                            isBookmarked={isSaved}
                                            onToggle={() => toggleSurah(toBookmarkPayload(surah))}
                                        />
                                    </div>
                                </article>
                            )
                        })}
                    </section>
                </section>
            </div>
        </div>
    )
}
