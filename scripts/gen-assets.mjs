// Generates the social preview, the drewhoover.com index card cover, and the
// PNG icons from hand-authored SVG. Outputs are committed and served static
// (CI does not regenerate them). Needs `sharp`, intentionally NOT a project
// dependency — run with a throwaway install:
//   npm i -D sharp && node scripts/gen-assets.mjs && npm uninstall sharp
import sharp from 'sharp'
import { writeFile, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '..', 'public')

// Reuse the real palette so the card can't drift from the site.
const css = await readFile(resolve(HERE, '..', 'src', 'team-colors.css'), 'utf8')
const dark = Object.fromEntries(
  [...css.split('@media')[1].matchAll(/--team-([a-z0-9-]+): (#[0-9A-F]{6})/g)].map((m) => [m[1], m[2]]))

// Scott Cochran's eight, in order — the fact the whole page exists to tell.
const COCHRAN = ['lsu', 'alabama', 'alabama', 'alabama', 'alabama', 'alabama', 'georgia', 'georgia']

const rings = (x, y, r, gap, stroke) => COCHRAN
  .map((t, i) => `<circle cx="${x + i * (r * 2 + gap)}" cy="${y}" r="${r}" fill="none" stroke="${dark[t]}" stroke-width="${stroke}"/>`)
  .join('\n    ')

function card(w, h, titleY) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#17150f"/>
  <text x="72" y="${titleY - 92}" fill="#BA8A2E" font-family="Helvetica, Arial, sans-serif" font-size="21" letter-spacing="5">A CURIO · CITED DATA</text>
  <text x="70" y="${titleY}" fill="#f4efe4" font-family="Georgia, 'Times New Roman', serif" font-size="62" font-weight="700">Who has the most rings</text>
  <text x="70" y="${titleY + 76}" fill="#f4efe4" font-family="Georgia, 'Times New Roman', serif" font-size="62" font-weight="700">in Division I football?</text>
  <g>
    ${rings(74, titleY + 168, 21, 20, 6)}
  </g>
  <text x="70" y="${titleY + 238}" fill="#b3aa99" font-family="Helvetica, Arial, sans-serif" font-size="26">Scott Cochran, a strength coach, has eight — one more than Nick Saban.</text>
  <text x="70" y="${h - 54}" fill="#8f8776" font-family="Helvetica, Arial, sans-serif" font-size="21">drewhoover.com/how-many-rings · every ring cited to a source</text>
</svg>`
}

// A single ring, the site's unit mark.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="13" fill="#17150f"/>
  <circle cx="32" cy="32" r="17" fill="none" stroke="#BA8A2E" stroke-width="7"/>
</svg>`

await writeFile(resolve(OUT, 'favicon.svg'), favicon)
await sharp(Buffer.from(card(1200, 630, 268))).png().toFile(resolve(OUT, 'og.png'))
await sharp(Buffer.from(card(1200, 750, 310))).png().toFile(resolve(OUT, 'cover.png'))
await sharp(Buffer.from(favicon)).resize(180, 180).png().toFile(resolve(OUT, 'apple-touch-icon.png'))
await sharp(Buffer.from(favicon)).resize(32, 32).png().toFile(resolve(OUT, 'favicon-32.png'))
console.log('Wrote og.png (1200x630), cover.png (1200x750), favicon.svg, apple-touch-icon.png, favicon-32.png')
