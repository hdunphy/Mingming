# Re-scope the power-curve-rebalance tickets against this map

- Type: wayfinder:task
- Status: closed
- Assignee: —
- Blocked by: —

## Question

Three open tickets in `docs/wayfinder/power-curve-rebalance/tickets/` were written before this map existed, and their numbers are partly deck artifacts:

- [01-mirror-stalemates](../../power-curve-rebalance/tickets/01-mirror-stalemates.md) — 7 species stall; several (kraken, gullinbursti, draugr, nidhoggr) are getting their decks rebuilt here, which may dissolve or reshape their stalls before any formula work happens.
- [02-os-variance-gaps](../../power-curve-rebalance/tickets/02-os-variance-gaps.md) — the ticket most directly superseded: its 9 gaps were measured with shared decks, and the charting audit showed several are dead-hook artifacts (kraken_v2, hraesvelgr, skoll's false pass). Its sleipnir-FTK item is real and stands.
- [03-card-budget-overages](../../power-curve-rebalance/tickets/03-card-budget-overages.md) — some of the 20 over-budget cards will be rebuilt or dropped by new decks anyway; per-card retuning there shouldn't race deck design here.

Task: annotate each of the three with a short "superseded/blocked-by/unaffected" note pointing at this map, so a session picking them up doesn't fix numbers this map is about to invalidate. Keep their findings intact — only re-scope what work should happen there vs. here, and when (e.g. "re-run after the pilot species lands"). The sleipnir first-turn-kill investigation should be explicitly preserved (moved here or kept there with a cross-link — pick one home).

## Resolution

**Done, 2026-08-12.** All three power-curve tickets carry a re-scope block above their `## Question`,
written against the committed report at registry `1:0af76c60` rather than against the 2026-08-05 run
they were authored from. Their findings are left intact; only the guidance about what work should
happen there versus here has changed.

| ticket | verdict |
|---|---|
| [01 mirror stalemates](../../power-curve-rebalance/tickets/01-mirror-stalemates.md) | **All but dissolved.** Of seven stalling mirrors, **one remains** — `mirror:audhumbla`, the last untuned placeholder. Every other stall closed by giving the species a real deck, never by touching the curve. Ticket 06's suspicion was right. |
| [02 OS variance gaps](../../power-curve-rebalance/tickets/02-os-variance-gaps.md) | **Superseded in substance** — its nine gaps were measured with SHARED decks, and every species now runs per-OS decks. Also flags that the ±15% cap it is written against is not the working bar (0.30–0.70 is). **Its sleipnir FTK item is CLOSED**: FTK is 0 across all 67 matchups. |
| [03 card budget overages](../../power-curve-rebalance/tickets/03-card-budget-overages.md) | **Bands stale, list superseded.** Written against pre-rev-3.9 bands. The useful reading it should have taken: the over-budget RATE is unchanged (18% then, 18.2% now) while the registry nearly doubled. Its three systematic causes are preserved and named. |

**The sleipnir first-turn-kill investigation gets one home, as the task asked:** it stays in ticket 02,
closed, with the current evidence attached. Moving it would have orphaned its history.

**A finding worth keeping from doing this:** all three tickets were written from a single dated run and
then read months later as if the numbers were still true. The re-scope blocks all lead with a registry
hash for that reason. The standing lesson is the one ticket 44 already recorded in a different form —
**a number without the run it came from is not a finding, it is a rumour.**
