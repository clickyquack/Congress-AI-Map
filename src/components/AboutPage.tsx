import { STANCE_COLORS, STANCE_LABELS, STANCE_ORDER } from '../lib/types'

const ISSUES_URL = 'https://github.com/clickyquack/Congress-AI-Map/issues'

export function AboutPage() {
  return (
    <article className="about">
      <a className="about-back" href="#map">
        ← Back to map
      </a>
      <h1>About this project</h1>
      <p>
        This is an interactive map and directory of the 119th U.S. Congress, color-coded by
        publicly sourced positions on AI risk and domestic AI regulation. It is a research
        snapshot, not a complete scorecard.
      </p>

      <section>
        <h2>Corrections</h2>
        <p>
          If a stance, quote, bill action, or seat is wrong or missing, please submit a
          correction on GitHub Issues. Include the member, what should change, and a public
          source link.
        </p>
        <p>
          <a href={ISSUES_URL} target="_blank" rel="noreferrer">
            Open an issue on GitHub
          </a>
        </p>
      </section>

      <section>
        <h2>How stance is assigned</h2>
        <p>
          Each member gets one display stance. When several signals exist, the{' '}
          <strong>highest-priority</strong> category wins. National-security-only measures
          such as chip export controls are excluded and never move stance.
        </p>
        <ol className="about-taxonomy">
          {STANCE_ORDER.map((s, i) => (
            <li key={s}>
              <span className="swatch" style={{ background: STANCE_COLORS[s] }} />
              <span>
                <strong>
                  {i + 1}. {STANCE_LABELS[s]}
                </strong>
                {s === 'xrisk_concern' &&
                  ' — explicit public discussion of AGI, superintelligence, loss of control, existential risk, recursive self-improvement, or the Singularity (primarily AIPN Congress on Superintelligence).'}
                {s === 'strong_risk_reg' &&
                  ' — sponsor, cosponsor, or support for frontier catastrophic-risk bills (for example the FRONTIER Act, AI Kill Switch Act, or RISE Act) without a public x-risk statement.'}
                {s === 'mundane_risk' &&
                  ' — support for addressing deepfakes, consumer harms, likeness protection, and similar issues (for example the NO FAKES Act).'}
                {s === 'opposes_domestic' &&
                  ' — sourced opposition to domestic AI rulemaking (for example a state AI regulation moratorium). Does not include national-security-only measures.'}
                {s === 'unknown' &&
                  ' — no sourced signal yet. Unknown does not mean opposed. Most members are in this category after the current research pass.'}
              </span>
            </li>
          ))}
        </ol>
        <p>
          Display stance is recomputed from quotes/evidence, tracked bill actions, and each
          bill’s category, so the map stays consistent when the underlying data is edited.
        </p>
      </section>

      <section>
        <h2>Map and list</h2>
        <ul>
          <li>
            <strong>Junior / senior senator</strong> — each state is colored by that seat.
            Seniority is the earlier continuous Senate start date within the state.
          </li>
          <li>
            <strong>House districts</strong> — 119th Congress cartographic boundaries (Census{' '}
            <code>cb_2025_us_cd119_20m</code>).
          </li>
          <li>
            <strong>List</strong> — the same members, filterable by stance, chamber, state,
            and party, and searchable by name or district.
          </li>
        </ul>
        <p>Click a seat or row for sourced quotes and tracked bill actions with links.</p>
      </section>

      <section>
        <h2>Sources</h2>
        <ul>
          <li>
            Roster:{' '}
            <a
              href="https://unitedstates.github.io/congress-legislators/legislators-current.json"
              target="_blank"
              rel="noreferrer"
            >
              unitedstates/congress-legislators
            </a>
          </li>
          <li>
            X-risk quotes primarily from{' '}
            <a href="https://theaipn.org/issue/quotes/" target="_blank" rel="noreferrer">
              AIPN Congress on Superintelligence
            </a>
            , plus other curated public statements
          </li>
          <li>
            Bills and actions: Congress.gov and press (including FRONTIER H.R.9925, Kill
            Switch H.R.9917, RISE S.2081, NO FAKES S.1367)
          </li>
          <li>House geography: Census CD119 shapefile</li>
        </ul>
      </section>

      <section>
        <h2>Limits</h2>
        <p>
          Many members remain unknown because no public signal has been collected yet. Former
          members who appear in AIPN quotes but are not in the current roster are omitted.
          Vote records are sparse for bills still in committee—cosponsorship is the main
          legislative signal used so far.
        </p>
      </section>
    </article>
  )
}
