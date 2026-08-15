// Fetch coach headshots from Wikipedia/Wikimedia Commons with license metadata.
// Resolves each name to a Wikipedia article, validates it's the football person
// (description must look football/coach-shaped), downloads the lead-image
// thumbnail to public/headshots/<slug>.<ext>, and records attribution in
// data/headshots-manifest.json. Misses get a deterministic SVG initials avatar.
// Idempotent: skips names already 'ok' in the manifest unless --force.
// Usage: node scripts/fetch-headshots.mjs [--force]
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const root = path.join(import.meta.dirname, '..')
const outDir = path.join(root, 'public', 'headshots')
const manifestPath = path.join(root, 'data', 'headshots-manifest.json')
fs.mkdirSync(outDir, { recursive: true })

const UA = 'HowManyRings/0.1 (https://drewhoover.com/how-many-rings/; drewhoover@gmail.com) node'
// Must match build-site-data.mjs: accents are stripped so ids stay ascii.
const slug = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function api(host, params) {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ format: 'json', ...params })}`
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

// Names come from the leaderboard plus any extras passed on the command line
// via --extra "Name One,Name Two" (used for counterexample-hunt headliners).
const top = JSON.parse(
  execSync('node scripts/leaderboard.mjs --min 3 --json --top 30', { cwd: root, encoding: 'utf8' })
)
const extraIdx = process.argv.indexOf('--extra')
const extras = extraIdx > -1 ? process.argv[extraIdx + 1].split(',').map((s) => s.trim()) : []
const targets = [
  ...top.map((p) => ({ name: p.display, group: 'leaderboard' })),
  ...extras.map((name) => ({ name, group: 'counterexample' })),
]

const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {}
const force = process.argv.includes('--force')

const stripName = (s) => s.replace(/\s*\(.*\)$/, '').replace(/[.']/g, '').toLowerCase()

for (const { name, group } of targets) {
  const key = slug(name)
  // A locked entry is a hand-picked image (e.g. a photo the author shot
  // themselves). Never overwrite it, not even with --force.
  if (manifest[key]?.locked) { console.log(`${name} ... locked, keeping ${manifest[key].file}`); continue }
  if (!force && manifest[key]?.status === 'ok') continue
  process.stdout.write(`${name} ... `)
  try {
    // 1. Find the article: plain-name search, football terms only as ranking hint
    const search = await api('en.wikipedia.org', {
      action: 'query', generator: 'search',
      gsrsearch: `${name} football`, gsrlimit: 5,
      prop: 'pageimages|description', piprop: 'name|thumbnail', pithumbsize: 500,
    })
    const pages = Object.values(search.query?.pages ?? {}).sort((a, b) => a.index - b.index)
    const isFootball = (d) => /football|coach|strength|athletic|linebacker|quarterback/i.test(d ?? '')
    const nameMatches = (t) => stripName(t) === stripName(name) || stripName(t).startsWith(stripName(name))
    const page = pages.find((p) => nameMatches(p.title) && isFootball(p.description)) ??
                 pages.find((p) => nameMatches(p.title) && p.description === undefined)
    if (!page) throw new Error('no matching article')
    if (!page.thumbnail || !page.pageimage) throw new Error(`article "${page.title}" has no lead image`)

    // 2. License metadata for the lead image file
    const info = await api('en.wikipedia.org', {
      action: 'query', titles: `File:${page.pageimage}`,
      prop: 'imageinfo', iiprop: 'extmetadata|url', iiurlwidth: 500,
    })
    const ii = Object.values(info.query.pages)[0]?.imageinfo?.[0]
    const meta = ii?.extmetadata ?? {}
    const licenseName = meta.LicenseShortName?.value ?? 'unknown'
    if (/non-free|fair use/i.test(licenseName)) throw new Error(`non-free image (${licenseName})`)

    // 3. Download thumbnail
    const imgUrl = ii?.thumburl ?? page.thumbnail.source
    const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': UA } })
    if (!imgRes.ok) throw new Error(`image download ${imgRes.status}`)
    const ext = (imgUrl.match(/\.(jpe?g|png|webp)/i)?.[1] ?? 'jpg').toLowerCase().replace('jpeg', 'jpg')
    const file = `${key}.${ext}`
    fs.writeFileSync(path.join(outDir, file), Buffer.from(await imgRes.arrayBuffer()))

    manifest[key] = {
      name, group, status: 'ok', file,
      article: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
      imageFile: `File:${page.pageimage}`,
      license: licenseName,
      artist: (meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim() || undefined,
      credit: meta.Credit?.value ? undefined : undefined,
      descriptionUrl: ii?.descriptionurl,
    }
    console.log(`ok (${page.title}, ${licenseName})`)
  } catch (e) {
    manifest[key] = { name, group, status: 'missing', reason: String(e.message) }
    console.log(`MISS: ${e.message}`)
  }
  await sleep(300)
}

// Placeholder SVG avatars for misses, so the UI never has a broken image
const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
for (const [key, entry] of Object.entries(manifest)) {
  if (entry.status !== 'missing') continue
  const initials = entry.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500" viewBox="0 0 100 100">
<rect width="100" height="100" fill="hsl(${hue(entry.name)} 35% 38%)"/>
<text x="50" y="50" dy="0.36em" text-anchor="middle" font-family="system-ui,sans-serif" font-size="38" fill="#fff">${initials}</text>
</svg>\n`
  const file = `${key}.svg`
  fs.writeFileSync(path.join(outDir, file), svg)
  entry.file = file
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
const ok = Object.values(manifest).filter((m) => m.status === 'ok').length
console.log(`\n${ok}/${Object.keys(manifest).length} real photos; manifest -> data/headshots-manifest.json`)
