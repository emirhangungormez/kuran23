import { Link, useLocation } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import usePlayerStore from '../stores/usePlayerStore'
import './BottomNav.css'

const items = [
  {
    key: 'home',
    to: '/',
    label: 'Ana Sayfa',
    isActive: (pathname) => pathname === '/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    )
  },
  {
    key: 'reading',
    to: '/oku/1',
    label: 'Oku',
    isActive: (pathname) => pathname.startsWith('/oku'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M20 22H6.5A2.5 2.5 0 0 1 4 19.5V4a2 2 0 0 1 2-2h14z" />
      </svg>
    )
  },
  {
    key: 'library',
    to: '/kutuphane',
    label: 'Kütüphane',
    isActive: (pathname) => pathname.startsWith('/kutuphane') || pathname.startsWith('/tefsirler'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 4.5h4a2 2 0 0 1 2 2V20H7a2 2 0 0 0-2 2z" />
        <path d="M19 4.5h-4a2 2 0 0 0-2 2V20h4a2 2 0 0 1 2 2z" />
        <path d="M9 7.5H7.5" />
        <path d="M16.5 7.5H15" />
      </svg>
    )
  },
  {
    key: 'profile',
    to: '/profil',
    label: 'Profil',
    isActive: (pathname) => pathname.startsWith('/profil'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21a8 8 0 1 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )
  }
]

export default function BottomNav() {
  const location = useLocation()
  const { settings, updateSettings } = useSettings()
  const playerMode = usePlayerStore((state) => state.mode)
  const hasPlayer = playerMode !== 'none'
  const isPlayerActive = hasPlayer && settings.isPlayerVisible
  const profileItem = items.find((item) => item.key === 'profile')
  const leadingItems = items.filter((item) => item.key !== 'profile')

  const handleTogglePlayer = () => {
    if (!hasPlayer) return
    updateSettings({ isPlayerVisible: !settings.isPlayerVisible })
  }

  const renderNavItem = (item) => {
    const active = item.isActive(location.pathname)

    return (
      <Link
        key={item.key}
        to={item.to}
        className={`bottom-nav-item${active ? ' active' : ''}`}
        aria-current={active ? 'page' : undefined}
      >
        <span className="bottom-nav-icon">{item.icon}</span>
        <span className="bottom-nav-label">{item.label}</span>
      </Link>
    )
  }

  return (
    <nav className="bottom-nav" aria-label="Alt gezinme">
      {leadingItems.map(renderNavItem)}
      <button
        type="button"
        className={`bottom-nav-item player-toggle${isPlayerActive ? ' active' : ''}`}
        onClick={handleTogglePlayer}
        aria-label={isPlayerActive ? 'Player gizle' : 'Player goster'}
        aria-pressed={isPlayerActive}
        disabled={!hasPlayer}
      >
        <span className="bottom-nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
          </svg>
        </span>
        <span className="bottom-nav-label">Player</span>
      </button>
      {profileItem ? renderNavItem(profileItem) : null}
    </nav>
  )
}
