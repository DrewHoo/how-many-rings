// Ingest a workflow journal.jsonl (staff-harvest run) into data/staffs/*.json
// + data/counterexamples.json. Idempotent: re-running overwrites by (season, team).
// Usage: node scripts/ingest-journal.mjs <path-to-journal.jsonl>
import fs from 'node:fs'
import path from 'node:path'

const journalPath = process.argv[2]
if (!journalPath) throw new Error('usage: node scripts/ingest-journal.mjs <journal.jsonl>')

const outDir = path.join(import.meta.dirname, '..', 'data', 'staffs')
fs.mkdirSync(outDir, { recursive: true })

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const seen = new Map() // key -> result (resume runs may duplicate keys; last wins)
for (const line of fs.readFileSync(journalPath, 'utf8').trim().split('\n')) {
  const entry = JSON.parse(line)
  if (entry.type === 'result' && entry.result) seen.set(entry.key, entry.result)
}

let staffFiles = 0
for (const result of seen.values()) {
  if (result.team && result.season && Array.isArray(result.staff)) {
    const file = path.join(outDir, `${result.season}-${slug(result.team)}.json`)
    fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n')
    staffFiles++
  } else if (Array.isArray(result.candidates)) {
    const file = path.join(import.meta.dirname, '..', 'data', 'counterexamples.json')
    fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n')
    console.log(`counterexamples: ${result.candidates.length} candidates -> ${path.relative(process.cwd(), file)}`)
  }
}
console.log(`staff rosters written: ${staffFiles}`)
