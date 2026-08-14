// Compute the rings leaderboard from data/staffs/*.json.
// The join is deterministic: every file IS a championship team-season, so
// rings per person = count of files they appear in (minus departed-before-title rows).
// Usage: node scripts/leaderboard.mjs [--min 2] [--all-roles]
import fs from 'node:fs'
import path from 'node:path'

const dir = path.join(import.meta.dirname, '..', 'data', 'staffs')
const min = Number(process.argv[process.argv.indexOf('--min') + 1]) || 2
const includeHC = process.argv.includes('--all-roles')

const norm = (name) => name.trim().replace(/\s+/g, ' ').replace(/[.']/g, '').replace(/\s+(Jr|Sr|II|III|IV)$/i, '')

const people = new Map() // norm name -> {display, rings: [{season, team, role, role_category, flagged}]}
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const { team, season, staff } = JSON.parse(fs.readFileSync(path.join(dir, file)))
  const seenHere = new Set()
  for (const row of staff) {
    const key = norm(row.name)
    if (seenHere.has(key)) continue // dedupe within a team-season
    seenHere.add(key)
    // Ring rule: on staff at the championship game. Agents mark clear departures.
    const departed = row.midseason_note && /NOT on staff/i.test(row.midseason_note)
    if (departed) continue
    if (!people.has(key)) people.set(key, { display: row.name, rings: [] })
    people.get(key).rings.push({
      season, team, role: row.role, role_category: row.role_category,
      flagged: Boolean(row.midseason_note),
    })
  }
}

const rows = [...people.values()]
  .map((p) => ({
    ...p,
    total: p.rings.length,
    asAssistant: p.rings.filter((r) => r.role_category !== 'headcoach').length,
    schools: [...new Set(p.rings.map((r) => r.team))],
  }))
  .filter((p) => (includeHC ? p.total : p.asAssistant) >= min)
  .sort((a, b) => b.asAssistant - a.asAssistant || b.total - a.total)

if (process.argv.includes('--json')) {
  const top = process.argv.includes('--top') ? Number(process.argv[process.argv.indexOf('--top') + 1]) : rows.length
  console.log(JSON.stringify(rows.slice(0, top), null, 2))
} else {
  for (const p of rows) {
    const flag = p.rings.some((r) => r.flagged) ? ' *' : ''
    const hc = p.total !== p.asAssistant ? ` (+${p.total - p.asAssistant} as HC)` : ''
    console.log(
      `${String(p.asAssistant).padStart(2)}${flag} ${p.display}${hc} — ${p.schools.join(', ')} — ` +
      p.rings.map((r) => `${r.season} ${r.team} [${r.role_category}]`).join('; ')
    )
  }
  console.error(`\n${rows.length} people with ${min}+ non-HC rings; * = has a midseason/role note to review`)
}
