import { useState, useEffect, useRef } from 'react'
import './CustomSelect.css'

export default function CustomSelect({ value, onChange, options, label, prefix = "", className = "" }) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef(null)

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const selectedOption = options.find(opt => opt.value === value) || options[0]

    if (!options.length) return null

    return (
        <div className={`custom-select-container ${isOpen ? 'is-open' : ''} ${className}`} ref={containerRef}>
            <button
                className="custom-select-trigger"
                onClick={() => setIsOpen(!isOpen)}
                type="button"
            >
                <span className="trigger-label">{prefix}{selectedOption?.label || '—'}</span>
                <svg className="trigger-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 1L5 5L9 1" />
                </svg>
            </button>

            {isOpen && (
                <div className="custom-select-dropdown">
                    <div className="dropdown-scroll">
                        {options.map((option) => (
                            <div
                                key={option.value}
                                className={`dropdown-item ${value === option.value ? 'selected' : ''}`}
                                onClick={() => {
                                    onChange(option.value)
                                    setIsOpen(false)
                                }}
                            >
                                {option.label}
                                {value === option.value && (
                                    <svg className="item-check" width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M1 5L4 8L11 1" />
                                    </svg>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
