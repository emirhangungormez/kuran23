import './DiacriticsToggle.css'

export default function DiacriticsToggle({ enabled, onToggle, className = '' }) {
  const label = enabled ? 'Harekeleri gizle' : 'Harekeleri göster'

  return (
    <button
      type="button"
      className={`diacritics-toggle ${enabled ? 'active' : ''} ${className}`.trim()}
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={label}
      title={label}
    >
      <svg className="diacritics-toggle-mark-only" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 14.5c1.1-2.8 3.2-2.8 4.3 0 1.1 2.8 3.2 2.8 4.3 0 1.1-2.8 3.2-2.8 4.4 0" />
      </svg>
    </button>
  )
}
