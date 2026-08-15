import type { Ring, Scope } from '../lib/types.ts'
import { inScope, ROLE_LABEL } from '../lib/types.ts'

/** Matches the custom-property names generated into src/team-colors.css. */
export const teamKey = (team: string) => team.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const R = 7          // ring outer radius
const STROKE = 3     // band thickness — a ring, not a dot
const GAP = 6        // surface gap between adjacent marks

/**
 * Unit marks: one ring glyph per championship. Rings outside the active scope
 * stay visible in the de-emphasis gray so the composition of someone's count
 * is never hidden by a filter — you can see that Cochran's are all support.
 */
export function RingGlyphs({
  rings, scope, onHover,
}: {
  rings: Ring[]
  scope: Scope
  onHover?: (r: Ring | null, el: EventTarget & SVGCircleElement | null) => void
}) {
  return <Glyphs rings={rings} scope={scope} onHover={onHover} />
}

/**
 * Rings won as a player: same hue, filled instead of outlined. A second
 * encoding rather than a second color, so the page still has one data color.
 */
export function PlayerRingGlyphs({ titles }: { titles: string[] }) {
  // Titles arrive as "2009 Alabama"; the school is everything after the year.
  const schoolOf = (t: string) => teamKey(t.replace(/^\d{4}\s+/, ''))
  const step = R * 2 + GAP
  const w = titles.length * step
  const h = R * 2 + STROKE
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img"
      aria-label={`${titles.length} won as a player: ${titles.join(', ')}`}>
      {titles.map((t, i) => (
        <circle key={t} cx={i * step + R + STROKE / 2} cy={h / 2} r={R - STROKE / 2}
          fill={`var(--team-${schoolOf(t)}, var(--ring-on))`}
          stroke={`var(--team-${schoolOf(t)}, var(--ring-on))`} strokeWidth={STROKE}>
          <title>{`${t} — won as a player`}</title>
        </circle>
      ))}
    </svg>
  )
}

function Glyphs({
  rings, scope, onHover,
}: {
  rings: Ring[]
  scope: Scope
  onHover?: (r: Ring | null, el: EventTarget & SVGCircleElement | null) => void
}) {
  const step = R * 2 + GAP
  const w = rings.length * step
  const h = R * 2 + STROKE

  // One delegated listener on the <svg> rather than a pair per circle: pointerover
  // bubbles, so it survives React re-renders that swap the circle under the cursor
  // (clicking a ring expands the row, which used to strand the tooltip on screen).
  const handleOver = (e: React.PointerEvent<SVGSVGElement>) => {
    const el = e.target as Element
    if (el.tagName !== 'circle') return onHover?.(null, null)
    const i = Number((el as SVGCircleElement).dataset.i)
    onHover?.(rings[i], el as SVGCircleElement)
  }

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img"
      onPointerOver={handleOver}
      onPointerLeave={() => onHover?.(null, null)}
      aria-label={`${rings.length} championship rings: ${rings.map((r) => `${r.season} ${r.team}`).join(', ')}`}>
      {rings.map((ring, i) => {
        const on = inScope(ring, scope)
        return (
          <circle
            key={`${ring.season}-${ring.team}`}
            data-i={i}
            cx={i * step + R + STROKE / 2} cy={h / 2} r={R - STROKE / 2}
            fill="none"
            // Hue is the school, always. Whether a ring counts in the current
            // filter rides on opacity, so the two encodings never fight.
            stroke={`var(--team-${teamKey(ring.team)}, var(--ring-on))`}
            opacity={on ? 1 : 0.22}
            strokeWidth={STROKE}
            // An unfilled circle is only hit-testable on its stroke, making the
            // target a 3px outline. 'all' hands back the whole disc.
            style={{ cursor: 'pointer', transition: 'stroke 120ms', pointerEvents: 'all' }}
          >
            <title>{`${ring.season} ${ring.team} — ${ring.role} (${ROLE_LABEL[ring.cat]})`}</title>
          </circle>
        )
      })}
    </svg>
  )
}
