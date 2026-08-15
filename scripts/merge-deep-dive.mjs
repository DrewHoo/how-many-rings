// Merge cross-check and lifer findings into the rosters.
// Input rows: {name, season, team, role, roleCategory, sourceUrl, quote, evidence, confidence}
// Low-confidence rows are dropped: this dataset would rather be short a ring
// than carry one it cannot stand behind. Rows sourced from an employment span
// rather than a staff list keep via:'tenure' so the site can label them.
// Usage: node scripts/merge-deep-dive.mjs <confirmed.json> [--dry]
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const staffDir = path.join(root, 'data', 'staffs')
const dry = process.argv.includes('--dry')

const ALIASES = JSON.parse(fs.readFileSync(path.join(root, 'data', 'name-aliases.json'), 'utf8')).aliases
const canonical = (n) => ALIASES[n.trim()] ?? n.trim()
const norm = (n) => canonical(n).toLowerCase().replace(/["']/g, '').replace(/[.]/g, '')
  .replace(/\s+/g, ' ').replace(/\s+(jr|sr|ii|iii|iv)$/, '').trim()

const files = fs.readdirSync(staffDir).filter((f) => f.endsWith('.json'))
const index = new Map() // "team|season" -> {path, data}
for (const f of files) {
  const p = path.join(staffDir, f)
  const d = JSON.parse(fs.readFileSync(p, 'utf8'))
  index.set(`${d.team}|${d.season}`, { path: p, data: d })
}

const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const added = [], dupes = [], lowConf = [], noRoster = []

for (const r of rows) {
  if (r.confidence === 'low') { lowConf.push(`${r.name} ${r.season} ${r.team}`); continue }
  const entry = index.get(`${r.team}|${r.season}`)
  if (!entry) { noRoster.push(`${r.name} ${r.season} ${r.team}`); continue }
  if (entry.data.staff.some((s) => norm(s.name) === norm(r.name))) {
    dupes.push(`${r.name} ${r.season} ${r.team}`)
    continue
  }
  entry.data.staff.push({
    name: canonical(r.name),
    role: r.role,
    role_category: r.roleCategory || 'other',
    ...(r.evidence === 'tenure' ? { via: 'tenure' } : {}),
    confidence: r.confidence,
    sources: [{ url: r.sourceUrl, quote: r.quote, note: `deep-dive audit (${r.evidence ?? 'roster'})` }],
  })
  added.push(`${r.name} — ${r.season} ${r.team} (${r.role})`)
}

if (!dry) for (const { path: p, data } of index.values()) fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n')

console.log(`added ${added.length} rows${dry ? ' (DRY)' : ''}`)
console.log(`skipped: ${dupes.length} already present, ${lowConf.length} low confidence, ${noRoster.length} no matching roster`)
if (lowConf.length) console.log('  low-confidence dropped: ' + lowConf.join('; '))
