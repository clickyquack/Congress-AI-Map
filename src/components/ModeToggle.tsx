import type { LayoutMode } from '../lib/types'

const OPTIONS: { id: LayoutMode; label: string }[] = [
  { id: 'map', label: 'Map' },
  { id: 'list', label: 'List' },
]

interface Props {
  value: LayoutMode
  onChange: (v: LayoutMode) => void
}

export function ModeToggle({ value, onChange }: Props) {
  return (
    <div className="view-toggle" role="tablist" aria-label="Display">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          role="tab"
          type="button"
          aria-selected={value === o.id}
          className={value === o.id ? 'active' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
