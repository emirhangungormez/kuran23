import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import { useSupporter } from '../contexts/SupporterContext'
import { juzData } from '../data/juzData'
import './ReadingJourney.css'

const normalizeCompletedJuz = (completedJuz) => {
    return Array.from(
        new Set((completedJuz || []).filter(n => Number.isInteger(n) && n >= 1 && n <= 30))
    ).sort((a, b) => a - b)
}

export default function ReadingJourney() {
    const { settings, updateSettings } = useSettings()
    const { isSupporter, journeyLimit } = useSupporter()
    const navigate = useNavigate()

    const journeys = useMemo(() => settings.readingJourneys || [], [settings.readingJourneys])

    const [expandedJourneyId, setExpandedJourneyId] = useState(null)
    const [isCreating, setIsCreating] = useState(false)
    const [newJourneyName, setNewJourneyName] = useState('')

    const overview = useMemo(() => {
        const totalJourneys = journeys.length
        const totalCompletedJuz = journeys.reduce(
            (sum, journey) => sum + normalizeCompletedJuz(journey.completedJuz).length,
            0
        )
        const completedJourneys = journeys.filter(
            journey => normalizeCompletedJuz(journey.completedJuz).length === 30
        ).length
        const averageProgress = totalJourneys > 0
            ? Math.round((totalCompletedJuz / (totalJourneys * 30)) * 100)
            : 0

        return {
            totalJourneys,
            totalCompletedJuz,
            completedJourneys,
            averageProgress,
        }
    }, [journeys])

    const createJourney = () => {
        if (!isSupporter && journeys.length >= journeyLimit) {
            window.alert('Normal üyeler en fazla 1 okuma serüveni oluşturabilir. Destekçi üyelik ile limit kalkar.')
            return
        }

        const name = newJourneyName.trim()
        if (!name) return

        const newJourney = {
            id: Date.now(),
            name,
            createdAt: new Date().toISOString(),
            completedJuz: [],
            juzBookmarks: {},
        }

        updateSettings({ readingJourneys: [...journeys, newJourney] })
        setNewJourneyName('')
        setIsCreating(false)
        setExpandedJourneyId(newJourney.id)
    }

    const deleteJourney = (journeyId) => {
        const shouldDelete = window.confirm('Bu serüveni silmek istediğinize emin misiniz?')
        if (!shouldDelete) return

        updateSettings({ readingJourneys: journeys.filter(journey => journey.id !== journeyId) })

        if (expandedJourneyId === journeyId) {
            setExpandedJourneyId(null)
        }
    }

    const updateJourneyName = (journeyId, value, fallbackValue) => {
        const nextName = value.trim()
        if (!nextName) return fallbackValue

        const updated = journeys.map(journey => {
            if (journey.id !== journeyId) return journey
            return { ...journey, name: nextName }
        })
        updateSettings({ readingJourneys: updated })
        return nextName
    }

    const toggleJuzComplete = (journeyId, juzNum) => {
        let incrementHatim = false

        const updatedJourneys = journeys.map(journey => {
            if (journey.id !== journeyId) return journey

            const completedJuz = normalizeCompletedJuz(journey.completedJuz)
            const isCompleted = completedJuz.includes(juzNum)
            const nextCompleted = isCompleted
                ? completedJuz.filter(num => num !== juzNum)
                : [...completedJuz, juzNum].sort((a, b) => a - b)

            if (!isCompleted && completedJuz.length === 29 && nextCompleted.length === 30) {
                incrementHatim = true
            }

            return {
                ...journey,
                completedJuz: nextCompleted,
            }
        })

        if (incrementHatim) {
            updateSettings({
                readingJourneys: updatedJourneys,
                hatimCount: (settings.hatimCount || 0) + 1,
            })
            return
        }

        updateSettings({ readingJourneys: updatedJourneys })
    }

    const openJuz = (juz) => {
        navigate(`/oku/${juz.startPage}`)
    }

    const getNextJuz = (completedJuz) => {
        if (!completedJuz?.length) return juzData[0] || null
        const highestMarked = Math.max(...completedJuz)
        if (highestMarked >= 30) return null
        return juzData.find(juz => juz.juz === highestMarked + 1) || null
    }

    return (
        <section className="journey-section">
            <div className="journey-overview-card">
                <div className="journey-overview-info">
                    <span className="journey-overview-tag">OKUMA TAKİBİ</span>
                    <h2 className="journey-overview-title">Serüvenlerini buradan yönet</h2>
                    <p className="journey-overview-desc">
                        Her serüven için cüz ilerlemesini tek yerden takip et, kaldığın cüzü aç,
                        tamamlananları işaretle.
                    </p>
                </div>

                <div className="journey-overview-stats">
                    <div className="journey-overview-stat">
                        <span className="journey-stat-value">{overview.totalJourneys}</span>
                        <span className="journey-stat-label">Serüven</span>
                    </div>
                    <div className="journey-overview-stat">
                        <span className="journey-stat-value">{overview.totalCompletedJuz}</span>
                        <span className="journey-stat-label">Tamamlanan Cüz</span>
                    </div>
                    <div className="journey-overview-stat">
                        <span className="journey-stat-value">%{overview.averageProgress}</span>
                        <span className="journey-stat-label">Ortalama İlerleme</span>
                    </div>
                </div>
            </div>

            {journeys.length === 0 && !isCreating && (
                <div className="journey-empty-card">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                    </svg>
                    <p>Henüz serüven yok. Yeni serüven oluşturarak başlayabilirsiniz.</p>
                </div>
            )}

            {journeys.map((journey) => {
                const completedJuz = normalizeCompletedJuz(journey.completedJuz)
                const completedCount = completedJuz.length
                const progress = Math.round((completedCount / 30) * 100)
                const nextJuz = getNextJuz(completedJuz)
                const isExpanded = expandedJourneyId === journey.id

                return (
                    <article key={journey.id} className={`journey-card ${isExpanded ? 'open' : ''}`}>
                        <header className="journey-card-header">
                            <div className="journey-card-main">
                                <div className="journey-card-topline">
                                    <span className="journey-card-tag">SERÜVEN</span>
                                    <span className="journey-card-dot">•</span>
                                    <span className="journey-card-status">
                                        {completedCount === 30 ? 'Tamamlandı' : `${completedCount}/30 Cüz`}
                                    </span>
                                </div>

                                <h3
                                    className="journey-card-name"
                                    contentEditable
                                    suppressContentEditableWarning
                                    spellCheck={false}
                                    onBlur={(event) => {
                                        const fallbackName = journey.name || 'Okuma Serüveni'
                                        const savedName = updateJourneyName(
                                            journey.id,
                                            event.currentTarget.innerText,
                                            fallbackName
                                        )
                                        event.currentTarget.innerText = savedName
                                    }}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault()
                                            event.currentTarget.blur()
                                        }
                                    }}
                                >
                                    {journey.name || 'Okuma Serüveni'}
                                </h3>

                                <div className="journey-card-meta">
                                    <span>%{progress} tamamlandı</span>
                                    <span className="journey-card-dot">•</span>
                                    <span>
                                        {nextJuz ? `Sonraki: ${nextJuz.juz}. Cüz` : 'Tüm cüzler tamamlandı'}
                                    </span>
                                </div>
                            </div>

                            <div className="journey-card-actions">
                                <button
                                    type="button"
                                    className="journey-btn journey-btn-secondary"
                                    onClick={() => {
                                        if (nextJuz) openJuz(nextJuz)
                                    }}
                                    disabled={!nextJuz}
                                >
                                    {nextJuz ? 'Kaldığın Yerden Oku' : 'Tamamlandı'}
                                </button>
                                <button
                                    type="button"
                                    className="journey-btn journey-btn-ghost"
                                    onClick={() => setExpandedJourneyId(isExpanded ? null : journey.id)}
                                >
                                    {isExpanded ? 'Detayı Gizle' : 'Detayı Aç'}
                                </button>
                            </div>
                        </header>

                        <div className="journey-progress-row">
                            <div className="journey-progress-track">
                                <div className="journey-progress-fill" style={{ width: `${progress}%` }} />
                            </div>
                            <span className="journey-progress-value">%{progress}</span>
                        </div>

                        {isExpanded && (
                            <div className="journey-card-body">
                                <div className="journey-card-body-header">
                                    <p className="journey-card-body-note">
                                        Cüz numarasına tıklayarak tamamlandı işareti verin. “Oku” ile
                                        cüzün başlangıç sayfasına geçebilirsiniz.
                                    </p>
                                    <button
                                        type="button"
                                        className="journey-btn journey-btn-danger"
                                        onClick={() => deleteJourney(journey.id)}
                                    >
                                        Serüveni Sil
                                    </button>
                                </div>

                                <div className="journey-juz-grid">
                                    {juzData.map((juz) => {
                                        const isDone = completedJuz.includes(juz.juz)
                                        return (
                                            <div key={juz.juz} className={`journey-juz-item ${isDone ? 'done' : ''}`}>
                                                <button
                                                    type="button"
                                                    className={`journey-juz-toggle ${isDone ? 'done' : ''}`}
                                                    onClick={() => toggleJuzComplete(journey.id, juz.juz)}
                                                    title={isDone ? 'Tamamlandı işaretini kaldır' : 'Tamamlandı olarak işaretle'}
                                                >
                                                    {juz.juz}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="journey-juz-read"
                                                    onClick={() => openJuz(juz)}
                                                >
                                                    Oku
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </article>
                )
            })}

            {isCreating ? (
                <form
                    className="journey-create-card"
                    onSubmit={(event) => {
                        event.preventDefault()
                        createJourney()
                    }}
                >
                    <input
                        type="text"
                        value={newJourneyName}
                        onChange={(event) => setNewJourneyName(event.target.value)}
                        className="journey-create-input"
                        placeholder="Örn. Ramazan Hatmi"
                        autoFocus
                    />
                    <div className="journey-create-actions">
                        <button
                            type="button"
                            className="journey-btn journey-btn-ghost"
                            onClick={() => {
                                setIsCreating(false)
                                setNewJourneyName('')
                            }}
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            className="journey-btn journey-btn-primary"
                            disabled={!newJourneyName.trim()}
                        >
                            Oluştur
                        </button>
                    </div>
                </form>
            ) : (
                <button
                    type="button"
                    className="journey-create-trigger"
                    onClick={() => {
                        if (!isSupporter && journeys.length >= journeyLimit) {
                            window.alert('Yeni serüven açmak için Destekçi üyelik gerekir.')
                            return
                        }
                        setIsCreating(true)
                    }}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                    </svg>
                    Yeni Serüven Oluştur
                </button>
            )}

            {!isSupporter && journeys.length >= journeyLimit && (
                <div className="journey-complete-note">
                    Ek serüven açmak için <strong>Destekçi</strong> profiline geçin.
                </div>
            )}

            {overview.completedJourneys > 0 && (
                <div className="journey-complete-note">
                    Tamamlanan serüven: <strong>{overview.completedJourneys}</strong>
                </div>
            )}
        </section>
    )
}
