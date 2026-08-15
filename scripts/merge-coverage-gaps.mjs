// Merge audited coverage gaps into the harvested rosters.
// Input: a JSON array of {name, role, roleCategory, seasons[], sourceUrl, quote}
// from a coverage-audit agent. Adds only (person, season) pairs that are
// genuinely absent — an audit run against a summarized roster list will
// re-report people we already have, so dedupe here, not in the prompt.
// Usage: node scripts/merge-coverage-gaps.mjs <gaps.json> <team> [--dry]
import fs from 'node:fs'
import path from 'node:path'

const [gapsPath, team] = process.argv.slice(2)
const dry = process.argv.includes('--dry')
if (!gapsPath || !team) throw new Error('usage: merge-coverage-gaps.mjs <gaps.json> <team> [--dry]')

const root = path.join(import.meta.dirname, '..')
const staffDir = path.join(root, 'data', 'staffs')
const norm = (n) => n.trim().replace(/\s+/g, ' ').replace(/["']/g, '').replace(/[.]/g, '')
  .replace(/\s+(Jr|Sr|II|III|IV)$/i, '').toLowerCase()

const gaps = JSON.parse(fs.readFileSync(gapsPath, 'utf8'))
const files = fs.readdirSync(staffDir).filter((f) => f.endsWith('.json'))
const added = []
const skipped = []

for (const gap of gaps) {
  for (const season of gap.seasons) {
    const file = files.find((f) => {
      const d = JSON.parse(fs.readFileSync(path.join(staffDir, f), 'utf8'))
      return d.season === season && d.team === team
    })
    if (!file) { skipped.push(`${gap.name} ${season}: no roster file for ${team} ${season}`); continue }
    const p = path.join(staffDir, file)
    const roster = JSON.parse(fs.readFileSync(p, 'utf8'))
    if (roster.staff.some((s) => norm(s.name) === norm(gap.name))) {
      skipped.push(`${gap.name} ${season}: already present`)
      continue
    }
    roster.staff.push({
      name: gap.name,
      role: gap.role,
      role_category: gap.roleCategory || 'other',
      sources: [{ url: gap.sourceUrl, quote: gap.quote, note: 'added by coverage audit' }],
    })
    added.push(`${gap.name} — ${season} ${team} (${gap.role})`)
    if (!dry) fs.writeFileSync(p, JSON.stringify(roster, null, 2) + '\n')
  }
}

console.log(`added ${added.length} rows${dry ? ' (DRY RUN)' : ''}:`)
for (const a of added) console.log('  + ' + a)
console.log(`\nskipped ${skipped.length} (already present or unmatched season)`)
for (const s of skipped.slice(0, 12)) console.log('  - ' + s)
