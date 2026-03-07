import { Link, useLocation } from 'react-router-dom'
import './BottomNav.css'

const items = [
  {
    to: '/',
    label: 'Ana Sayfa',
    isActive: (pathname) => pathname === '/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    )
  },
  {
    to: '/oku',
    label: 'Oku',
    isActive: (pathname) => pathname.startsWith('/oku'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M20 22H6.5A2.5 2.5 0 0 1 4 19.5V4a2 2 0 0 1 2-2h14z" />
      </svg>
    )
  },
  {
    to: '/fihrist',
    label: 'Fihrist',
    isActive: (pathname) => pathname.startsWith('/fihrist'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 6h13" />
        <path d="M8 12h13" />
        <path d="M8 18h13" />
        <path d="M3 6h.01" />
        <path d="M3 12h.01" />
        <path d="M3 18h.01" />
      </svg>
    )
  },
  {
    to: '/ay-evresi',
    label: 'Ay',
    isActive: (pathname) => pathname.startsWith('/ay-evresi'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.79Z" />
      </svg>
    )
  },
  {
    to: '/profil',
    label: 'Profil',
    isActive: (pathname) => pathname.startsWith('/profil'),
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21a8 8 0 1 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )
  }
]

export default function BottomNav() {
  const location = useLocation()

  return (
    <nav className="bottom-nav" aria-label="Alt gezinme">
      {items.map((item) => {
        const active = item.isActive(location.pathname)
        return (
          <Link key={item.to} to={item.to} className={`bottom-nav-item${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined}>
            <span className="bottom-nav-icon">{item.icon}</span>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
