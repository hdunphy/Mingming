# Pace amendment: damage divisor 35 -> 45 (rev 3.1)

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-06
- Blocked by: - (spec amendment; supersedes a rev-3 number, blocks the Air pass)

## Question

Henry's call after watching three deck passes in a row: even matchups were resolving in
**3-4.5 turns** because a single full turn removed **60-70% of a health pool**. That is
not enough turns for a game to happen in, and it quietly killed every archetype that wins
by BUILDING - poison attrition, momentum stacking, discard windmills. The deck passes kept
rediscovering the same wall one species at a time (jormungandr's v2 curve verdict,
sleipnir's invisible MOMENTUM_DRIVE, hraesvelgr's windmill).

Target: evens ~5-6 turns, element/level-advantage routs 2-3, FTK only off a perfect setup.

## Resolution

Landed 2026-08-06. Gates: 749 vitest, tsc, build, full committed balance.

**One constant.** `calculateDamage`'s divisor `/35` -> `/45` (`src/engine/combatUtils.ts`),
plus a rev-3.1 amendment appended to `docs/power_curve_spec.md`. rev 3 had chosen /35
specifically to *preserve* the pace of the old `/50 + 2` formula; preserving it was the
mistake.

**Card budgets and prices are unchanged, and that is deliberate.** A global divisor scales
every card by the same factor, so it moves ABSOLUTE pace only - the rev-3 budget bands, the
1e = 40 power unit, and every relative card-economics decision survive intact. What a longer
game does change is the VALUE of slow-build archetypes relative to burst ones, which is the
entire point.

### Pace, before and after (committed full runs)

| mirror (even matchup) | rev 3 (/35) | rev 3.1 (/45) |
|---|---|---|
| kraken | 3.54 turns | **4.42 turns** |
| jormungandr | 4.46 turns | **6.02 turns** |
| sleipnir | 2.54 turns | 3.20 turns |

FTK stayed at **0** across every matchup in the registry, before and after.

### Water re-gate

The two tuned species were re-measured under the new pace. First-pass bands: §2.3 0.30-0.70,
mirror >=60% decided within 30 turns, deadCards <=0.35.

| | §2.3 before | §2.3 after | mirror decided | deadCards | ftk |
|---|---|---|---|---|---|
| kraken | 0.43 | **0.62** | 400/400 | 0.121 | 0 |
| jormungandr | 0.51 | **0.33** | 400/400 | 0.093 | 0 |

**Kraken needed no knobs** - it drifted from 0.43 to about 0.62 and stayed in band.

**Jormungandr flipped v2-ward exactly as predicted**: poison attrition finally has the turns
to build, so v2 went from a curve verdict to the stronger variant. Scoped §2.3 read **0.19**
at the new pace. Two knob rounds, one change each:

1. `corrosive_bolt` Poison **5 -> 4** -> 0.26 (still out of band)
2. `acid_splash` Poison **2 -> 1** -> **0.33, in band**

Both cards' description text was stale (`corrosive_bolt` still read "Add 3 stacks" after
ticket 20 took it to 5) and was corrected to match the real values in the same edit.

### Pinned tests updated (15)

The divisor moves every absolute damage number in the suite. All 15 failures were of that
one class - no structural or behavioural breaks. Henry approved updating them rather than
stopping at the ~10 tripwire.

| test | was | now |
|---|---|---|
| combatUtils - L50 manual, no STAB | 25 | 19 |
| combatUtils - L100 manual, no STAB | 48 | 37 |
| combatUtils - STAB calculation | 37 | 29 |
| StatusCombat - base damage | 4 | 3 |
| StatusCombat - Strengthened 1 stack | 4 | 3 |
| StatusCombat - Weakened 1 stack | 3 | 2 |
| StatusCombat - Sharp target 1 stack | 3 | 2 |
| StatusCombat - Dazed target 1 stack | 4 | 3 |
| StatusCombat - +25% cap (13 and 100 stacks) | 5 | 3 |
| StatusCombat - Weakened x Sharp deadlock regression | 2 | 1 |
| battleReducer - nextProgramModifier boost | 94 HP | 95 HP |
| DaemonSystem - THERMAL_OVERLOAD | 93 HP | 94 HP |
| OSSystem - TIDAL_CRUSH boost bound | < 95 | < 97 |
| BugFixes - KO/XP split (FIXTURE) | enemy at 5 HP | enemy at 3 HP |
| OSGapClosures - ymir_v2 Ice +35% (FIXTURE) | level 1 | level 20 |

The last two are fixture recalibrations rather than assertion bumps, and both are worth
knowing:

- **BugFixes**: `fury_strike` now deals 4, so the 5-HP enemy survived and the KO/XP path
  under test stopped firing at all. Dropped to 3 HP so the test measures what it is named for.
- **OSGapClosures**: a 20-power card at level 1 now floors to **0** damage, which made a
  "+35%" assertion meaningless. Levelled the fixture to 20.

Two results carry meaning beyond the number, both reviewed and accepted by Henry:

- **The Weakened x Sharp anti-deadlock margin thinned from 2 damage to 1.** The 25% cap still
  does its job - the worst case is not 0 - but the margin is thinner at a slower pace.
  **Re-check this specific case if the divisor is ever raised again.**
- Small hits round to 0 more readily. Nothing in a real deck is that small at real levels,
  but it is now the reason a level-1 test fixture can measure nothing.

Not in scope, noted for later: raising the damage FLOOR (guaranteeing >=1 on any non-zero
power hit) would stop the anti-deadlock margin thinning as pace slows. Henry declined it for
this ticket.

### Registry-wide effects

Registry hash `1:5148d22f` -> **`1:2c6705ec`**. Full committed run 11m03s.

- **FTK is 0 across all 48 matchups**, unchanged.
- Every decided mirror slowed: sleipnir 2.5 -> 3.2, fenrir 3.1 -> 3.4, skoll 3.2 -> 3.9,
  kraken 3.5 -> 4.4, hraesvelgr 4.4 -> 5.9, jormungandr 4.5 -> 6.0, ratatoskr 6.4 -> 10.9,
  draugr 13.8 -> 22.9.
- Matchup redlines 9 -> 12; card-budget redlines 21 -> 20. The three new matchup redlines are
  untuned legacy species whose numbers moved, not Water - both Water species are in band.
- **Sleipnir drifted without being touched**: §2.3 0.59 -> 0.55, mirror 2.5 -> 3.2 turns, both
  still in band. Hraesvelgr's legacy decks moved too (§2.3 0.09 -> 0.04). Per Henry's
  sequencing, the Air prompt re-gates both under this pace - run it NEXT.
