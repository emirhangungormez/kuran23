import { useState } from 'react'
import './BookmarkButton.css'

export default function BookmarkButton({ isBookmarked, onToggle }) {
    const [isAnimating, setIsAnimating] = useState(false)

    const handleClick = () => {
        setIsAnimating(true)
        onToggle()
        setTimeout(() => setIsAnimating(false), 600)
    }

    return (
        <button
            className={`bookmark-btn ${isBookmarked ? 'bookmarked' : ''} ${isAnimating ? 'animating' : ''}`}
            onClick={handleClick}
            aria-label={isBookmarked ? 'Kaydedilenlerde' : 'Kaydet'}
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
        </button>
    )
}
