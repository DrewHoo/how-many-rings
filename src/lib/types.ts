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

export interface Coach {
  id: string
  name: string
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
