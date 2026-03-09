import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useBookmarks } from '../contexts/BookmarksContext'
import { useSettings } from '../contexts/SettingsContext'
import { juzData } from '../data/juzData'
import './LastReadPage.css'

const normalizeCompletedJuz = (completedJuz) => {
    return Array.from(
        new Set((completedJuz || []).filter(n => Number.isInteger(n) && n >= 1 && n <= 30))
    ).sort((a, b) => a - b)
}

const getNextJourneyJuz = (journeys) => {
    const marked = journeys.flatMap(journey => normalizeCompletedJuz(journey.completedJuz))
    if (!marked.length) {
        return {
            nextJuz: juzData[0] || null,
            highestMarked: 0,
            hasMarked: false,
        }
    }

    const highestMarked = Math.max(...marked)
    if (highestMarked >= 30) {
        return {
            nextJuz: null,
            highestMarked,
            hasMarked: true,
        }
    }

    return {
        nextJuz: juzData.find(juz => juz.juz === highestMarked + 1) || null,
        highestMarked,
        hasMarked: true,
    }
}

export default function LastReadPage() {
    const { bookmarks } = useBookmarks()
    const { settings } = useSettings()

    const journeys = useMemo(() => settings.readingJourneys || [], [settings.readingJourneys])
    const journeyTarget = useMemo(() => getNextJourneyJuz(journeys), [journeys])

    const fallbackBookmark = bookmarks.stringBookmark || bookmarks.lastPage
    const hasJourneyTarget = !!journeyTarget.nextJuz

    if (!hasJourneyTarget && !fallbackBookmark) return null

    const isBookmarkMode = !hasJourneyTarget
    const isActualBookmark = !!bookmarks.stringBookmark

    const title = isBookmarkMode
        ? (isActualBookmark ? 'Ayraç Yerim' : 'Okumaya Devam Et')
        : 'Okumaya Devam Et'

    const targetPath = isBookmarkMode
        ? `/oku/${fallbackBookmark.pageNumber}`
        : `/oku/${journeyTarget.nextJuz.startPage}`

    const badge = isBookmarkMode
        ? (isActualBookmark ? 'AYRAÇ' : 'MUSHAF')
        : 'CÜZ'

    const headline = isBookmarkMode
        ? `${fallbackBookmark.surahName} Suresi`
        : `${journeyTarget.nextJuz.juz}. Cüz`

    const bookmarkPageLabel = isBookmarkMode
        ? (fallbackBookmark.pageNumber === 0
            ? 'Fatiha (Başlangıç)'
            : `${fallbackBookmark.pageNumber}. Sayfa`)
        : ''

    const meta = isBookmarkMode
        ? `${bookmarkPageLabel} · ${fallbackBookmark.juzNumber}. Cüz`
        : `${journeyTarget.nextJuz.startPage}. sayfadan başlar`

    const actionLabel = isBookmarkMode
        ? (isActualBookmark ? 'Ayraç sayfasına git' : 'Son ziyaret edilen sayfa')
        : (journeyTarget.hasMarked
            ? `${journeyTarget.highestMarked}. cüzden sonraya git`
            : 'İlk cüzden başla')

    return (
        <div className="last-read-container">
            <h2 className="profile-section-title">{title}</h2>
            <Link to={targetPath} className="last-read-card continue-read-card">
                <div className="continue-read-overlay">
                    <div className="continue-read-badge">{badge}</div>
                    <div className="continue-read-content">
                        <h3>{headline}</h3>
                        <p>{meta}</p>
                    </div>
                    <div className="continue-read-action">
                        <span>{actionLabel}</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                    </div>
                </div>
            </Link>
        </div>
    )
}
