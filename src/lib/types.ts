export type Stance =
  | 'xrisk_concern'
  | 'strong_risk_reg'
  | 'mundane_risk'
  | 'opposes_domestic'
  | 'unknown'

export type Chamber = 'senate' | 'house'
export type SenateRank = 'junior' | 'senior'
export type MapView = 'junior' | 'senior' | 'house'
export type LayoutMode = 'map' | 'list'
export type Party = 'D' | 'R' | 'I'
export type PartyFilter = 'All' | Party
export type ChamberFilter = 'All' | Chamber

export interface Member {
  bioguideId: string
  name: string
  party: Party
  state: string
  chamber: Chamber
  district?: number
  senateRank?: SenateRank
  stance: Stance
  lastReviewed: string
}

export interface Evidence {
  id: string
  bioguideId: string
  stanceImplied: Stance
  quote: string
  date: string
  sourceUrl: string
  sourceLabel: string
  notes?: string
}

export type BillCategory = 'strong_risk' | 'ethics' | 'chip_security' | 'international' | 'other'

export interface Bill {
  id: string
  congress: number
  billType: string
  number: number
  title: string
  category: BillCategory
  congressGovUrl: string
}

export type LegislativeActionType =
  | 'sponsor'
  | 'cosponsor'
  | 'vote_yea'
  | 'vote_nay'
  | 'vote_present'

export interface LegislativeAction {
  bioguideId: string
  billId: string
  action: LegislativeActionType
  date?: string
  sourceUrl?: string
}

export const STANCE_ORDER: Stance[] = [
  'xrisk_concern',
  'strong_risk_reg',
  'opposes_domestic',
  'mundane_risk',
  'unknown',
]

export const STANCE_LABELS: Record<Stance, string> = {
  xrisk_concern: 'Long-term / existential risk concern',
  strong_risk_reg: 'Supports stronger-risk regulation',
  mundane_risk: 'AI ethical concerns',
  opposes_domestic: 'Opposes domestic AI regulation',
  unknown: 'Unknown / no sourced signal',
}

export const STANCE_COLORS: Record<Stance, string> = {
  xrisk_concern: '#0f4c5c',
  strong_risk_reg: '#1b7f6e',
  mundane_risk: '#c4a35a',
  opposes_domestic: '#a33b2b',
  unknown: '#c8c2b4',
}

export const STANCE_SHORT: Record<Stance, string> = {
  xrisk_concern: 'X-risk concern',
  strong_risk_reg: 'Stronger-risk regs',
  mundane_risk: 'Ethical concerns',
  opposes_domestic: 'Opposes regulation',
  unknown: 'Unknown',
}

export const BILL_GROUP_ORDER: BillCategory[] = [
  'ethics',
  'strong_risk',
  'chip_security',
  'international',
]

export const BILL_GROUP_LABELS: Record<BillCategory, string> = {
  ethics: 'AI ethics',
  strong_risk: 'Stronger-risk regulation',
  chip_security: 'Chip / compute security',
  international: 'International AI governance',
  other: 'Other',
}
