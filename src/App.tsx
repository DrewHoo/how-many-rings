import { useEffect, useMemo, useState } from 'react'
import type { Dataset, Ring, Scope } from './lib/types.ts'
import { ROLE_LABEL, matchesScope } from './lib/types.ts'
import { CoachRow } from './components/CoachRow.tsx'
import { ShareButton } from './components/ShareButton.tsx'

const BASE = import.meta.env.BASE_URL
const SCOPES: { key: Scope; label: string; blurb: string }[] = [
  { key: 'all', label: 'Everyone on staff', blurb: 'Every person the team listed — coaches, trainers, analysts, operations.' },
  { key: 'support', label: 'Support staff only', blurb: 'Anyone who earned a ring in strength, medical, analyst or operations work — the people who never appear on TV.' },
  { key: 'onfield', label: 'Coaches only', blurb: 'Anyone who earned a ring as a head coach or on-field assistant.' },
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

  return (
    <main className="wrap">
      <header className="head">
        <h1>Who has the most rings in Division I football?</h1>
        <p className="lede">
          Coach Saban has seven rings. But you might be surprised to learn that Scott Cochran,
          who ran his weight room, has eight! I had an agent (really a whole mess of agents)
          systematically research and answer the question “who has the most rings?”
        </p>
        <p className="lede lede-note">
          Note that I’m not certain that every single person literally possesses a championship
          ring for each year (there are department policies and complicated reasons why they may
          or may not have a physical ring), but I am saying that if they did, they deserve them!
        </p>
      </header>

      <section className="controls">
        <div className="segmented" role="tablist" aria-label="Which rings count">
          {SCOPES.map((s) => (
            <button key={s.key} role="tab" aria-selected={scope === s.key}
              className={scope === s.key ? 'seg on' : 'seg'}
              onClick={() => setScope(s.key)}>{s.label}</button>
          ))}
        </div>
        <input className="search" type="search" placeholder="Filter by name or school…"
          value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter by name or school" />
        <ShareButton />
      </section>
      <p className="scope-blurb">
        {activeScope.blurb} <strong>{ranked.length}</strong> people
        {scope === 'all' ? ' have 2 or more rings.' : ' qualify — each still shown with every ring they own.'}
      </p>

      {/* The tooltip belongs to a ring, so it lives exactly as long as the pointer
          is on one. Watching the list rather than each circle survives the case
          that broke it before: clicking a ring expands the row, unmounting the
          circle mid-hover so its own leave event never fires. */}
      <ol className="rows"
        onPointerLeave={() => setTip(null)}
        onPointerMove={(e) => { if (tip && !(e.target as Element).closest('svg')) setTip(null) }}>
        {ranked.slice(0, 100).map((c, i) => (
          <CoachRow key={c.id} coach={c} rank={i + 1} scope={scope as Scope} count={c.total}
            expanded={open === c.id}
            onToggle={() => { setTip(null); setOpen(open === c.id ? '' : c.id) }}
            onHoverRing={(ring, el) => {
              if (!ring || !el) return setTip(null)
              const b = el.getBoundingClientRect()
              setTip({ ring, x: b.left + b.width / 2, y: b.top })
            }} />
        ))}
      </ol>
      {ranked.length > 100 && <p className="muted more">Showing the top 100 of {ranked.length}. Search to find anyone else.</p>}

      {tip && (
        <div className="tip" style={{ left: tip.x, top: tip.y }}>
          <b>{tip.ring.season} {tip.ring.team}</b>
          <span>{tip.ring.role}</span>
          <em>{ROLE_LABEL[tip.ring.cat]}</em>
        </div>
      )}

      <footer className="foot">
        <h3>How this was counted</h3>
        <p>
          A ring here means: this person was on the staff of a team that won the national championship
          that season, and was still on staff at the championship game. The count comes from staff
          rosters for all {data.meta.seasonCount} championship team-seasons since 1990 — {data.meta.peopleTotal.toLocaleString()} people in
          all — each row carrying the source page and the verbatim line that supports it. Click any
          name to see the receipts.
        </p>
        <h3>Who doesn’t count</h3>
        <p>
          The job has to be the team. {data.meta.excludedCount} people who were on these staff lists are
          left out because someone else signed their paycheck — {data.meta.employmentRules.map((r) => r.label.toLowerCase()).join(', ')}.
        </p>
        <p className="muted">
          Data built {data.meta.built}. Split national titles count for both schools. The 2004 USC title
          was later vacated, but the rings were handed out. Rings won as a <em>player</em> are tracked
          separately and shown as a badge — they aren’t part of the ranking. Coverage of support staff is
          thinner in the early 1990s than today, so this undercounts the older dynasties.
        </p>
      </footer>
    </main>
  )
}
