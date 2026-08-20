import type { Bill, BillCategory, LegislativeAction } from './types'
import { BILL_GROUP_ORDER } from './types'

const SUPPORT_ACTIONS = new Set(['sponsor', 'cosponsor', 'vote_yea'])

export function supportedBillIds(
  bioguideId: string,
  actions: LegislativeAction[],
): Set<string> {
  const ids = new Set<string>()
  for (const a of actions) {
    if (a.bioguideId !== bioguideId) continue
    if (!SUPPORT_ACTIONS.has(a.action)) continue
    ids.add(a.billId)
  }
  return ids
}

export function billsByGroup(bills: Bill[]): Map<BillCategory, Bill[]> {
  const map = new Map<BillCategory, Bill[]>()
  for (const g of BILL_GROUP_ORDER) map.set(g, [])
  for (const b of bills) {
    if (!map.has(b.category)) continue
    map.get(b.category)!.push(b)
  }
  return map
}

export function memberSupportsBillFilter(
  supported: Set<string>,
  bills: Bill[],
  billFilter: string,
): boolean {
  if (billFilter === 'All') return true
  if (billFilter.startsWith('group:')) {
    const group = billFilter.slice(6) as BillCategory
    return bills.some((b) => b.category === group && supported.has(b.id))
  }
  return supported.has(billFilter)
}

export function billSupportCount(
  supported: Set<string>,
  bills: Bill[],
  billFilter: string,
): number {
  if (billFilter === 'All') return supported.size
  if (billFilter.startsWith('group:')) {
    const group = billFilter.slice(6) as BillCategory
    return bills.filter((b) => b.category === group && supported.has(b.id)).length
  }
  return supported.has(billFilter) ? 1 : 0
}

export function shortBillTitle(title: string): string {
  return title.replace(/ Act of 20\d{2}$/, '').replace(/ Act$/, '')
}
