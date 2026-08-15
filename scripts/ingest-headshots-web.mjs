// Ingest web-hunted headshot URLs (from data/headshots-web.json) into
// public/headshots/ + data/headshots-manifest.json. Complements
// fetch-headshots.mjs, which handles the Wikipedia/Commons pass.
// Entries: [{name, imageUrl|null, sourcePage, sourceKind, license, note}]
// Only fills people whose manifest status is 'missing'; --force re-downloads.
// Regenerates SVG placeholders for anyone still missing afterwards.
// Usage: node scripts/ingest-headshots-web.mjs
import fs from 'node:fs'
import path from 'node:path'

const root = path.join(import.meta.dirname, '..')
const outDir = path.join(root, 'public', 'headshots')
const manifestPath = path.join(root, 'data', 'headshots-manifest.json')
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const entries = JSON.parse(fs.readFileSync(path.join(root, 'data', 'headshots-web.json'), 'utf8'))
const force = process.argv.includes('--force')

const UA = 'HowManyRings/0.1 (https://drewhoover.com/how-many-rings/; drewhoover@gmail.com) node'
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

for (const e of entries) {
  const key = slug(e.name)
  const current = manifest[key]
  if (!current) { console.log(`${e.name}: not in manifest, skipping`); continue }
  if (current.locked) { console.log(`${e.name}: locked, keeping ${current.file}`); continue }
  if (current.status === 'ok' && !force) continue
  if (!e.imageUrl) { current.reason = e.note ?? current.reason; continue }
  process.stdout.write(`${e.name} ... `)
  try {
    const res = await fetch(e.imageUrl, { headers: { 'User-Agent': UA } })
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok || !type.startsWith('image/')) throw new Error(`${res.status} ${type}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 3000) throw new Error(`suspiciously small (${buf.length}B)`)
    const ext = (type.match(/image\/(jpeg|png|webp|gif)/)?.[1] ?? 'jpg').replace('jpeg', 'jpg')
    const file = `${key}.${ext}`
    fs.writeFileSync(path.join(outDir, file), buf)
    fs.rmSync(path.join(outDir, `${key}.svg`), { force: true }) // drop placeholder if present
    manifest[key] = {
      name: e.name, group: current.group, status: 'ok', file,
      sourceKind: e.sourceKind, sourcePage: e.sourcePage,
      license: e.license, note: e.note, imageUrl: e.imageUrl,
    }
    console.log(`ok (${e.sourceKind}, ${Math.round(buf.length / 1024)}KB)`)
  } catch (err) {
    console.log(`FAIL: ${err.message}`)
    manifest[key].reason = `web url failed: ${err.message}`
  }
}

// placeholders for anyone still missing
const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
for (const [key, entry] of Object.entries(manifest)) {
  if (entry.status !== 'missing') continue
  const initials = entry.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  fs.writeFileSync(path.join(outDir, `${key}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 100 100">
<rect width="100" height="100" fill="hsl(${hue(entry.name)} 35% 38%)"/>
<text x="50" y="50" dy="0.36em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="38" fill="#fff">${initials}</text>
</svg>\n`)
  entry.file = `${key}.svg`
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
const counts = { ok: 0, missing: 0 }
for (const m of Object.values(manifest)) counts[m.status] = (counts[m.status] ?? 0) + 1
console.log(`\nmanifest: ${counts.ok} real photos, ${counts.missing} placeholders`)
