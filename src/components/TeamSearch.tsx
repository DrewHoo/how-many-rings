import { useEffect, useRef, useState } from 'react'
import type { TeamSeries } from '../lib/types.ts'

// Type-to-find any country (all ~85, including former nations) and toggle it on
// the chart. Selected teams show a check; former nations are tagged.
export function TeamSearch({ teams, selected, onToggle, colorOf }: {
  teams: TeamSeries[]
  selected: Set<string>
  onToggle: (team: string) => void
  colorOf: (team: string) => string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const needle = q.trim().toLowerCase()
  const matches = teams.filter((t) => t.team.toLowerCase().includes(needle)).slice(0, 60)

  return (
    <div ref={ref} style={{ position: 'relative', flex: '1 1 200px', minWidth: 160, maxWidth: 320 }}>
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Find a country…"
        aria-label="Find a country to add or remove"
        style={{
          width: '100%', font: 'inherit', fontSize: 13, padding: '7px 11px',
          borderRadius: 8, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)',
        }}
      />
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute', zIndex: 20, top: 'calc(100% + 4px)', left: 0, right: 0,
            maxHeight: 300, overflowY: 'auto', background: 'var(--card)',
            border: '1px solid var(--line)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: 4,
          }}
        >
          {matches.map((t) => {
            const on = selected.has(t.team)
            return (
              <button
                key={t.team}
                role="option"
                aria-selected={on}
                onClick={() => onToggle(t.team)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                  font: 'inherit', fontSize: 13, cursor: 'pointer', padding: '7px 8px',
                  borderRadius: 7, border: 'none', background: on ? 'color-mix(in srgb, var(--accent) 9%, transparent)' : 'transparent',
                  color: 'var(--ink)',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 10, background: colorOf(t.team), flex: 'none' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.team}</span>
                {t.defunct && (
                  <span style={{ fontSize: 10.5, color: 'var(--faint)', border: '1px solid var(--line)', borderRadius: 5, padding: '0 4px', flex: 'none' }}>
                    former
                  </span>
                )}
                <span className="tabular" style={{ marginLeft: 'auto', color: 'var(--muted)', flex: 'none' }}>{t.total}</span>
                <span style={{ flex: 'none', width: 14, textAlign: 'center', color: on ? 'var(--accent)' : 'var(--faint)', fontWeight: 700 }}>
                  {on ? '✓' : '+'}
                </span>
              </button>
            )
          })}
          {!matches.length && (
            <div style={{ padding: '10px 8px', fontSize: 13, color: 'var(--faint)' }}>No countries match “{q}”.</div>
          )}
        </div>
      )}
    </div>
  )
}
