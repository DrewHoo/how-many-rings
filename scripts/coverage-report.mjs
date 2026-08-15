// Coverage diagnostics: where is the dataset most likely to be undercounting?
//
// Two failure modes, neither visible by reading the leaderboard:
//   1. Depth asymmetry — two title seasons of the same program harvested from
//      sources of different depth, so people appear in one staff and not the
//      other. Consecutive title seasons should overlap heavily; when they don't,
//      the shallower harvest is the problem, not staff turnover.
//   2. Missing lifers — long-tenured support staff credited for a subset of a
//      program's titles. Contiguous credited seasons hide this (an internal-gap
//      check can't see it), so flag people whose credited seasons are a strict
//      subset of the titles their program won.
// Usage: node scripts/coverage-report.mjs
import fs from 'node:fs'
import path from 'node:path'

const staffDir = path.join(import.meta.dirname, '..', 'data', 'staffs')
const champs = new Map()   // team -> [seasons]
const rosters = new Map()  // "team|season" -> staff[]
const credited = new Map() // "team|name" -> {seasons, roles}

for (const f of fs.readdirSync(staffDir).filter((x) => x.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(staffDir, f), 'utf8'))
  champs.set(d.team, [...(champs.get(d.team) ?? []), d.season].sort((a, b) => a - b))
  rosters.set(`${d.team}|${d.season}`, d.staff)
  for (const s of d.staff) {
    const k = `${d.team}|${s.name.toLowerCase()}`
    const e = credited.get(k) ?? { name: s.name, team: d.team, seasons: [], role: s.role }
    e.seasons.push(d.season)
    credited.set(k, e)
  }
}

console.log('=== 1. Depth asymmetry between a program\'s title seasons ===')
console.log('(consecutive titles should share most of a staff; a low overlap means a thin harvest)\n')
const asym = []
for (const [team, seasons] of champs) {
  for (let i = 0; i < seasons.length - 1; i++) {
    const a = seasons[i], b = seasons[i + 1]
    if (b - a > 6) continue // too far apart to expect overlap
    const A = new Set(rosters.get(`${team}|${a}`).map((s) => s.name.toLowerCase()))
    const B = new Set(rosters.get(`${team}|${b}`).map((s) => s.name.toLowerCase()))
    const both = [...A].filter((n) => B.has(n)).length
    const overlap = both / Math.min(A.size, B.size)
    asym.push({ team, a, b, sizeA: A.size, sizeB: B.size, both, overlap, gap: b - a })
  }
}
for (const r of asym.sort((x, y) => x.overlap - y.overlap)) {
  const flag = r.overlap < 0.6 ? '  <-- suspicious' : ''
  console.log(`  ${r.team} ${r.a}(${r.sizeA}) / ${r.b}(${r.sizeB}): ${r.both} shared, ${Math.round(r.overlap * 100)}% of the smaller roster${flag}`)
}

console.log('\n=== 2. Possible missing lifers ===')
console.log('(credited for some of a program\'s titles, in a role that usually means a long tenure)\n')
const LIFER_ROLE = /trainer|equipment|video|photograph|academic|operations|nutrition|facilit|administrative|personnel|technology|medicine|strength/i
const suspects = []
for (const e of credited.values()) {
  const titles = champs.get(e.team)
  if (titles.length < 2 || e.seasons.length >= titles.length) continue
  if (!LIFER_ROLE.test(e.role)) continue
  const missing = titles.filter((y) => !e.seasons.includes(y))
  suspects.push({ ...e, missing, span: titles.length })
}
for (const s of suspects.sort((a, b) => b.seasons.length - a.seasons.length || a.name.localeCompare(b.name)).slice(0, 30)) {
  console.log(`  ${s.name} (${s.team}) has ${s.seasons.join(',')} — program also won ${s.missing.join(',')} | ${s.role.slice(0, 50)}`)
}
console.log(`\n${suspects.length} people in long-tenure roles are credited for only part of their program's titles.`)
