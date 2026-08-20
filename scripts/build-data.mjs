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
    'angus king': 'angus',
    'raphael warnock': 'raphael',
    'kirsten gillibrand': 'kirsten',
    'john curtis': 'john',
    'dave mccormick': 'david',
    'maggie hassan': 'margaret',
    'bernie sanders': 'bernard',
    'angela alsobrooks': 'angela',
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
    {
      name: 'John Thune',
      state: 'SD',
      quote:
        'We want to be the leaders in AI and quantum and all these new technologies. And the way to do that is not to come in with a heavy hand of government, it\'s to come in with a light touch.',
      date: '2025-06-25',
      sourceUrl: 'https://www.axios.com/2025/06/25/thune-ai-moratorium-big-beautiful-bill',
      sourceLabel: 'Axios: Thune urges light-touch AI rules and state-regulation freeze',
      notes:
        'Supported keeping a freeze on state AI regulations in the 2025 reconciliation package. National-security chip/export controls are excluded from this taxonomy.',
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
        'Has repeatedly pressed for legislation addressing deepfakes, election deepfake harms, and consumer AI transparency — AI ethical concerns.',
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
    {
      name: 'Elizabeth Warren',
      state: 'MA',
      quote:
        'On December 29, 2025, Elon Musk’s X unveiled a new feature allowing users to use Grok, X’s AI chatbot, to create and edit images with just one click. This tool sparked a wave of users requesting explicit deepfake images, enabling widespread sexual harassment — much of which targeted women and children.',
      date: '2026-04-01',
      sourceUrl:
        'https://www.warren.senate.gov/newsroom/press-releases/warren-presses-trade-ambassador-greer-on-trump-admin-special-favors-to-advance-big-techs-dangerous-deregulatory-agenda',
      sourceLabel: 'Warren letter on Grok deepfakes and AI deregulation',
    },
    {
      name: 'Maggie Hassan',
      state: 'NH',
      quote:
        'In recent years, AI voice-generating tools have enabled global criminal networks to produce deepfake materials to target more people with increasingly personalized and believable digital scams, including fictitious voices and calls used for imposter and romance scams.',
      date: '2026-04-01',
      sourceUrl:
        'https://www.jec.senate.gov/public/index.cfm/democrats/2026/4/senator-hassan-presses-leading-ai-voice-cloning-companies-to-prevent-exploitation-by-scammers',
      sourceLabel: 'Hassan inquiry into AI voice-cloning scams',
    },
    {
      name: 'Tammy Duckworth',
      state: 'IL',
      quote:
        'These AI chatbots were never meant to be used by young children, yet they’re being embedded inside toys by the thousands. We’ve already seen far too many instances where AI-enabled toys have imparted information to our children that could put them in immediate danger and have long-term impacts on their development.',
      date: '2026-07-01',
      sourceUrl:
        'https://www.duckworth.senate.gov/news/press-releases/duckworth-murkowski-bipartisan-bill-to-protect-children-from-dangers-of-ai-toys-passes-committee',
      sourceLabel: 'Children’s Artificial Intelligence Toy Safety Act',
    },
    {
      name: 'Lisa Murkowski',
      state: 'AK',
      quote:
        'AI-enabled toys have the potential to significantly impact the physical, mental, and emotional development of our children. It is imperative we equip policymakers and America’s families with the knowledge they need to make informed choices about these devices.',
      date: '2026-07-01',
      sourceUrl:
        'https://www.duckworth.senate.gov/news/press-releases/duckworth-murkowski-bipartisan-bill-to-protect-children-from-dangers-of-ai-toys-passes-committee',
      sourceLabel: 'Children’s Artificial Intelligence Toy Safety Act',
    },
    {
      name: 'Ruben Gallego',
      state: 'AZ',
      quote:
        'It’s absurd that AI companies are letting their chatbots run unchecked, exposing kids and teens to sexual abuse and encouraging self-harm. I’m proud to work with my colleagues across the aisle to hold Big Tech accountable and put real safeguards in place to protect our children.',
      date: '2025-10-31',
      sourceUrl:
        'https://www.gallego.senate.gov/news/press-releases/gallego-backs-bipartisan-bill-protecting-children-from-ai-chatbots/',
      sourceLabel: 'GUARD Act (AI companions for minors)',
    },
    {
      name: 'Kirsten Gillibrand',
      state: 'NY',
      quote:
        'As policymakers, we are working to address this issue for our constituents. To better understand your current and planned efforts to curb the rise of non-nude sexualized deepfakes on your platforms, we request additional detail on the steps you are taking now and intend to take going forward.',
      date: '2026-01-15',
      sourceUrl:
        'https://www.gillibrand.senate.gov/news/press/release/gillibrand-colleagues-demand-tech-giants-take-down-sexualized-ai-images-protect-minors/',
      sourceLabel: 'Letter to tech platforms on sexualized AI images',
    },
    {
      name: 'Tammy Baldwin',
      state: 'WI',
      quote:
        'Joined colleagues in calling on some of America’s largest tech and social media companies to address the rise of non-consensual, sexualized, AI-generated images appearing on their platforms.',
      date: '2026-01-15',
      sourceUrl:
        'https://www.baldwin.senate.gov/news/press-releases/senator-baldwin-colleagues-demand-big-tech-remove-sexualized-ai-generated-images',
      sourceLabel: 'Letter to tech platforms on sexualized AI images',
    },
    {
      name: 'Dave McCormick',
      state: 'PA',
      quote:
        'Outlined federal child-safety rules for AI, including safeguards against systems designed to exploit or groom minors, alongside a relatively limited domestic regulatory framework.',
      date: '2026-07-29',
      sourceUrl:
        'https://www.mccormick.senate.gov/news/press-releases/senator-mccormick-unveils-vision-for-american-ai-leadership-in-major-address-at-manhattan-institute/',
      sourceLabel: 'Manhattan Institute AI policy address',
    },
    {
      name: 'Lisa Blunt Rochester',
      state: 'DE',
      quote:
        'With more Americans using AI every day, we need to do all we can to cut down on AI-related fraud. Our AI Fraud Accountability Act would ensure our statutes are updated to meet this current moment.',
      date: '2026-03-04',
      sourceUrl:
        'https://www.bluntrochester.senate.gov/news/press-releases/news-senators-blunt-rochester-and-sheehy-introduce-ai-fraud-accountability-act/',
      sourceLabel: 'AI Fraud Accountability Act',
    },
    {
      name: 'Andy Kim',
      state: 'NJ',
      quote:
        'Co-led the CHAT Act 2.0, a federal framework to protect minors from companion AI chatbots that encourage self-harm, generate sexual content, or engage in romantic interactions with children.',
      date: '2026-07-30',
      sourceUrl:
        'https://www.husted.senate.gov/media/press-releases/husted-kim-lead-bipartisan-bill-to-protect-children-from-ai-companion-chatbots/',
      sourceLabel: 'CHAT Act 2.0',
    },
    {
      name: 'Jon Husted',
      state: 'OH',
      quote:
        'We need to protect children in the digital world the same way we do in the physical world. The CHAT Act 2.0 would put guardrails in place to keep parents informed, protect children from harm and ensure their safety comes before unchecked technology.',
      date: '2026-07-30',
      sourceUrl:
        'https://newyork.news12.com/sens-kim-husted-introduce-bipartisan-bill-to-regulate-ai-companion-chatbots-for-minors',
      sourceLabel: 'CHAT Act 2.0',
    },
    {
      name: 'Sheldon Whitehouse',
      state: 'RI',
      quote:
        'Joined colleagues urging DOJ and the FTC to investigate whether generative AI features on dominant platforms misappropriate journalism and other creative work in ways that harm competition and local news.',
      date: '2024-06-01',
      sourceUrl:
        'https://www.duckworth.senate.gov/news/press-releases/duckworth-durbin-join-klobuchar-colleagues-to-urge-doj-ftc-to-investigate-generative-ai-products-for-potential-antitrust-violations',
      sourceLabel: 'Letter on generative AI and competition',
    },
    {
      name: 'Ron Wyden',
      state: 'OR',
      quote:
        'Introduced the Algorithmic Accountability Act of 2025 to require impact assessments of automated decision systems used in housing, employment, credit, insurance, education, and healthcare.',
      date: '2025-06-25',
      sourceUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/2164',
      sourceLabel: 'Algorithmic Accountability Act of 2025',
    },
    {
      name: 'Chuck Grassley',
      state: 'IA',
      quote:
        'Today, too many people working in AI feel they’re unable to speak up when they see something wrong. Whistleblowers are one of the best ways to ensure Congress keeps pace as the AI industry rapidly develops.',
      date: '2025-05-15',
      sourceUrl:
        'https://www.grassley.senate.gov/news/news-releases/grassley-introduces-ai-whistleblower-protection-act',
      sourceLabel: 'AI Whistleblower Protection Act',
      notes:
        'Bill would protect disclosures of substantial dangers that AI development or deployment may pose to public safety, public health, or national security.',
    },
    {
      name: 'Edward J. Markey',
      state: 'MA',
      quote:
        'The risks are the lived reality of AI for millions of Americans — and they deserve policymakers who are paying attention to their lives, not Big Tech’s bottom line.',
      date: '2026-07-10',
      sourceUrl:
        'https://www.markey.senate.gov/news/press-releases/senator-markey-releases-the-ai-accountability-agenda-taking-power-back-from-big-tech',
      sourceLabel: 'AI Accountability Agenda',
    },
    {
      name: 'Mark R. Warner',
      state: 'VA',
      quote:
        'As the capabilities of GenAI continue to evolve, maliciously manipulated media poses a significant risk to vulnerable communities, public trust, and democratic institutions, particularly during competitive election cycles.',
      date: '2026-03-01',
      sourceUrl:
        'https://www.warner.senate.gov/newsroom/press-releases/warner-pushes-tech-companies-to-take-action-against-deepfakes-maliciously-manipulated-media/',
      sourceLabel: 'Warner letter on deepfakes and manipulated media',
    },
    {
      name: 'Alex Padilla',
      state: 'CA',
      quote:
        'As the use of AI spreads rapidly, we must ensure there are guardrails in place to prevent it from becoming a tool to suppress votes, spread disinformation, or purge eligible voters from the rolls.',
      date: '2026-06-11',
      sourceUrl:
        'https://www.padilla.senate.gov/newsroom/press-releases/padilla-merkley-seek-new-election-safeguards-amid-growing-misuse-of-ai-to-suppress-voting-and-spread-misinformation/',
      sourceLabel: 'FAIR Elections Act',
    },
    {
      name: 'Tina Smith',
      state: 'MN',
      quote:
        'Joined colleagues urging DOJ and the FTC to investigate whether generative AI features on dominant platforms misappropriate journalism and other creative work in ways that harm competition and local news.',
      date: '2024-09-10',
      sourceUrl:
        'https://www.duckworth.senate.gov/news/press-releases/duckworth-durbin-join-klobuchar-colleagues-to-urge-doj-ftc-to-investigate-generative-ai-products-for-potential-antitrust-violations',
      sourceLabel: 'Letter on generative AI and competition',
    },
    {
      name: 'Mark Kelly',
      state: 'AZ',
      quote:
        'AI tools are increasingly becoming part of older Americans’ daily lives, but we still don’t fully understand their impact. This bill will help us better assess both the opportunities and risks of AI so we can ensure these technologies support older people’s independence, safety, and well-being.',
      date: '2026-06-24',
      sourceUrl:
        'https://www.kelly.senate.gov/newsroom/press-releases/kelly-introduces-bipartisan-legislation-to-study-how-ai-tools-impact-older-americans/',
      sourceLabel: 'Aging with Artificial Intelligence Act',
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
      category: 'ethics',
      congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/1367',
    },
    {
      id: 's146-119',
      congress: 119,
      billType: 's',
      number: 146,
      title: 'TAKE IT DOWN Act',
      category: 'ethics',
      congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/146',
    },
    {
      id: 's1837-119',
      congress: 119,
      billType: 's',
      number: 1837,
      title: 'DEFIANCE Act of 2025',
      category: 'ethics',
      congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/1837',
    },
    {
      id: 's2164-119',
      congress: 119,
      billType: 's',
      number: 2164,
      title: 'Algorithmic Accountability Act of 2025',
      category: 'ethics',
      congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/2164',
    },
    {
      id: 's1396-119',
      congress: 119,
      billType: 's',
      number: 1396,
      title: 'COPIED Act of 2025',
      category: 'ethics',
      congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/1396',
    },
    {
      id: 's4591-119',
      congress: 119,
      billType: 's',
      number: 4591,
      title: 'NO FAKES Act of 2026',
      category: 'ethics',
      congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/4591',
    },
    {
      id: 's4774-119',
      congress: 119,
      billType: 's',
      number: 4774,
      title: 'FAIR Elections Act of 2026',
      category: 'ethics',
      congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/4774',
    },
    {
      id: 's4916-119',
      congress: 119,
      billType: 's',
      number: 4916,
      title: 'Aging with Artificial Intelligence Act of 2026',
      category: 'ethics',
      congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/4916',
    },
    {
      id: 's1705-119',
      congress: 119,
      billType: 's',
      number: 1705,
      title: 'Chip Security Act',
      category: 'chip_security',
      congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/1705',
    },
    {
      id: 's3519-119',
      congress: 119,
      billType: 's',
      number: 3519,
      title: 'Remote Access Security Act',
      category: 'chip_security',
      congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/3519',
    },
    {
      id: 's3952-119',
      congress: 119,
      billType: 's',
      number: 3952,
      title: 'Future of AI Innovation Act of 2026',
      category: 'international',
      congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/3952',
    },
    {
      id: 's1269-119',
      congress: 119,
      billType: 's',
      number: 1269,
      title: 'U.S. Leadership in Standards Act of 2025',
      category: 'international',
      congressGovUrl: 'https://www.congress.gov/bill/119th-congress/senate-bill/1269',
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
    // TAKE IT DOWN Act (deepfake NCII)
    ['Ted Cruz', 'TX', 's146-119', 'sponsor', '2025-01-16'],
    ['Amy Klobuchar', 'MN', 's146-119', 'cosponsor', '2025-01-16'],
    ['Shelley Moore Capito', 'WV', 's146-119', 'cosponsor', '2025-01-16'],
    ['Richard Blumenthal', 'CT', 's146-119', 'cosponsor', '2025-01-16'],
    ['Bill Cassidy', 'LA', 's146-119', 'cosponsor', '2025-01-16'],
    ['Cory Booker', 'NJ', 's146-119', 'cosponsor', '2025-01-16'],
    ['John Barrasso', 'WY', 's146-119', 'cosponsor', '2025-01-16'],
    ['Jacky Rosen', 'NV', 's146-119', 'cosponsor', '2025-01-16'],
    ['Cynthia Lummis', 'WY', 's146-119', 'cosponsor', '2025-01-16'],
    ['John Hickenlooper', 'CO', 's146-119', 'cosponsor', '2025-01-16'],
    ['Ted Budd', 'NC', 's146-119', 'cosponsor', '2025-01-16'],
    ['Marsha Blackburn', 'TN', 's146-119', 'cosponsor', '2025-01-16'],
    ['Roger Wicker', 'MS', 's146-119', 'cosponsor', '2025-01-16'],
    ['Todd Young', 'IN', 's146-119', 'cosponsor', '2025-01-16'],
    ['John Curtis', 'UT', 's146-119', 'cosponsor', '2025-01-16'],
    ['Tim Sheehy', 'MT', 's146-119', 'cosponsor', '2025-01-16'],
    ['Raphael Warnock', 'GA', 's146-119', 'cosponsor', '2025-01-16'],
    ['Martin Heinrich', 'NM', 's146-119', 'cosponsor', '2025-01-16'],
    ['Gary Peters', 'MI', 's146-119', 'cosponsor', '2025-01-16'],
    ['Adam Schiff', 'CA', 's146-119', 'cosponsor', '2025-01-21'],
    ['Catherine Cortez Masto', 'NV', 's146-119', 'cosponsor', '2025-02-05'],
    ['Jeanne Shaheen', 'NH', 's146-119', 'cosponsor', '2025-02-06'],
    // DEFIANCE Act (intimate digital forgeries / deepfakes)
    ['Dick Durbin', 'IL', 's1837-119', 'sponsor', '2025-05-21'],
    ['Amy Klobuchar', 'MN', 's1837-119', 'cosponsor', '2025-05-21'],
    ['Angus King', 'ME', 's1837-119', 'cosponsor', '2025-05-21'],
    ['Mike Lee', 'UT', 's1837-119', 'cosponsor', '2025-05-21'],
    ['Martin Heinrich', 'NM', 's1837-119', 'cosponsor', '2025-05-21'],
    ['Peter Welch', 'VT', 's1837-119', 'cosponsor', '2025-05-21'],
    ['Chuck Schumer', 'NY', 's1837-119', 'cosponsor', '2025-05-21'],
    ['Josh Hawley', 'MO', 's1837-119', 'cosponsor', '2025-05-21'],
    // Algorithmic Accountability Act (consumer/civil-rights AI harms)
    ['Ron Wyden', 'OR', 's2164-119', 'sponsor', '2025-06-25'],
    ['Elizabeth Warren', 'MA', 's2164-119', 'cosponsor', '2025-06-25'],
    ['Cory Booker', 'NJ', 's2164-119', 'cosponsor', '2025-06-25'],
    ['Martin Heinrich', 'NM', 's2164-119', 'cosponsor', '2025-06-25'],
    ['Ben Ray Luján', 'NM', 's2164-119', 'cosponsor', '2025-06-25'],
    ['Jeff Merkley', 'OR', 's2164-119', 'cosponsor', '2025-06-25'],
    ['Mazie Hirono', 'HI', 's2164-119', 'cosponsor', '2025-06-25'],
    ['Brian Schatz', 'HI', 's2164-119', 'cosponsor', '2025-06-25'],
    // COPIED Act (deepfake provenance / creator protections)
    ['Maria Cantwell', 'WA', 's1396-119', 'sponsor', '2025-04-09'],
    ['Marsha Blackburn', 'TN', 's1396-119', 'cosponsor', '2025-04-09'],
    ['Martin Heinrich', 'NM', 's1396-119', 'cosponsor', '2025-04-09'],
    // NO FAKES Act of 2026
    ['Chris Coons', 'DE', 's4591-119', 'sponsor', '2026-05-20'],
    ['Marsha Blackburn', 'TN', 's4591-119', 'cosponsor', '2026-05-20'],
    ['Amy Klobuchar', 'MN', 's4591-119', 'cosponsor', '2026-05-20'],
    ['Thom Tillis', 'NC', 's4591-119', 'cosponsor', '2026-05-20'],
    ['Dick Durbin', 'IL', 's4591-119', 'cosponsor', '2026-05-20'],
    ['Katie Britt', 'AL', 's4591-119', 'cosponsor', '2026-05-20'],
    ['Mazie Hirono', 'HI', 's4591-119', 'cosponsor', '2026-05-20'],
    ['Ashley Moody', 'FL', 's4591-119', 'cosponsor', '2026-05-20'],
    ['Peter Welch', 'VT', 's4591-119', 'cosponsor', '2026-05-20'],
    ['Bill Cassidy', 'LA', 's4591-119', 'cosponsor', '2026-05-20'],
    ['Adam Schiff', 'CA', 's4591-119', 'cosponsor', '2026-05-20'],
    ['Bill Hagerty', 'TN', 's4591-119', 'cosponsor', '2026-05-20'],
    ['Elissa Slotkin', 'MI', 's4591-119', 'cosponsor', '2026-05-20'],
    ['James Lankford', 'OK', 's4591-119', 'cosponsor', '2026-05-20'],
    ['Richard Blumenthal', 'CT', 's4591-119', 'cosponsor', '2026-06-16'],
    ['Rick Scott', 'FL', 's4591-119', 'cosponsor', '2026-06-16'],
    // FAIR Elections Act (AI election deepfakes / voter suppression)
    ['Jeff Merkley', 'OR', 's4774-119', 'sponsor', '2026-06-11'],
    ['Alex Padilla', 'CA', 's4774-119', 'cosponsor', '2026-06-11'],
    ['Mazie Hirono', 'HI', 's4774-119', 'cosponsor', '2026-06-11'],
    ['Sheldon Whitehouse', 'RI', 's4774-119', 'cosponsor', '2026-06-11'],
    ['Peter Welch', 'VT', 's4774-119', 'cosponsor', '2026-06-11'],
    ['Bernie Sanders', 'VT', 's4774-119', 'cosponsor', '2026-06-16'],
    // Aging with AI Act (older-adult AI harms)
    ['Mark Kelly', 'AZ', 's4916-119', 'sponsor', '2026-06-24'],
    ['Rick Scott', 'FL', 's4916-119', 'cosponsor', '2026-06-24'],
    ['Roger Marshall', 'KS', 's4916-119', 'cosponsor', '2026-06-24'],
    // Chip Security Act (tracked; does not move stance)
    ['Tom Cotton', 'AR', 's1705-119', 'sponsor', '2025-05-08'],
    ['Maggie Hassan', 'NH', 's1705-119', 'cosponsor', '2025-05-20'],
    ['Cynthia Lummis', 'WY', 's1705-119', 'cosponsor', '2025-06-04'],
    ['Brian Schatz', 'HI', 's1705-119', 'cosponsor', '2025-06-16'],
    ['Jim Banks', 'IN', 's1705-119', 'cosponsor', '2025-09-11'],
    ['Pete Ricketts', 'NE', 's1705-119', 'cosponsor', '2025-10-30'],
    ['Chris Coons', 'DE', 's1705-119', 'cosponsor', '2025-11-04'],
    ['Dave McCormick', 'PA', 's1705-119', 'cosponsor', '2025-11-04'],
    ['Josh Hawley', 'MO', 's1705-119', 'cosponsor', '2025-12-17'],
    ['Elizabeth Warren', 'MA', 's1705-119', 'cosponsor', '2026-02-12'],
    ['Kevin Cramer', 'ND', 's1705-119', 'cosponsor', '2026-02-26'],
    ['Catherine Cortez Masto', 'NV', 's1705-119', 'cosponsor', '2026-04-13'],
    ['John Kennedy', 'LA', 's1705-119', 'cosponsor', '2026-04-27'],
    ['Thom Tillis', 'NC', 's1705-119', 'cosponsor', '2026-05-11'],
    ['Tommy Tuberville', 'AL', 's1705-119', 'cosponsor', '2026-05-14'],
    ['Angela Alsobrooks', 'MD', 's1705-119', 'cosponsor', '2026-05-21'],
    ['Elissa Slotkin', 'MI', 's1705-119', 'cosponsor', '2026-06-02'],
    ['Mark Kelly', 'AZ', 's1705-119', 'cosponsor', '2026-06-02'],
    ['Chuck Schumer', 'NY', 's1705-119', 'cosponsor', '2026-06-15'],
    ['Ashley Moody', 'FL', 's1705-119', 'cosponsor', '2026-06-17'],
    ['Eric Schmitt', 'MO', 's1705-119', 'cosponsor', '2026-06-18'],
    ['Rick Scott', 'FL', 's1705-119', 'cosponsor', '2026-06-23'],
    // Remote Access Security Act (tracked; does not move stance)
    ['Dave McCormick', 'PA', 's3519-119', 'sponsor', '2025-12-17'],
    ['Ron Wyden', 'OR', 's3519-119', 'cosponsor', '2025-12-17'],
    ['Tom Cotton', 'AR', 's3519-119', 'cosponsor', '2025-12-17'],
    ['Chris Coons', 'DE', 's3519-119', 'cosponsor', '2025-12-17'],
    ['Rick Scott', 'FL', 's3519-119', 'cosponsor', '2026-06-18'],
    ['Jim Banks', 'IN', 's3519-119', 'cosponsor', '2026-08-04'],
    ['Elissa Slotkin', 'MI', 's3519-119', 'cosponsor', '2026-08-04'],
    // Future of AI Innovation Act (international coalitions / governance)
    ['Todd Young', 'IN', 's3952-119', 'sponsor', '2026-02-26'],
    ['Maria Cantwell', 'WA', 's3952-119', 'cosponsor', '2026-02-26'],
    ['Marsha Blackburn', 'TN', 's3952-119', 'cosponsor', '2026-02-26'],
    ['John Hickenlooper', 'CO', 's3952-119', 'cosponsor', '2026-02-26'],
    // U.S. Leadership in Standards Act (international AI standards)
    ['Marsha Blackburn', 'TN', 's1269-119', 'sponsor', '2025-04-02'],
    ['Mark R. Warner', 'VA', 's1269-119', 'cosponsor', '2025-04-02'],
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
