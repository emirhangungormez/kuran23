import { useNavigate, Link } from 'react-router-dom';
import { fihristData } from '../data/topicsData';
import GlobalNav from '../components/GlobalNav';
import './FihristPage.css';

export default function FihristPage() {
    const navigate = useNavigate();

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
                    <h1 className="fihrist-title">Kuran Fihristi</h1>
                    <p className="fihrist-subtitle">Kur'an'da öne çıkan başlıklara hızlı erişim</p>
                </div>

                <div className="fihrist-grid">
                    {fihristData.map((category, idx) => (
                        <div key={idx} className="fihrist-category-card">
                            <div className="cat-header-wrap">
                                <h2 className="cat-header">
                                    {category.title}
                                </h2>
                                <p className="cat-desc">{category.desc}</p>
                            </div>

                            <div className="cat-subcategories">
                                {category.subcategories.map((sub, subIdx) => (
                                    <div key={subIdx} className="subcategory-group">
                                        <h3 className="subcat-title">{sub.title}</h3>
                                        <div className="subcat-topics">
                                            {sub.topics.map((topic, tIdx) => (
                                                <button
                                                    key={tIdx}
                                                    className="fihrist-topic-tag"
                                                    onClick={() => handleTopicClick(topic.query)}
                                                >
                                                    #{topic.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
