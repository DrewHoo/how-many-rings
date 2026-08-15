// Merge a player-ring sweep's findings into data/player-rings.json.
//
// A player title only counts if it is one of the championships this dataset
// recognizes — the same consensus list the staff rings are joined against.
// Otherwise the site would apply a looser standard to player rings than to
// staff rings (Pitt's 1980 minor-selector title was the case that made this
// rule necessary).
// Usage: node scripts/merge-player-rings.mjs <found.json> [--dry]
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const staffDir = path.join(root, 'data', 'staffs')
const dry = process.argv.includes('--dry')

const recognized = new Set()
for (const f of fs.readdirSync(staffDir).filter((x) => x.endsWith('.json'))) {
  const d = JSON.parse(fs.readFileSync(path.join(staffDir, f), 'utf8'))
  recognized.add(`${d.season} ${d.team}`)
}
const ALIASES = JSON.parse(fs.readFileSync(path.join(root, 'data', 'name-aliases.json'), 'utf8')).aliases
const canonical = (n) => ALIASES[n.trim()] ?? n.trim()

const file = path.join(root, 'data', 'player-rings.json')
const store = JSON.parse(fs.readFileSync(file, 'utf8'))
const byName = new Map(store.players.map((p) => [canonical(p.name).toLowerCase(), p]))

const found = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const added = [], skipped = [], outOfScope = []

for (const f of found) {
  if (f.confidence === 'low') { skipped.push(`${f.name}: low confidence`); continue }
  const titles = (f.playerTitles ?? []).filter((t) => recognized.has(t.replace(/\s*\(.*$/, '').trim()))
  const dropped = (f.playerTitles ?? []).filter((t) => !titles.includes(t))
  if (dropped.length) outOfScope.push(`${f.name}: ${dropped.join(', ')}`)
  if (!titles.length) continue

  const key = canonical(f.name).toLowerCase()
  const existing = byName.get(key)
  if (existing) {
    const merged = [...new Set([...existing.titles, ...titles])]
    if (merged.length !== existing.titles.length) {
      existing.titles = merged.sort()
      added.push(`${f.name} (updated to ${merged.join(', ')})`)
    }
    continue
  }
  const entry = {
    name: canonical(f.name),
    titles: titles.sort(),
    detail: f.detail,
    sources: f.sources ?? [],
    confidence: f.confidence,
  }
  store.players.push(entry)
  byName.set(key, entry)
  added.push(`${f.name}: ${titles.join(', ')}`)
}

store.players.sort((a, b) => b.titles.length - a.titles.length || a.name.localeCompare(b.name))
if (!dry) fs.writeFileSync(file, JSON.stringify(store, null, 2) + '\n')

console.log(`added/updated ${added.length}${dry ? ' (DRY)' : ''}:`)
for (const a of added) console.log('  + ' + a)
if (outOfScope.length) {
  console.log(`\ndropped ${outOfScope.length} titles outside this dataset's recognized championships:`)
  for (const o of outOfScope) console.log('  - ' + o)
}
if (skipped.length) console.log(`\nskipped ${skipped.length}: ` + skipped.join('; '))
console.log(`\nplayer-rings.json now holds ${store.players.length} people`)
