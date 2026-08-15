# Who has the most rings in Division I football?

**Live:** https://drewhoover.com/how-many-rings/

Nick Saban has seven national championship rings. Scott Cochran, who ran his weight room, has eight — one at LSU, five at Alabama, two at Georgia, collected by following Saban and then Kirby Smart. Tied with Saban at seven: Alabama's team photographer, its athletics communications director, its student-services director, and the man who was Saban's personal assistant. Four of the six people at the top of this list never coached a down.

This site counts every ring on every national-championship staff since 1990 — **409 people with two or more**, out of 1,273 on those staffs — and every single one links to the source page and the verbatim line that supports it.

A [Curio](https://github.com/DrewHoo/curio): interactive, mobile-first, shareable via URL state, and every number cited.

## How the count works

A ring means: this person was on the staff of a team that won the national championship that season, and was still on staff at the championship game.

That decomposes into two datasets joined deterministically in code — no model does any counting:

1. **Champion seasons** — one consensus national champion per season (CFP > BCS > AP > Coaches), reused from the sibling [`collegiate-championships`](https://github.com/DrewHoo/cfb-all-time-records) scraper. 40 team-seasons, split titles counted for both schools.
2. **Staff rosters for those seasons** — the part that existed nowhere. Assembled from media guides on archive.org, Wayback Machine snapshots of athletics staff directories, and school bios, by an agent fleet. Each row carries a URL and the exact line from it, so a hallucinated row can be rejected by string match rather than by trust.

Rings per person = group the rows by person. Working backwards from championships is what keeps the problem small enough to verify claim by claim.

### The rules, kept in data rather than in judgment

- **[`data/employment-rules.json`](data/employment-rules.json)** — the job has to be the team. 61 people on these staff lists are excluded because someone else signed their paycheck: state troopers and team security, chaplains and FCA staff, consulting physicians and surgeons, volunteers. Athletic trainers, academic counselors and video staff are department employees and count.
- **[`data/name-aliases.json`](data/name-aliases.json)** — sources spell one person several ways across seasons. Wes Neighbors appears on the same 2012 roster as both "Wes" and "Wesley"; unmerged, that splits one person into two undercounted people.
- **[`data/player-rings.json`](data/player-rings.json)** — 14 people won rings as players too, tracked separately and shown as a filled mark. Dabo Swinney, Mickey Conn and Lemanski Hall all won 1992 as Alabama players, then won 2016 and 2018 together on Clemson's staff.
- **[`data/school-colors.json`](data/school-colors.json)** — each school's official brand color, cited to its brand guidelines, with notes where two schools publish identical hexes.

Rings sourced from a documented employment span rather than a staff list are marked `via: "tenure"` and labeled *from tenure* in the UI. It is weaker evidence and the site says so.

## Scripts

```bash
npm run dev            # local dev server
npm run build          # build data + typecheck + vite build + prerender
npm run gen:colors     # regenerate src/team-colors.css from data/school-colors.json
node scripts/coverage-report.mjs   # dataset health — run after any merge
```

`coverage-report.mjs` measures the failure modes a finished page hides:

1. **Depth asymmetry** — two title seasons of one program harvested from sources of different depth. Consecutive championship staffs share ~75% of their people; when the number is 33%, the thin season is the bug, not staff turnover.
2. **Missing lifers** — someone credited for part of a program's titles in a role that implies they were there for all of them. Kent Gidley read as a 2017/2020 guy until you learn he has photographed Alabama football since 1986. He has seven.
3. **Photo coverage** of the union of each filter's top 100 — the set actually on screen.
4. **Headshots shaped like logos** — a school bio page whose photo is missing serves its site logo as `og:image`, which downloads cleanly and passes a content-type check. The only tell is that it's landscape.

The merge scripts (`merge-*.mjs`) apply audited findings to the rosters, deduping against what's already there and dropping low-confidence rows.

## Known gaps

- **LSU 2003 and 2007 share only 37% of their staff** — the last obviously thin harvest. Alabama 2012/2015 (56%) and Florida State 1993/1999 (59%) are next.
- Support-staff coverage is thinner in the early 1990s than today, so the older dynasties are undercounted.
- Tennessee/Clemson and Texas/Auburn are indistinguishable by ring color. Six of these programs wear orange and seven wear red; no palette fixes that, so color is a supporting cue and the school is always named in text.

## Data pipeline design

[docs/data-pipeline.md](docs/data-pipeline.md) — how the agentic gathering works and why it's shaped this way. [docs/research/scott-cochran.md](docs/research/scott-cochran.md) is the pilot case, and doubles as the fixture the automated count has to reproduce.
