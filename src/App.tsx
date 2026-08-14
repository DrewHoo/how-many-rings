import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Dataset } from './lib/types.ts'
import { colorFor } from './lib/colors.ts'
import { GoalRaceChart } from './components/GoalRaceChart.tsx'
import { TeamSearch } from './components/TeamSearch.tsx'
import { Sources } from './components/Sources.tsx'
import { ShareButton } from './components/ShareButton.tsx'

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  )
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 640)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return narrow
}

export function App() {
  const [data, setData] = useState<Dataset | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const [highlight, setHighlight] = useState<string | null>(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('team') : null,
  )
  const narrow = useIsNarrow()

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/worldcup.json`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d: Dataset) => setData(d))
      .catch((e) => setError(String(e)))
  }, [])

  // Stable colour per team, by all-time rank (so a team keeps its colour
  // regardless of what else is selected).
  const colorByTeam = useMemo(() => {
    const m = new Map<string, string>()
    data?.teams.forEach((t, i) => m.set(t.team, colorFor(i)))
    return m
  }, [data])
  const colorOf = (team: string) => colorByTeam.get(team) ?? '#999'

  const defaultSet = useMemo(() => new Set(data?.meta.defaultSelection ?? []), [data])

  // Initialise selection once data lands: honour a shared ?teams= list, else the
  // default top-20. A ?team= highlight is folded in so its line is visible.
  useEffect(() => {
    if (!data || selected) return
    const known = new Set(data.teams.map((t) => t.team))
    const raw = new URLSearchParams(window.location.search).get('teams')
    let init = raw ? raw.split(',').filter((t) => known.has(t)) : []
    if (!init.length) init = data.meta.defaultSelection
    if (highlight && known.has(highlight) && !init.includes(highlight)) init = [...init, highlight]
    if (highlight && !known.has(highlight)) setHighlight(null)
    setSelected(new Set(init))
  }, [data, selected, highlight])

  // Mirror state → URL. ?teams= only when the selection differs from default.
  useEffect(() => {
    if (!data || !selected) return
    const isDefault = selected.size === defaultSet.size && [...selected].every((t) => defaultSet.has(t))
    const params = new URLSearchParams()
    // URLSearchParams.toString() handles percent-encoding; don't pre-encode
    // (that double-encodes spaces to %2520). No team name contains a comma.
    if (!isDefault) params.set('teams', [...selected].join(','))
    if (highlight) params.set('team', highlight)
    const qs = params.toString()
    const next = qs ? `${location.pathname}?${qs}` : location.pathname
    if (next !== location.pathname + location.search) history.replaceState(null, '', next)
  }, [data, selected, highlight, defaultSet])

  const selectedTeams = useMemo(
    () => (data && selected ? data.teams.filter((t) => selected.has(t.team)) : []),
    [data, selected],
  )
  const isDefaultSelection =
    !!selected && selected.size === defaultSet.size && [...selected].every((t) => defaultSet.has(t))

  function toggleSelect(team: string) {
    const has = selected?.has(team)
    setSelected((prev) => {
      const n = new Set(prev)
      if (has) n.delete(team); else n.add(team)
      return n
    })
    if (has && highlight === team) setHighlight(null)
  }
  function isolate(team: string) {
    setSelected((prev) => { const n = new Set(prev); n.add(team); return n })
    setHighlight((cur) => (cur === team ? null : team))
  }
  function resetSelection() {
    if (!data) return
    setSelected(new Set(data.meta.defaultSelection))
    setHighlight(null)
  }

  const leader = data?.teams[0]
  const btn: CSSProperties = {
    font: 'inherit', fontSize: 13, cursor: 'pointer', padding: '6px 12px',
    borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)',
  }

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: narrow ? '28px 16px 72px' : '48px 28px 96px' }}>
      <p style={{ margin: 0, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 600 }}>
        A Curio · built on open data
      </p>
      <h1 style={{ fontSize: narrow ? 30 : 42, lineHeight: 1.08, margin: '10px 0 14px', textWrap: 'balance' }}>
        The World Cup Goal Race
      </h1>
      <p style={{ fontSize: narrow ? 16 : 18, color: 'var(--muted)', margin: '0 0 6px', maxWidth: 640 }}>
        Every goal every nation has scored across World Cup history, 1930–2022, as a cumulative race.
        Each line is a country; each point is one World Cup — hover it for every game they played, and a 🏆 marks a title.
      </p>
      {leader && (
        <p className="tabular" style={{ fontSize: 15, color: 'var(--ink)', margin: '0 0 22px' }}>
          {leader.team} leads with <b>{leader.total}</b> goals across {leader.matches} matches.
        </p>
      )}

      <div style={{
        background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14,
        padding: narrow ? '14px 8px 10px' : '18px 18px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '0 6px 10px' }}>
          {data && selected && (
            <TeamSearch teams={data.teams} selected={selected} onToggle={toggleSelect} colorOf={colorOf} />
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
            {highlight && <button onClick={() => setHighlight(null)} style={btn}>Show all lines</button>}
            {!isDefaultSelection && selected && <button onClick={resetSelection} style={btn}>Reset to top 20</button>}
            <ShareButton />
          </div>
        </div>

        {error && <p style={{ color: '#9c560f', padding: 24 }}>Couldn’t load the data: {error}</p>}
        {!data && !error && <p style={{ color: 'var(--faint)', padding: 24 }}>Loading the last 92 years of World Cups…</p>}
        {data && selected && (
          <GoalRaceChart
            teams={selectedTeams}
            colorOf={colorOf}
            highlight={highlight}
            onHighlight={isolate}
            height={narrow ? 380 : 470}
          />
        )}

        {/* Legend of selected teams. Click a chip to isolate its line; × removes it. */}
        {data && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 6px 4px' }}>
            {selectedTeams.map((t) => {
              const on = highlight === t.team
              const dim = highlight !== null && !on
              return (
                <span
                  key={t.team}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13,
                    padding: '4px 4px 4px 10px', borderRadius: 999,
                    border: `1px solid ${on ? 'var(--ink)' : 'var(--line)'}`,
                    background: on ? 'var(--ink)' : 'var(--card)',
                    color: on ? 'var(--card)' : 'var(--ink)', opacity: dim ? 0.5 : 1,
                  }}
                >
                  <button
                    onClick={() => isolate(t.team)}
                    aria-pressed={on}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, font: 'inherit', fontSize: 13, cursor: 'pointer', border: 'none', background: 'none', color: 'inherit', padding: 0 }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: 10, background: colorOf(t.team), flex: 'none' }} />
                    {t.team}
                    <span className="tabular" style={{ color: on ? 'var(--card)' : 'var(--muted)' }}>{t.total}</span>
                  </button>
                  <button
                    onClick={() => toggleSelect(t.team)}
                    aria-label={`Remove ${t.team}`}
                    style={{ cursor: 'pointer', border: 'none', background: 'none', color: on ? 'var(--card)' : 'var(--faint)', fontSize: 15, lineHeight: 1, padding: '0 4px' }}
                  >×</button>
                </span>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 20, fontSize: 14.5, color: 'var(--muted)', maxWidth: 660, display: 'grid', gap: 8 }}>
        <p style={{ margin: 0 }}>
          <b style={{ color: 'var(--ink)' }}>Reading it:</b> each point is one World Cup for that country, at its
          running goal total; a 🏆 marks the year they won it. Hover (or tap) a point for that tournament’s games.
          Use search to add any nation — including former ones — or tap a country to isolate its run.
        </p>
        <p style={{ margin: 0 }}>
          <b style={{ color: 'var(--ink)' }}>Former nations</b> like West Germany and the Soviet Union aren’t in the
          default top 20, but you can add them — West Germany’s goals alone would rank near the very top.
        </p>
        {data && (
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--faint)' }}>
            {data.meta.matchesUsed} matches across {data.meta.editions} tournaments, {data.meta.teamsTotal} nations. {data.meta.goalRule}.
          </p>
        )}
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '28px 0 18px' }} />
      {data && <Sources sources={[data.source]} />}

      <p style={{ marginTop: 28, fontSize: 12.5, color: 'var(--faint)' }}>
        Made with <a href="https://github.com/DrewHoo/curio" style={{ color: 'var(--accent)' }}>Curio</a>
        {data ? ` · data generated ${data.generatedAt.slice(0, 10)}` : ''}. A question, settled with receipts.
      </p>
    </main>
  )
}
