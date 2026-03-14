import { useNavigate, Link } from 'react-router-dom';
import { fihristData } from '../data/topicsData';
import GlobalNav from '../components/GlobalNav';
import './FihristPage.css';

function buildLegacySections(group) {
    if (group.subcategories?.length) {
        return group.subcategories;
    }

    if (!group.terms?.length) {
        return [];
    }

    if (group.terms.length <= 8) {
        return [
            {
                title: 'Kelimeler',
                topics: group.terms.map((term) => ({ name: term.name, query: term.query }))
            }
        ];
    }

    const midpoint = Math.ceil(group.terms.length / 2);

    return [
        {
            title: 'Öne Çıkan Kelimeler',
            topics: group.terms.slice(0, midpoint).map((term) => ({ name: term.name, query: term.query }))
        },
        {
            title: 'Diğer Kelimeler',
            topics: group.terms.slice(midpoint).map((term) => ({ name: term.name, query: term.query }))
        }
    ];
}

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
                    <h1 className="fihrist-title">Kur'an Fihristi</h1>
                    <p className="fihrist-subtitle">Kur'an'da geçen kavramlara hızlı erişim</p>
                </div>

                <div className="fihrist-grid">
                    {fihristData.map((group, index) => {
                        const sections = buildLegacySections(group);
                        const description = group.desc || "Kur'an'da öne çıkan kavramlara hızlı erişim";

                        return (
                            <div key={group.title || index} className="fihrist-category-card">
                                <div className="cat-header-wrap">
                                    <h2 className="cat-header">{group.title}</h2>
                                    <p className="cat-desc">{description}</p>
                                </div>

                                <div className="cat-subcategories">
                                    {sections.map((section, sectionIndex) => (
                                        <div key={`${group.title}-${section.title}-${sectionIndex}`} className="subcategory-group">
                                            <h3 className="subcat-title">{section.title}</h3>
                                            <div className="subcat-topics">
                                                {section.topics.map((topic) => (
                                                    <button
                                                        key={`${group.title}-${topic.query}`}
                                                        type="button"
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
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
