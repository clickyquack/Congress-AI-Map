import type { Stance } from '../lib/types'
import { STANCE_COLORS, STANCE_LABELS, STANCE_ORDER } from '../lib/types'

export function StanceLegend() {
  return (
    <ul className="legend">
      {STANCE_ORDER.map((s: Stance) => (
        <li key={s}>
          <span className="swatch" style={{ background: STANCE_COLORS[s] }} />
          <span>{STANCE_LABELS[s]}</span>
        </li>
      ))}
    </ul>
  )
}
