import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import GlobalNav from '../components/GlobalNav'
import ReadingJourney from '../components/ReadingJourney'
import './JourneysPage.css'

export default function JourneysPage() {
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    return (
        <div className="page journeys-view">
            <GlobalNav backTo="/profil" backLabel="Profil" />
            <div className="page-content journeys-page-content">
                <div className="journeys-page-top">
                    <Link to="/profil" className="back-link journeys-back-link">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                        <span>Profil</span>
                    </Link>
                </div>

                <header className="journeys-page-header">
                    <h1 className="journeys-page-title">Okuma Serüvenleri</h1>
                    <p className="journeys-page-desc">
                        Düzenli okuma için serüven oluşturun, cüz ilerlemenizi işaretleyin ve
                        kaldığınız yerden doğrudan okumaya devam edin.
                    </p>
                </header>

                <ReadingJourney />
            </div>
        </div>
    )
}
