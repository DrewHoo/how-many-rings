// The per-person share card: 1200x630 SVG, drawn on the site's one dark surface
// with the site's two faces, then rasterised by resvg. Pure string building so
// the same function renders in the Worker and in the local preview script.

export interface CardPerson {
  name: string
  role: string
  total: number
  /** [season, team] per staff ring, oldest first. */
  rings: [number, string][]
  playerTitles: number
}

const W = 1200
const H = 630
const BG = '#17150f'
const CREAM = '#f4efe4'
const MUTED = '#b3aa99'
const FAINT = '#8f8776'
const GOLD = '#BA8A2E'
const RING_FALLBACK = '#D6A43C'

export const teamKey = (team: string) =>
  team.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

/** Parse `--team-x: #hex` pairs out of the generated site stylesheet, so the card can't drift from the board. */
export function parseTeamColors(css: string): Record<string, string> {
  return Object.fromEntries([...css.matchAll(/--team-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]))
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Monospace makes truncation exact: Plex Mono advances 0.6em per glyph. */
function clip(s: string, fontSize: number, maxWidth: number) {
  const max = Math.floor(maxWidth / (fontSize * 0.6))
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…'
}

function initials(name: string) {
  const parts = name.replace(/[^A-Za-z\s-]/g, '').split(/[\s-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function cardSvg(p: CardPerson, colors: Record<string, string>, photoDataUri?: string): string {
  const color = (team: string) => colors[teamKey(team)] ?? RING_FALLBACK
  const X = 356               // text column
  const COLW = W - X - 72

  // Alfa Slab One is wide (~0.62em average); size the name to fit one line.
  const nameSize = Math.min(78, Math.floor(COLW / (p.name.length * 0.62)))

  // Photo, or initials on a quiet disc — never an empty hole.
  const PX = 196, PY = 282, PR = 118
  const face = photoDataUri
    ? `<clipPath id="c"><circle cx="${PX}" cy="${PY}" r="${PR}"/></clipPath>
  <image href="${photoDataUri}" x="${PX - PR}" y="${PY - PR}" width="${PR * 2}" height="${PR * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#c)"/>`
    : `<circle cx="${PX}" cy="${PY}" r="${PR}" fill="#211d15"/>
  <text x="${PX}" y="${PY + 30}" text-anchor="middle" fill="${FAINT}" font-family="Alfa Slab One" font-size="88">${esc(initials(p.name))}</text>`

  // One ring glyph per championship, in the colour of the school that won it.
  const R = 25, STROKE = 8, STEP = R * 2 + 18
  const ringY = 362
  const glyphs = p.rings.map(([, team], i) =>
    `<circle cx="${X + R + i * STEP}" cy="${ringY}" r="${R}" fill="none" stroke="${color(team)}" stroke-width="${STROKE}"/>`).join('\n  ')
  const countX = X + p.rings.length * STEP + 10
  const countLabel = `${p.total} ${p.total === 1 ? 'ring' : 'rings'}`

  // Seasons grouped by school, school-coloured, at most three lines (the data's max).
  const bySchool = new Map<string, number[]>()
  for (const [season, team] of p.rings) bySchool.set(team, [...(bySchool.get(team) ?? []), season])
  const seasonLines = [...bySchool].slice(0, 3).map(([team, seasons], i) => {
    const y = 436 + i * 33
    return `<text x="${X}" y="${y}" font-family="IBM Plex Mono" font-size="24"><tspan fill="${color(team)}">${esc(team)}</tspan><tspan fill="${MUTED}"> ${esc(clip(seasons.join(' · '), 24, COLW - (team.length + 1) * 14.4))}</tspan></text>`
  }).join('\n  ')

  const player = p.playerTitles
    ? `<text x="${W - 72}" y="104" text-anchor="end" fill="${FAINT}" font-family="IBM Plex Mono" font-size="20">+${p.playerTitles} as a player</text>`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <text x="72" y="104" fill="${GOLD}" font-family="IBM Plex Mono" font-size="22" letter-spacing="4">HOW MANY RINGS?</text>
  ${player}
  ${face}
  <text x="${X}" y="218" fill="${CREAM}" font-family="Alfa Slab One" font-size="${nameSize}">${esc(p.name)}</text>
  <text x="${X}" y="272" fill="${MUTED}" font-family="IBM Plex Mono" font-size="24">${esc(clip(p.role, 24, COLW))}</text>
  ${glyphs}
  <text x="${countX}" y="${ringY + 15}" fill="${CREAM}" font-family="Alfa Slab One" font-size="44">${countLabel}</text>
  ${seasonLines}
  <text x="72" y="${H - 52}" fill="${FAINT}" font-family="IBM Plex Mono" font-size="20">drewhoover.com/how-many-rings · every ring cited to a source</text>
</svg>`
}
