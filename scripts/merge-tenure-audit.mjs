// Apply verified tenure-audit findings: seasons a person's documented employment
// covers but our per-season roster harvest missed.
// These rings are marked via:"tenure" because the evidence is a documented
// employment span, not a line on that season's staff list — a weaker (but still
// cited) claim, and the site says which kind each ring is.
// Usage: node scripts/merge-tenure-audit.mjs <results.json> [--dry]
import fs from 'node:fs'
import path from 'node:path'

const resultsPath = process.argv[2]
const dry = process.argv.includes('--dry')
const root = path.join(import.meta.dirname, '..')
const staffDir = path.join(root, 'data', 'staffs')
const norm = (n) => n.trim().replace(/\s+/g, ' ').replace(/["']/g, '').replace(/[.]/g, '')
  .replace(/\s+(Jr|Sr|II|III|IV)$/i, '').toLowerCase()

const CAT = { // map the audit's prose categories onto our role_category vocabulary
  'strength and conditioning': 'sc', 'football operations / administration': 'ops',
  'athletic trainer': 'medical', 'analyst': 'analyst', 'equipment': 'equipment',
}
const catOf = (m) => CAT[(m.roleCategory ?? '').toLowerCase()] ??
  (/strength/i.test(m.role) ? 'sc'
    : /trainer|rehab|medicine|nutrition/i.test(m.role) ? 'medical'
    : /equipment/i.test(m.role) ? 'equipment'
    : /analyst|adviser|advisor|consultant|liaison/i.test(m.role) ? 'analyst'
    : /student assistant|graduate assistant/i.test(m.role) ? 'gradasst'
    : 'ops')

const people = JSON.parse(fs.readFileSync(resultsPath, 'utf8')).filter((p) => p.verdict === 'we-undercount')
const files = fs.readdirSync(staffDir).filter((f) => f.endsWith('.json'))
const added = []

for (const person of people) {
  for (const m of person.missingSeasons) {
    const file = files.find((f) => {
      const d = JSON.parse(fs.readFileSync(path.join(staffDir, f), 'utf8'))
      return d.season === m.season && d.team === person.team
    })
    if (!file) { console.log(`! no roster for ${person.team} ${m.season}`); continue }
    const p = path.join(staffDir, file)
    const roster = JSON.parse(fs.readFileSync(p, 'utf8'))
    if (roster.staff.some((s) => norm(s.name) === norm(person.name))) continue
    roster.staff.push({
      name: person.name,
      role: m.role,
      role_category: catOf(m),
      via: 'tenure',
      tenure: person.tenure,
      confidence: person.confidence,
      sources: [{ url: m.sourceUrl, quote: m.quote, note: 'tenure audit: documented employment covers this season' }],
    })
    added.push(`${person.name} — ${m.season} ${person.team} (${m.role}) [${person.confidence}]`)
    if (!dry) fs.writeFileSync(p, JSON.stringify(roster, null, 2) + '\n')
  }
}

console.log(`${added.length} rings added${dry ? ' (DRY RUN)' : ''}:`)
for (const a of added) console.log('  + ' + a)
