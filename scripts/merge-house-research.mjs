/**
 * Merge batch House research into curated-evidence-house.json and house-progress.json
 * Usage: node scripts/merge-house-research.mjs
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

const batch = [
  {
    bioguideId: 'R000600',
    name: 'Aumua Amata Coleman Radewagen',
    state: 'AS',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'Commended TAKE IT DOWN Act; not a tracked-bill cosponsor.',
    evidence: [
      {
        quote:
          "Congress acted in bipartisan unity to stop this problem before it grows out of control, give law enforcement the means to prevent and prosecute it, and require when unlawful images of specific people are found, that companies 'take it down'.",
        date: '2025-05-03',
        sourceUrl:
          'https://radewagen.house.gov/media-center/press-releases/amata-commends-senate-and-house-passage-take-it-down-act',
        sourceLabel: 'TAKE IT DOWN Act passage press release',
        stanceImplied: 'mundane_risk',
      },
    ],
  },
  {
    bioguideId: 'M001238',
    name: 'Sarah McBride',
    state: 'DE',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'Supports sectoral AI regulation; opposed moratorium in NDAA letter.',
    evidence: [
      {
        quote:
          "Artificial intelligence is certainly the biggest change in society since the Industrial Revolution… I am someone who believes in what we call sectoral regulation. I think regulation for AI looks different in agriculture than it does in transportation, than it does in education, than it does in healthcare.",
        date: '2026-04-19',
        sourceUrl:
          'https://www.delawareonline.com/story/opinion/2026/04/19/delaware-rep-sarah-mcbride-on-iran-immigration-and-more-opinion/89646433007/',
        sourceLabel: 'Delaware Online interview',
        stanceImplied: 'mundane_risk',
      },
    ],
  },
  {
    bioguideId: 'M001219',
    name: 'James C. Moylan',
    state: 'GU',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'Lead sponsor of deepfake labeling bill H.R. 8479 (untracked).',
    evidence: [
      {
        quote:
          'Artificial intelligence is advancing rapidly, and while innovation brings tremendous opportunity, it also comes with real responsibility. Americans deserve transparency when AI-generated content is being used to influence, persuade, or deceive.',
        date: '2026-04-24',
        sourceUrl:
          'https://foushee.house.gov/media/press-releases/reps-foushee-beyer-and-moylan-introduce-the-protecting-consumers-from-deceptive-ai-act-to-establish-accountability-and-transparency-standards-for-generative-ai',
        sourceLabel: 'Protecting Consumers from Deceptive AI Act press release',
        stanceImplied: 'mundane_risk',
      },
    ],
  },
  {
    bioguideId: 'C001055',
    name: 'Ed Case',
    state: 'HI',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'Supports federal AI standards without hindering responsible development.',
    evidence: [
      {
        quote:
          'All of this should be fairly regulated on a national basis through Congress and the administration to set common expectations and standards, with the rest of the world where we can, without hindering the responsible development of AI.',
        date: '2026-07-09',
        sourceUrl:
          'https://www.staradvertiser.com/2026/07/09/election/2026-election-ed-case/',
        sourceLabel: 'Honolulu Star-Advertiser candidate Q&A',
        stanceImplied: 'mundane_risk',
      },
    ],
  },
  {
    bioguideId: 'K000404',
    name: 'Kimberlyn King-Hinds',
    state: 'MP',
    status: 'no_signal',
    signalsFound: [],
    notes: 'General pro-innovation AI remarks at committee hearing; no tracked-bill actions or risk-regulation quotes.',
  },
  {
    bioguideId: 'H001103',
    name: 'Pablo José Hernández',
    state: 'PR',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'Pro-AI infrastructure development framing; no tracked-bill cosponsorship.',
    evidence: [
      {
        quote:
          "Artificial Intelligence is not a toy. It's not a trend. It's a revolution on the scale of the personal computer, the internet, the smartphone—even the printing press. We cannot afford to fall behind.",
        date: '2026-01-15',
        sourceUrl:
          'http://hernandez.house.gov/media/press-releases/resident-commissioner-highlights-importance-data-centers-ai-development',
        sourceLabel: 'Data centers / AI development hearing press release',
        stanceImplied: 'mundane_risk',
      },
    ],
  },
  {
    bioguideId: 'P000610',
    name: 'Stacey E. Plaskett',
    state: 'VI',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'House lead on enacted TAKE IT DOWN Act (tracked Senate bill s146-119).',
    evidence: [
      {
        quote:
          'It is imperative that federal policymakers and AI experts continue to expose and address the dangers of explicit deepfakes and non-consensual intimate imagery (NCII) that profoundly impact women and girls.',
        date: '2025-01-22',
        sourceUrl:
          'https://debbiedingell.house.gov/news/documentsingle.aspx?DocumentID=5397',
        sourceLabel: 'TAKE IT DOWN Act reintroduction (Dingell press release)',
        stanceImplied: 'mundane_risk',
      },
    ],
  },
  {
    bioguideId: 'F000482',
    name: 'Julie Fedorchak',
    state: 'ND',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'AI competition/national-security framing; voted for H.R. 1 moratorium.',
    evidence: [
      {
        quote:
          "AI has been described as not only a powerful tool, but an incredible weapon. And I don't feel like the public necessarily understands that or sees it exactly that way.",
        date: '2026-01-15',
        sourceUrl:
          'http://fedorchak.house.gov/media/press-releases/fedorchak-highlights-urgent-need-beat-china-ai-race',
        sourceLabel: 'E&C AI subcommittee hearing press release',
        stanceImplied: 'mundane_risk',
      },
      MORATORIUM_VOTE,
    ],
  },
  {
    bioguideId: 'H001096',
    name: 'Harriet M. Hageman',
    state: 'WY',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'FAIR Act sponsor; voted for H.R. 1 moratorium.',
    evidence: [
      {
        quote:
          'AI is advancing faster than our institutions are prepared for, and we either allow technology to become a tool for propaganda or insist it serves the truth.',
        date: '2025-09-16',
        sourceUrl:
          'https://hageman.house.gov/media/press-releases/congresswoman-harriet-hageman-introduces-fair-act-safeguard-truth-and',
        sourceLabel: 'FAIR Act (H.R. 5315) press release',
        stanceImplied: 'mundane_risk',
      },
      MORATORIUM_VOTE,
    ],
  },
  {
    bioguideId: 'D000197',
    name: 'Diana DeGette',
    state: 'CO',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'Supports AI privacy guardrails; voted Nay on H.R. 1.',
    evidence: [
      {
        quote:
          "Artificial intelligence is here, but we need to make sure that it's not used to violate Americans' privacy rights and to take their sensitive data… Congress is right now developing guardrails.",
        date: '2026-06-29',
        sourceUrl:
          'https://www.denverpost.com/2026/06/29/diana-degette-ai-privacy/',
        sourceLabel: 'Denver Post / CD-1 primary coverage',
        stanceImplied: 'mundane_risk',
      },
    ],
  },
  { bioguideId: 'N000191', name: 'Joe Neguse', state: 'CO', status: 'no_signal', signalsFound: [], notes: 'No tracked-bill actions or sourced AI-risk-regulation quotes found.' },
  { bioguideId: 'C001121', name: 'Jason Crow', state: 'CO', status: 'no_signal', signalsFound: [], notes: 'No tracked-bill actions or sourced AI-risk-regulation quotes found.' },
  {
    bioguideId: 'B000825',
    name: 'Lauren Boebert',
    state: 'CO',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'Deepfake criminalization focus; voted for H.R. 1 moratorium.',
    evidence: [
      {
        quote:
          "The advent of deepfakes and technology and AI is really a new frontier… we looked at Chapter 88, Title 18 of the Federal Code of laws and looked at how we can make it a crime.",
        date: '2024-02-15',
        sourceUrl:
          'https://www.govinfo.gov/content/pkg/CHRG-118hhrg55181/html/CHRG-118hhrg55181.htm',
        sourceLabel: 'House Judiciary hearing: Addressing Real Harm Done by Deepfakes',
        stanceImplied: 'mundane_risk',
      },
      MORATORIUM_VOTE,
    ],
  },
  {
    bioguideId: 'P000620',
    name: 'Brittany Pettersen',
    state: 'CO',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'Supports federal preemption over state AI patchwork; deepfake scam legislation.',
    evidence: [
      {
        quote:
          "A state-by-state patchwork of AI rules could be incredibly problematic for an emerging national industry and states don't have the personnel needed to regulate such a complex subject so intricately.",
        date: '2025-08-19',
        sourceUrl:
          'https://tsscolorado.com/colorado-congressional-delegation-finds-some-bipartisan-agreement-on-ai-tax-credit-extensions/',
        sourceLabel: 'The Sum and Substance delegation forum',
        stanceImplied: 'opposes_domestic',
      },
      {
        quote:
          "The rise of AI-driven fraud poses significant risks to older adults… this legislation will help ensure the financial industry and its regulators better understand AI's use to proactively mitigate AI-related threats.",
        date: '2025-02-05',
        sourceUrl:
          'https://pettersen.house.gov/news/documentsingle.aspx?DocumentID=1044',
        sourceLabel: 'Preventing Deep Fake Scams Act press release',
        stanceImplied: 'mundane_risk',
      },
    ],
  },
  {
    bioguideId: 'H001100',
    name: 'Jeff Hurd',
    state: 'CO',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'Criticized Colorado AI law; voted for H.R. 1 moratorium.',
    evidence: [
      {
        quote:
          "I have heard from business leaders about how intrusive Colorado's law is regarding disclosures and appeals of AI-generated decisions, and I vowed to try to get something through Congress.",
        date: '2025-08-19',
        sourceUrl:
          'https://tsscolorado.com/colorado-congressional-delegation-finds-some-bipartisan-agreement-on-ai-tax-credit-extensions/',
        sourceLabel: 'The Sum and Substance delegation forum',
        stanceImplied: 'opposes_domestic',
      },
      MORATORIUM_VOTE,
    ],
  },
  { bioguideId: 'C001137', name: 'Jeff Crank', state: 'CO', status: 'complete', signalsFound: ['evidence'], notes: 'Voted for H.R. 1 moratorium.', evidence: [MORATORIUM_VOTE] },
  {
    bioguideId: 'E000300',
    name: 'Gabe Evans',
    state: 'CO',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'Urged national AI framework over state patchwork; voted for H.R. 1 moratorium.',
    evidence: [
      {
        quote:
          'A patchwork of conflicting, burdensome, and imprudent state regulations threatens U.S. AI leadership… we agree with the president that U.S. AI leadership can be enhanced through a minimally burdensome national policy framework.',
        date: '2026-02-19',
        sourceUrl:
          'https://riponadvance.com/featured/evans-urges-administration-to-develop-national-ai-approach/',
        sourceLabel: 'Letter to Commerce Secretary (Ripon Advance coverage)',
        stanceImplied: 'opposes_domestic',
      },
      MORATORIUM_VOTE,
    ],
  },
  {
    bioguideId: 'C001069',
    name: 'Joe Courtney',
    state: 'CT',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'AI industry accountability on child exploitation.',
    evidence: [
      {
        quote:
          "Clearly, there's a cost here. There's a social cost to AI, which we as a society have to figure out who pays… industry has an obligation here given the fact that there's a direct connection to scaling rapidly… and really, what's also happening rapidly in terms of negative fallout.",
        date: '2026-01-15',
        sourceUrl:
          'https://courtney.house.gov/media-center/press-releases/courtney-presses-ai-industry-accountability-amid-avalanche-child',
        sourceLabel: 'AI industry accountability press release',
        stanceImplied: 'mundane_risk',
      },
    ],
  },
  {
    bioguideId: 'D000216',
    name: 'Rosa L. DeLauro',
    state: 'CT',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'Concerns about AI costs for working people.',
    evidence: [
      {
        quote:
          "I don't know that there's enough of real knowledge in the House about the potential costs of A.I. on working people.",
        date: '2024-10-28',
        sourceUrl: 'https://theinnercitynews.com/a-i-is-the-new-nafta/',
        sourceLabel: 'InnerCity News trade/AI roundtable',
        stanceImplied: 'mundane_risk',
      },
    ],
  },
  { bioguideId: 'H001047', name: 'James A. Himes', state: 'CT', status: 'no_signal', signalsFound: [], notes: 'Cosponsors AI PLAN Act (H.R. 2152, untracked); no sourced AI-risk quote found.' },
  { bioguideId: 'L000557', name: 'John B. Larson', state: 'CT', status: 'no_signal', signalsFound: [], notes: 'No tracked-bill actions or sourced AI-risk quotes found.' },
  { bioguideId: 'H001081', name: 'Jahana Hayes', state: 'CT', status: 'no_signal', signalsFound: [], notes: 'No tracked-bill actions or sourced AI-risk quotes found.' },
  {
    bioguideId: 'P000597',
    name: 'Chellie Pingree',
    state: 'ME',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'AI job-displacement concerns.',
    evidence: [
      {
        quote:
          "If a huge segment of people in your district are losing their jobs, they're going to be like, 'Well, what the hell are you doing about me?'",
        date: '2025-10-01',
        sourceUrl:
          'https://www.notus.org/perspectives/i-tried-to-document-how-every-member-of-congress-feels-about-ai-the-results-were-strikingly-partisan',
        sourceLabel: 'NOTUS AI positions survey',
        stanceImplied: 'mundane_risk',
      },
    ],
  },
  { bioguideId: 'G000592', name: 'Jared F. Golden', state: 'ME', status: 'no_signal', signalsFound: [], notes: 'No AI-specific public statements or tracked-bill actions found.' },
  { bioguideId: 'P000614', name: 'Chris Pappas', state: 'NH', status: 'no_signal', signalsFound: [], notes: 'No tracked-bill actions or sourced AI-risk quotes found.' },
  { bioguideId: 'G000604', name: 'Maggie Goodlander', state: 'NH', status: 'no_signal', signalsFound: [], notes: 'Freshman; no tracked-bill actions or sourced AI-risk quotes found.' },
  {
    bioguideId: 'Z000018',
    name: 'Ryan K. Zinke',
    state: 'MT',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'AI/data-center energy framing; voted for H.R. 1 moratorium.',
    evidence: [
      {
        quote:
          "Our economy and people have always relied on Montana's clean coal and that is only going to increase with the advancement of AI, data centers and population growth.",
        date: '2025-01-15',
        sourceUrl:
          'http://downing.house.gov/media/press-releases/downing-daines-sheehy-zinke-introduce-bicameral-resolution-removing-harmful',
        sourceLabel: 'Miles City RMPA resolution press release',
        stanceImplied: 'mundane_risk',
      },
      MORATORIUM_VOTE,
    ],
  },
  {
    bioguideId: 'D000634',
    name: 'Troy Downing',
    state: 'MT',
    status: 'complete',
    signalsFound: ['evidence'],
    notes: 'Prefers permissive AI regulation; voted for H.R. 1 moratorium.',
    evidence: [
      {
        quote:
          'The folks on the other side tend to want a heavier hand in regulation, and I want a more permissive environment in regulation.',
        date: '2025-10-01',
        sourceUrl:
          'https://www.notus.org/perspectives/i-tried-to-document-how-every-member-of-congress-feels-about-ai-the-results-were-strikingly-partisan',
        sourceLabel: 'NOTUS AI positions survey',
        stanceImplied: 'opposes_domestic',
      },
      MORATORIUM_VOTE,
    ],
  },
  { bioguideId: 'M001205', name: 'Carol D. Miller', state: 'WV', status: 'complete', signalsFound: ['evidence'], notes: 'Voted for H.R. 1 moratorium.', evidence: [MORATORIUM_VOTE] },
  { bioguideId: 'M001235', name: 'Riley M. Moore', state: 'WV', status: 'complete', signalsFound: ['evidence'], notes: 'Voted for H.R. 1 moratorium.', evidence: [MORATORIUM_VOTE] },
  { bioguideId: 'S001148', name: 'Michael K. Simpson', state: 'ID', status: 'complete', signalsFound: ['evidence'], notes: 'Voted for H.R. 1 moratorium.', evidence: [MORATORIUM_VOTE] },
  { bioguideId: 'F000469', name: 'Russ Fulcher', state: 'ID', status: 'complete', signalsFound: ['evidence'], notes: 'Voted for H.R. 1 moratorium.', evidence: [MORATORIUM_VOTE] },
]

const curatedPath = path.join(researchDir, 'curated-evidence-house.json')
const progressPath = path.join(researchDir, 'house-progress.json')
const curated = JSON.parse(fs.readFileSync(curatedPath, 'utf8'))
const progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'))

const curatedKeys = new Set(
  curated.map((e) => `${e.name}|${e.state}|${e.sourceUrl}|${e.quote.slice(0, 80)}`),
)

let addedEvidence = 0
for (const row of batch) {
  progress.members[row.bioguideId] = {
    status: row.status,
    reviewedAt: today,
    signalsFound: row.signalsFound,
    notes: row.notes,
  }
  for (const e of row.evidence || []) {
    const key = `${row.name}|${row.state}|${e.sourceUrl}|${e.quote.slice(0, 80)}`
    if (curatedKeys.has(key)) continue
    curatedKeys.add(key)
    curated.push({ name: row.name, state: row.state, ...e })
    addedEvidence++
  }
}

const states = [
  'AL','AK','AZ','AR','AS','CA','CO','CT','DC','DE','FL','GA','GU','HI','IA','ID','IL','IN','KS','KY','LA','MA','MD','ME','MI','MN','MO','MP','MS','MT','NC','ND','NE','NH','NJ','NM','NV','NY','OH','OK','OR','PA','PR','RI','SC','SD','TN','TX','UT','VA','VI','VT','WA','WI','WV','WY',
]
const members = JSON.parse(fs.readFileSync(path.join(root, 'data/members.json'), 'utf8'))
const houseByState = {}
for (const m of members.filter((x) => x.chamber === 'house')) {
  ;(houseByState[m.state] ??= []).push(m)
}
let nextState = 'CA'
for (const s of states) {
  const pending = (houseByState[s] || []).some((m) => !progress.members[m.bioguideId])
  if (pending) {
    nextState = s
    break
  }
}
progress.currentState = nextState

fs.writeFileSync(curatedPath, JSON.stringify(curated, null, 2) + '\n')
fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2) + '\n')
console.log(`Merged ${batch.length} members; added ${addedEvidence} evidence rows`)
console.log(`Total reviewed: ${Object.keys(progress.members).length}/437; next state: ${nextState}`)
