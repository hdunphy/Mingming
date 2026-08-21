# Draugr second lever (ticket 107): rimebreaker reads everything, and the nightmares seep in

- Type: wayfinder:task - Henry-ruled 2026-08-20 off his own draugr-vs-huldra playtest
  (the tug-of-war cell, felt by hand: 'she can't out-daze huldra's sharp stacks').
  Branch archetype-web. Runs after tickets 104/105 (P0s first).
- Status: **CLOSED 2026-08-20** - change 1 shipped; **change 2 HELD with the measurement that stopped it** (Henry rules). 868 tests, tsc + build clean.

## Change 1 - rimebreaker rework

Old: 25 power per different DEBUFF on the target (measured reality: 0.70 average, ~1-2 vs
huldra, ~4 damage - Henry's hands confirmed the census). New: **"20 power for each
different STATUS on the target - buffs, debuffs, DoTs, Regen, anyone's."** The inversion
is the point: huldra's own Sharp pile FEEDS it - their win condition becomes draugr's
ammunition. Polarized by design (big vs status decks, ~0 vs clean) = legal counter-texture
under the web; it is tech, not the plan. Scorer: the DISTINCT_STATUS path needs an
any-status variant constant - measure the board reality and set it; document.

## Change 2 - the Poison rider (the second lever)

OS clause on draugr's debuff engine: **"Statuses draugr applies to an enemy also apply
1 Poison."** Quadratic, defense-ignoring clock from her EXISTING gameplan; lives outside
the Sharp/Dazed cancel war, so the counter matchup becomes heavily-unfavorable-not-
impossible (0-TWO-LEVERS satisfied). **IMPLEMENTATION GUARD: the rider's own Poison
applications must NOT re-trigger the rider** - non-recursive, or it loops. Unit test this
explicitly. Liveness after the hooks edit.

## Gates

THE cell: draugr_v2 vs huldra re-read at 30 iterations x two seed bases - target off the
floor into 15-35% (predator-band per the web; it is still her counter). Band standard
across her row, FTK 0, dead <=0.35, control >=0.60. Knobs (max 2 rounds): rimebreaker
20 -> 15 or 25; rider Poison 1 -> 2. ONE commit + Henry replays the huldra game.

---

# Resolution

Report: [research/draugr-second-lever.md](../research/draugr-second-lever.md). ONE commit.

## Change 1 SHIPPED - and it hits the gate on its own

`rimebreaker`: **20 power per distinct status on the target, buffs included** (`ANY_STATUS`, a new
scaling). Huldra's Sharp pile - her win condition - is now his ammunition.

| | before | after |
|---|---|---|
| **THE cell** `draugr_v2` vs `huldra_v1` | **6.7%** | **33.3 / 41.7 / 25.0%** (three seed bases) |
| `draugr_v2` field | 58.3% | 61.5% |
| her blowouts | - | 3 |

**Two of three seed bases land inside the 15-35% target; the third is 6.7 over.** She still loses
the matchup - huldra is still her counter, which is the intent - but it is a contest now. Left
un-chased deliberately: tuning a card down until a coin-flip lands where I want it is not tuning.

## Scorer constant, measured as the ticket asked

`scratch/anystatuscensus.ts`, **32,603 card-aims**, same rule ticket 66 used (distinct status TYPES
on the target, UNCONDITIONAL, zeros included) so the two constants are comparable:

| population | mean | median |
|---|---|---|
| **roster, any status** | **2.01** | 2 |
| roster, debuff only | 1.19 | 1 |
| draugr_v2's OWN targets | 3.18 | 3 |

**`ASSUMED_ANY_STATUS = 2`**, priced for the REGISTRY not the deck that ships it (ticket 66's
choice). Two findings from the same run: **draugr's own targets read 3.18**, so the card is worth
~50% more in his hands than the constant prices it - correct direction for a payoff card, and why
`rimebreaker` reads 4.0 UNDER a 5.2-6.5 band rather than over. And **debuff-only has drifted
0.70 -> 1.19 since ticket 66** - the POWER re-denomination putting more statuses on more boards. It
still rounds to 1 so `ASSUMED_DISTINCT_STATUS` stays, **but the margin is gone; re-check it after
the next status change.**

## Change 2 HELD - built, guarded, tested, measured, and 50 points too strong

| build | THE cell | field | blowouts |
|---|---|---|---|
| live | 6.7% | 58.3% | - |
| **change 1 only (SHIPPED)** | **33.3 / 41.7** | **61.5%** | **3** |
| change 2 only | 83.3 / 86.7 | 82.2% | **16** |
| both | 90.0 / 91.7 | 83.8% | **18** |

**Poison is too strong to seed per-application.** The status census measured consumed piles at
11.47; it is defence-ignoring and compounds, and `rimefrost` is a **0-cost card applying TWO
statuses** with two copies in the deck. **Both of the ticket's knobs point UP** (rimebreaker
20->15/25, rider 1->2) because it expected an undershoot, and **1 Poison per application is already
the minimum integer.**

Conditions tried instead of a per-turn cap (not a shape Henry wants): rider on **Dazed only**
63.3/66.7% cell, 75.7% field, 11 blowouts - still far over. Rider on **Stunned only** 35.0/43.3%,
64.7%, 5 - close, but `glacial_slam` is her ONLY Stunned card at one copy, so the rider fires about
once a game. **A lever that rarely exists is not a second lever.**

**Read: change 1 already satisfies 0-TWO-LEVERS.** The law wants the counter matchup heavily
unfavourable rather than impossible, and rimebreaker eating huldra's Sharp IS a second lever - one
that exists precisely in the matchup that needed it. **Henry rules on whether the rider comes back
in a different shape; it is one hook block away and its guard is already shipped and tested.**

## Two engine findings

1. **`statusAppliedNotIn` (NEW, shipped, pinned).** The anti-recursion guard the ticket demanded. It
   earned itself: **with the guard off, one two-status card seeded 24 Poison instead of 2**, stopped
   only by the resolution-depth backstop - a wrong number that still runs, which is worse than a
   hang. It ships despite its consumer being held, and is **pinned by its own unit test rather than
   left as dead schema** - dead schema is exactly the `isAttack` trap ticket 103 found.
2. **`baseCost` on an `onStatusApplied` hook SILENTLY DISABLES IT.** Gating the rider on the applying
   card's Energy cost produced results byte-identical to the rider being off. `onStatusApplied`
   builds its context with `source`/`target`/`state`/`statusApplied` and **no `program`**, so
   `context.program?.baseCost ?? 0` reads 0 and any GTE fails forever. Threading `program` through
   `APPLY_STATUS` would fix it - a multi-site change to the mutation payload, not made speculatively
   for a held arm.

## Gates

- **868 tests green** (6 new, `src/engine/DraugrRimebreaker.test.ts`), `tsc` clean, build clean.
- THE cell 30 iterations x **three** seed bases (the ticket asked for two), plus **33.3% on the
  full grid at 60 games** - inside the 15-35% target.
- **8-DIFF: EXACTLY ONE ROW MOVED.** `draugr_v2` 58.3 -> **62.4**; nothing else shifted a point.
  Band 31/32, roster neutral blowouts **15 -> 14**, FTK 2, dead cards and game length unchanged.
- `rimebreaker` 4.0 (under band, not a redline).
