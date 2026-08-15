import type { Ring, Scope } from '../lib/types.ts'
import { inScope, ROLE_LABEL } from '../lib/types.ts'

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
  const step = R * 2 + GAP
  const w = rings.length * step
  const h = R * 2 + STROKE

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img"
      aria-label={`${rings.length} championship rings: ${rings.map((r) => `${r.season} ${r.team}`).join(', ')}`}>
      {rings.map((ring, i) => {
        const on = inScope(ring, scope)
        return (
          <circle
            key={`${ring.season}-${ring.team}`}
            cx={i * step + R + STROKE / 2} cy={h / 2} r={R - STROKE / 2}
            fill="none"
            stroke={on ? 'var(--ring-on)' : 'var(--ring-off)'}
            strokeWidth={STROKE}
            style={{ cursor: 'pointer', transition: 'stroke 120ms' }}
            onPointerEnter={(e) => onHover?.(ring, e.currentTarget)}
            onPointerLeave={() => onHover?.(null, null)}
          >
            <title>{`${ring.season} ${ring.team} — ${ring.role} (${ROLE_LABEL[ring.cat]})`}</title>
          </circle>
        )
      })}
    </svg>
  )
}
