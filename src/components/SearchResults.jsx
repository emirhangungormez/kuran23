import { Link } from 'react-router-dom'
import './SearchResults.css'

const ARABIC_RE = /[\u0600-\u06FF]/

function hasArabic(input) {
    return ARABIC_RE.test(input || '')
}

function normalizeArabicChar(ch) {
    if (/[\u064B-\u065F\u0670\u06D6-\u06ED]/.test(ch)) return ''
    if (ch === '\u0640') return ''

    if ('\u0622\u0623\u0625\u0671'.includes(ch)) return '\u0627'
    if (ch === '\u0649') return '\u064A'
    if (ch === '\u0629') return '\u0647'

    return ch
}

function normalizeArabicWithMap(text) {
    let normalized = ''
    const map = []

    for (let i = 0; i < text.length; i += 1) {
        const n = normalizeArabicChar(text[i])
        if (!n) continue
        normalized += n
        map.push(i)
    }

    return { normalized, map }
}

function highlightArabicText(text, query) {
    if (!query || query.length < 1 || !text) return text

    const nq = normalizeArabicWithMap(query).normalized
    if (!nq) return text

    const { normalized: nt, map } = normalizeArabicWithMap(text)
    if (!nt) return text

    const ranges = []
    let start = nt.indexOf(nq)
    while (start !== -1) {
        const end = start + nq.length - 1
        if (map[start] !== undefined && map[end] !== undefined) {
            ranges.push([map[start], map[end] + 1])
        }
        start = nt.indexOf(nq, start + 1)
    }

    if (!ranges.length) return text

    const merged = []
    for (const [s, e] of ranges) {
        if (!merged.length || s > merged[merged.length - 1][1]) {
            merged.push([s, e])
        } else {
            merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e)
        }
    }

    const out = []
    let cursor = 0
    merged.forEach(([s, e], i) => {
        if (cursor < s) out.push(text.slice(cursor, s))
        out.push(<mark key={`ar-${i}`} className="highlight">{text.slice(s, e)}</mark>)
        cursor = e
    })
    if (cursor < text.length) out.push(text.slice(cursor))

    return out
}

function highlightText(text, query) {
    if (!query || query.length < 2 || !text) return text

    if (hasArabic(query) && hasArabic(text)) {
        return highlightArabicText(text, query)
    }

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) => (
        i % 2 === 1 ? <mark key={i} className="highlight">{part}</mark> : part
    ))
}

export default function SearchResults({ results, query, onLoadMore, isLoadingMore }) {
    const { surahs, verses, total } = results
    const currentCount = surahs.length + verses.length

    if (total === 0) {
        return (
            <div className="sr-empty">
                <div className="sr-empty-icon">
                    <svg viewBox="0 0 64 64" fill="none">
                        <circle cx="28" cy="28" r="18" stroke="var(--text-tertiary)" strokeWidth="2.5" />
                        <path d="M42 42l12 12" stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                </div>
                <h3 className="sr-empty-title">Sonuç bulunamadı</h3>
                <p className="sr-empty-desc">"{query}" için eşleşen ayet veya sure bulunamadı.</p>
            </div>
        )
    }

    return (
        <div className="sr">
            <p className="sr-count">{total} sonuç bulundu</p>

            {surahs.length > 0 && (
                <div className="sr-section">
                    <h3 className="sr-section-title">Sureler</h3>
                    {surahs.map((s, i) => (
                        <Link key={s.no} to={`/sure/${s.no}`} className="sr-surah" style={{ animationDelay: `${i * 0.04}s` }}>
                            <div className="sr-surah-no">{s.no}</div>
                            <div className="sr-surah-body">
                                <div className="sr-surah-top">
                                    <span className="sr-surah-name">{highlightText(s.nameTr, query)}</span>
                                    <span className="sr-surah-ar" dir="rtl">{s.nameAr}</span>
                                </div>
                                <div className="sr-surah-meta">
                                    {s.nameEn && <><span>{s.nameEn}</span><span>·</span></>}
                                    <span>{s.ayahCount} ayet</span>
                                </div>
                            </div>
                            <svg className="sr-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M9 18l6-6-6-6" />
                            </svg>
                        </Link>
                    ))}
                </div>
            )}

            {verses.length > 0 && (
                <div className="sr-section">
                    <h3 className="sr-section-title">Ayetler</h3>
                    {verses.map((v, i) => (
                        <Link key={`${v.surahNo}-${v.ayah}-${i}`} to={`/sure/${v.surahNo}/${v.ayah}`} className="sr-verse" style={{ animationDelay: `${(surahs.length + i) * 0.04}s` }}>
                            <div className="sr-verse-ref">
                                <span className="sr-verse-surah">{v.surahTr}</span>
                                <span className="sr-verse-ayah">{v.surahNo}:{v.ayah}</span>
                                {v.translationLang && (
                                    <span className={`sr-translation-lang ${String(v.translationLang).toLowerCase()}`}>
                                        {String(v.translationLang).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <p className="sr-verse-ar" dir="rtl">{highlightText(v.textAr, query)}</p>
                            <p className="sr-verse-tr">{highlightText(v.textTr, query)}</p>
                        </Link>
                    ))}
                </div>
            )}

            {total > currentCount && (
                <div className="sr-load-more">
                    <button
                        className={`sr-load-btn ${isLoadingMore ? 'loading' : ''}`}
                        onClick={onLoadMore}
                        disabled={isLoadingMore}
                    >
                        {isLoadingMore ? (
                            <div className="sr-spinner"></div>
                        ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                        )}
                        {isLoadingMore ? 'Yükleniyor...' : 'Daha Fazla Sonuç Göster'}
                    </button>
                    <p className="sr-load-info">{total - currentCount} sonuç daha var</p>
                </div>
            )}
        </div>
    )
}
