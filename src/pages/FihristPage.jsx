import { useNavigate, Link } from 'react-router-dom';
import { fihristData } from '../data/topicsData';
import GlobalNav from '../components/GlobalNav';
import './FihristPage.css';

export default function FihristPage() {
    const navigate = useNavigate();
    const featuredGroup = fihristData[0];
    const secondaryGroups = fihristData.slice(1);

    const handleTopicClick = (query) => {
        navigate(`/?q=${encodeURIComponent(query)}`);
    };

    return (
        <div className="page fihrist-page">
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

                <div className="fihrist-hero">
                    <span className="fihrist-kicker">Kelime Fihristi</span>
                    <h1 className="fihrist-title">Kur'an'da geçen kavramlar</h1>
                    <p className="fihrist-subtitle">Konu rehberi gibi değil, doğrudan kelime ve kavram araması için hazırlanmış hızlı erişim alanı.</p>
                </div>

                {featuredGroup && (
                    <section className={`fihrist-featured-card accent-${featuredGroup.accent}`}>
                        <div className="fihrist-featured-head">
                            <div>
                                <p className="fihrist-featured-label">{featuredGroup.title}</p>
                                <h2>Doğrudan aranan kelimeler</h2>
                            </div>
                            <span className="fihrist-featured-count">{featuredGroup.terms.length} kelime</span>
                        </div>
                        <div className="fihrist-chip-cloud">
                            {featuredGroup.terms.map((term) => (
                                <button
                                    key={term.query}
                                    type="button"
                                    className="fihrist-chip fihrist-chip-featured"
                                    onClick={() => handleTopicClick(term.query)}
                                >
                                    {term.name}
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                <div className="fihrist-sections-grid">
                    {secondaryGroups.map((group) => (
                        <section key={group.title} className={`fihrist-keyword-card accent-${group.accent}`}>
                            <div className="fihrist-section-head">
                                <h2>{group.title}</h2>
                                <span>{group.terms.length} kelime</span>
                            </div>
                            <div className="fihrist-chip-cloud">
                                {group.terms.map((term) => (
                                    <button
                                        key={term.query}
                                        type="button"
                                        className="fihrist-chip"
                                        onClick={() => handleTopicClick(term.query)}
                                    >
                                        {term.name}
                                    </button>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
