import { Link } from 'react-router-dom'
import { useBookmarks } from '../contexts/BookmarksContext'
import './RecentSurahs.css'

import { surahs as allSurahs } from '../data/quranData'

export default function RecentSurahs() {
    const { bookmarks, clearHistory } = useBookmarks()
    const history = bookmarks.history?.surahs || []

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
            <section className="recent-section surahs-section">
                <div className="section-header">
                    <h2 className="section-title">Son Ziyaret Edilen Sureler</h2>
                </div>
                <div className="empty-history">
                    <p>Henüz bir sure ziyaret etmediniz.</p>
                </div>
            </section>
        )
    }

    return (
        <section className="recent-section surahs-section">
            <div className="section-header">
                <h2 className="section-title">Son Ziyaret Edilen Sureler</h2>
                <button
                    className="section-action clear-btn"
                    onClick={() => clearHistory('surahs')}
                >
                    Temizle
                </button>
            </div>

            <div className="surah-grid">
                {history.slice(0, 6).map((s, i) => {
                    const meta = allSurahs.find(x => x.no === parseInt(s.no)) || {}
                    return (
                        <Link
                            key={s.no}
                            to={`/sure/${s.no}`}
                            className="rs-ios-card"
                            style={{ animationDelay: `${0.1 + i * 0.05}s` }}
                        >
                            <div className="rs-ios-left">
                                <div className="rs-ios-number">{s.no}</div>
                                <div className="rs-ios-names">
                                    <span className="rs-ios-name-ar">{meta.nameAr || s.nameAr}</span>
                                    <span className="rs-ios-name-tr">{meta.nameTr || s.nameTr}</span>
                                </div>
                            </div>
                            <div className="rs-ios-right">
                                <div className="rs-ios-meta">
                                    <div className="rs-ios-top-info">
                                        <span className="rs-ios-ayah-count">{meta.ayahCount || s.ayahCount} Ayet</span>
                                        <span className="rs-ios-time">{formatRelativeTime(s.visitedAt)}</span>
                                    </div>
                                    <div className="rs-ios-badges-row">
                                        {bookmarks.surahs.some(saved => parseInt(saved.id) === parseInt(s.no)) && (
                                            <div className="saved-badge">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                                                </svg>
                                            </div>
                                        )}
                                        <span className={`rs-ios-badge ${meta.type === 'Medeni' || s.type === 'Medeni' ? 'medeni' : 'mekki'}`}>
                                            {(meta.type || s.type || 'Mekki').toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    )
                })}
            </div>
        </section>
    )
}
