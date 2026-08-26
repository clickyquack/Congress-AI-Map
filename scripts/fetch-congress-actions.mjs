/**
 * Fetches sponsor/cosponsor rows from Congress.gov API for tracked bills.
 * Usage: CONGRESS_API_KEY=your_key npm run fetch:congress
 * Falls back to DEMO_KEY (rate-limited) if env var unset.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const dataDir = path.join(root, 'data')
const researchDir = path.join(dataDir, 'research')

const API_KEY = process.env.CONGRESS_API_KEY || 'DEMO_KEY'
const BASE = 'https://api.congress.gov/v3'
const HOUSE_ONLY = process.argv.includes('--house-only')
const REQUEST_DELAY_MS = Number(process.env.CONGRESS_REQUEST_DELAY_MS || 1200)

function loadJsonIfExists(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Congress API ${res.status}: ${url}`)
  }
  return res.json()
}

async function fetchAllCosponsors(congress, billType, number) {
  const rows = []
  let offset = 0
  const limit = 250
  while (true) {
    const url = `${BASE}/bill/${congress}/${billType}/${number}/cosponsors?api_key=${API_KEY}&limit=${limit}&offset=${offset}`
    const data = await fetchJson(url)
    for (const c of data.cosponsors || []) {
      rows.push(c)
    }
    const total = data.pagination?.countIncludingWithdrawnCosponsors ?? data.pagination?.count ?? rows.length
    offset += limit
    if (offset >= total || !(data.cosponsors?.length)) break
    await sleep(REQUEST_DELAY_MS)
  }
  return rows
}

async function fetchSponsors(congress, billType, number) {
  const url = `${BASE}/bill/${congress}/${billType}/${number}?api_key=${API_KEY}`
  const data = await fetchJson(url)
  return data.bill?.sponsors || []
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function billId(bill) {
  return `${bill.billType}${bill.number}-${bill.congress}`
}

async function main() {
  const billsPath = path.join(dataDir, 'bills.json')
  let bills = JSON.parse(fs.readFileSync(billsPath, 'utf8'))
  if (HOUSE_ONLY) {
    bills = bills.filter((b) => b.billType === 'hr')
    console.log(`House-only mode: ${bills.length} bills`)
  }

  const existingRaw = loadJsonIfExists(path.join(researchDir, 'congress-actions-raw.json'), {
    actions: [],
  })
  const actions = [...(existingRaw.actions || [])]
  const seen = new Set(actions.map((a) => `${a.bioguideId}|${a.billId}|${a.action}`))

  for (const bill of bills) {
    const id = bill.id
    const { congress, billType, number } = bill
    console.log(`Fetching ${id}...`)

    try {
      const sponsors = await fetchSponsors(congress, billType, number)
      await sleep(REQUEST_DELAY_MS)
      const cosponsors = await fetchAllCosponsors(congress, billType, number)

      for (const s of sponsors) {
        if (!s.bioguideId) continue
        const key = `${s.bioguideId}|${id}|sponsor`
        if (seen.has(key)) continue
        seen.add(key)
        actions.push({
          bioguideId: s.bioguideId,
          billId: id,
          action: 'sponsor',
          date: bill.introducedDate || undefined,
          sourceUrl: bill.congressGovUrl,
        })
      }

      for (const c of cosponsors) {
        if (!c.bioguideId) continue
        const key = `${c.bioguideId}|${id}|cosponsor`
        if (seen.has(key)) continue
        seen.add(key)
        const isSponsor = sponsors.some((s) => s.bioguideId === c.bioguideId)
        if (isSponsor) continue
        actions.push({
          bioguideId: c.bioguideId,
          billId: id,
          action: 'cosponsor',
          date: c.sponsorshipDate || undefined,
          sourceUrl: bill.congressGovUrl,
        })
      }
    } catch (err) {
      console.warn(`  Skipped ${id}: ${err.message}`)
    }

    await sleep(REQUEST_DELAY_MS)
  }

  fs.mkdirSync(researchDir, { recursive: true })
  const out = path.join(researchDir, 'congress-actions-raw.json')
  fs.writeFileSync(
    out,
    JSON.stringify(
      {
        fetchedAt: new Date().toISOString().slice(0, 10),
        apiKey: API_KEY === 'DEMO_KEY' ? 'DEMO_KEY' : 'env',
        actions,
      },
      null,
      2,
    ),
  )
  console.log(`Wrote ${actions.length} actions → ${out}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
