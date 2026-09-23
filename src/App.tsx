import { useEffect, useMemo, useState } from 'react'
import type { Dataset, Ring, Scope } from './lib/types.ts'
import { ROLE_LABEL, matchesScope } from './lib/types.ts'
import { CoachRow } from './components/CoachRow.tsx'
import { ShareButton } from './components/ShareButton.tsx'

const BASE = import.meta.env.BASE_URL
const SCOPES: { key: Scope; label: string; blurb: string }[] = [
  { key: 'all', label: 'Everyone', blurb: 'Everyone the team listed — coaches, trainers, analysts, operations.' },
  { key: 'support', label: 'Support staff', blurb: 'People who earned a ring in strength, medical, analyst or operations work.' },
  { key: 'onfield', label: 'Coaches', blurb: 'People who earned a ring as a head coach or on-field assistant.' },
]

/**
 * URL-backed state. The first render must not read `window` — the prerendered
 * HTML has no query string, so seeding from the URL hydrates into a mismatch
 * whenever someone opens a shared link. Start at the fallback and apply the URL
 * on mount instead.
 */
function useQueryState(key: string, fallback: string) {
  const [v, setV] = useState(fallback)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(key)
    if (fromUrl !== null) setV(fromUrl)
    setReady(true)
  }, [key])

  useEffect(() => {
    if (!ready) return   // don't wipe the incoming URL before we've read it
    const p = new URLSearchParams(window.location.search)
    v === fallback ? p.delete(key) : p.set(key, v)
    const q = p.toString()
    window.history.replaceState(null, '', q ? `?${q}` : window.location.pathname)
  }, [key, v, fallback, ready])

  return [v, setV] as const
}

export function App({ initialData }: { initialData?: Dataset } = {}) {
  const [data, setData] = useState<Dataset | null>(initialData ?? null)
  const [error, setError] = useState<string | null>(null)
  const [scope, setScope] = useQueryState('scope', 'all')
  const [q, setQ] = useQueryState('q', '')
  const [open, setOpen] = useQueryState('open', '')
  const [tip, setTip] = useState<{ ring: Ring; x: number; y: number } | null>(null)

  useEffect(() => {
    if (!tip) return
    const clear = () => setTip(null)
    window.addEventListener('scroll', clear, { passive: true })
    window.addEventListener('blur', clear)
    return () => { window.removeEventListener('scroll', clear); window.removeEventListener('blur', clear) }
  }, [tip])

  // Always fetch the full dataset: the seed carries only the top 100 and no
  // citations, which is enough to paint but not enough to click into.
  useEffect(() => {
    fetch(`${BASE}data/rings.json`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(setData)
      .catch((e) => { if (!initialData) setError(String(e)) })
  }, [initialData])

  // Rank and count are always the person's real ring total — the scope decides
  // who is listed, never what anyone is worth.
  const ranked = useMemo(() => {
    if (!data) return []
    const s = scope as Scope
    const needle = q.trim().toLowerCase()
    return data.coaches
      .filter((c) => matchesScope(c, s) && (!needle ||
        c.name.toLowerCase().includes(needle) ||
        c.primaryRole.toLowerCase().includes(needle) ||
        c.schools.some((t) => t.toLowerCase().includes(needle))))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  }, [data, scope, q])

  const activeScope = SCOPES.find((s) => s.key === scope) ?? SCOPES[0]

  if (error) return <main className="wrap"><p className="err">Couldn’t load the data: {error}</p></main>
  if (!data) return <main className="wrap"><p className="muted">Loading…</p></main>

  const shown = ranked.slice(0, 100)
  const half = Math.ceil(shown.length / 2)
  const cols = shown.length > 6 ? [shown.slice(0, half), shown.slice(half)] : [shown]

  return (
    <main className="wrap">
      <header className="head">
        <div className="field-rule" aria-hidden="true"></div>
        <h1>How Many Rings?</h1>
        <div className="dateline">National championship staffs · 1990 – present</div>
        <p className="sub">
          Nick Saban has seven. <b>Scott Cochran</b>, who ran his weight room, has <b>eight</b>.
        </p>
      </header>

      <div className="filters">
        <div className="toggle" role="tablist" aria-label="Which rings count">
          {SCOPES.map((s) => (
            <button key={s.key} role="tab" aria-selected={scope === s.key}
              className={scope === s.key ? 'on' : ''}
              onClick={() => setScope(s.key)}>{s.label}</button>
          ))}
        </div>
        <input type="search" placeholder="name or school"
          value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter by name or school" />
        <ShareButton />
      </div>
      <div className="h2-note">
        {activeScope.blurb} {ranked.length} people{scope === 'all' ? ' with 2+ rings' : ''} —
        tap a name for the receipts, a ring for the season.
      </div>

      {/* The tooltip belongs to a ring, so it lives exactly as long as the pointer
          is on one. Watching the board rather than each circle survives the case
          that broke it before: clicking a ring expands the row, unmounting the
          circle mid-hover so its own leave event never fires. */}
      <div className="board"
        onPointerLeave={() => setTip(null)}
        onPointerMove={(e) => { if (tip && !(e.target as Element).closest('svg')) setTip(null) }}>
        {cols.map((col, ci) => (
          <ol className="bcol" key={ci} start={ci * half + 1}>
            {col.map((c, i) => (
              <CoachRow key={c.id} coach={c} rank={ci * half + i + 1} scope={scope as Scope} count={c.total}
                expanded={open === c.id}
                onToggle={() => { setTip(null); setOpen(open === c.id ? '' : c.id) }}
                onHoverRing={(ring, el) => {
                  if (!ring || !el) return setTip(null)
                  const b = el.getBoundingClientRect()
                  setTip({ ring, x: b.left + b.width / 2, y: b.top })
                }} />
            ))}
          </ol>
        ))}
        {!shown.length && <p className="h2-note">No one matches — loosen the filters.</p>}
      </div>
      {ranked.length > 100 && <p className="more">Showing the top 100 of {ranked.length}. Search to find anyone else.</p>}

      {tip && (
        <div className="tip" style={{ left: tip.x, top: tip.y }}>
          <b>{tip.ring.season} {tip.ring.team}</b>
          <span>{tip.ring.role}</span>
          <em>{ROLE_LABEL[tip.ring.cat]}</em>
        </div>
      )}

      <section className="notes">
        <h2>How a ring is counted</h2>
        <div className="method">
          <p>
            A ring here means: this person was on the staff of a team that won the national championship
            that season, and was still on staff at the championship game. The count comes from staff
            rosters for all {data.meta.seasonCount} championship team-seasons since 1990 — {data.meta.peopleTotal.toLocaleString()} people in
            all — each row carrying the source page and the verbatim line that supports it. Click any
            name to see the receipts.
          </p>
          <p>
            The job has to be the team: {data.meta.excludedCount} people on these staff lists are left out
            because someone else signed their paycheck — {data.meta.employmentRules.map((r) => r.label.toLowerCase()).join(', ')}.
            Split national titles count for both schools. The 2004 USC title was later vacated, but the
            rings were handed out. Rings won as a <em>player</em> are shown separately and aren't part of
            the ranking. Coverage of support staff is thinner in the early 1990s than today, so this
            undercounts the older dynasties. And whether each person physically owns every ring varies
            with department policy — this counts the ones they earned. Data built {data.meta.built}.
          </p>
        </div>
      </section>

      <section className="notes">
        <h2>What to read next</h2>
        <div className="method">
          <p>
            <a href="https://drewhoover.com/hostile-territory/">Hostile Territory</a> — every head
            coach's true road record against AP top-10 teams since 1990, one chip per game.
          </p>
          <p>
            <a href="https://drewhoover.com/collegiate-championships/">Who has the most college championships?</a> — every
            NCAA champion since 1972, 33 sports, one grid.
          </p>
          <p>
            <a href="https://drewhoover.com/cfb-all-time-records/football">All-time FBS records</a> — all
            136 programs ranked by total wins, win percentage and bowl record.
          </p>
        </div>
      </section>
    </main>
  )
}
