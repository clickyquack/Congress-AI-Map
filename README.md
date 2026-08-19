# AI Risk in Congress

Interactive map of the **119th U.S. Congress** color-coded by publicly sourced positions on AI risk and domestic AI regulation.

## Run

```bash
npm install
npm run build:data   # refresh roster, AIPN quotes, districts geo
npm run dev
```

Production build: `npm run build` → `dist/`.

## GitHub Pages

The app is configured for a project site at `/Congress-AI-Map/`.

1. Push this repo to GitHub.
2. In repo **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Pushes to `main` run `.github/workflows/deploy.yml` (build + deploy `dist/`).
4. Site URL: `https://<user>.github.io/Congress-AI-Map/`

`public/.nojekyll` is copied into `dist/` so GitHub does not process the site with Jekyll.

## Map views

- **Junior senator** / **Senior senator** — each state colored by that seat (seniority = earlier continuous Senate start date within the state)
- **House districts** — 119th Congress cartographic boundaries (Census `cb_2025_us_cd119_20m`)

Click a seat for quotes/evidence and tracked bill actions with source links.

## Stance taxonomy (highest wins)

1. **Long-term / existential risk concern** — explicit public discussion of AGI, superintelligence, loss of control, existential risk, recursive self-improvement, or the Singularity (primarily [AIPN Congress on Superintelligence](https://theaipn.org/issue/quotes/))
2. **Supports stronger-risk regulation** — sponsor/cosponsor/support for frontier catastrophic-risk bills (e.g. FRONTIER Act, AI Kill Switch Act, RISE Act) without public x-risk concern
3. **Supports addressing mundane AI risks** — deepfakes, consumer harms, likeness protection (e.g. NO FAKES Act), etc.
4. **Opposes domestic AI regulation** — sourced opposition to domestic AI rulemaking (e.g. state AI regulation moratorium). **Excludes** national-security-only measures such as chip export controls
5. **Unknown** — no sourced signal yet (majority of members after this research pass)

`unknown` does **not** mean opposed.

Display stance is **recomputed** in `src/lib/classify.ts` from `evidence.json` + `actions.json` + bill categories so the map stays consistent when data is edited.

## Data

| File | Source |
|------|--------|
| `data/members.json` | [unitedstates/congress-legislators](https://unitedstates.github.io/congress-legislators/legislators-current.json) |
| `data/evidence.json` | AIPN quotes page (`RAW_DATA`) + curated statements |
| `data/bills.json` / `actions.json` | Congress.gov / press (FRONTIER H.R.9925, Kill Switch H.R.9917, RISE S.2081, NO FAKES S.1367, …) |
| `public/geo/districts-119.json` | Census CD119 shapefile → GeoJSON via `scripts/build-data.mjs` |

Refresh: `npm run build:data` (re-parses saved AIPN HTML in `data/aipn-quotes.json` and legislators JSON).

## Limits

This is a research snapshot, not a complete scorecard. Many members remain `unknown`. Former members who appear on AIPN but are not in the current roster (e.g. Marjorie Taylor Greene) are omitted from the map. Vote records are sparse for bills still in committee—cosponsorship is the main legislative signal used so far.
