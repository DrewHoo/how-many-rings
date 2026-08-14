export interface Game {
  opp: string
  gf: number // goals this team scored (in-play + ET, no shootout)
  ga: number // goals conceded
  result: 'W' | 'L' | 'D'
  stage: string
}

export interface EditionPoint {
  year: number // World Cup edition
  ts: number // UTC timestamp used for the x-position (edition's last match)
  cum: number // cumulative goals for this team through this edition
  goals: number // goals this team scored in this tournament
  champion: boolean // this team won the World Cup that year
  games: Game[] // this team's matches that tournament, in order of appearance
}

export interface TeamSeries {
  team: string
  total: number
  editions: number
  matches: number
  defunct: boolean // nation no longer exists (e.g. West Germany, Soviet Union)
  points: EditionPoint[]
}

export interface Source {
  label: string
  publisher: string
  url: string
  license?: string
  accessed: string
}

export interface Dataset {
  generatedAt: string
  source: Source
  meta: {
    editions: number
    yearsSpanned: [number, number]
    matchesUsed: number
    matchesSkipped: number
    teamsTotal: number
    defaultTop: number
    defaultSelection: string[]
    goalRule: string
  }
  teams: TeamSeries[]
}
