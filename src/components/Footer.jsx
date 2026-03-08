import './Footer.css'

export default function Footer() {
    const year = new Date().getFullYear()

    return (
        <footer className="site-footer">
            <div className="footer-container">
                <div className="footer-surface">
                    <div className="footer-top">
                        <div className="footer-col footer-brand">
                            <p>Kur'an-ı Kerim için sade, hızlı ve odaklı bir dijital okuma deneyimi.</p>
                        </div>

                        <div className="footer-col">
                            <h4>Keşfet</h4>
                            <a href="/hakkimizda" className="footer-link">Hakkımızda</a>
                            <a href="/fihrist" className="footer-link">Fihrist</a>
                            <a href="/ayakta-tutanlar" className="footer-link">Teşekkür Listesi</a>
                            <a href="/destek" className="footer-link">Destek</a>
                        </div>

                        <div className="footer-col">
                            <h4>Uygulama</h4>
                            <a href="/ay-evresi" className="footer-link">Ay Bölümü</a>
                            <a href="/profil" className="footer-link">Profil</a>
                            <a href="/oku/1" className="footer-link">Kuran Oku</a>
                        </div>

                        <div className="footer-col footer-cta">
                            <a href="/destek" className="footer-donate-btn">
                                <span>Projeyi Destekle</span>
                                <span className="footer-donate-heart" aria-hidden="true">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                    </svg>
                                </span>
                            </a>
                            <span className="footer-cta-note">Reklamsız ve sürdürülebilir kalması için katkı sun.</span>
                        </div>
                    </div>

                    <div className="footer-logo-wrap" aria-hidden="true">
                        <img src="/kuran.svg" alt="" className="footer-giant-logo" />
                    </div>
                </div>

                <div className="footer-bottom">
                    <p>
                        (c) {year} Bu site{' '}
                        <a href="https://emirhangungormez.com.tr" target="_blank" rel="noopener noreferrer" className="dev-link">
                            Emirhan Güngörmez
                        </a>{' '}
                        tarafından hazırlanmıştır.
                    </p>
                    <div className="footer-meta-links">
                        <a href="/hakkimizda" className="footer-link">Gizlilik</a>
                        <span className="footer-dot">•</span>
                        <a href="/destek" className="footer-link">Sürümü Destekle</a>
                    </div>
                </div>
            </div>
        </footer>
    )
}
