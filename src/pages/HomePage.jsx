import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { searchQuran as searchApi, getDailyVerse } from '../services/api'
import { searchQuran as searchMock, surahs as allSurahs } from '../data/quranData'
import SearchResults from '../components/SearchResults'
import DailyVerse from '../components/DailyVerse'
import { popularTopics } from '../data/topicsData'
import { sanitizeSearchInput } from '../utils/security'
import { normalizeArabicDisplayText } from '../utils/textEncoding'
import './HomePage.css'

import GlobalNav from '../components/GlobalNav'
import ArabicKeyboard from '../components/ArabicKeyboard'

const HOME_SHORTCUTS = [
    {
        key: 'reading',
        to: '/oku/1',
        badge: 'MUSHAF',
        title: 'Kuran-ı Kerim',
        description: 'Sayfa düzeninde okumaya hemen başla.',
        tone: 'emerald',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M20 22H6.5A2.5 2.5 0 0 1 4 19.5V4a2 2 0 0 1 2-2h14z" />
            </svg>
        )
    },
    {
        key: 'library',
        to: '/kutuphane',
        badge: 'TEFSIR',
        title: 'Tefsir Kütüphanesi',
        description: 'Tefsir ve meal kitaplarını tek yerden aç.',
        tone: 'sand',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 4.5h4a2 2 0 0 1 2 2V20H7a2 2 0 0 0-2 2z" />
                <path d="M19 4.5h-4a2 2 0 0 0-2 2V20h4a2 2 0 0 1 2 2z" />
                <path d="M9 7.5H7.5" />
                <path d="M16.5 7.5H15" />
            </svg>
        )
    },
    {
        key: 'fihrist',
        to: '/fihrist',
        badge: 'REHBER',
        title: 'Fihrist',
        description: 'Sure ve konu başlıklarına doğrudan geç.',
        tone: 'slate',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 6h12" />
                <path d="M8 12h12" />
                <path d="M8 18h12" />
                <path d="M3 6h.01" />
                <path d="M3 12h.01" />
                <path d="M3 18h.01" />
            </svg>
        )
    },
    {
        key: 'moon',
        to: '/ay-evresi',
        badge: 'GÖKYÜZÜ',
        title: 'Ay Mertebesi',
        description: 'Güncel ay evresini tek bakışta gör.',
        tone: 'ink',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.79Z" />
            </svg>
        )
    }
]

const FEATURED_SURAH_IDS = [1, 2, 3, 18, 19, 20, 36, 44, 55, 56, 67, 78, 87, 97, 112, 114]

export default function HomePage() {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState(null)
    const [isFocused, setIsFocused] = useState(false)
    const [useApi, setUseApi] = useState(true)
    const [dailyVerse, setDailyVerse] = useState(null)
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
    const inputRef = useRef(null)
    const location = useLocation()

    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const q = sanitizeSearchInput(params.get('q'))
        if (q) {
            setQuery(q)
            window.scrollTo(0, 0)
        }
    }, [location.search])

    const sanitizedQuery = sanitizeSearchInput(query)

    const { data: dailyVerseData } = useQuery({
        queryKey: ['dailyVerse'],
        queryFn: getDailyVerse,
        staleTime: 1000 * 60 * 60 * 24 // 24 hours
    })

    useEffect(() => {
        if (dailyVerseData) {
            setDailyVerse(dailyVerseData)
        }
    }, [dailyVerseData])

    const {
        data: searchData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage
    } = useInfiniteQuery({
        queryKey: ['search', sanitizedQuery, useApi],
        queryFn: async ({ pageParam = 1 }) => {
            if (!useApi || sanitizedQuery.trim().length < 1) return null;
            const res = await searchApi(sanitizedQuery, 30, pageParam);
            if (!res) {
                setUseApi(false);
                return searchMock(sanitizedQuery);
            }
            return res;
        },
        getNextPageParam: (lastPage, allPages) => {
            // Check if we have more results based on total count
            if (!lastPage || !lastPage.total) return undefined;
            const currentTotal = allPages.reduce((acc, curr) => acc + (curr?.verses?.length || 0), 0);
            return currentTotal < lastPage.total ? allPages.length + 1 : undefined;
        },
        enabled: sanitizedQuery.trim().length >= 1,
        staleTime: 1000 * 60 * 5 // 5 minutes cache for searches
    });

    useEffect(() => {
        if (sanitizedQuery.trim().length >= 1) {
            if (!useApi) {
                setResults(searchMock(sanitizedQuery))
            } else if (searchData) {
                // Flatten pages for backward compatibility
                const firstPage = searchData.pages[0];
                if (!firstPage) {
                    setResults(null);
                    return;
                }

                const combinedVerses = searchData.pages.flatMap(p => p?.verses || []);
                // Assuming surahs usually come in the first page or we merge them uniquely
                const combinedSurahs = searchData.pages.flatMap(p => p?.surahs || []).filter((v, i, a) => a.findIndex(v2 => (v2.no === v.no)) === i);

                setResults({
                    total: firstPage.total || 0,
                    surahs: combinedSurahs,
                    verses: combinedVerses
                });
            }
        } else {
            setResults(null)
            setUseApi(true) // reset api fallback on empty query
        }
    }, [sanitizedQuery, searchData, useApi])

    const handleLoadMore = () => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }

    const featuredSurahs = allSurahs.filter((surah) => FEATURED_SURAH_IDS.includes(surah.no))

    return (
        <div className="home">
            <GlobalNav />

            <div className={`search-area${results ? ' has-results' : ''}`}>
                <div className="search-header">
                    <img src="/kuran.svg" alt="kuran23 Logo" className="search-main-logo" />
                    <p className="search-subtitle">Ayet ve sure arayın</p>
                </div>

                <div className={`search-box${isFocused ? ' focused' : ''}`}>
                    <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                        ref={inputRef}
                        type="text"
                        className="search-input"
                        placeholder="Sure adı, ayet metni veya numara ara..."
                        value={sanitizedQuery}
                        onChange={(e) => setQuery(sanitizeSearchInput(e.target.value))}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                    />
                    {sanitizedQuery && (
                        <button className="search-clear" onClick={() => { setQuery(''); inputRef.current?.focus() }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                    <button
                        className={`keyboard-toggle-btn ${isKeyboardOpen ? 'active' : ''}`}
                        onClick={() => setIsKeyboardOpen(!isKeyboardOpen)}
                        title="Arapça Klavye"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="5" width="20" height="14" rx="2" ry="2" />
                            <line x1="7" y1="15" x2="7.01" y2="15" />
                            <line x1="12" y1="15" x2="12.01" y2="15" />
                            <line x1="17" y1="15" x2="17.01" y2="15" />
                            <line x1="7" y1="10" x2="7.01" y2="10" />
                            <line x1="12" y1="10" x2="12.01" y2="10" />
                            <line x1="17" y1="10" x2="17.01" y2="10" />
                        </svg>
                    </button>

                    {isKeyboardOpen && (
                        <ArabicKeyboard
                            onKeyClick={(key) => {
                                setQuery(prev => sanitizeSearchInput(prev + key));
                                inputRef.current?.focus();
                            }}
                            onBackspace={() => {
                                setQuery(prev => prev.slice(0, -1));
                                inputRef.current?.focus();
                            }}
                            onClose={() => setIsKeyboardOpen(false)}
                        />
                    )}
                </div>

            </div>

            <div className="home-content">
                {results ? (
                    <SearchResults
                        results={results}
                        query={sanitizedQuery}
                        onLoadMore={handleLoadMore}
                        isLoadingMore={isFetchingNextPage}
                    />
                ) : (
                    <>
                        <div className="home-sections-grid">
                            <section className="quick-links-section">
                                <div className="section-head">
                                    <div>
                                        <h2 className="section-title">Hızlı Erişim</h2>
                                        <p className="section-note">Ana akışlar ilk ekranda.</p>
                                    </div>
                                </div>
                                <div className="quick-links-grid">
                                    {HOME_SHORTCUTS.map((item, index) => (
                                        <Link
                                            key={item.key}
                                            to={item.to}
                                            className={`quick-link-card tone-${item.tone}`}
                                            style={{ animationDelay: `${index * 0.04}s` }}
                                        >
                                            <div className="quick-link-head">
                                                <span className="quick-link-icon">{item.icon}</span>
                                                <span className="quick-link-badge">{item.badge}</span>
                                            </div>
                                            <div className="quick-link-body">
                                                <h3>{item.title}</h3>
                                                <p>{item.description}</p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </section>

                            <section className="popular-section">
                                <div className="section-head">
                                    <div>
                                        <h2 className="section-title">Sık Açılan Sureler</h2>
                                        <p className="section-note">Okumaya hızlı başlamak için seçili sureler.</p>
                                    </div>
                                    <Link to="/fihrist" className="section-link">Tüm sureler</Link>
                                </div>
                                <div className="popular-grid">
                                    {featuredSurahs.map((surah, index) => (
                                        <Link
                                            key={surah.no}
                                            to={`/sure/${surah.no}`}
                                            className="popular-card"
                                            style={{ animationDelay: `${index * 0.03}s` }}
                                        >
                                            <span className="popular-no">{surah.no}</span>
                                            <div className="popular-info">
                                                <span className="popular-name-ar">{normalizeArabicDisplayText(surah.nameAr)}</span>
                                                <span className="popular-name-tr">{surah.nameTr}</span>
                                            </div>
                                            <div className="popular-meta">
                                                <span className="popular-ayah">{surah.ayahCount} Ayet</span>
                                                <span className={`surah-type-badge ${surah.type?.toLowerCase()}`}>{surah.type}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </section>

                            <div className="explore-topics-section">
                                <div className="section-head">
                                    <div>
                                        <h2 className="section-title">Konuları Keşfedin</h2>
                                        <p className="section-note">Aramaya tek dokunuşla başlayın.</p>
                                    </div>
                                </div>
                                <div className="horizontal-topics">
                                    {popularTopics.map((topic) => {
                                        const label = typeof topic === 'string' ? topic : topic.label
                                        const searchQuery = sanitizeSearchInput(typeof topic === 'string' ? topic : (topic.query || topic.label))
                                        const isArabic = typeof topic === 'object' && topic.lang === 'ar'
                                        return (
                                        <button
                                            key={searchQuery}
                                            className={`topic-tag-chip ${isArabic ? 'topic-tag-chip-ar' : ''}`}
                                            dir={isArabic ? 'rtl' : 'ltr'}
                                            onClick={() => {
                                                setQuery(searchQuery);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                inputRef.current?.focus();
                                            }}
                                        >
                                            {isArabic ? label : `#${label}`}
                                        </button>
                                        )
                                    })}
                                    <Link to="/fihrist" className="topic-tag-chip all-topics">Tümünü Gör</Link>
                                </div>
                            </div>

                            <section className="daily-verse-home-section">
                                <div className="section-head">
                                    <div>
                                        <h2 className="section-title">Günün Ayeti</h2>
                                        <p className="section-note">İsterseniz en sonda günlük bir durak.</p>
                                    </div>
                                </div>
                                <DailyVerse verse={dailyVerse} />
                            </section>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}



