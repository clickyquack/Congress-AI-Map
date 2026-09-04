import type { MapChamber, SenateSeatFilter } from '../lib/types'

const CHAMBER_OPTIONS: { id: MapChamber; label: string }[] = [
  { id: 'senate', label: 'Senate' },
  { id: 'house', label: 'House' },
]

const SEAT_OPTIONS: { id: SenateSeatFilter; label: string }[] = [
  { id: 'both', label: 'Both' },
  { id: 'junior', label: 'Junior' },
  { id: 'senior', label: 'Senior' },
]

interface Props {
  chamber: MapChamber
  onChamber: (v: MapChamber) => void
  senateSeat: SenateSeatFilter
  onSenateSeat: (v: SenateSeatFilter) => void
}

export function ViewToggle({ chamber, onChamber, senateSeat, onSenateSeat }: Props) {
  return (
    <div className="view-toggles">
      <div className="view-toggle" role="tablist" aria-label="Chamber view">
        {CHAMBER_OPTIONS.map((o) => (
          <button
            key={o.id}
            role="tab"
            type="button"
            aria-selected={chamber === o.id}
            className={chamber === o.id ? 'active' : ''}
            onClick={() => onChamber(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {chamber === 'senate' ? (
        <div className="view-toggle" role="tablist" aria-label="Senate seat">
          {SEAT_OPTIONS.map((o) => (
            <button
              key={o.id}
              role="tab"
              type="button"
              aria-selected={senateSeat === o.id}
              className={senateSeat === o.id ? 'active' : ''}
              onClick={() => onSenateSeat(o.id)}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
