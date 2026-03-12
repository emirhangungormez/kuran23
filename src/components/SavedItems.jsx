import { Link } from 'react-router-dom'
import { useBookmarks } from '../contexts/BookmarksContext'
import './SavedItems.css'
import { surahs as allSurahs } from '../data/quranData'
import { normalizeArabicDisplayText } from '../utils/textEncoding'

export default function SavedItems() {
    const { bookmarks } = useBookmarks()
    const { surahs, verses } = bookmarks

    const hasSavedItems = surahs.length > 0 || verses.length > 0

    if (!hasSavedItems) {
        return (
            <div className="saved-empty">
                <div className="saved-empty-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                </div>
                <h3>Henüz kayıt yok</h3>
                <p>Beğendiğiniz sure ve ayetleri kaydedin</p>
            </div>
        )
    }

    return (
        <div className="saved-items">
            {verses.length > 0 && (
                <div className="saved-section">
                    <h3 className="saved-section-title">Kaydedilen Ayetler ({verses.length})</h3>
                    <div className="saved-verse-list">
                        {verses.map(v => (
                            <Link key={v.id} to={`/sure/${v.surah_id}/${v.verse_number}`} className="saved-verse-card">
                                <div className="saved-verse-ref">
                                    <div className="saved-verse-surah-info">
                                        <span className="saved-verse-surah">{v.surah_name || `Sure ${v.surah_id}`}</span>
                                        <span className="saved-verse-no">{v.surah_id}:{v.verse_number}</span>
                                    </div>
                                    <div className="saved-badge sm">
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                                        </svg>
                                    </div>
                                </div>
                                <p className="saved-verse-text" dir="rtl">
                                    {normalizeArabicDisplayText(String(v.verse || '').replace(/<[^>]+>/g, ''))}
                                </p>
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {surahs.length > 0 && (
                <div className="saved-section">
                    <h3 className="saved-section-title">Kaydedilen Sureler ({surahs.length})</h3>
                    <div className="saved-grid">
                        {surahs.map(s => (
                            <Link key={s.id} to={`/sure/${s.id}`} className="rs-ios-card">
                                <div className="rs-ios-left">
                                    <div className="rs-ios-number">{s.id}</div>
                                    <div className="rs-ios-names">
                                        <span className="rs-ios-name-ar">{normalizeArabicDisplayText(s.name_original)}</span>
                                        <span className="rs-ios-name-tr">{s.name}</span>
                                    </div>
                                </div>
                                <div className="rs-ios-meta">
                                    <span className="rs-ios-ayah-count">{s.verse_count || s.ayahCount} Ayet</span>
                                    <div className="rs-ios-badges-row">
                                        <div className="saved-badge">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                                            </svg>
                                        </div>
                                        <span className={`rs-ios-badge ${((allSurahs.find(x => x.no === parseInt(s.id))?.type) || s.type || 'Mekki').toLowerCase() === 'medeni' ? 'medeni' : 'mekki'}`}>
                                            {((allSurahs.find(x => x.no === parseInt(s.id))?.type) || s.type || 'Mekki').toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
