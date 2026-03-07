import { Link } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import { getProfileIcon } from '../data/profileIcons'

export default function UserAvatar({ size = 36 }) {
    const { settings } = useSettings()
    const { isLoggedIn, setIsAuthOpen } = useAuth()
    const icon = getProfileIcon(settings.profileIcon)

    const handleClick = (e) => {
        if (!isLoggedIn) {
            e.preventDefault()
            setIsAuthOpen(true)
        }
    }

    return (
        <Link
            to={isLoggedIn ? "/profil" : "#"}
            onClick={handleClick}
            className={`home-avatar ${!isLoggedIn ? 'guest' : ''}`}
            aria-label={isLoggedIn ? "Profil Ayarları" : "Giriş Yap"}
            style={!isLoggedIn ? { background: 'var(--fill)', border: '1px solid var(--border-color)' } : {}}
        >
            {isLoggedIn && icon.component ? (
                <icon.component size={size} />
            ) : isLoggedIn && icon.path ? (
                <svg className="home-avatar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    {icon.path}
                </svg>
            ) : (
                <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                </svg>
            )}
        </Link>
    )
}
