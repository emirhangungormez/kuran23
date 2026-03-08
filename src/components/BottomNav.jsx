import { Link, useLocation } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
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
    key: 'theme',
    type: 'theme-toggle',
    label: 'Tema',
    isActive: () => false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.8v2.4" />
        <path d="M12 18.8v2.4" />
        <path d="m4.9 4.9 1.7 1.7" />
        <path d="m17.4 17.4 1.7 1.7" />
        <path d="M2.8 12h2.4" />
        <path d="M18.8 12h2.4" />
        <path d="m4.9 19.1 1.7-1.7" />
        <path d="m17.4 6.6 1.7-1.7" />
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

  const handleToggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark'
    updateSettings({ theme: nextTheme })
  }

  return (
    <nav className="bottom-nav" aria-label="Alt gezinme">
      {items.map((item) => {
        const active = item.isActive(location.pathname)
        if (item.type === 'theme-toggle') {
          const isDark = settings.theme === 'dark'
          return (
            <button
              key={item.key}
              type="button"
              className="bottom-nav-item"
              onClick={handleToggleTheme}
              aria-label={isDark ? 'Aydınlık temaya geç' : 'Karanlık temaya geç'}
              aria-pressed={isDark}
            >
              <span className="bottom-nav-icon">
                {isDark ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 12.79A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.79Z" />
                  </svg>
                ) : item.icon}
              </span>
              <span className="bottom-nav-label">{item.label}</span>
            </button>
          )
        }

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
      })}
    </nav>
  )
}
