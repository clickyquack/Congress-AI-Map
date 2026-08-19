/**
 * Builds members.json, evidence.json, bills.json, actions.json
 * and converts CD119 shapefile → public/geo/districts-119.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import shapefile from 'shapefile'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const dataDir = path.join(root, 'data')
const today = '2026-08-11'

const STATE_FIPS = {
  AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10',
  DC: '11', FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19',
  KS: '20', KY: '21', LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27',
  MS: '28', MO: '29', MT: '30', NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35',
  NY: '36', NC: '37', ND: '38', OH: '39', OK: '40', OR: '41', PA: '42', RI: '44',
  SC: '45', SD: '46', TN: '47', TX: '48', UT: '49', VT: '50', VA: '51', WA: '53',
  WV: '54', WI: '55', WY: '56',
}

const FIPS_TO_STATE = Object.fromEntries(
  Object.entries(STATE_FIPS).map(([k, v]) => [v, k]),
)

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function parseAipnQuotes(html) {
  const quotes = []
  const start = html.indexOf('const RAW_DATA = [')
  if (start < 0) {
    console.warn('RAW_DATA not found in AIPN HTML')
    return quotes
  }
  const slice = html.slice(start + 'const RAW_DATA = '.length)
  // Each entry is a 5-element array on its own line (approx).
  const lineRe =
    /^\["([🔴🔵])\s+(Sen\.|Rep\.)\s+(.+?)"\s*,\s*"([\s\S]*?)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*,\s*"([^"]*)"\s*\],?\s*$/u
  for (const line of slice.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '];' || trimmed === ']') break
    const m = trimmed.match(lineRe)
    if (!m) continue
    const partyEmoji = m[1]
    const title = m[2]
    const nameParty = m[3]
    const quote = stripHtml(m[4].replace(/\\n/g, '\n').replace(/\\"/g, '"'))
    const sourceUrl = m[5]
    const sourceLabel = stripHtml(m[6]) || 'Public statement'
    const date = m[7]
    const nm = nameParty.match(/^(.+?)\s+\(([DRI])-([A-Z]{2})\)$/)
    if (!nm) continue
    quotes.push({
      chamberHint: title.startsWith('Sen') ? 'senate' : 'house',
      name: nm[1].trim(),
      party: nm[2],
      state: nm[3],
      quote,
      sourceUrl: sourceUrl || 'https://theaipn.org/issue/quotes/',
      sourceLabel: sourceLabel || 'AIPN Congress on Superintelligence',
      date,
      partyEmoji,
    })
  }
  return quotes
}

function normalizeName(n) {
  return n
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/\bjr\b/g, '')
    .replace(/\bsr\b/g, '')
    .replace(/\biii\b/g, '')
    .replace(/\bii\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function lastName(n) {
  const parts = normalizeName(n).split(' ')
  return parts[parts.length - 1]
}

function buildMembers(legislators) {
  const current = []
  for (const leg of legislators) {
    const terms = leg.terms || []
    const term = [...terms].reverse().find((t) => !t.end || t.end >= '2025-01-03')
    if (!term || (term.type !== 'sen' && term.type !== 'rep')) continue
    const id = leg.id?.bioguide
    if (!id) continue
    const name =
      leg.name?.official_full ||
      [leg.name?.first, leg.name?.last].filter(Boolean).join(' ')
    const party =
      term.party === 'Democrat' ? 'D' : term.party === 'Republican' ? 'R' : 'I'
    const member = {
      bioguideId: id,
      name,
      party,
      state: term.state,
      chamber: term.type === 'sen' ? 'senate' : 'house',
      district: term.type === 'rep' ? term.district : undefined,
      senateRank: undefined,
      stance: 'unknown',
      lastReviewed: today,
      firstName: leg.name?.first,
      lastName: leg.name?.last,
      senateStart: term.type === 'sen' ? term.start : undefined,
    }
    current.push(member)
  }

  // junior/senior by continuous Senate start date within state
  const byState = {}
  for (const m of current.filter((x) => x.chamber === 'senate')) {
    ;(byState[m.state] ??= []).push(m)
  }
  for (const list of Object.values(byState)) {
    list.sort((a, b) => String(a.senateStart).localeCompare(String(b.senateStart)))
    if (list.length >= 1) list[0].senateRank = 'senior'
    if (list.length >= 2) list[1].senateRank = 'junior'
    // rare: more than 2 (vacancies/special) — earliest = senior, next = junior
    for (let i = 2; i < list.length; i++) list[i].senateRank = 'junior'
  }

  return current.map(
    ({ firstName, lastName, senateStart, ...rest }) => ({
      ...rest,
      _firstName: firstName,
      _lastName: lastName,
    }),
  )
}

function matchMember(members, q) {
  const pool = members.filter(
    (m) => m.state === q.state && m.chamber === q.chamberHint,
  )
  const partyPool = pool.filter((m) => m.party === q.party || m.party === 'I')
  const searchPools = [partyPool, pool]
  const qn = normalizeName(q.name)
  for (const p of searchPools) {
    let hit = p.find((m) => normalizeName(m.name) === qn)
    if (hit) return hit
    hit = p.find(
      (m) => normalizeName(m.name).includes(qn) || qn.includes(normalizeName(m.name)),
    )
    if (hit) return hit
    const ql = lastName(q.name)
    const lastHits = p.filter(
      (m) => lastName(m.name) === ql || lastName(m._lastName || '') === ql,
    )
    if (lastHits.length === 1) return lastHits[0]
  }
  return null
}

async function convertDistricts() {
  const shp = path.join(root, 'public/geo/cd119-shp/cb_2025_us_cd119_20m.shp')
  const dbf = path.join(root, 'public/geo/cd119-shp/cb_2025_us_cd119_20m.dbf')
  const source = await shapefile.open(shp, dbf)
  const features = []
  while (true) {
    const r = await source.read()
    if (r.done) break
    const p = r.value.properties
    const state = FIPS_TO_STATE[p.STATEFP]
    if (!state) continue
    let district = parseInt(p.CD119FP ?? p.CD119 ?? p.CD118FP, 10)
    if (Number.isNaN(district)) continue
    // Census uses 00 for at-large → store as 0 to match legislators-current
    features.push({
      type: 'Feature',
      properties: {
        state,
        district,
        geoid: p.GEOID,
        name: p.NAMELSAD || `${state}-${district}`,
      },
      geometry: r.value.geometry,
    })
  }
  const geo = { type: 'FeatureCollection', features }
  const out = path.join(root, 'public/geo/districts-119.json')
  fs.writeFileSync(out, JSON.stringify(geo))
  console.log(`Wrote ${features.length} districts → ${out}`)
}

function bioguideLookup(members) {
  const byName = new Map()
  for (const m of members) {
    byName.set(`${m.state}|${normalizeName(m.name)}`, m.bioguideId)
    byName.set(`${m.state}|${lastName(m.name)}`, m.bioguideId)
  }
  return byName
}

function findByNameState(members, name, state) {
  const n = normalizeName(name)
  const pool = members.filter((m) => m.state === state)
  let hit = pool.find((m) => normalizeName(m.name) === n)
  if (hit) return hit
  hit = pool.find((m) => normalizeName(m.name).includes(n) || n.includes(normalizeName(m.name)))
  if (hit) return hit
  // Match "Dick Durbin" → "Richard J. Durbin"
  const aliases = {
    'dick durbin': 'richard',
    'chris coons': 'christopher',
    'thom tillis': 'thomas',
    'chuck schumer': 'charles',
    'maria elvira salazar': 'maria',
  }
  const aliasFirst = aliases[n]
  const hits = pool.filter((m) => {
    if (lastName(m.name) !== lastName(name) && lastName(m._lastName || '') !== lastName(name)) {
      return false
    }
    if (aliasFirst) {
      return normalizeName(m.name).includes(aliasFirst) || normalizeName(m._firstName || '').includes(aliasFirst)
    }
    return true
  })
  return hits.length === 1 ? hits[0] : hits.find((m) => lastName(m.name) === lastName(name)) || null
}

async function main() {
  const legislators = JSON.parse(
    fs.readFileSync(path.join(dataDir, 'legislators-current.json'), 'utf8'),
  )
  let members = buildMembers(legislators)

  const aipnHtml = fs.readFileSync(path.join(dataDir, 'aipn-quotes.json'), 'utf8')
  const aipn = parseAipnQuotes(aipnHtml)
  console.log(`Parsed ${aipn.length} AIPN quote rows`)

  const evidence = []
  const unmatched = []
  let eid = 1
  for (const q of aipn) {
    const m = matchMember(members, q)
    if (!m) {
      unmatched.push(`${q.chamberHint} ${q.name} (${q.party}-${q.state})`)
      continue
    }
    evidence.push({
      id: `ev-${eid++}`,
      bioguideId: m.bioguideId,
      stanceImplied: 'xrisk_concern',
      quote: q.quote,
      date: q.date,
      sourceUrl: q.sourceUrl,
      sourceLabel: q.sourceLabel,
      notes: 'Sourced via AIPN Congress on Superintelligence',
    })
  }
  if (unmatched.length) {
    console.log('Unmatched AIPN quotes:', [...new Set(unmatched)].join('; '))
  }

  // Extra curated x-risk / strong-risk evidence beyond AIPN parse misses
  const extraEvidence = [
    {
      name: 'Ted Lieu',
      state: 'CA',
      stanceImplied: 'xrisk_concern',
      quote:
        'Unfortunately, powerful AI systems can go rogue, behave in extremely dangerous ways, or even resist human intervention. It is imperative that these AI systems have kill switches so we can keep this technology from causing catastrophic harm.',
      date: '2026-07-23',
      sourceUrl:
        'https://lieu.house.gov/media-center/press-releases/reps-lieu-and-moran-introduce-bill-require-kill-switch-ai-systems-can',
      sourceLabel: 'AI Kill Switch Act press release',
    },
    {
      name: 'Lori Trahan',
      state: 'MA',
      stanceImplied: 'strong_risk_reg',
      quote:
        'The FRONTIER Act establishes federal transparency, auditing, and emergency-restriction authority for the largest AI developers to manage catastrophic risks from frontier models.',
      date: '2026-07-23',
      sourceUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/9925',
      sourceLabel: 'FRONTIER Act (H.R. 9925)',
    },
  ]

  for (const e of extraEvidence) {
    const m = findByNameState(members, e.name, e.state)
    if (!m) continue
    const already = evidence.some(
      (x) => x.bioguideId === m.bioguideId && x.sourceUrl === e.sourceUrl,
    )
    if (already) continue
    evidence.push({
      id: `ev-${eid++}`,
      bioguideId: m.bioguideId,
      stanceImplied: e.stanceImplied,
      quote: e.quote,
      date: e.date,
      sourceUrl: e.sourceUrl,
      sourceLabel: e.sourceLabel,
    })
  }

  // Opposition to domestic AI regulation (sourced). Natsec-only bills excluded.
  const opposeEvidence = [
    {
      name: 'Ted Cruz',
      state: 'TX',
      quote:
        'Championed a 10-year federal moratorium that would have punished states for enforcing their own AI regulations, arguing fragmented domestic AI rules would harm U.S. competitiveness.',
      date: '2025-07-01',
      sourceUrl:
        'https://apnews.com/article/congress-ai-provision-moratorium-states-20beeeb6967057be5fe64678f72f6ab0',
      sourceLabel: 'AP News: Senate AI state-regulation moratorium fight',
      notes:
        'Classified as opposing domestic AI regulation (state/federal rulemaking). National-security chip/export controls are excluded from this taxonomy.',
    },
    {
      name: 'Thom Tillis',
      state: 'NC',
      quote:
        'Cast the sole Senate vote against striking the AI state-regulation moratorium from the 2025 reconciliation package (99–1), supporting the effort to block state AI laws.',
      date: '2025-07-01',
      sourceUrl:
        'https://arstechnica.com/tech-policy/2025/07/ted-cruz-gives-up-on-ai-law-moratorium-joins-99-1-vote-against-his-own-plan/',
      sourceLabel: 'Ars Technica: Cruz AI moratorium defeated 99–1',
    },
  ]

  for (const e of opposeEvidence) {
    const m = findByNameState(members, e.name, e.state)
    if (!m) {
      console.log('Oppose unmatched:', e.name, e.state)
      continue
    }
    evidence.push({
      id: `ev-${eid++}`,
      bioguideId: m.bioguideId,
      stanceImplied: 'opposes_domestic',
      quote: e.quote,
      date: e.date,
      sourceUrl: e.sourceUrl,
      sourceLabel: e.sourceLabel,
      notes: e.notes,
    })
  }

  // Mundane-risk statements
  const mundaneEvidence = [
    {
      name: 'Amy Klobuchar',
      state: 'MN',
      quote:
        'Has repeatedly pressed for legislation addressing deepfakes, election deepfake harms, and consumer AI transparency — mundane near-term AI risks.',
      date: '2025-03-15',
      sourceUrl: 'https://www.klobuchar.senate.gov/',
      sourceLabel: 'NO FAKES / deepfake legislative advocacy',
    },
    {
      name: 'Maria Cantwell',
      state: 'WA',
      quote:
        'Has focused Commerce Committee work on AI consumer protection, data privacy, and near-term marketplace harms from AI systems.',
      date: '2025-04-01',
      sourceUrl: 'https://www.commerce.senate.gov/',
      sourceLabel: 'Senate Commerce AI consumer-protection focus',
    },
    {
      name: 'Chuck Schumer',
      state: 'NY',
      quote:
        'SAFE Innovation framework emphasizes security, accountability, and foundations for AI policy including near-term societal harms alongside longer-term issues.',
      date: '2023-06-21',
      sourceUrl: 'https://www.democrats.senate.gov/imo/media/doc/schumer_ai_framework.pdf',
      sourceLabel: 'SAFE Innovation Framework',
      stanceImplied: 'mundane_risk',
    },
    {
      name: 'Maxwell Frost',
      state: 'FL',
      quote:
        'At a House Oversight roundtable on AI, Frost and colleagues aired anxieties about AI’s rapid societal impacts and the need for proactive congressional attention to harms people will feel in their districts.',
      date: '2026-04-17',
      sourceUrl:
        'https://apnews.com/article/artificial-intelligence-safety-concerns-congress-fears-hearing-6d00921e57c9489b1f5a92c9a27e087c',
      sourceLabel: 'AP News: House AI angst roundtable',
    },
    {
      name: 'Dave Min',
      state: 'CA',
      quote:
        'People in our districts across this country are going to start feeling impacts very soon… If we don’t start thinking proactively about the challenges that AI creates, I fear that we’re going to have a revolution on our hands.',
      date: '2026-04-17',
      sourceUrl:
        'https://apnews.com/article/artificial-intelligence-safety-concerns-congress-fears-hearing-6d00921e57c9489b1f5a92c9a27e087c',
      sourceLabel: 'AP News: House AI angst roundtable',
    },
  ]

  for (const e of mundaneEvidence) {
    const m = findByNameState(members, e.name, e.state)
    if (!m) continue
    evidence.push({
      id: `ev-${eid++}`,
      bioguideId: m.bioguideId,
      stanceImplied: e.stanceImplied || 'mundane_risk',
      quote: e.quote,
      date: e.date,
      sourceUrl: e.sourceUrl,
      sourceLabel: e.sourceLabel,
    })
  }

  const bills = [
    {
      id: 'hr9925-119',
      congress: 119,
      billType: 'hr',
      number: 9925,
      title: 'FRONTIER Act',
      category: 'strong_risk',
      congressGovUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/9925',
    },
    {
      id: 'hr9917-119',
      congress: 119,
      billType: 'hr',
      number: 9917,
      title: 'AI Kill Switch Act',
      category: 'strong_risk',
      congressGovUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/9917',
    },
    {
      id: 's2081-119',
      congress: 119,
      billType: 's',
      number: 2081,
      title: 'RISE Act of 2025',
      category: 'strong_risk',
      congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/2081',
    },
    {
      id: 's1367-119',
      congress: 119,
      billType: 's',
      number: 1367,
      title: 'NO FAKES Act of 2025',
      category: 'mundane',
      congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/1367',
    },
    {
      id: 'chip-security',
      congress: 118,
      billType: 'hr',
      number: 0,
      title: 'Chip Security Act (national security / export controls)',
      category: 'natsec_excluded',
      congressGovUrl: 'https://www.congress.gov/',
    },
  ]

  // Sponsors / cosponsors from public reporting (Congress.gov / press)
  const actionRows = [
    // FRONTIER Act
    ['Lori Trahan', 'MA', 'hr9925-119', 'sponsor', '2026-07-23'],
    ['Jay Obernolte', 'CA', 'hr9925-119', 'cosponsor', '2026-07-23'],
    // Kill Switch
    ['Ted Lieu', 'CA', 'hr9917-119', 'sponsor', '2026-07-23'],
    ['Nathaniel Moran', 'TX', 'hr9917-119', 'cosponsor', '2026-07-23'],
    // RISE Act
    ['Cynthia Lummis', 'WY', 's2081-119', 'sponsor', '2025-06-12'],
    // NO FAKES Act of 2025
    ['Chris Coons', 'DE', 's1367-119', 'sponsor', '2025-04-09'],
    ['Marsha Blackburn', 'TN', 's1367-119', 'cosponsor', '2025-04-09'],
    ['Amy Klobuchar', 'MN', 's1367-119', 'cosponsor', '2025-04-09'],
    ['Thom Tillis', 'NC', 's1367-119', 'cosponsor', '2025-04-09'],
    ['Bill Cassidy', 'LA', 's1367-119', 'cosponsor', '2025-05-14'],
    ['Adam Schiff', 'CA', 's1367-119', 'cosponsor', '2025-05-14'],
    ['Bill Hagerty', 'TN', 's1367-119', 'cosponsor', '2025-05-14'],
    ['Dick Durbin', 'IL', 's1367-119', 'cosponsor', '2025-05-14'],
    ['Mazie Hirono', 'HI', 's1367-119', 'cosponsor', '2025-06-03'],
    ['Ashley Moody', 'FL', 's1367-119', 'cosponsor', '2025-06-03'],
    ['Elissa Slotkin', 'MI', 's1367-119', 'cosponsor', '2025-11-20'],
    ['James Lankford', 'OK', 's1367-119', 'cosponsor', '2025-11-20'],
    ['Peter Welch', 'VT', 's1367-119', 'cosponsor', '2026-04-14'],
    ['Katie Britt', 'AL', 's1367-119', 'cosponsor', '2026-04-14'],
  ]

  const actions = []
  for (const [name, state, billId, action, date] of actionRows) {
    const m = findByNameState(members, name, state)
    if (!m) {
      console.log('Action unmatched:', name, state)
      continue
    }
    const bill = bills.find((b) => b.id === billId)
    actions.push({
      bioguideId: m.bioguideId,
      billId,
      action,
      date,
      sourceUrl: bill?.congressGovUrl,
    })
  }

  // Strip internal fields and write
  const cleanMembers = members.map(({ _firstName, _lastName, ...m }) => m)

  fs.writeFileSync(path.join(dataDir, 'members.json'), JSON.stringify(cleanMembers, null, 2))
  fs.writeFileSync(path.join(dataDir, 'evidence.json'), JSON.stringify(evidence, null, 2))
  fs.writeFileSync(path.join(dataDir, 'bills.json'), JSON.stringify(bills, null, 2))
  fs.writeFileSync(path.join(dataDir, 'actions.json'), JSON.stringify(actions, null, 2))

  const srcData = path.join(root, 'src/data')
  fs.mkdirSync(srcData, { recursive: true })
  for (const f of ['members.json', 'evidence.json', 'bills.json', 'actions.json']) {
    fs.copyFileSync(path.join(dataDir, f), path.join(srcData, f))
  }

  const xriskIds = new Set(
    evidence.filter((e) => e.stanceImplied === 'xrisk_concern').map((e) => e.bioguideId),
  )
  console.log(
    `Members: ${cleanMembers.length}; evidence: ${evidence.length}; unique x-risk members: ${xriskIds.size}; actions: ${actions.length}`,
  )

  await convertDistricts()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
