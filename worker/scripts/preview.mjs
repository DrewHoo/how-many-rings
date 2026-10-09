// Render cards locally with the Worker's own card code, for eyeballing.
// Usage: npm run preview -- jeff-allen scott-cochran   (writes preview/<id>.png, gitignored)
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import { cardSvg, parseTeamColors } from '../src/card.ts'

const SITE = 'https://drewhoover.com/how-many-rings/'
const ids = process.argv.slice(2)
await initWasm(await readFile(new URL('../node_modules/@resvg/resvg-wasm/index_bg.wasm', import.meta.url)))
const fonts = await Promise.all(['AlfaSlabOne-Regular.ttf', 'IBMPlexMono-SemiBold.ttf']
  .map(async (f) => new Uint8Array(await readFile(new URL(`../fonts/${f}`, import.meta.url)))))
const colors = parseTeamColors(await readFile(new URL('../../src/team-colors.css', import.meta.url), 'utf8'))
const data = await (await fetch(`${SITE}data/rings.json`)).json()
await mkdir(new URL('../preview/', import.meta.url), { recursive: true })

for (const id of ids) {
  const c = data.coaches.find((x) => x.id === id)
  if (!c) { console.error('no such person', id); continue }
  const p = {
    name: c.name, role: c.primaryRole, total: c.total, playerTitles: c.player?.titles.length ?? 0,
    rings: [...c.rings].sort((a, b) => a.season - b.season).map((r) => [r.season, r.team]),
  }
  let photo
  if (c.photo?.endsWith('.jpg')) {
    const b = Buffer.from(await (await fetch(`${SITE}headshots/${c.photo}`)).arrayBuffer())
    photo = `data:image/jpeg;base64,${b.toString('base64')}`
  }
  const t = performance.now()
  const png = new Resvg(cardSvg(p, colors, photo), {
    fitTo: { mode: 'width', value: 1200 },
    font: { fontBuffers: fonts, loadSystemFonts: false, defaultFontFamily: 'IBM Plex Mono' },
  }).render().asPng()
  await writeFile(new URL(`../preview/${id}.png`, import.meta.url), png)
  console.log(`${id}: ${Math.round(performance.now() - t)}ms, ${Math.round(png.length / 1024)}KB`)
}
