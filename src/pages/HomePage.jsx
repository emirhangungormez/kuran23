import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { searchQuran as searchApi, getDailyVerse } from '../services/api'
import { searchQuran as searchMock, surahs as allSurahs } from '../data/quranData'
import SearchResults from '../components/SearchResults'
import DailyVerse from '../components/DailyVerse'
import { popularTopics } from '../data/topicsData'
import { sanitizeSearchInput } from '../utils/security'
import './HomePage.css'

import { useBookmarks } from '../contexts/BookmarksContext'
import GlobalNav from '../components/GlobalNav'
import ArabicKeyboard from '../components/ArabicKeyboard'

export default function HomePage() {
    const { bookmarks } = useBookmarks()
    const { lastPage, stringBookmark } = bookmarks
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

    const popularSurahs = allSurahs.filter(s =>
        [1, 2, 18, 36, 55, 56, 67, 112].includes(s.no)
    )

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
                            <DailyVerse verse={dailyVerse} />

                            <div className="popular-section">
                                <h2 className="section-title">Popüler Sureler</h2>
                                <div className="popular-grid">
                                    {popularSurahs.map((s, i) => (
                                        <Link key={s.no} to={`/sure/${s.no}`} className="popular-card" style={{ animationDelay: `${i * 0.05}s` }}>
                                            <div className="popular-no">{s.no}</div>
                                            <div className="popular-info">
                                                <span className="popular-name-ar">{s.nameAr}</span>
                                                <span className="popular-name-tr">{s.nameTr}</span>
                                            </div>
                                            <div className="popular-meta">
                                                <span className="popular-ayah">{s.ayahCount} Ayet</span>
                                                <span className={`surah-type-badge ${s.type?.toLowerCase()}`}>{s.type}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            <section className="quick-links-section">
                                <h2 className="section-title">Hızlı Erişim</h2>
                                <div className="home-promo-row">
                                <Link to="/ay-evresi" className="moon-promo-card">
                                    <div className="moon-promo-overlay">
                                            <span className="moon-promo-badge">GÖKYÜZÜ</span>
                                        <div className="moon-promo-content">
                                            <h3>Ay Mertebesi</h3>
                                            <p>Mevcut ay evresini takip edin.</p>
                                        </div>
                                    </div>
                                </Link>

                                <Link to="/oku/1" className="quran-promo-card">
                                    <div className="quran-promo-overlay">
                                        <span className="quran-promo-badge">MUSHAF</span>
                                            <div className="quran-promo-content">
                                                <h3>Kuran-ı Kerim</h3>
                                                <p>Baştan sona düzenli Kur'an okuma.</p>
                                            </div>
                                        </div>
                                    </Link>

                                <Link to="/tefsirler" className="tafsir-promo-card">
                                    <div className="tafsir-promo-overlay">
                                        <span className="tafsir-promo-badge">KÜTÜPHANE</span>
                                        <div className="tafsir-promo-content">
                                            <h3>Tefsirler</h3>
                                            <p>Kitap düzeninde kaynak tefsirleri okuyun.</p>
                                        </div>
                                    </div>
                                </Link>

                                </div>
                            </section>
                        </div>

                        <div className="explore-topics-section">
                            <h2 className="section-title">Konuları Keşfedin</h2>
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
                    </>
                )}
            </div>
        </div>
    )
}
