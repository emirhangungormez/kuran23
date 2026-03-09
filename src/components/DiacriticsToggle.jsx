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
        <path d="M3.8 15.4c1.3-3.8 3-3.8 4.3 0 1.2 3.5 2.9 3.5 4.1 0 1.3-3.8 3-3.8 4.3 0 1.2 3.5 2.9 3.5 4.1 0" />
      </svg>
    </button>
  )
}
