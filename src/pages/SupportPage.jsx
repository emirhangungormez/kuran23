import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import GlobalNav from '../components/GlobalNav'
import { useAuth } from '../contexts/AuthContext'
import { useSupporter } from '../contexts/SupporterContext'
import { useSettings } from '../contexts/SettingsContext'
import { getProfileIcon } from '../data/profileIcons'
import './SupportPage.css'

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

const SUPPORT_UNLOCK_ADS = 50

export default function SupportPage() {
    const { isLoggedIn, user } = useAuth()
    const { settings } = useSettings()
    const {
        stats,
        isSupporter,
        isQuickProActive,
        membershipType,
        adsEnabled,
        remainingAdsToUnlock,
        toggleAdsEnabled,
        refresh,
        createMockQuickProReward,
        grantHourlyProAccess,
        canWatchQuickProAd,
        dailyQuickProLimit,
        dailyQuickProUsed,
        dailyQuickProRemaining
    } = useSupporter()
    const icon = getProfileIcon(settings.profileIcon)
    const hasKron23Pro = isSupporter || membershipType === 'quick-pro'
    const displayName = settings.userName || user?.full_name || user?.username || 'Misafir Kullanıcı'
    const displayBio = settings.userBio || 'Kuran-ı Kerim okuyucusu'

    const [isQuickProLoading, setIsQuickProLoading] = useState(false)
    const [overlayMode, setOverlayMode] = useState('none')
    const [overlaySeconds, setOverlaySeconds] = useState(0)
    const [feedback, setFeedback] = useState('')
    const [toggleLoading, setToggleLoading] = useState(false)
    const countdownRef = useRef(null)

    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    useEffect(() => {
        if (!feedback) return undefined
        const timer = window.setTimeout(() => setFeedback(''), 4200)
        return () => window.clearTimeout(timer)
    }, [feedback])

    useEffect(() => {
        return () => {
            if (countdownRef.current) {
                window.clearInterval(countdownRef.current)
                countdownRef.current = null
            }
        }
    }, [])

    const unlockProgress = useMemo(() => {
        const current = Number(stats?.cycle_ads || 0)
        const percentage = Math.min(100, Math.max(0, (current / SUPPORT_UNLOCK_ADS) * 100))
        return { current, percentage }
    }, [stats?.cycle_ads])

    const runOverlayCountdown = async (seconds) => {
        setOverlayMode('watching')
        setOverlaySeconds(seconds)

        await new Promise((resolve) => {
            countdownRef.current = window.setInterval(() => {
                setOverlaySeconds((prev) => {
                    if (prev <= 1) {
                        if (countdownRef.current) {
                            window.clearInterval(countdownRef.current)
                            countdownRef.current = null
                        }
                        resolve()
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        })
    }

    const handleToggleAds = async () => {
        setToggleLoading(true)
        try {
            await toggleAdsEnabled(!adsEnabled)
        } catch {
            // Sessiz geç: destek modu aç/kapat için sağ üst toast gösterme.
        } finally {
            setToggleLoading(false)
        }
    }

    const handleQuickProAccess = async () => {
        if (!isLoggedIn) {
            setFeedback('Hızlı Pro erişim için önce giriş yapmalısınız.')
            return
        }
        if (isSupporter) {
            setFeedback('Kron23 Pro üyeliğiniz aktif. Bu buton size kapalıdır.')
            return
        }
        if (!canWatchQuickProAd) {
            setFeedback('Günlük 3 reklam limitine ulaştınız. Yarın tekrar deneyin.')
            return
        }
        if (isQuickProLoading) return

        setIsQuickProLoading(true)
        try {
            setOverlayMode('loading')
            await wait(900)
            await runOverlayCountdown(5)
            const transactionId = await createMockQuickProReward()
            const grantResult = await grantHourlyProAccess(transactionId)
            setFeedback(grantResult?.message || 'Teşekkürler, 1 saatlik Pro süreniz başladı!')
            await refresh()
        } catch (error) {
            setFeedback(error?.message || 'Saatlik Pro erişim başlatılamadı.')
        } finally {
            setOverlayMode('none')
            setOverlaySeconds(0)
            setIsQuickProLoading(false)
        }
    }

    return (
        <div className="page support-page">
            <GlobalNav />

            {feedback && (
                <div className="support-toast" role="status" aria-live="polite">
                    {feedback}
                </div>
            )}

            {overlayMode !== 'none' && (
                <div className="support-overlay" role="dialog" aria-modal="true" aria-label="Reklam İzleniyor">
                    <div className="support-overlay-card">
                        <span className="overlay-eyebrow">REKLAM MODU</span>
                        <h3>{overlayMode === 'loading' ? 'Reklam hazırlanıyor...' : 'Reklam oynatılıyor'}</h3>
                        <p>
                            {overlayMode === 'loading'
                                ? 'Lütfen bekleyin, doğrulama başlatılıyor.'
                                : `Arayüz kilitlendi. Kalan süre: ${overlaySeconds}s`}
                        </p>
                        <div className={`overlay-loader ${overlayMode === 'watching' ? 'watching' : ''}`} />
                    </div>
                </div>
            )}

            <div className="page-content">
                <div className="page-header-row hidden-mobile">
                    <Link to="/" className="back-link">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                        <span>Ana Sayfa</span>
                    </Link>
                </div>

                {isLoggedIn && (
                    <section className="support-stage">
                        <article className="support-hourly-card">
                            <div className="support-hourly-overlay">
                                <div className="support-hourly-layout">
                                    <div className="support-hourly-main">
                                        <div className="support-hourly-top">
                                            <span className="support-hourly-badge">PROFİL DESTEK KARTI</span>
                                        </div>

                                        <div className="support-hourly-body">
                                            <div className="support-user-strip">
                                                <div className="support-user-avatar">
                                                    {icon.component ? (
                                                        <icon.component size={56} />
                                                    ) : (
                                                        <svg className="support-user-avatar-fallback" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                                            {icon.path}
                                                        </svg>
                                                    )}
                                                </div>
                                                <div className="support-user-copy">
                                                    {isLoggedIn && user?.username && (
                                                        <p className="support-user-handle">
                                                            @{user.username}
                                                        </p>
                                                    )}
                                                    <h1 className="support-user-name">
                                                        {displayName}
                                                    </h1>
                                                    <p className="support-user-bio">{displayBio}</p>
                                                </div>
                                            </div>

                                            <div className="support-hourly-content">
                                                <h2>Tek Reklamla 60 Dakika Pro</h2>
                                                <p>
                                                    Reklam tamamlanınca Pro sürenize +60 dakika eklenir.
                                                    Günlük en fazla {dailyQuickProLimit} kez kullanılabilir.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="support-hourly-meta">
                                            {hasKron23Pro && <span>Kron23 Pro <strong>Aktif</strong></span>}
                                            <span>Bugün <strong>{dailyQuickProUsed}/{dailyQuickProLimit}</strong></span>
                                            <span>Kalan hak <strong>{dailyQuickProRemaining}</strong></span>
                                            <span>Durum <strong>{isQuickProActive ? 'Pro Açık' : 'Pro Kapalı'}</strong></span>
                                        </div>
                                    </div>

                                    <aside className="support-hourly-action">
                                        <p className="support-hourly-action-title">1 Saatlik Pro Erişim</p>
                                        <p className="support-hourly-action-copy">Reklamı tamamlayın, Pro erişim hemen başlasın.</p>
                                        {!isSupporter && (
                                            <button
                                                className={`quick-pro-btn${isQuickProLoading ? ' loading' : ''}`}
                                                onClick={handleQuickProAccess}
                                                disabled={!canWatchQuickProAd || isQuickProLoading}
                                                type="button"
                                            >
                                                {isQuickProLoading ? 'Doğrulanıyor...' : '1 Saatlik Modu Aç'}
                                            </button>
                                        )}
                                        {isSupporter && <p className="quick-pro-hint quick-pro-hint-positive">Kron23 Pro üyeliğiniz aktif.</p>}
                                        {!isSupporter && dailyQuickProRemaining <= 0 && (
                                            <p className="quick-pro-hint">Bugünkü limit doldu. Yarın tekrar deneyebilirsiniz.</p>
                                        )}
                                    </aside>
                                </div>
                            </div>
                        </article>
                    </section>
                )}

                <section className="support-cards">
                    <article className="support-card support-card-merged">
                        <div className="support-merged-grid">
                            <div className="support-merged-panel">
                                <span className="support-badge">Gönüllü Katkı</span>
                                <h3>Reklam Destek Modu</h3>
                                <p>
                                    Bu modu açtığınızda izlediğiniz reklamlar doğrudan katkı sayısına yazılır.
                                    Toplam {SUPPORT_UNLOCK_ADS} reklama ulaştığınızda 1 aylık Pro üyelik açılır.
                                </p>
                                <p className="support-state-copy">
                                    {adsEnabled
                                        ? 'Destek modu açık. Sistem belirli anlarda reklam gösterir ve katkı otomatik işlenir.'
                                        : 'Destek modu kapalı. Reklam katkısı için aktif edebilirsiniz.'}
                                </p>
                                <div className="support-mode-row support-mode-row-centered">
                                    <span className="support-mode-label">Destek Durumu</span>
                                    <button
                                        className={`support-mode-toggle ${adsEnabled ? 'is-on' : ''}`}
                                        onClick={handleToggleAds}
                                        disabled={toggleLoading}
                                        type="button"
                                        aria-label={adsEnabled ? 'Destek modunu kapat' : 'Destek modunu aç'}
                                    >
                                        <span className="support-mode-option off">Pasif</span>
                                        <span className="support-mode-option on">Aktif</span>
                                        <span className="support-mode-thumb" />
                                    </button>
                                </div>
                                {toggleLoading && <p className="support-mode-loading">Durum güncelleniyor...</p>}
                                {!isLoggedIn && (
                                    <p className="support-mode-loading">Misafir modda reklam desteğini açabilirsiniz. Pro üyelik için giriş yapmalısınız.</p>
                                )}
                            </div>

                            <div className="support-merged-panel support-merged-panel-divider">
                                <span className="support-badge">Uzun Vadeli Destek</span>
                                <h3>{SUPPORT_UNLOCK_ADS} Reklamda 1 Aylık Pro</h3>
                                <p>
                                    Bu ilerleme çubuğu aylık Pro hedefinize ne kadar kaldığını gösterir.
                                    Her yeni reklam doğrudan hedefe eklenir.
                                </p>
                                <div className="support-progress-head">
                                    <span>{unlockProgress.current} / {SUPPORT_UNLOCK_ADS} reklam</span>
                                    <span>Kalan: {remainingAdsToUnlock}</span>
                                </div>
                                <div className="support-progress-track">
                                    <div className="support-progress-fill" style={{ width: `${unlockProgress.percentage}%` }} />
                                </div>
                                <ul className="support-feature-list">
                                    <li>Gelişmiş okuma ve dinleme analizi</li>
                                    <li>Sınırsız oynatma listesi oluşturma</li>
                                    <li>Birden fazla okuma serüvenini birlikte sürdürme</li>
                                </ul>
                                <Link to="/ayakta-tutanlar" className="support-sponsor-btn">
                                    Teşekkür Listesini Gör
                                </Link>
                            </div>
                        </div>
                    </article>
                </section>

                {isLoggedIn && (
                    <section className="support-note">
                        <p>
                            Hızlı Pro süresi bittiğinde sayfa yenilemeden erişim otomatik standart moda döner.
                        </p>
                    </section>
                )}
            </div>
        </div>
    )
}


