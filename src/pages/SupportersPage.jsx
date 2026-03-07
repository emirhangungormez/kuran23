import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import GlobalNav from '../components/GlobalNav'
import { API_BASE } from '../services/api'
import { getProfileIcon } from '../data/profileIcons'
import './SupportersPage.css'

const PINNED_CONTRIBUTORS = [
    {
        user_id: 'pinned-emirhan',
        full_name: 'Emirhan',
        profile_icon: 'muessis',
        is_supporter: true
    }
]

async function fetchContributors() {
    const res = await fetch(`${API_BASE}/supporters.php?action=contributors&limit=160`)
    const data = await res.json()
    if (!res.ok || !data?.success) {
        throw new Error(data?.error || 'Teşekkür listesi yüklenemedi.')
    }
    return data.contributors || []
}

export default function SupportersPage() {
    const { data: contributors = [], isLoading, isError, error } = useQuery({
        queryKey: ['supporterContributorsWall'],
        queryFn: fetchContributors,
        staleTime: 1000 * 60 * 5
    })

    const renderName = (row) => {
        const fullName = String(row.full_name || '').trim()
        return fullName || 'İsmi paylaşılmıyor'
    }

    const uniqueContributors = useMemo(() => {
        const source = [...PINNED_CONTRIBUTORS, ...contributors]
        const seen = new Set()
        return source.filter((row) => {
            const key = Number(row.user_id || 0) || renderName(row).toLowerCase()
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    }, [contributors])

    return (
        <div className="page supporters-page">
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

                <section className="supporters-hero">
                    <div className="supporters-hero-card">
                        <div className="supporters-hero-main">
                            <span className="supporters-eyebrow">TEŞEKKÜR PANOSU</span>
                            <h1>Katkıda Bulunanlar Listesi</h1>
                            <p>
                                Bu alanda gönüllü reklam desteği veren kullanıcıların isimleri yer alır.
                                Sıra veya puan gösterilmez.
                            </p>
                        </div>
                        <div className="supporters-hero-meta">
                            <div className="supporters-meta-item">
                                <span className="supporters-meta-label">Toplam İsim</span>
                                <span className="supporters-meta-value">{uniqueContributors.length}</span>
                            </div>
                            <div className="supporters-meta-item">
                                <span className="supporters-meta-label">Model</span>
                                <span className="supporters-meta-value">Sırasız Teşekkür</span>
                            </div>
                        </div>
                    </div>
                </section>

                {isLoading && (
                    <div className="supporters-empty">Yükleniyor...</div>
                )}

                {isError && (
                    <div className="supporters-empty">{error?.message || 'Teşekkür listesi yüklenemedi.'}</div>
                )}

                {!isLoading && !isError && uniqueContributors.length > 0 && (
                    <section className="supporters-board" aria-label="Katkıda bulunanlar listesi">
                        <div className="supporters-grid">
                            {uniqueContributors.map((row, index) => {
                                const icon = getProfileIcon(row.profile_icon)
                                const isVip = Boolean(row.is_supporter)
                                return (
                                    <article key={`supporter-${row.user_id || index}-${index}`} className="supporter-item">
                                        <span className="supporter-item-avatar">
                                            {icon.component ? <icon.component size={28} /> : <span className="fallback-dot" />}
                                        </span>
                                        <span className="supporter-item-name-row">
                                            <span className="supporter-item-name">{renderName(row)}</span>
                                            {isVip && <span className="supporter-item-vip" title="VIP">📿</span>}
                                        </span>
                                    </article>
                                )
                            })}
                        </div>
                    </section>
                )}

                {!isLoading && !isError && uniqueContributors.length === 0 && (
                    <div className="supporters-empty">
                        Henüz paylaşılmış bir destekçi ismi bulunmuyor.
                    </div>
                )}
            </div>
        </div>
    )
}
