// Generates the social preview image + PNG icons from hand-authored SVG.
// Run locally when the design changes; outputs are committed and served static
// (CI does not regenerate them). Needs `sharp`, which is intentionally NOT a
// project dependency (keeps installs + CI lean). Run with a throwaway install:
//   npm i -D sharp && node scripts/gen-assets.mjs && npm uninstall sharp
import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')

// A staircase polyline echoing the chart's cumulative lines.
function stair(x0, y0, steps, dx, up, color, width) {
  let d = `M ${x0} ${y0}`
  let x = x0, y = y0
  for (let i = 0; i < steps; i++) { x += dx; d += ` H ${x}`; y -= up; d += ` V ${y}` }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" opacity="0.95"/>`
}

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#15110c"/><stop offset="1" stop-color="#0b0906"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g transform="translate(560 90)">
    ${stair(0, 470, 9, 68, 40, '#4c78a8', 5)}
    ${stair(0, 470, 9, 68, 30, '#e4572e', 5)}
    ${stair(0, 470, 10, 61, 47, '#d8a200', 7)}
  </g>
  <text x="80" y="150" fill="#d8a200" font-family="Georgia, serif" font-size="22" letter-spacing="6">A CURIO · OPEN DATA</text>
  <text x="78" y="250" fill="#f5f2ec" font-family="Georgia, 'Times New Roman', serif" font-size="82" font-weight="700">The World Cup</text>
  <text x="78" y="340" fill="#f5f2ec" font-family="Georgia, 'Times New Roman', serif" font-size="82" font-weight="700">Goal Race</text>
  <text x="80" y="410" fill="#b9b0a2" font-family="Helvetica, Arial, sans-serif" font-size="27">Which nations have scored the most — 1930–2022,</text>
  <text x="80" y="446" fill="#b9b0a2" font-family="Helvetica, Arial, sans-serif" font-size="27">as a cumulative race across every match.</text>
  <text x="80" y="560" fill="#8a8175" font-family="Helvetica, Arial, sans-serif" font-size="22">drewhoover.com/curio · source: openfootball</text>
  <rect x="80" y="586" width="120" height="4" fill="#d8a200"/>
</svg>`

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="13" fill="#1b1712"/>
  <polyline points="10,46 24,38 34,42 44,24 54,18" fill="none" stroke="#d8a200" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="54" cy="18" r="5.5" fill="#e4572e"/>
</svg>`

await writeFile(resolve(OUT, 'favicon.svg'), favicon)
await sharp(Buffer.from(og)).png().toFile(resolve(OUT, 'og.png'))
await sharp(Buffer.from(favicon)).resize(180, 180).png().toFile(resolve(OUT, 'apple-touch-icon.png'))
await sharp(Buffer.from(favicon)).resize(32, 32).png().toFile(resolve(OUT, 'favicon-32.png'))
console.log('Wrote og.png, apple-touch-icon.png, favicon-32.png')
