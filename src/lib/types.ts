export type RoleCat =
  | 'headcoach' | 'onfield' | 'sc' | 'analyst' | 'qc'
  | 'gradasst' | 'ops' | 'medical' | 'equipment' | 'other'

export interface Source {
  url: string
  /** Verbatim text from the source page supporting this ring. */
  quote: string
}

export interface Ring {
  season: number
  team: string
  /** Role exactly as the source words it. */
  role: string
  cat: RoleCat
  /** Only present when the person arrived or left mid-season. */
  note?: string
  sources: Source[]
}

export interface PlayerRings {
  /** e.g. ["2009 Alabama"] — titles won while on the roster as a player. */
  titles: string[]
  detail: string
  sources: string[]
}

export interface Coach {
  id: string
  name: string
  /** The title they held for the most championship seasons. */
  primaryRole: string
  primaryCat: RoleCat
  /** Present when this person also won a title as a player, before/after staff work. */
  player?: PlayerRings
  rings: Ring[]
  total: number
  /** Rings earned in support roles (S&C, analyst, ops, medical, …). */
  support: number
  onfield: number
  head: number
  schools: string[]
  photo?: string
  placeholder?: string
  photoCredit?: { license?: string; page?: string; note?: string }
}

export interface Dataset {
  meta: {
    built: string
    seasons: { team: string; season: number; staffCount: number; coverageNotes: string }[]
    seasonCount: number
    peopleTotal: number
    note: string
    /** Why some people around a championship team don't count — see data/employment-rules.json. */
    employmentRules: { label: string; reason: string }[]
    excludedCount: number
    excludedTop: { name: string; rings: number; rule: string; role: string }[]
  }
  coaches: Coach[]
}

/** Scope filters — which rings "count" for the ranking. */
export type Scope = 'all' | 'support' | 'onfield'

export const ROLE_LABEL: Record<RoleCat, string> = {
  headcoach: 'Head coach',
  onfield: 'On-field assistant',
  sc: 'Strength & conditioning',
  analyst: 'Analyst',
  qc: 'Quality control',
  gradasst: 'Graduate assistant',
  ops: 'Operations',
  medical: 'Medical / training',
  equipment: 'Equipment',
  other: 'Support staff',
}

const SUPPORT_CATS: RoleCat[] = ['sc', 'analyst', 'qc', 'gradasst', 'ops', 'medical', 'equipment', 'other']

/** Does this ring count under the active scope? */
export function inScope(ring: Ring, scope: Scope): boolean {
  if (scope === 'all') return true
  if (scope === 'onfield') return ring.cat === 'onfield' || ring.cat === 'headcoach'
  return SUPPORT_CATS.includes(ring.cat)
}

export function scopedCount(coach: Coach, scope: Scope): number {
  return coach.rings.filter((r) => inScope(r, scope)).length
}

/**
 * A scope is a filter over people, not a re-score. Someone's ring count is a
 * fact about them, so it never changes with the view; the scope only decides
 * who belongs in the list — anyone who earned at least one ring that way.
 */
export function matchesScope(coach: Coach, scope: Scope): boolean {
  return scope === 'all' || coach.rings.some((r) => inScope(r, scope))
}
