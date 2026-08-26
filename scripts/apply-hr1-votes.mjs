/**
 * Apply H.R. 1 (Roll 145) votes to unreviewed House members.
 * Yea voters get opposes_domestic moratorium evidence; Nay voters marked no_signal pending further research.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const researchDir = path.join(root, 'data/research')
const today = new Date().toISOString().slice(0, 10)

const MORATORIUM_VOTE = {
  quote:
    'Voted yes on the House-passed reconciliation bill that included a 10-year prohibition on states and political subdivisions from limiting, restricting, or otherwise regulating artificial intelligence models and artificial intelligence systems entered into interstate commerce.',
  date: '2025-05-22',
  sourceUrl: 'https://clerk.house.gov/Votes/2025145',
  sourceLabel: 'House roll call on reconciliation bill (H.R. 1)',
  stanceImplied: 'opposes_domestic',
  notes:
    'Classified as opposing domestic AI regulation (state/federal rulemaking moratorium). National-security chip/export controls are excluded from this taxonomy.',
}

function parseRoll(xml) {
  const votes = new Map()
  const re =
    /<recorded-vote><legislator name-id="([^"]+)"[^>]*>([^<]*)<\/legislator><vote>([^<]+)<\/vote><\/recorded-vote>/g
  let m
  while ((m = re.exec(xml))) {
    votes.set(m[1], m[3])
  }
  return votes
}

const xml = fs.readFileSync(path.join(researchDir, 'roll145.xml'), 'utf8')
const rollVotes = parseRoll(xml)
const members = JSON.parse(fs.readFileSync(path.join(root, 'data/members.json'), 'utf8')).filter(
  (x) => x.chamber === 'house',
)
const progress = JSON.parse(fs.readFileSync(path.join(researchDir, 'house-progress.json'), 'utf8'))
const curated = JSON.parse(fs.readFileSync(path.join(researchDir, 'curated-evidence-house.json'), 'utf8'))
const curatedKeys = new Set(
  curated.map((e) => `${e.name}|${e.state}|${e.sourceUrl}|${e.quote.slice(0, 80)}`),
)

const evidence = JSON.parse(fs.readFileSync(path.join(root, 'data/evidence.json'), 'utf8'))
const actions = JSON.parse(fs.readFileSync(path.join(root, 'data/actions.json'), 'utf8'))

let yeaAdded = 0
let nayMarked = 0
let skipped = 0
let completedFromData = 0

for (const m of members) {
  if (progress.members[m.bioguideId]) continue
  const ev = evidence.filter((e) => e.bioguideId === m.bioguideId)
  const ac = actions.filter((a) => a.bioguideId === m.bioguideId)
  if (ev.length || ac.length) {
    const signals = []
    if (ev.length) signals.push('evidence')
    if (ac.length) signals.push('bill_action')
    progress.members[m.bioguideId] = {
      status: 'complete',
      reviewedAt: today,
      signalsFound: signals,
      notes: 'Existing dataset signals found during systematic review.',
    }
    completedFromData++
    continue
  }
  const vote = rollVotes.get(m.bioguideId)
  if (!vote) {
    skipped++
    progress.members[m.bioguideId] = {
      status: 'no_signal',
      reviewedAt: today,
      signalsFound: [],
      notes: 'Delegate or not voting on H.R. 1 Roll 145; no other signals found in automated pass.',
    }
    continue
  }
  if (vote === 'Yea') {
    const key = `${m.name}|${m.state}|${MORATORIUM_VOTE.sourceUrl}|${MORATORIUM_VOTE.quote.slice(0, 80)}`
    if (!curatedKeys.has(key)) {
      curated.push({ name: m.name, state: m.state, ...MORATORIUM_VOTE })
      curatedKeys.add(key)
      yeaAdded++
    }
    progress.members[m.bioguideId] = {
      status: 'complete',
      reviewedAt: today,
      signalsFound: ['evidence'],
      notes: 'Voted for House reconciliation package with 10-year state AI regulation moratorium.',
    }
  } else {
    progress.members[m.bioguideId] = {
      status: 'no_signal',
      reviewedAt: today,
      signalsFound: [],
      notes: `Voted ${vote} on H.R. 1 (Roll 145); no additional AI-risk evidence in automated pass.`,
    }
    nayMarked++
  }
}

const states = 'AL AK AZ AR AS CA CO CT DC DE FL GA GU HI IA ID IL IN KS KY LA MA MD ME MI MN MO MP MS MT NC ND NE NH NJ NM NV NY OH OK OR PA PR RI SC SD TN TX UT VA VI VT WA WI WV WY'.split(
  ' ',
)
const houseByState = {}
for (const m of members) (houseByState[m.state] ??= []).push(m)
let nextState = 'CA'
for (const s of states) {
  if ((houseByState[s] || []).some((m) => !progress.members[m.bioguideId])) {
    nextState = s
    break
  }
  if ((houseByState[s] || []).every((m) => progress.members[m.bioguideId])) {
    continue
  }
}
// find first state with any member lacking deeper review beyond auto-pass
for (const s of states) {
  const pending = (houseByState[s] || []).filter(
    (m) =>
      !progress.members[m.bioguideId] ||
      progress.members[m.bioguideId].notes?.includes('automated pass'),
  )
  if (pending.length) {
    nextState = s
    break
  }
}
progress.currentState = nextState

fs.writeFileSync(path.join(researchDir, 'curated-evidence-house.json'), JSON.stringify(curated, null, 2) + '\n')
fs.writeFileSync(path.join(researchDir, 'house-progress.json'), JSON.stringify(progress, null, 2) + '\n')
console.log(`Yea evidence added: ${yeaAdded}; completed from dataset: ${completedFromData}; Nay/no-vote marked: ${nayMarked + skipped}`)
console.log(`Total reviewed: ${Object.keys(progress.members).length}/437`)
