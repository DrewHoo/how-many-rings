# Pilot case: Scott Cochran — 8 national championship rings

The founding hunch of this project, verified. One ring at LSU, five at Alabama, two at Georgia. Every source that states a total says eight, and each title checks individually against his employment dates. Confidence: high.

This file doubles as the pipeline's first test fixture: any future automated run must reproduce these 8 rows (and their edge-case handling) or explain why.

## Timeline

| Years | School / Org | Role |
|---|---|---|
| 2001–2003 | LSU | Graduate assistant, S&C (all sports) |
| 2003–2004 | LSU | Assistant strength & conditioning coach (football) |
| 2004–2007 | New Orleans Hornets (NBA) | Assistant S&C coach |
| Jan 2007 – Feb 2020 | Alabama | Head strength & conditioning coach (all 13 Saban seasons) |
| Feb 2020 – Feb 14, 2024 | Georgia | Special teams coordinator (on-field through Aug 2021; medical leave Aug 8 – Oct 19, 2021; off-field thereafter while retaining the STC title) |
| 2024 | American Addiction Recovery Association | President / co-founder |
| Feb 2025 – present | West Alabama (D-II) | Head coach |

## The 8 rings

| Season | Team | Title | Verdict |
|---|---|---|---|
| 2003 | LSU | BCS | ON STAFF — assistant S&C (paid assistant by then, not GA; confirmed by his rolltide.com bio) |
| 2009 | Alabama | BCS | ON STAFF — head S&C |
| 2011 | Alabama | BCS | ON STAFF — head S&C |
| 2012 | Alabama | BCS | ON STAFF — head S&C |
| 2015 | Alabama | CFP | ON STAFF — head S&C |
| 2017 | Alabama | CFP | ON STAFF — head S&C |
| 2021 | Georgia | CFP | ON STAFF (off-field, partial season) — medical leave Aug 8 – Oct 19, 2021 (Will Muschamp covered on-field); returned in off-field capacity and was on staff for the SEC title game, playoff, and championship. Universally credited with the ring. |
| 2022 | Georgia | CFP | ON STAFF — held the STC title all season (functionally off-field; see discrepancies) |

**Not counted:** LSU 2007 (he was with the Hornets; joined Alabama Jan 2007), Alabama 2020 (left for Georgia Feb 2020).

## Sources

1. https://en.wikipedia.org/wiki/Scott_Cochran — full timeline; enumerates all 8 titles
2. https://www.espn.com/college-football/story/_/id/41362499/georgia-alabama-assistant-scott-cochran-addiction-recovery — Sept 2024 feature; leave/return dates; "won eight national championships at LSU, Alabama and Georgia"
3. https://gradynewsource.uga.edu/former-georgia-football-coach-now-works-to-eliminate-the-whisper-of-addiction/ — "eight-time national champion, winning rings at LSU, Alabama and Georgia"
4. https://keyt.com/sports/national-sports/ap-national-sports/2021/10/19/scott-cochran-returns-to-georgia-staff-in-off-field-capacity/ — AP, Oct 19 2021; resolves the 2021 edge case
5. https://rolltide.com/sports/football/roster/coaches/scott-cochran/941 — LSU 2003 assistant-S&C verification
6. https://247sports.com/college/georgia/article/special-teams-coordinator-scott-cochran-no-longer-on-georgia-staff-227164164/ — Feb 2024 departure
7. https://www.espn.com/college-football/story/_/id/43681975/west-alabama-hires-long-sec-assistant-scott-cochran-coach — West Alabama hire

(Accessed 2026-08-14.)

## Discrepancies noted between sources

- **2022–23 role label:** UGA's staff directory bucketed him under "Football Support Staff" while media kept calling him "special teams coordinator"; ESPN says he worked behind the scenes after the Oct 2021 return. Reconciliation: retained the STC title, functioned off-field. Doesn't affect the count.
- **Leave year:** one DawgNation-derived summary says the leave was August 2020 — wrong; it was Aug 8, 2021. (April 2020 was his private rehab stay, not a public leave.)
- **LSU boundary:** sources fuzz the GA → paid-assistant transition year, but all agree he was a paid assistant S&C coach during the 2003 championship season.

## Pipeline lessons from this case

Every hard edge the pipeline design anticipates showed up in this one coach:

1. **Role-category scope matters** — all 8 rings are S&C or off-field/support roles. An on-field-only staff definition scores Cochran at 2, not 8. (`role_category` filter, docs/data-pipeline.md.)
2. **Mid-season leave + return** — the "on staff at time of the championship game" policy resolves 2021 cleanly, and matches how every source credits it.
3. **Title vs function drift** — a coach can hold a title while working a different job. The row schema records the source's verbatim wording, so this surfaces as a discrepancy rather than being silently normalized.
4. **Near-miss seasons are the trap** — LSU 2007 and Alabama 2020 both *look* like his rings if you only match (coach, school) without dates. Employment-date boundaries have to be exact-season, which is why every row is per-season, never per-stint.
