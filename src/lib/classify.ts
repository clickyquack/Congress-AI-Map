import type { Bill, Evidence, LegislativeAction, Stance } from './types'
import { STANCE_ORDER } from './types'

const RANK: Record<Stance, number> = {
  xrisk_concern: 5,
  strong_risk_reg: 4,
  mundane_risk: 3,
  opposes_domestic: 2,
  unknown: 1,
}

function stanceFromAction(
  action: LegislativeAction,
  bill: Bill | undefined,
): Stance | null {
  if (!bill || bill.category === 'natsec_excluded' || bill.category === 'other') {
    return null
  }
  if (action.action === 'vote_nay') {
    // Voting against strong/mundane regulation → opposition signal
    if (bill.category === 'strong_risk' || bill.category === 'mundane') {
      return 'opposes_domestic'
    }
    return null
  }
  if (
    action.action === 'sponsor' ||
    action.action === 'cosponsor' ||
    action.action === 'vote_yea'
  ) {
    if (bill.category === 'strong_risk') return 'strong_risk_reg'
    if (bill.category === 'mundane') return 'mundane_risk'
  }
  return null
}

/** Highest-priority stance wins. Natsec-only bills never classify. */
export function classifyMember(
  bioguideId: string,
  evidence: Evidence[],
  actions: LegislativeAction[],
  bills: Bill[],
): Stance {
  const billById = new Map(bills.map((b) => [b.id, b]))
  let best: Stance = 'unknown'

  for (const e of evidence) {
    if (e.bioguideId !== bioguideId) continue
    if (e.stanceImplied === 'unknown') continue
    if (RANK[e.stanceImplied] > RANK[best]) best = e.stanceImplied
  }

  for (const a of actions) {
    if (a.bioguideId !== bioguideId) continue
    const implied = stanceFromAction(a, billById.get(a.billId))
    if (!implied) continue
    if (RANK[implied] > RANK[best]) best = implied
  }

  return best
}

export function classifyAll(
  memberIds: string[],
  evidence: Evidence[],
  actions: LegislativeAction[],
  bills: Bill[],
): Map<string, Stance> {
  const map = new Map<string, Stance>()
  for (const id of memberIds) {
    map.set(id, classifyMember(id, evidence, actions, bills))
  }
  return map
}

export function stanceRank(s: Stance): number {
  return STANCE_ORDER.indexOf(s)
}
