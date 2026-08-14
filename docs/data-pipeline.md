# Data pipeline: counting rings verifiably, cheaply

Design for the agentic workflow that gathers "who was on the staff of every national championship team" — the one dataset this project needs that doesn't exist anywhere in structured form. Built to run on cheap models (Haiku-class) or no model at all per stage; nothing here needs frontier-model judgment because every stage is narrow extraction or deterministic code.

## Why this is tractable: invert the question

"Count every ring for every assistant coach ever" is unbounded. But **rings only come from championship teams**, and there are only ~35 consensus champion team-seasons since 1990 (~90 since the AP era began in 1936). Each has a staff of ~10 on-field assistants plus S&C/analysts/support. So the full universe is a few hundred to ~1,500 (coach, team, season) rows — small enough to verify claim-by-claim.

```
champions.json  (already solved — collegiate-championships repo)
      ×
staff rosters per champion team-season  (this pipeline)
      ↓ deterministic join in code
rings per coach, each ring carrying its own citations
```

**The LLM never counts anything.** It only extracts rows from fetched pages. Code does the join, the counting, and the ranking. This is the main verifiability lever: a wrong ring count can only come from a wrong extracted row, and every row is independently auditable.

## The row schema

Every claim the pipeline produces is one row:

```jsonc
{
  "coach": "Scott Cochran",
  "coach_id": "wiki:Scott_Cochran",       // Wikipedia URL slug when one exists — canonical entity ID
  "team": "Alabama", "season": 2017,
  "role": "Strength and conditioning",
  "role_category": "sc",                  // onfield | sc | analyst | qc | ops | other
  "sources": [
    {
      "url": "https://en.wikipedia.org/wiki/2017_Alabama_Crimson_Tide_football_team",
      "quote": "Scott Cochran – Strength and conditioning",   // VERBATIM from the page
      "accessed": "2026-08-14"
    }
  ],
  "status": "grounded"                    // grounded | single-source | flagged
}
```

The `quote` field is the heart of the design — see Stage 3.

## Stages

### Stage 0 — Champions list (no LLM)
Reuse the scraper from `~/Projects/collegiate-championships` (`scripts/fetch-data.mjs`): consensus football champion per season, CFP > BCS > AP > Coaches. Emit `data/champions.json`. Split-title seasons (1990, 1991, 1997, 2003…) are tagged `split: true` and **both** schools count — both schools handed out actual rings, and the split makes a good UI footnote.

### Stage 1 — Source fetching (no LLM)
For each champion team-season, fetch and cache plain text of candidate sources into `data/sources/<team>-<season>/`:
- Wikipedia season page — predictable URL: `{year}_{Team}_football_team`. Recent pages have full staff tables including analysts.
- School athletics site staff directory via Wayback Machine, snapshot nearest the title game (primary source for older seasons where Wikipedia thins out).
- Optional: a news article announcing the staff (corroboration pool).

Cached text is the ground truth everything downstream is checked against. Fetching is plain code — no model.

### Stage 2 — Extraction (cheap LLM)
One Haiku-class call per cached page: "extract every coaching/support staff member with their exact role, returning the verbatim supporting text for each." Schema-enforced JSON out. Narrow task, no judgment, no memory reliance — the page text is in-context. This is why the pipeline doesn't need Fable: extraction from provided text is the easiest thing small models do.

### Stage 3 — Quote grounding (no LLM) ← the anti-hallucination gate
For every extracted row, check in code that `quote` actually appears in the cached page text (exact match, then whitespace/dash-normalized fuzzy match). A row whose quote isn't in the page is **rejected mechanically** — a hallucinated staffer cannot survive this stage, and no model is needed to catch it. Also here, deterministically:
- Dedupe rows across sources for the same (coach, team, season).
- Entity-resolve coaches: Wikipedia link → canonical ID; otherwise exact-name clustering with a review flag on collisions (two different "Mike Johnson"s must not merge silently).

### Stage 4 — Corroboration & refutation (cheap LLM, targeted)
- Rows with one source → `single-source`; a targeted search pass tries to find a second independent source (then re-runs Stages 1–3 on it).
- A cheap adversarial pass on suspicious rows: "try to refute that {coach} was on {team}'s staff in {season} — mid-season departure? analyst vs on-field mislabel? arrived the following year?" Refuted or unresolved → `flagged`.

### Stage 5 — Join & rank (no LLM)
`champions × grounded rows → rings per coach`. Emit the site's data file, where **every ring carries its source bundle** (URL + quote + access date) so the UI can make each ring click through to its evidence. Nothing reaches the page without surviving Stage 3.

### Stage 6 — Human review queue
`flagged` and unresolved `single-source` rows, **sorted by ranking impact**: a disputed row that would change the top 10 gets reviewed first; a disputed 1-ring analyst can wait. This keeps human effort proportional to how much a claim matters.

Everything is keyed by (team, season) and idempotent — re-runs fill gaps only, so the whole thing is resumable and a new season is a one-key increment.

## Policy decisions (encoded in code, not left to model judgment)

- **What's a ring:** on staff at the time of the championship game. Mid-season departures don't count; mid-season arrivals do. (Surface exceptions as footnotes when sources disagree.)
- **Who counts as staff:** everyone the team listed — on-field assistants, S&C, analysts, QC, ops — each tagged with `role_category` so the UI can filter. This matters: **Scott Cochran's rings are mostly as S&C staff**; an on-field-only definition erases the most fun data point in the set.
- **Player rings** (e.g., a coach who also won as a player) are out of scope for v1; possible later toggle.
- **Head coaches** are extracted too (they're on staff) but the headline ranking filters to non-head-coach roles — the whole point is the assistants.

## Cost & effort envelope

~35 team-seasons (1990+) × ~3 pages × 1 Haiku extraction call + a corroboration pass ≈ low hundreds of small-model calls, single-digit dollars, one evening of runtime. Expanding to the full AP era (1936+) roughly triples it. Runs as plain Node scripts calling the API directly (or `claude -p --model haiku` per page) — no orchestration framework needed.

## Second-order: other sports

`collegiate-championships` already has champions lists for 30 NCAA sports — Stage 0 is done for all of them. Basketball staffs are smaller (~5–8), so the marginal cost per sport is lower than football. The interesting cross-sport question the schema already supports: does anyone have rings in **two different sports**?
