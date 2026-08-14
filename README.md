# How Many Rings?

**Which college football assistant coaches have the most national championship rings?**

Head coaches get the statues. But an assistant who rides shotgun on multiple dynasties can quietly out-ring almost everyone — Scott Cochran followed Nick Saban from LSU to Alabama, then followed Kirby Smart to Georgia, collecting rings at every stop. This site counts every ring on every championship staff and ranks the assistants.

A [Curio](https://github.com/DrewHoo/curio): interactive, mobile-first, shareable via URL state, and **every number cited to a real source**.

**Status: early scaffold.** The app code is still the curio template's World Cup example; the data pipeline design lives in [docs/data-pipeline.md](docs/data-pipeline.md).

## The core computation

A "ring" is defined as: **coach C was on team T's staff during season S, and T won the national championship in S.**

That decomposes into two datasets, one of which is already solved:

1. **Championship seasons** (small, fixed, settled): one consensus national champion per season. Already scraped in the sibling repo [`collegiate-championships`](https://github.com/DrewHoo/cfb-all-time-records) (CFP > BCS > AP > Coaches preference order).
2. **Staff rosters for championship teams** (the hard part): who was on staff for each championship team-season, in what role. This is bounded — ~35 champion team-seasons since 1990, ~10–15 on-field assistants plus notable staff each — and is gathered by the agentic pipeline in `docs/data-pipeline.md`.

Rings per coach = group the (coach, team, season, role, citations) rows by coach. Working **backward from championships** (rather than forward from all coaches ever) is what keeps the problem small and every claim independently checkable.

## Development

```bash
npm install
npm run dev          # local dev server
npm run build        # fetch data + typecheck + build
```

Deploys to GitHub Pages at `https://drewhoover.com/how-many-rings/` via `.github/workflows/deploy.yml` once the repo is pushed (not yet pushed — local only for now).
