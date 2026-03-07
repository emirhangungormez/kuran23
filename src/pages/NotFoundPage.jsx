import React from 'react';
import { Link } from 'react-router-dom';
import GlobalNav from '../components/GlobalNav';
import './NotFoundPage.css';

export default function NotFoundPage() {
    return (
        <div className="page not-found-page">
            <GlobalNav />
            <div className="page-content">
                <Link to="/" className="back-link hidden-mobile">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                    <span>Ana Sayfa</span>
                </Link>

                <div className="nf-v4-main">
                    <div className="nf-v4-left">
                        <div className="nf-v4-header">
                            <span className="nf-v4-code">ERROR • 404</span>
                            <div className="nf-v4-line" />
                        </div>

                        <div className="nf-v4-quote-area">
                            <h2 className="nf-v4-arabic" dir="rtl">فَاَيْنَ تَذْهَبُونَؕ</h2>
                            <div className="nf-v4-translation">
                                <p className="nf-v4-tr-text">"Öyleyse nereye gidiyorsunuz?"</p>
                                <span className="nf-v4-ref">Tekvîr Suresi, 26. Ayet</span>
                            </div>
                        </div>

                        <div className="nf-v4-footer">
                            <p className="nf-v4-hint">Aradığınız sayfa mevcudiyetini yitirmiş veya hiç var olmamış olabilir.</p>
                        </div>
                    </div>

                    <div className="nf-v4-right">
                        <div className="nf-v4-img-wrapper">
                            <img src="/404.png" alt="Lost traveler" className="nf-v4-image" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
