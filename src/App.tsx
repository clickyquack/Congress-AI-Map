import { useEffect, useMemo, useState } from 'react'
import membersData from './data/members.json'
import evidenceData from './data/evidence.json'
import billsData from './data/bills.json'
import actionsData from './data/actions.json'
import { AboutPage } from './components/AboutPage'
import { ListView } from './components/ListView'
import { MapView } from './components/MapView'
import { MemberPanel } from './components/MemberPanel'
import { ModeToggle } from './components/ModeToggle'
import { StanceLegend } from './components/StanceLegend'
import { ViewToggle } from './components/ViewToggle'
import { classifyAll } from './lib/classify'
import type {
  Bill,
  ChamberFilter,
  Evidence,
  LayoutMode,
  LegislativeAction,
  MapView as MapViewType,
  Member,
  PartyFilter,
  Stance,
} from './lib/types'
import { STANCE_ORDER, STANCE_SHORT } from './lib/types'
import './App.css'

const members = membersData as Member[]
const evidence = evidenceData as Evidence[]
const bills = billsData as Bill[]
const actions = actionsData as LegislativeAction[]

function pageFromHash(): 'home' | 'about' {
  return window.location.hash.replace(/^#\/?/, '') === 'about' ? 'about' : 'home'
}

export default function App() {
  const [page, setPage] = useState<'home' | 'about'>(pageFromHash)
  const [layout, setLayout] = useState<LayoutMode>('map')
  const [view, setView] = useState<MapViewType>('senior')
  const [partyFilter, setPartyFilter] = useState<PartyFilter>('All')
  const [stanceFilter, setStanceFilter] = useState<Stance | 'All'>('All')
  const [chamberFilter, setChamberFilter] = useState<ChamberFilter>('All')
  const [stateFilter, setStateFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    const onHash = () => {
      setPage(pageFromHash())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const stanceById = useMemo(
    () => classifyAll(
      members.map((m) => m.bioguideId),
      evidence,
      actions,
      bills,
    ),
    [],
  )

  const counts = useMemo(() => {
    const c: Record<Stance, number> = {
      xrisk_concern: 0,
      strong_risk_reg: 0,
      mundane_risk: 0,
      opposes_domestic: 0,
      unknown: 0,
    }
    for (const s of stanceById.values()) c[s]++
    return c
  }, [stanceById])

  const selected = members.find((m) => m.bioguideId === selectedId) || null
  const selectedStance = selected
    ? stanceById.get(selected.bioguideId) || 'unknown'
    : 'unknown'
  const selectedEvidence = evidence.filter((e) => e.bioguideId === selectedId)
  const selectedActions = actions.filter((a) => a.bioguideId === selectedId)

  if (page === 'about') {
    return (
      <div className="app">
        <header className="hero">
          <p className="brand">
            <a href="#map">AI Risk in Congress</a>
          </p>
        </header>
        <main className="main about-main">
          <AboutPage />
        </main>
        <footer className="footer">
          <a href="#map">Map</a>
          {' · '}
          <a href="#about" aria-current="page">
            About
          </a>
          {' · '}
          <a
            href="https://github.com/clickyquack/Congress-AI-Map/issues"
            target="_blank"
            rel="noreferrer"
          >
            Submit a correction
          </a>
        </footer>
      </div>
    )
  }

  return (
    <div className={`app ${selected ? 'has-panel' : ''}`}>
      <header className="hero">
        <p className="brand">AI Risk in Congress</p>
        <h1>Where members stand on AI risk and regulation</h1>
        <p className="sub">
          Color-coded map and directory of the 119th Congress. Click a seat or row for
          sourced quotes and bill actions. National-security-only measures (e.g. chip
          export controls) do not move stance.
        </p>
        <ModeToggle value={layout} onChange={setLayout} />
        {layout === 'map' ? (
          <>
            <ViewToggle value={view} onChange={setView} />
            <div className="filters">
              <label>
                Party
                <select
                  value={partyFilter}
                  onChange={(e) => setPartyFilter(e.target.value as PartyFilter)}
                >
                  <option value="All">All</option>
                  <option value="D">Democrats</option>
                  <option value="R">Republicans</option>
                  <option value="I">Independents</option>
                </select>
              </label>
              <label>
                Stance
                <select
                  value={stanceFilter}
                  onChange={(e) => setStanceFilter(e.target.value as Stance | 'All')}
                >
                  <option value="All">All</option>
                  {STANCE_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STANCE_SHORT[s]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        ) : null}
        <StanceLegend />
        <p className="counts">
          Classified: {counts.xrisk_concern} x-risk · {counts.strong_risk_reg} strong-risk
          regs · {counts.mundane_risk} mundane · {counts.opposes_domestic} oppose ·{' '}
          {counts.unknown} unknown
        </p>
      </header>

      <main className="main">
        {layout === 'map' ? (
          <MapView
            view={view}
            members={members}
            stanceById={stanceById}
            partyFilter={partyFilter}
            stanceFilter={stanceFilter}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ) : (
          <ListView
            members={members}
            stanceById={stanceById}
            selectedId={selectedId}
            onSelect={setSelectedId}
            search={search}
            onSearch={setSearch}
            stanceFilter={stanceFilter}
            onStanceFilter={setStanceFilter}
            chamberFilter={chamberFilter}
            onChamberFilter={setChamberFilter}
            stateFilter={stateFilter}
            onStateFilter={setStateFilter}
            partyFilter={partyFilter}
            onPartyFilter={setPartyFilter}
          />
        )}
        <MemberPanel
          member={selected}
          stance={selectedStance}
          evidence={selectedEvidence}
          actions={selectedActions}
          bills={bills}
          onClose={() => setSelectedId(null)}
        />
      </main>

      <footer className="footer">
        X-risk quotes primarily from{' '}
        <a href="https://theaipn.org/issue/quotes/" target="_blank" rel="noreferrer">
          AIPN Congress on Superintelligence
        </a>
        . Roster from unitedstates/congress-legislators.
        {' · '}
        <a href="#about">About & methodology</a>
      </footer>
    </div>
  )
}
