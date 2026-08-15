import type { Coach, Ring, Scope } from '../lib/types.ts'
import { ROLE_LABEL, inScope } from '../lib/types.ts'
import { RingGlyphs, PlayerRingGlyphs } from './RingGlyphs.tsx'

const BASE = import.meta.env.BASE_URL

export function CoachRow({
  coach, rank, scope, count, expanded, onToggle, onHoverRing,
}: {
  coach: Coach
  rank: number
  scope: Scope
  count: number
  expanded: boolean
  onToggle: () => void
  onHoverRing: (r: Ring | null, el: (EventTarget & SVGCircleElement) | null) => void
}) {
  const img = coach.photo ?? coach.placeholder
  return (
    <li className={`row${expanded ? ' row-open' : ''}`}>
      <button className="row-head" onClick={onToggle} aria-expanded={expanded}>
        <span className="rank tabular">{rank}</span>
        {img
          ? <img className="face" src={`${BASE}headshots/${img}`} alt="" loading="lazy" width={44} height={44} />
          : <span className="face face-blank" aria-hidden="true" />}
        <span className="who">
          <span className="name">
            {coach.name}
            {coach.player && (
              <span className="badge" title={`Also won as a player: ${coach.player.titles.join(', ')}`}>
                +{coach.player.titles.length} as a player
              </span>
            )}
          </span>
          <span className="schools">
            <span className="role-tag">{coach.primaryRole}</span>
            <span className="school-list"> · {coach.schools.join(' · ')}</span>
          </span>
        </span>
        <span className="marks">
          <RingGlyphs rings={coach.rings} scope={scope} onHover={onHoverRing} />
        </span>
        <span className="count tabular">{count}</span>
      </button>

      {expanded && (
        <div className="detail">
          {coach.player && (
            <div className="player-note">
              <div className="player-head">
                <PlayerRingGlyphs titles={coach.player.titles} />
                <strong>Won {coach.player.titles.length === 1 ? 'a ring' : `${coach.player.titles.length} rings`} as a player</strong>
                <span className="player-titles">{coach.player.titles.join(' · ')}</span>
              </div>
              <p>
                {coach.player.detail}
                {coach.player.sources.map((u, i) => (
                  <a key={u + i} href={u} target="_blank" rel="noopener noreferrer"> source</a>
                ))}
              </p>
            </div>
          )}
          <ol className="ring-list">
            {coach.rings.map((r) => (
              <li key={`${r.season}-${r.team}`} className={inScope(r, scope) ? '' : 'dim'}>
                <span className="ring-when tabular">{r.season}</span>
                <span className="ring-team">{r.team}</span>
                <span className="ring-role">
                  {r.role} <em>({ROLE_LABEL[r.cat]})</em>
                  {r.via === 'tenure' && (
                    <span className="via" title="Not on this season's published staff list — credited because a documented employment span covers the season.">
                      from tenure
                    </span>
                  )}
                </span>
                <span className="ring-cites">
                  {r.sources.slice(0, 3).map((s, i) => (
                    <a key={s.url + i} href={s.url} target="_blank" rel="noopener noreferrer"
                       title={s.quote ? `"${s.quote.slice(0, 180)}"` : 'source'}>
                      source {i + 1}
                    </a>
                  ))}
                  {!r.sources.length && <span className="nocite">no source recorded</span>}
                </span>
                {r.note && <span className="ring-note">{r.note}</span>}
              </li>
            ))}
          </ol>
          {coach.photoCredit?.page && (
            <p className="credit">
              Photo: <a href={coach.photoCredit.page} target="_blank" rel="noopener noreferrer">source</a>
              {coach.photoCredit.license ? ` · ${coach.photoCredit.license}` : ''}
            </p>
          )}
        </div>
      )}
    </li>
  )
}
