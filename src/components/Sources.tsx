import type { Source } from '../lib/types.ts'

// Auto-rendered citation footer. Every Curio ships this; an empty source list
// would trip the "sources not provided" badge (see references/citations.md).
export function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) {
    return (
      <p role="note" style={{ color: '#9c560f', fontSize: 14 }}>
        ⚠ Sources not provided — treat these figures as unverified.
      </p>
    )
  }
  return (
    <section aria-label="Sources" style={{ fontSize: 14, color: 'var(--muted)' }}>
      <h2 style={{ fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--faint)', margin: '0 0 8px' }}>
        Sources
      </h2>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        {sources.map((s, i) => (
          <li key={i} style={{ marginBottom: 4 }}>
            <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
              {s.label}
            </a>
            {s.publisher ? <> — {s.publisher}</> : null}
            {s.license ? <> · {s.license}</> : null}
            {s.accessed ? <> · accessed {s.accessed}</> : null}
          </li>
        ))}
      </ol>
    </section>
  )
}
