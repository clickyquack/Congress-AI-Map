import type { MapView as MapViewType } from '../lib/types'

const OPTIONS: { id: MapViewType; label: string }[] = [
  { id: 'junior', label: 'Junior senator' },
  { id: 'senior', label: 'Senior senator' },
  { id: 'house', label: 'House districts' },
]

interface Props {
  value: MapViewType
  onChange: (v: MapViewType) => void
}

export function ViewToggle({ value, onChange }: Props) {
  return (
    <div className="view-toggle" role="tablist" aria-label="Chamber view">
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
