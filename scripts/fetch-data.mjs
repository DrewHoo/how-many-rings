// Build-time data fetch for the Curio example.
//
// Question: which countries have scored the most goals in World Cup history —
// as a cumulative race, one line per country. We condense each team's tournament
// into a SINGLE point per edition (a team plays ~7 games in a one-month window,
// far too dense to hover on a 92-year axis). Hovering a point shows that team's
// matches in that tournament, in order of appearance.
//
// Source: openfootball / worldcup.json (CC0 public domain).
//   https://github.com/openfootball/worldcup.json
// Per-edition JSON, one file per tournament. We hardcode the 22 men's editions
// (1930–2022) rather than globbing the repo tree, which also contains 2025
// (Club World Cup) and 2026 (future fixtures) directories.
//
// Goal-counting rule: per match, per team, count in-play + extra-time goals and
// EXCLUDE penalty-shootout kicks. score.et is the tally after 120 min (includes
// extra-time goals); fall back to score.ft (90 min) when there was no extra time.
// NEVER read score.p — that's the shootout. Verified on the 2022 final:
// score = {ft:[2,2], et:[3,3], p:[4,2]} → counted 3–3, shootout excluded.

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')
const BASE = 'https://raw.githubusercontent.com/openfootball/worldcup.json/master'
const YEARS = [
  1930, 1934, 1938, 1950, 1954, 1958, 1962, 1966, 1970, 1974, 1978,
  1982, 1986, 1990, 1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022,
]

// Only a true same-entity naming inconsistency is merged. Historical
// successor-state names (West Germany vs Germany, Soviet Union vs Russia, …)
// are kept distinct on purpose — they read as honest, separate histories.
const ALIAS = { USA: 'United States' }
const norm = (t) => ALIAS[t] ?? t

// Nations that no longer exist as such. Kept in the data (and searchable), but
// excluded from the default top-20 so the default view is present-day countries.
const DEFUNCT = new Set([
  'West Germany', 'East Germany', 'Soviet Union', 'Czechoslovakia',
  'Yugoslavia', 'Serbia and Montenegro', 'Zaire', 'Dutch East Indies',
])

const SOURCE = {
  label: 'openfootball / worldcup.json — free open public-domain World Cup football data',
  publisher: 'openfootball (football.json project)',
  url: 'https://github.com/openfootball/worldcup.json',
  license: 'CC0-1.0 (public domain)',
  accessed: new Date().toISOString().slice(0, 10),
}

const DEFAULT_TOP = 20 // still-existing countries selected as lines by default

async function fetchEdition(year) {
  const res = await fetch(`${BASE}/${year}/worldcup.json`)
  if (!res.ok) throw new Error(`${year}: HTTP ${res.status}`)
  return { year, matches: (await res.json()).matches ?? [] }
}

async function mapLimit(items, limit, worker) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await worker(items[idx]) }
  }))
  return out
}

function goalsFor(score) {
  if (!score) return null
  const arr = score.et ?? score.ft
  if (!Array.isArray(arr) || arr.length !== 2) return null
  const [a, b] = arr
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  return [a, b]
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const editions = await mapLimit(YEARS, 6, fetchEdition)

  // Flatten every scored match into two per-team game rows, and track each
  // edition's last match date (the x-position all its team-points share).
  const rows = [] // { team, year, ts, date, opp, gf, ga, result, stage }
  const editionEndTs = new Map()
  const champions = new Map() // year -> winning team (derived from the Final)
  let matchesUsed = 0, skipped = 0

  for (const { year, matches } of editions) {
    for (const m of matches) {
      const g = goalsFor(m.score)
      if (!m.date || !m.team1 || !m.team2 || !g) { skipped++; continue }
      matchesUsed++
      const ts = Date.parse(`${m.date}T00:00:00Z`) // UTC — avoids the local-midnight date shift
      // Seed with -Infinity, not 0: pre-1970 editions have NEGATIVE timestamps,
      // and Math.max(0, negative) would wrongly pin them all to the 1970 epoch.
      editionEndTs.set(year, Math.max(editionEndTs.get(year) ?? -Infinity, ts))
      const stage = m.round || m.group || ''
      const [t1, t2] = [norm(m.team1), norm(m.team2)]
      const res = (a, b) => (a > b ? 'W' : a < b ? 'L' : 'D')
      rows.push({ team: t1, year, ts, date: m.date, opp: t2, gf: g[0], ga: g[1], result: res(g[0], g[1]), stage })
      rows.push({ team: t2, year, ts, date: m.date, opp: t1, gf: g[1], ga: g[0], result: res(g[1], g[0]), stage })

      // Champion = winner of the match whose round is exactly "Final". A drawn
      // final is decided by the penalty shootout (score.p) — the ONLY place we
      // read score.p, and never for goal totals.
      if (/^final$/i.test((m.round || '').trim())) {
        const [a, b] = g
        const p = m.score.p
        const w = a !== b ? (a > b ? 0 : 1) : p && p[0] !== p[1] ? (p[0] > p[1] ? 0 : 1) : null
        if (w !== null) champions.set(year, w === 0 ? t1 : t2)
      }
    }
  }

  // 1950 had a final round-robin, not a single "Final" match; record its winner.
  const FALLBACK_CHAMPION = { 1950: 'Uruguay' }
  for (const [y, champ] of Object.entries(FALLBACK_CHAMPION)) {
    if (!champions.has(+y)) champions.set(+y, champ)
  }

  // Group rows by team, then by edition. One point per (team, edition):
  // cumulative goals through that edition + the ordered list of that cup's games.
  const byTeam = new Map()
  for (const r of rows) {
    if (!byTeam.has(r.team)) byTeam.set(r.team, new Map())
    const byYear = byTeam.get(r.team)
    if (!byYear.has(r.year)) byYear.set(r.year, [])
    byYear.get(r.year).push(r)
  }

  const teams = []
  for (const [team, byYear] of byTeam) {
    let cum = 0
    const points = []
    for (const year of [...byYear.keys()].sort((a, b) => a - b)) {
      const games = byYear.get(year).sort((a, b) => a.ts - b.ts) // order of appearance
      const goals = games.reduce((s, g) => s + g.gf, 0)
      cum += goals
      points.push({
        year,
        ts: editionEndTs.get(year),
        cum,
        goals,
        champion: champions.get(year) === team,
        games: games.map((g) => ({ opp: g.opp, gf: g.gf, ga: g.ga, result: g.result, stage: g.stage })),
      })
    }
    teams.push({
      team, total: cum, editions: points.length,
      matches: rows.filter((r) => r.team === team).length,
      defunct: DEFUNCT.has(team), points,
    })
  }

  teams.sort((a, b) => b.total - a.total)
  // Default view: the top-N still-existing countries. Defunct nations stay in
  // the data (searchable) but don't fill the default slots.
  const defaultSelection = teams.filter((t) => !t.defunct).slice(0, DEFAULT_TOP).map((t) => t.team)

  const payload = {
    generatedAt: new Date().toISOString(),
    source: SOURCE,
    meta: {
      editions: YEARS.length,
      yearsSpanned: [YEARS[0], YEARS[YEARS.length - 1]],
      matchesUsed,
      matchesSkipped: skipped,
      teamsTotal: teams.length,
      defaultTop: DEFAULT_TOP,
      defaultSelection,
      goalRule: 'in-play + extra-time goals per team; penalty-shootout goals excluded',
    },
    teams, // all teams, sorted by total desc
  }

  await writeFile(resolve(OUT_DIR, 'worldcup.json'), JSON.stringify(payload))

  // Self-checks + human-readable summary (a sanity gate for the build).
  const arg = teams.find((t) => t.team === 'Argentina')
  const final2022 = arg?.points.find((p) => p.year === 2022)?.games.find((g) => g.opp === 'France')
  console.log(`Editions: ${editions.length}  matches used: ${matchesUsed}  skipped: ${skipped}`)
  console.log(`Teams total: ${teams.length}  default selection: top ${defaultSelection.length} still-existing`)
  console.log('Top scorers (cumulative goals, all World Cups):')
  for (const t of teams.slice(0, 15)) {
    console.log(`  ${String(t.total).padStart(3)}  ${t.team}${t.defunct ? '  [former]' : ''}  (${t.editions} cups)`)
  }
  if (final2022) console.log(`Self-check 2022 vs France: Argentina scored ${final2022.gf} (not the shootout) ✓`)
  else console.log('Self-check: could not locate 2022 Argentina–France row.')
  console.log(`Champions derived: ${champions.size}/22  spot-checks → 2022:${champions.get(2022)}  1966:${champions.get(1966)}  1950:${champions.get(1950)}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
