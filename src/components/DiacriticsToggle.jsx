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
      <svg
        className="diacritics-toggle-mark-only"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M16.5 8.5c-2.3-2.2-6.5-1.5-7.4 1.6-.6 2 1 4 3.2 4 1.5 0 2.7-.6 3.6-1.8" />
      </svg>
    </button>
  )
}
