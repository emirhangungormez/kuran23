import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import { useAuth } from '../contexts/AuthContext'
import { useSupporter } from '../contexts/SupporterContext'
import { getProfileIcon } from '../data/profileIcons'
import './ProfileHeader.css'

const PencilIcon = ({ size = 13 }) => (
    <span className="edit-pencil">
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
    </span>
)

export default function ProfileHeader({ onEditAvatar }) {
    const { settings, updateSettings } = useSettings()
    const { logout, isLoggedIn, user } = useAuth()
    const { isSupporter, membershipType } = useSupporter()
    const isVip = isSupporter || membershipType === 'quick-pro'
    const navigate = useNavigate()
    const icon = getProfileIcon(settings.profileIcon)
    const [isHovering, setIsHovering] = useState(false)
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const nameRef = useRef(null)
    const bioRef = useRef(null)

    const handleBlur = useCallback((field, ref) => {
        const text = ref.current?.innerText?.trim()
        if (text && text !== settings[field]) {
            updateSettings({ [field]: text })
        }
    }, [settings, updateSettings])

    const handleKeyDown = useCallback((e, ref) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            ref.current?.blur()
        }
    }, [])

    const handleLogout = async () => {
        if (isLoggingOut) return
        setIsLoggingOut(true)
        try {
            await Promise.race([
                logout(),
                new Promise((resolve) => setTimeout(resolve, 1200))
            ])
            navigate('/', { replace: true })
        } finally {
            setIsLoggingOut(false)
        }
    }

    return (
        <div className="profile-header">
            <div
                className="avatar-container"
                onClick={onEditAvatar}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                <div className="avatar">
                    {icon.component ? (
                        <icon.component size={96} />
                    ) : (
                        <svg className="avatar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            {icon.path}
                        </svg>
                    )}
                </div>
                <div className={`avatar-edit-overlay${isHovering ? ' visible' : ''}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                </div>
            </div>

            <div className="profile-info">
                {isLoggedIn && user?.username && (
                    <span className="profile-username">
                        @{user.username}
                    </span>
                )}

                <div className="editable-row profile-name-row">
                    <h1
                        ref={nameRef}
                        className="profile-name editable"
                        contentEditable={true}
                        suppressContentEditableWarning
                        spellCheck={false}
                        onBlur={() => handleBlur('userName', nameRef)}
                        onKeyDown={(e) => handleKeyDown(e, nameRef)}
                    >
                        {settings.userName || 'Misafir Kullanıcı'}
                    </h1>
                    {isVip ? <span className="profile-vip-mark profile-vip-mark-name" title="VIP">📿</span> : null}
                    <PencilIcon size={14} />
                </div>

                <div className="editable-row">
                    <p
                        ref={bioRef}
                        className="profile-bio editable"
                        contentEditable={true}
                        suppressContentEditableWarning
                        spellCheck={false}
                        onBlur={() => handleBlur('userBio', bioRef)}
                        onKeyDown={(e) => handleKeyDown(e, bioRef)}
                    >
                        {settings.userBio || 'Biyografi ekleyin...'}
                    </p>
                    <PencilIcon size={12} />
                </div>

                {isLoggedIn && (
                    <button
                        type="button"
                        className="profile-logout-btn"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                        </svg>
                        {isLoggingOut ? 'Çıkış...' : 'Çıkış Yap'}
                    </button>
                )}
            </div>
        </div>
    )
}
