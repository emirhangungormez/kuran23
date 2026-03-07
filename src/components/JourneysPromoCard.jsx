import { Link } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import './JourneysPromoCard.css'

export default function JourneysPromoCard() {
    const { settings } = useSettings()
    const journeysCount = settings.readingJourneys?.length || 0
    const hatimCount = settings.hatimCount || 0
    const headline = journeysCount > 0 ? `${journeysCount} Aktif Serüven` : 'Yeni Serüven Başlat'
    const actionLabel = journeysCount > 0 ? 'Serüvenlere Git' : 'Hemen Başla'
    const description = hatimCount > 0
        ? `Tamamlanan hatim: ${hatimCount}`
        : 'Kuran okuma hedeflerinizi takip edin'

    return (
        <div className="last-read-container">
            <h2 className="profile-section-title">Okuma Serüvenleri</h2>
            <Link to="/seruvenler" className="last-read-card journeys-promo-card">
                <div className="journeys-promo-overlay">
                    <span className="journeys-promo-badge">HEDEFLER</span>

                    <div className="journeys-promo-content">
                        <h3>{headline}</h3>
                        <p>{description}</p>
                    </div>

                    <div className="journeys-promo-action">
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
