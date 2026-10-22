// The other drewhoover.com sports sites, in the order every one of them lists
// the rest. "What to read next" on the page and dist/llms.txt (the prerender)
// read the same list, so the two can't drift.
export const SITE = 'https://drewhoover.com/how-many-rings/'

export interface Sibling { name: string; url: string; words: string }

export const SIBLINGS: Sibling[] = [
  { name: 'NFL Comparator', url: 'https://drewhoover.com/nfl-comparator/',
    words: 'compare NFL players at the same point in their careers, every career since 1999, with a page for every player and what he leads' },
  { name: 'NBA Comparator', url: 'https://drewhoover.com/nba-comparator/',
    words: 'the same comparator over every NBA career since 1946-47, Wilt and Jordan included, with a page for every player and what he leads' },
  { name: 'WNBA Comparator', url: 'https://drewhoover.com/wnba-comparator/',
    words: 'the same comparator over every WNBA career since 1997' },
  { name: 'NHL Comparator', url: 'https://drewhoover.com/nhl-comparator/',
    words: 'the same comparator over every NHL career since 1917-18, Gretzky and Howe included' },
  { name: 'College Football Comparator', url: 'https://drewhoover.com/cfb-comparator/',
    words: 'every coach, team and player at the same point in their careers, since 1869, with the best players of each position at every school and conference' },
  { name: 'College Football Streak King', url: 'https://drewhoover.com/cfb-streak-king/',
    words: 'the longest active and all-time winning and losing streaks in college football, under any definition, every FBS game since 1936' },
  { name: 'Hostile Territory', url: 'https://drewhoover.com/hostile-territory/',
    words: "every head coach's true road record against AP top-10 teams since 1936" },
  { name: 'Collegiate Championships', url: 'https://drewhoover.com/collegiate-championships/',
    words: 'which schools have won the most NCAA championships, across 33 sports' },
  { name: 'CFB All-Time Records', url: 'https://drewhoover.com/cfb-all-time-records/',
    words: 'all-time win-loss, bowl and national-title records for every FBS program' },
]
