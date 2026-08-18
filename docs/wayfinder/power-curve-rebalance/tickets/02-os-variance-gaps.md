# OS variance: v1/v2 power gaps, and a real sleipnir FTK problem

- Type: wayfinder:task
- Status: open
- Assignee: —
- Blocked by: —

> ## Re-scoped by [deck-archetypes ticket 06](../../deck-archetypes/tickets/06-rescope-power-curve-tickets.md), 2026-08-12
>
> **STATUS: superseded in substance; the numbers below were measured with SHARED decks.** Every
> species now runs a per-OS deck, so a v1/v2 gap measured before that is a measurement of the shared
> deck, not of the firmware. Do not tune against the table below.
>
> **The bar also moved.** The ±15% `osMaxGap` this ticket is written against is *not* the working
> gate — the deck map runs a first-pass band of **0.30–0.70**, and the deck-archetypes HANDOFF is
> explicit that the strict cap is not the bar. Read the two separately: as of registry `1:0af76c60`,
> seven species trip the strict 15% and **only two are outside the working band** — `os:jormungandr`
> (0.240) and `os:audhumbla` (0.000, an untuned placeholder).
>
> **The sleipnir FTK item is CLOSED, not moved.** It was the one finding here flagged as real and
> independent of deck quality. **FTK is 0 across all 67 matchups** in the current committed report,
> sleipnir included. Ticket 36's `escalatePerPlay` and ticket 44's terminal eval both bore on it; if
> a first-turn kill ever reappears, this ticket is its history.
>
> **What survives:** jormungandr is the only tuned species genuinely outside the working band, and it
> is already listed as the top priority in
> [deck-archetypes ticket 49](../../deck-archetypes/tickets/49-roster-floor-pass.md) — with the
> caveat that ticket 49's own numbers are stale pending a re-run.

## Question

`npm run balance` (run 2026-08-05, registry `1:1cba1e2c`, after
[power_curve_spec.md rev 3](../../../power_curve_spec.md) — commit `8088eec`) shows 9 of 17
species breaching §2.3's 15%-gap cap between their OS v1 and v2 firmware, three of them at the
ceiling (one variant wins **every** decided game):

| species | gap | decided games | note |
|---|---|---|---|
| kraken | 50.0% | 87/100 | v2 always wins |
| sleipnir | 50.0% | 100/100 | v2 always wins, **and** v1 scores 50 first-turn kills against v2 out of the same 100 runs |
| gullinbursti | 50.0% | 100/100 | v2 always wins |
| hraesvelgr | 40.0% | 100/100 | v2 always wins |
| jormungandr | 36.0% | 100/100 | v2 favored |
| ymir | 38.0% | 100/100 | v2 favored |
| nidhoggr | 40.0% | 40/100 | v2 favored, on a small decided-game sample (60 stalled — see [mirror stalemates ticket](01-mirror-stalemates.md), nidhoggr is on that list too) |
| fenrir | 16.7% | 99/100 | just over the line |
| ratatoskr | 18.0% | 100/100 | v1 favored (the one case where v1 is the stronger variant) |

The pre-rev-3 baseline (per the [balance auditor ticket](../../debug-toolkit/tickets/21-balance-auditor-report.md)'s original run) had 7 `OS_GAP` redlines; this run has 9. Two more
species crossed the line, but the direction and size of the pre-existing 7 gaps hasn't been
compared against this run's numbers — that comparison would show whether rev 3 widened existing
gaps or these are two newly-crossed borderline cases.

The **sleipnir FTK count is the sharper problem of the two** and shouldn't wait on the broader
gap analysis: §3's zero-interaction-win redline is 0, and this pairing has 50/100 runs ending
before the loser ever acted. That's a specific interaction between sleipnir_v1's kit and
sleipnir_v2 worth isolating on its own — likely a single opening card or status combo doing
lethal or near-lethal damage before the second side's first turn under the new curve.

Checklist:

- Isolate the sleipnir v1-vs-v2 FTK: pull a seeded log from one of the 50 first-turn kills,
  identify which opening play (or play + existing hook/OS proc) is doing it, and check whether
  it's specific to facing v2 or a general opening-burst problem for sleipnir_v1.
- For the three 50%-gap (always-wins) pairs — kraken, sleipnir, gullinbursti — check whether the
  losing variant's kit leans on a status/heal mechanic from the [mirror stalemates
  ticket](01-mirror-stalemates.md) list (kraken and gullinbursti are already on that list), since
  a kit that can't close out a fight against *itself* likely can't close one out against a
  stronger sibling either — same root cause, two different redlines.
- For jormungandr/ymir/nidhoggr/hraesvelgr: confirm each gap is genuinely about firmware (v1 vs
  v2 playstyle) and not a symptom of the same underlying stall/heal issue leaking into a
  decided-but-late game.
- ratatoskr is the one pairing where v1 (not v2) is ahead — check whether that's this species'
  intended asymmetry or coincidence before assuming "v2 is generally stronger" as a pattern.
- Re-run `npm run balance` after any change; confirm gaps drop under 15% and the sleipnir FTK
  count returns to what the loser side actually could contest, not just that the *percentage*
  moved.

Done when: no OS pairing breaches the 15% gap, the sleipnir FTK count is 0 (or the loser gets a
real turn before it's decided), and any pairing intentionally left asymmetric (if any) has a
documented reason.
