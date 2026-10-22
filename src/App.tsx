import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dataset, Ring, Scope } from './lib/types.ts'
import { ROLE_LABEL, matchesScope } from './lib/types.ts'
import { CoachRow } from './components/CoachRow.tsx'
import { ShareButton } from './components/ShareButton.tsx'
import { KOFI_URL, track } from './lib/analytics.ts'
import { SIBLINGS } from './lib/siblings.ts'

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
  // The person a shared link points at, read once on mount. Cleared after the
  // page scrolls to them, so later clicks never yank the viewport around.
  const linked = useRef<string | null>(null)
  useEffect(() => { linked.current = new URLSearchParams(window.location.search).get('open') }, [])
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

  // Land a shared link on its person. Runs as rows appear: the prerendered seed
  // has only the top 100, so someone further down shows up when the full data does.
  useEffect(() => {
    const id = linked.current
    if (!id || open !== id) return
    const el = document.getElementById(`person-${id}`)
    if (!el) return
    linked.current = null
    el.scrollIntoView({ block: 'start' })
  }, [open, data, scope, q])

  const activeScope = SCOPES.find((s) => s.key === scope) ?? SCOPES[0]

  if (error) return <main className="wrap"><p className="err">Couldn’t load the data: {error}</p></main>
  if (!data) return <main className="wrap"><p className="muted">Loading…</p></main>

  const shown = ranked.slice(0, 100)
  // A shared link can point past the top 100; show that one person too, at their real rank.
  const openIdx = open ? ranked.findIndex((c) => c.id === open) : -1
  const linkedBelow = openIdx >= shown.length ? ranked[openIdx] : null
  const half = Math.ceil(shown.length / 2)
  const cols = shown.length > 6 ? [shown.slice(0, half), shown.slice(half)] : [shown]
  // What a share says: the open person's line, else the sentence the page opens with.
  const openPerson = open ? data.coaches.find((c) => c.id === open) : undefined
  const shareText = openPerson
    ? `${openPerson.name} has ${openPerson.total} national championship ${openPerson.total === 1 ? 'ring' : 'rings'}`
    : 'Nick Saban has seven national championship rings. Scott Cochran, who ran his weight room, has eight.'

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
        <ShareButton text={shareText} open={openPerson?.id ?? null} />
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
      {linkedBelow && (
        <div className="board board-linked" onPointerLeave={() => setTip(null)}>
          <ol className="bcol" start={openIdx + 1}>
            <CoachRow coach={linkedBelow} rank={openIdx + 1} scope={scope as Scope} count={linkedBelow.total}
              expanded onToggle={() => { setTip(null); setOpen('') }}
              onHoverRing={(ring, el) => {
                if (!ring || !el) return setTip(null)
                const b = el.getBoundingClientRect()
                setTip({ ring, x: b.left + b.width / 2, y: b.top })
              }} />
          </ol>
        </div>
      )}

      {tip && (
        <div className="tip" style={{ left: tip.x, top: tip.y }}>
          <b>{tip.ring.season} {tip.ring.team}</b>
          <span>{tip.ring.role}</span>
          <em>{ROLE_LABEL[tip.ring.cat]}</em>
        </div>
      )}

      <section className="notes" id="method" aria-label="Method">
        <h2>Method</h2>
        <div className="method">
          <p>
            A ring here means: this person was on the staff of a team that won the national championship
            that season, and was still on staff at the championship game. The count comes from staff
            rosters for all {data.meta.seasonCount} championship team-seasons since 1990 — {data.meta.peopleTotal.toLocaleString()} people in
            all — each row carrying the source page and the verbatim line that supports it. Click any
            name to see the receipts. The sections below say how a ring is counted, where the names come
            from, what the words mean, and what we couldn't verify. Data built {data.meta.built}.
          </p>

          <details>
            <summary>How a ring is counted</summary>
            <p>
              Rings per person are the championship team-seasons whose staff roster the person appears on.
              Code does the counting from those rows; no model counts anything.
              The job has to be the team: {data.meta.excludedCount} people on these staff lists are left out
              because someone else signed their paycheck — {data.meta.employmentRules.map((r) => r.label.toLowerCase()).join(', ')}.
            </p>
            <p>
              Split national titles count for both schools. The 2004 USC title was later vacated, but the
              rings were handed out. Rings won as a <em>player</em> are shown separately and aren't part of
              the ranking.
            </p>
          </details>

          <details>
            <summary>Where the names come from</summary>
            <p>
              One consensus national champion per season (CFP, else BCS, else AP, else Coaches) names the
              team-seasons. The staff rosters for those seasons existed nowhere, so they were assembled
              from media guides on archive.org, Wayback Machine snapshots of athletics staff directories,
              and school bios. Each row carries the source page and the verbatim line from it, so a row
              that nothing supports can be rejected; a ring with no source recorded says so on its row.
            </p>
            <p>
              Sources spell one person several ways across seasons, so names are merged by a kept list of
              aliases before the count. A ring credited from a documented employment span rather than a
              season's published staff list is labeled <em>from tenure</em>. It is weaker evidence and the
              row says so.
            </p>
          </details>

          <details>
            <summary>What the words mean</summary>
            <p>
              <b>Everyone</b> is everyone the team listed — coaches, trainers, analysts, operations.{' '}
              <b>Support staff</b> are the people who earned a ring in strength, medical, analyst or operations work.{' '}
              <b>Coaches</b> are the people who earned a ring as a head coach or on-field assistant.
              The scope decides who is listed, never what anyone is worth: a person's rank and count are
              always their real ring total.
            </p>
            <p>
              A <b>role</b> is worded the way the source words it. A ring won as a <b>player</b> is drawn
              filled, where a staff ring is outlined, and is counted apart from the ranking.
            </p>
          </details>

          <details>
            <summary>What we couldn't verify</summary>
            <p>
              Coverage of support staff is thinner in the early 1990s than today, so this undercounts the
              older dynasties. Each team-season's coverage note, kept with the data, says what its sources did and didn't reach.
              And whether each person physically owns every ring varies with department policy — this
              counts the ones they earned.
            </p>
          </details>

          <p>
            The site is free and serves no ads. If you enjoyed using it, consider{' '}
            <a href={KOFI_URL} onClick={() => track('kofi', { from: 'notes' })}>buying me some server compute</a> or
            donating to The Internet Archive's <a href="https://archive.org/donate">Wayback Machine</a> (I am a
            monthly donor, FTR).
          </p>
        </div>
      </section>

      <section className="notes">
        <h2>What to read next</h2>
        <div className="method">
          {SIBLINGS.map((s) => (
            <p key={s.url}><a href={s.url}>{s.name}</a> — {s.words}.</p>
          ))}
        </div>
      </section>

      <footer>
        <a href="https://drewhoover.com/">drewhoover.com</a> ·{' '}
        <a href="https://github.com/DrewHoo/how-many-rings">source & receipts</a> ·{' '}
        <a href={KOFI_URL} onClick={() => track('kofi', { from: 'footer' })}>buy me a coffee</a>
      </footer>
    </main>
  )
}
