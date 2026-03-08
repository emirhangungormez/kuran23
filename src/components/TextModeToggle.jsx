import { TEXT_MODE_OPTIONS } from '../utils/textMode'
import './TextModeToggle.css'

export default function TextModeToggle({ value, onChange, className = '' }) {
  return (
    <div className={`text-mode-toggle ${className}`.trim()} role="tablist" aria-label="Arapça metin modu">
      {TEXT_MODE_OPTIONS.map((mode) => {
        const active = value === mode.value
        return (
          <button
            key={mode.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`text-mode-btn ${active ? 'active' : ''}`}
            onClick={() => onChange(mode.value)}
          >
            {mode.label}
          </button>
        )
      })}
    </div>
  )
}
