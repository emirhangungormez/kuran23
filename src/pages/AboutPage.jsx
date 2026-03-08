import './AboutPage.css'
import { Link } from 'react-router-dom'
import { useEffect } from 'react'
import GlobalNav from '../components/GlobalNav'

export default function AboutPage() {
    useEffect(() => {
        window.scrollTo(0, 0)
    }, [])

    return (
        <div className="page about-page">
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

                <section className="about-hero">
                    <div className="about-hero-card">
                        <div className="about-hero-main">
                            <span className="about-hero-eyebrow">PROJE HAKKINDA</span>
                            <h1>Hakkımızda</h1>
                            <p>
                                kuran23, Kur'an-ı Kerim'i daha düzenli, sade ve karşılaştırmalı biçimde incelemek isteyenler için
                                geliştirilen modern bir dijital çalışma alanıdır.
                            </p>
                        </div>
                        <div className="about-hero-meta">
                            <div className="about-meta-item">
                                <span className="about-meta-label">Yaklaşım</span>
                                <span className="about-meta-value">Sade ve Güvenilir</span>
                            </div>
                            <div className="about-meta-item">
                                <span className="about-meta-label">Model</span>
                                <span className="about-meta-value">Bağımsız Geliştirme</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="about-grid">
                    <article className="about-card">
                        <h2>Projenin Amacı</h2>
                        <p>
                            Bu proje, kişisel mushaf notlarını daha işlevsel hale getirme ihtiyacından doğdu. Zamanla herkesin
                            kullanabileceği, araştırma odaklı bir yapıya dönüştü.
                        </p>
                        <p>
                            Hedefimiz; Kur'an metnini, farklı anlam katmanlarını ve konu başlıklarını tek çatı altında anlaşılır bir
                            düzenle sunmaktır.
                        </p>
                    </article>

                    <article className="about-card">
                        <h2>İlmi Çerçeve</h2>
                        <p>
                            İçerikler geleneksel ilmi birikimi merkeze alan, Ehl-i Sünnet çizgisini gözeten bir hassasiyetle
                            düzenlenir. Amaç bir görüş dayatmak değil, düzenli inceleme imkanı sunmaktır.
                        </p>
                    </article>

                    <article className="about-card">
                        <h2>Bağımsızlık ve Şeffaflık</h2>
                        <p>
                            kuran23 herhangi bir kurum veya yapıya bağlı değildir. Uygulama ücretsizdir; destek modeli tamamen
                            gönüllülük esasına dayanır.
                        </p>
                        <p>
                            Destek süreçlerini görmek için <Link to="/destek" className="about-inline-link">Destek</Link> sayfasını
                            inceleyebilirsiniz.
                        </p>
                    </article>

                    <article className="about-card">
                        <h2>Teknik Altyapı</h2>
                        <div className="about-tech-list">
                            <div className="about-tech-row"><strong>Frontend:</strong> React + Vite</div>
                            <div className="about-tech-row"><strong>Backend:</strong> PHP</div>
                            <div className="about-tech-row"><strong>Veritabanı:</strong> MySQL</div>
                            <div className="about-tech-row"><strong>Veri Kaynağı:</strong> AçıkKuran API + Diyanet açık kaynak çalışmaları</div>
                        </div>
                    </article>

                    <article className="about-card">
                        <h2>Kaynaklar ve Lisans</h2>
                        <div className="about-tech-list">
                            <div className="about-tech-row"><strong>Kullanım Notu:</strong> Ticari kullanım kaynak lisanslarına göre değerlendirilir, atıf kontrolü zorunludur.</div>
                            <div className="about-tech-row"><strong>Görünürlük:</strong> Lisans/atıf detayları yalnızca bu sayfada merkezi olarak tutulur.</div>
                        </div>
                    </article>

                    <article className="about-card about-card-wide">
                        <h2>Geliştirilenler ve Yol Haritası</h2>
                        <div className="about-roadmap-board">
                            <section className="about-roadmap-col is-done">
                                <header className="about-roadmap-head">
                                    <h3>Tamamlananlar</h3>
                                    <span className="about-roadmap-count">2</span>
                                </header>
                                <div className="about-roadmap-items">
                                    <article className="about-roadmap-item">
                                        <div className="about-roadmap-item-top">
                                            <strong>Kur'an Okuma Altyapısı</strong>
                                            <span className="roadmap-badge done">Tamamlandı</span>
                                        </div>
                                        <p>Sure/ayet okuma, sekmeli içerik düzeni ve temel dinleme akışı aktif.</p>
                                    </article>
                                    <article className="about-roadmap-item">
                                        <div className="about-roadmap-item-top">
                                            <strong>Diyanet + AçıkKuran Entegrasyonu</strong>
                                            <span className="roadmap-badge done">Tamamlandı</span>
                                        </div>
                                        <p>Meal/tefsir içeriklerini farklı kaynaklardan tek düzen içinde sunan temel yapı hazır.</p>
                                    </article>
                                </div>
                            </section>

                            <section className="about-roadmap-col is-progress">
                                <header className="about-roadmap-head">
                                    <h3>İşlemde Olanlar</h3>
                                    <span className="about-roadmap-count">3</span>
                                </header>
                                <div className="about-roadmap-items">
                                    <article className="about-roadmap-item">
                                        <div className="about-roadmap-item-top">
                                            <strong>Hafızlar İçin Ezber Sistemi</strong>
                                            <span className="roadmap-badge progress">İşlemde</span>
                                        </div>
                                        <p>Tekrar planı, hedef takibi ve ezber oturumlarını destekleyen modüller eklenecek.</p>
                                    </article>
                                    <article className="about-roadmap-item">
                                        <div className="about-roadmap-item-top">
                                            <strong>Zikir Sistemi</strong>
                                            <span className="roadmap-badge progress">İşlemde</span>
                                        </div>
                                        <p>Günlük zikir akışı, sayaç ve kişisel takip özellikleri bir sonraki fazda sunulacak.</p>
                                    </article>
                                    <article className="about-roadmap-item">
                                        <div className="about-roadmap-item-top">
                                            <strong>Mobil Uygulama</strong>
                                            <span className="roadmap-badge progress">İşlemde</span>
                                        </div>
                                        <p>Android/iOS için çevrimdışı desteği güçlendirilmiş daha hızlı bir deneyim hedefleniyor.</p>
                                    </article>
                                </div>
                            </section>

                            <section className="about-roadmap-col is-next">
                                <header className="about-roadmap-head">
                                    <h3>Gelecek Planları</h3>
                                    <span className="about-roadmap-count">2</span>
                                </header>
                                <div className="about-roadmap-items">
                                    <article className="about-roadmap-item">
                                        <div className="about-roadmap-item-top">
                                            <strong>Hadis Ekosistemi</strong>
                                            <span className="roadmap-badge next">Planlandı</span>
                                        </div>
                                        <p>Kaynak, konu ve arama odaklı hadis inceleme alanı kademeli olarak hazırlanıyor.</p>
                                    </article>
                                    <article className="about-roadmap-item">
                                        <div className="about-roadmap-item-top">
                                            <strong>Yapay Zeka Destekli Sohbet</strong>
                                            <span className="roadmap-badge next">Planlandı</span>
                                        </div>
                                        <p>Kur'an merkezli sorular için bağlamsal ve kontrollü yardımcı sohbet deneyimi geliştiriliyor.</p>
                                    </article>
                                </div>
                            </section>
                        </div>
                    </article>
                </section>

                <section className="about-source-note">
                    <p>
                        Açık veri ekosistemine katkıları için <strong>AçıkKuran</strong> ve <strong>Diyanet</strong> ekiplerine teşekkür ederiz.
                    </p>
                    <div className="about-source-actions">
                        <a href="https://github.com/acikkuran" target="_blank" rel="noopener noreferrer" className="about-source-btn">
                            AçıkKuran GitHub
                        </a>
                        <a href="https://github.com/diyanet" target="_blank" rel="noopener noreferrer" className="about-source-btn">
                            Diyanet GitHub
                        </a>
                    </div>
                </section>
            </div>
        </div>
    )
}
