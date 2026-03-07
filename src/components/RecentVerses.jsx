import { Link } from 'react-router-dom'
import { useBookmarks } from '../contexts/BookmarksContext'
import { normalizeArabicDisplayText } from '../utils/textEncoding'
import './RecentVerses.css'

export default function RecentVerses() {
    const { bookmarks, clearHistory } = useBookmarks()
    const history = bookmarks.history?.verses || []

    const formatRelativeTime = (isoString) => {
        if (!isoString) return ''
        const date = new Date(isoString)
        const diff = new Date() - date
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(minutes / 60)
        const days = Math.floor(hours / 24)

        if (minutes < 1) return 'Yeni'
        if (minutes < 60) return `${minutes} dk önce`
        if (hours < 24) return `${hours} sa önce`
        if (days === 1) return 'Dün'
        return `${days} gün önce`
    }

    if (history.length === 0) {
        return (
            <section className="recent-section">
                <div className="section-header">
                    <h2 className="section-title">Son Ziyaret Edilen Ayetler</h2>
                </div>
                <div className="empty-history">
                    <p>Henüz bir ayet ziyaret etmediniz.</p>
                </div>
            </section>
        )
    }

    return (
        <section className="recent-section">
            <div className="section-header">
                <h2 className="section-title">Son Ziyaret Edilen Ayetler</h2>
                <button
                    className="section-action clear-btn"
                    onClick={() => clearHistory('verses')}
                >
                    Temizle
                </button>
            </div>

            <div className="saved-verse-list">
                {history.slice(0, 6).map((v, i) => (
                    <Link
                        key={v.id}
                        to={`/sure/${v.surahId}/${v.ayah}`}
                        className="saved-verse-card"
                        style={{ animationDelay: `${0.1 + i * 0.06}s`, textDecoration: 'none' }}
                    >
                        <div className="saved-verse-ref">
                            <div className="saved-verse-surah-info">
                                <span className="saved-verse-surah">{v.surahTr}</span>
                                <span className="saved-verse-no">{v.surahId}:{v.ayah}</span>
                                <span className="verse-date-meta">{formatRelativeTime(v.visitedAt)}</span>
                            </div>
                            {bookmarks.verses.some(saved => saved.id === (v.id || `${v.surahId}-${v.ayah}`)) && (
                                <div className="saved-badge sm">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                                    </svg>
                                </div>
                            )}
                        </div>
                        <p className="saved-verse-text" dir="rtl">
                            {normalizeArabicDisplayText(String(v.text || '').replace(/<[^>]+>/g, ''))}
                        </p>
                    </Link>
                ))}
            </div>
        </section>
    )
}
