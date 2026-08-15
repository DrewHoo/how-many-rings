// Build the site's data file from the harvested rosters + headshot manifest.
// Deterministic join, no model in the loop: rings per person = the championship
// team-seasons whose roster they appear on. Writes public/data/rings.json.
// Usage: node scripts/build-site-data.mjs
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const staffDir = path.join(root, 'data', 'staffs')
const outDir = path.join(root, 'public', 'data')
fs.mkdirSync(outDir, { recursive: true })

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const norm = (n) => n.trim().replace(/\s+/g, ' ').replace(/[.']/g, '').replace(/\s+(Jr|Sr|II|III|IV)$/i, '')

// Roles the site groups into two readable buckets. 'onfield'/'headcoach' are the
// coaches you see on TV; everything else is the support staff the project is about.
const SUPPORT = new Set(['sc', 'analyst', 'qc', 'gradasst', 'ops', 'medical', 'equipment', 'other'])

// Employment filter: a ring counts only if the football program is the person's
// full-time employer. Troopers, chaplains and consulting physicians are around
// the team but paid by someone else — see data/employment-rules.json.
const rules = JSON.parse(fs.readFileSync(path.join(root, 'data', 'employment-rules.json'), 'utf8'))
const keepRe = rules.keepOverrides.map((k) => new RegExp(k.pattern, 'i'))
const externalRules = rules.external.map((r) => ({ ...r, re: r.patterns.map((p) => new RegExp(p, 'i')) }))
function classifyEmployment(role) {
  if (keepRe.some((re) => re.test(role))) return null
  return externalRules.find((r) => r.re.some((re) => re.test(role))) ?? null
}

// Rings won as a player, tracked separately — they are a different kind of ring
// and the leaderboard ranks staff service. Shown as a badge on the person's row.
const playerRings = new Map(
  JSON.parse(fs.readFileSync(path.join(root, 'data', 'player-rings.json'), 'utf8')).players
    .map((p) => [norm(p.name), p]))

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'headshots-manifest.json'), 'utf8'))
const people = new Map()
const seasons = []
const excluded = new Map() // name -> {rule, roles:Set, count}

for (const file of fs.readdirSync(staffDir).filter((f) => f.endsWith('.json'))) {
  const { team, season, staff, coverage_notes } = JSON.parse(fs.readFileSync(path.join(staffDir, file), 'utf8'))
  seasons.push({ team, season, staffCount: staff.length, coverageNotes: coverage_notes })
  const seenHere = new Set()
  for (const row of staff) {
    const key = norm(row.name)
    if (seenHere.has(key)) continue
    seenHere.add(key)
    if (row.midseason_note && /NOT on staff/i.test(row.midseason_note)) continue // ring rule
    const ext = classifyEmployment(row.role)
    if (ext) {
      const e = excluded.get(key) ?? { name: row.name, rule: ext.label, roles: new Set(), count: 0 }
      e.roles.add(row.role); e.count++
      excluded.set(key, e)
      continue
    }
    if (!people.has(key)) people.set(key, { name: row.name, rings: [] })
    people.get(key).rings.push({
      season, team, role: row.role,
      cat: row.role_category,
      note: row.midseason_note,
      sources: (row.sources ?? []).map((s) => ({ url: s.url, quote: s.quote })).filter((s) => s.url),
    })
  }
}

const coaches = [...people.values()]
  .map((p) => {
    const id = slug(p.name)
    const photo = manifest[id]
    const asPlayer = playerRings.get(norm(p.name))
    p.rings.sort((a, b) => a.season - b.season)
    return {
      id, name: p.name,
      player: asPlayer
        ? { titles: asPlayer.titles, detail: asPlayer.detail, sources: asPlayer.sources ?? [] }
        : undefined,
      rings: p.rings,
      total: p.rings.length,
      support: p.rings.filter((r) => SUPPORT.has(r.cat)).length,
      onfield: p.rings.filter((r) => r.cat === 'onfield').length,
      head: p.rings.filter((r) => r.cat === 'headcoach').length,
      schools: [...new Set(p.rings.map((r) => r.team))],
      photo: photo?.status === 'ok' ? photo.file : undefined,
      placeholder: photo && photo.status !== 'ok' ? photo.file : undefined,
      photoCredit: photo?.status === 'ok'
        ? { license: photo.license, page: photo.sourcePage ?? photo.article, note: photo.note }
        : undefined,
    }
  })
  .filter((p) => p.total >= 2)
  .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

const out = {
  meta: {
    built: process.env.BUILD_DATE ?? new Date().toISOString().slice(0, 10),
    seasons: seasons.sort((a, b) => a.season - b.season),
    seasonCount: seasons.length,
    peopleTotal: people.size,
    note: 'Rings = championship team-seasons a person appears on, per the harvested staff rosters. Every ring carries its source citations.',
    employmentRules: rules.external.map((r) => ({ label: r.label, reason: r.reason })),
    excludedCount: excluded.size,
    excludedTop: [...excluded.values()]
      .filter((e) => e.count >= 2)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
      .map((e) => ({ name: e.name, rings: e.count, rule: e.rule, role: [...e.roles][0] })),
  },
  coaches,
}
fs.writeFileSync(path.join(outDir, 'rings.json'), JSON.stringify(out))
console.log(`rings.json: ${coaches.length} people with 2+ rings, from ${seasons.length} championship seasons (${people.size} counted, ${excluded.size} excluded as not employed by the program)`)
const notable = [...excluded.values()].filter((e) => e.count >= 3).sort((a, b) => b.count - a.count)
if (notable.length) console.log('  excluded with 3+ rings: ' + notable.map((e) => `${e.name} (${e.count}, ${e.rule})`).join('; '))
