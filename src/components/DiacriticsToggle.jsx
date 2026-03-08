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
      <span className="diacritics-toggle-mark-only" aria-hidden="true">ُ</span>
    </button>
  )
}
