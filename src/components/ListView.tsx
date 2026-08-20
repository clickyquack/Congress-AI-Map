import { useMemo } from 'react'
import {
  billSupportCount,
  billsByGroup,
  memberSupportsBillFilter,
  shortBillTitle,
  supportedBillIds,
} from '../lib/bills'
import { stateName } from '../lib/geo'
import type {
  Bill,
  ChamberFilter,
  LegislativeAction,
  Member,
  Party,
  PartyFilter,
  Stance,
} from '../lib/types'
import {
  BILL_GROUP_LABELS,
  BILL_GROUP_ORDER,
  STANCE_COLORS,
  STANCE_ORDER,
  STANCE_SHORT,
} from '../lib/types'
import { stanceRank } from '../lib/classify'

export type ListSort = 'name' | 'stance' | 'bills'

interface Props {
  members: Member[]
  bills: Bill[]
  actions: LegislativeAction[]
  stanceById: Map<string, Stance>
  selectedId: string | null
  onSelect: (memberId: string) => void
  search: string
  onSearch: (q: string) => void
  stanceFilter: Stance | 'All'
  onStanceFilter: (s: Stance | 'All') => void
  chamberFilter: ChamberFilter
  onChamberFilter: (c: ChamberFilter) => void
  stateFilter: string
  onStateFilter: (s: string) => void
  partyFilter: PartyFilter
  onPartyFilter: (p: PartyFilter) => void
  billFilter: string
  onBillFilter: (v: string) => void
  sort: ListSort
  onSort: (v: ListSort) => void
}

const PARTY_LABEL: Record<Party, string> = {
  D: 'Democrat',
  R: 'Republican',
  I: 'Independent',
}

function seatLabel(m: Member): string {
  if (m.chamber === 'senate') {
    return m.senateRank === 'junior' ? 'Junior senator' : 'Senior senator'
  }
  return m.district === 0 ? 'At-large' : `District ${m.district}`
}

function matchesSearch(m: Member, raw: string): boolean {
  const q = raw.trim().toLowerCase()
  if (!q) return true
  if (m.name.toLowerCase().includes(q)) return true

  const compact = q.replace(/[–—]/g, '-').replace(/\s+/g, ' ')
  const nospace = compact.replace(/[\s-]/g, '')

  if (m.chamber === 'house') {
    const dist = m.district === 0 ? 'atlarge' : String(m.district)
    const stateDist = `${m.state}${dist}`.toLowerCase()
    const hyphen = `${m.state}-${m.district === 0 ? 'al' : m.district}`.toLowerCase()
    if (nospace === stateDist || compact === hyphen) return true
    if (compact === `${m.state.toLowerCase()} ${m.district}`) return true
    if (m.district === 0) {
      if (
        compact.includes('at-large') ||
        compact.includes('at large') ||
        nospace === `${m.state.toLowerCase()}al`
      ) {
        return true
      }
    } else {
      if (compact === String(m.district) || compact === `district ${m.district}`) {
        return true
      }
      if (compact === `d${m.district}` || compact === `cd ${m.district}`) return true
    }
  }

  return false
}

export function ListView({
  members,
  bills,
  actions,
  stanceById,
  selectedId,
  onSelect,
  search,
  onSearch,
  stanceFilter,
  onStanceFilter,
  chamberFilter,
  onChamberFilter,
  stateFilter,
  onStateFilter,
  partyFilter,
  onPartyFilter,
  billFilter,
  onBillFilter,
  sort,
  onSort,
}: Props) {
  const states = useMemo(() => {
    const set = new Set(members.map((m) => m.state))
    return [...set].sort((a, b) => stateName(a).localeCompare(stateName(b)))
  }, [members])

  const groupedBills = useMemo(() => billsByGroup(bills), [bills])
  const billById = useMemo(() => new Map(bills.map((b) => [b.id, b])), [bills])

  const rows = useMemo(() => {
    const filtered = members.filter((m) => {
      const stance = stanceById.get(m.bioguideId) || 'unknown'
      if (stanceFilter !== 'All' && stance !== stanceFilter) return false
      if (chamberFilter !== 'All' && m.chamber !== chamberFilter) return false
      if (stateFilter !== 'All' && m.state !== stateFilter) return false
      if (partyFilter !== 'All' && m.party !== partyFilter) return false
      if (!matchesSearch(m, search)) return false
      const supported = supportedBillIds(m.bioguideId, actions)
      if (!memberSupportsBillFilter(supported, bills, billFilter)) return false
      return true
    })

    return filtered.sort((a, b) => {
      if (sort === 'stance') {
        const cmp = stanceRank(stanceById.get(a.bioguideId) || 'unknown')
          - stanceRank(stanceById.get(b.bioguideId) || 'unknown')
        if (cmp !== 0) return cmp
      }
      if (sort === 'bills') {
        const aN = billSupportCount(supportedBillIds(a.bioguideId, actions), bills, billFilter)
        const bN = billSupportCount(supportedBillIds(b.bioguideId, actions), bills, billFilter)
        if (bN !== aN) return bN - aN
      }
      return a.name.localeCompare(b.name)
    })
  }, [
    members,
    stanceById,
    stanceFilter,
    chamberFilter,
    stateFilter,
    partyFilter,
    search,
    actions,
    bills,
    billFilter,
    sort,
  ])

  return (
    <div className="list-wrap">
      <div className="list-toolbar">
        <label className="list-search">
          Search
          <input
            type="search"
            value={search}
            placeholder="Name or district (e.g. CA-12)"
            onChange={(e) => onSearch(e.target.value)}
          />
        </label>
        <label>
          Stance
          <select
            value={stanceFilter}
            onChange={(e) => onStanceFilter(e.target.value as Stance | 'All')}
          >
            <option value="All">All</option>
            {STANCE_ORDER.map((s) => (
              <option key={s} value={s}>
                {STANCE_SHORT[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Bill support
          <select value={billFilter} onChange={(e) => onBillFilter(e.target.value)}>
            <option value="All">All tracked bills</option>
            {BILL_GROUP_ORDER.map((g) => (
              <optgroup key={g} label={BILL_GROUP_LABELS[g]}>
                <option value={`group:${g}`}>Any {BILL_GROUP_LABELS[g].toLowerCase()} bill</option>
                {(groupedBills.get(g) || []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label>
          Sort
          <select value={sort} onChange={(e) => onSort(e.target.value as ListSort)}>
            <option value="name">Name</option>
            <option value="stance">Stance</option>
            <option value="bills">Bill support</option>
          </select>
        </label>
        <label>
          Chamber
          <select
            value={chamberFilter}
            onChange={(e) => onChamberFilter(e.target.value as ChamberFilter)}
          >
            <option value="All">All</option>
            <option value="senate">Senate</option>
            <option value="house">House</option>
          </select>
        </label>
        <label>
          State
          <select value={stateFilter} onChange={(e) => onStateFilter(e.target.value)}>
            <option value="All">All</option>
            {states.map((abbr) => (
              <option key={abbr} value={abbr}>
                {stateName(abbr)} ({abbr})
              </option>
            ))}
          </select>
        </label>
        <label>
          Party
          <select
            value={partyFilter}
            onChange={(e) => onPartyFilter(e.target.value as PartyFilter)}
          >
            <option value="All">All</option>
            <option value="D">Democrats</option>
            <option value="R">Republicans</option>
            <option value="I">Independents</option>
          </select>
        </label>
      </div>

      <p className="list-count">
        {rows.length} of {members.length} members
        {sort === 'bills' ? ' · sorted by tracked bill support' : ''}
      </p>

      <div className="list-table-scroll">
        <table className="list-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Party</th>
              <th>State</th>
              <th>Seat</th>
              <th>Stance</th>
              <th>Tracked bills</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="list-empty">
                  No members match these filters.
                </td>
              </tr>
            ) : (
              rows.map((m) => {
                const stance = stanceById.get(m.bioguideId) || 'unknown'
                const supported = [...supportedBillIds(m.bioguideId, actions)]
                  .map((id) => billById.get(id))
                  .filter((b): b is Bill => Boolean(b))
                return (
                  <tr
                    key={m.bioguideId}
                    className={m.bioguideId === selectedId ? 'selected' : ''}
                    tabIndex={0}
                    onClick={() => onSelect(m.bioguideId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect(m.bioguideId)
                      }
                    }}
                  >
                    <td className="list-name">{m.name}</td>
                    <td>{PARTY_LABEL[m.party]}</td>
                    <td>
                      {stateName(m.state)} ({m.state})
                    </td>
                    <td>{seatLabel(m)}</td>
                    <td>
                      <span className="list-stance">
                        <span
                          className="swatch"
                          style={{ background: STANCE_COLORS[stance] }}
                        />
                        {STANCE_SHORT[stance]}
                      </span>
                    </td>
                    <td>
                      {supported.length === 0 ? (
                        <span className="muted">—</span>
                      ) : (
                        <span className="bill-tags">
                          {supported.map((b) => (
                            <span key={b.id} className={`bill-tag bill-tag-${b.category}`}>
                              {shortBillTitle(b.title)}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
