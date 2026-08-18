# State of the roster (ticket 85) - 18 August 2026

A full pass at `0ccc271`, after tickets 79-84. Everything below is measured, not carried over:
the **960-cell deck grid at 30 iterations per turn order (57,600 games)**, a fresh **60-iteration
deck report** over all 32 subjects, and `npm run balance`.

Companion dashboard: `docs/balance/roster_dashboard.html` (field rates, the full 32x32 heatmap,
type and role views, card health, gates).

---

## 1. The headline

| | today | five tickets ago (pre-79) |
|---|---|---|
| decks inside the 35-80 field band | **32 / 32** | 22 / 32 |
| field win-rate spread | **36.1 - 68.7** | 24.7 - 81.4 |
| absolute 0% cells | **50** | 80 |
| absolute 100% cells | **48** | 78 |
| NEUTRAL absolutes (the only real bugs) | **13 + 12** | 34 + 33 |
| out-of-band cells | **297** of 960 | 411 |
| first-turn kills | **2**, both in the accepted allowance | 43 |
| control floor | **every deck >= 65%** | same gate, never failing |

**Every deck is playable and no deck is dominant.** The distance between the best and worst deck is
32.6 points, where two weeks ago it was 56.7. The remaining work is not "some decks are too strong"
- it is that a small number of individual matchups are still all-or-nothing.

## 2. Where each deck sits

Top of the ladder is flat: `audhumbla_v1` 68.7, `ymir_v1` 68.4, `ymir_v2` 68.1, `nidhoggr_v1` 67.3,
`nidhoggr_v2` 66.7 - five decks inside two points, none of them runaway. Bottom is `kraken_v2` 36.1,
`draugr_v2` 36.7, `sleipnir_v1` 36.8, `skoll_v2` 37.5, `fafnir_v2` 38.6 - all inside the band.

**Field rate is no longer the interesting number.** The decks that need work now are picked out by
their SPREAD, not their mean:

| deck | field | out-of-band cells | what it means |
|---|---|---|---|
| `audhumbla_v2` | 43.0% | **16, all neutral** | wins totally or loses totally - see 4 |
| `ymir_v1` | 68.4% | 16 (7 neutral) | five 100% cells, the most of any top deck |
| `kraken_v1` | 40.4% | 16 (4 neutral) | 5 zero cells on a mid-table field rate |
| `draugr_v2` | 36.7% | 16 (7 neutral) | never had a pass |
| `skoll_v1` | 43.2% | 15 (4 neutral) | 6 zeros AND 4 hundreds |
| `fafnir_v2` | 38.6% | 15 (5 neutral) | |

## 3. The two axes that shape matchups

**The type chart works and needs nothing.** Advantaged cells average **84.1%**, neutral **50.1%**,
disadvantaged **16.0%** - a 68-point swing, perfectly one-directional, and **not one 0% cell exists
in an advantaged matchup**. Under the 3v3 simultaneous-actives rule those extremes are the design,
not a defect.

**The archetype wheel does not turn.** Measured over neutral cells only:

| role beats -> | ZOO | RAMP | CONTROL | BURST |
|---|---|---|---|---|
| **ZOO** | 53.6 | 34.3 | 40.0 | 35.3 |
| **RAMP** | 65.5 | 51.2 | 67.1 | 50.9 |
| **CONTROL** | 53.3 | 34.1 | 49.9 | 33.8 |
| **BURST** | 63.4 | 48.4 | 68.0 | 50.1 |

The intended cycle is ZOO > RAMP > CONTROL > ZOO. **Not one leg of it holds.** ZOO loses to RAMP
(34.3), RAMP beats CONTROL (67.1) which is the right direction, and CONTROL loses to ZOO's counter
rather than beating it. What the table actually shows is a **ladder**: RAMP 55.5 > BURST 50.3 >
CONTROL 45.7 > ZOO 43.3.

Part of that is sample: the roles are wildly uneven - **BURST 13 decks, RAMP 9, CONTROL 7, ZOO 3**.
A three-deck role cannot express a counter-relationship against a thirteen-deck one. This is a
design question for Henry, not a tuning one: either the roles get rebalanced in number, or the wheel
is retired as an organising idea and the type chart carries the strategy layer alone.

## 4. What is actually still broken

25 neutral cells are absolute (13 at 0%, 12 at 100%). **`audhumbla_v2` is one side of 18 of them.**

She is the roster's all-or-nothing deck: 43.0% field, **16 out-of-band cells and every one of them
neutral**, on the **longest games in the game at 11.2 turns** (the roster median is 5.2). Six decks
never beat her; she never beats seven others. Her sibling `audhumbla_v1` is simultaneously the
strongest deck at 68.7% and `os:audhumbla` is a **100.0%** wipe in the OS-variance suite - the
largest gap on the roster.

**One deck is half the remaining bug list.** The next pass is hers.

After her, the neutral absolutes thin out fast: `kraken_v1` loses to both audhumblas, `fafnir_v2`
loses to `gullinbursti_v1`, `huldra_v2` loses to `nidhoggr_v2`, `draugr_v2` loses to `huldra_v1`,
`hel_v2` beats `ratatoskr_v2` in 2.9 turns, `nidhoggr_v1` beats `gullinbursti_v2`.

## 5. Pace

Median game 5.2 turns. The outliers at both ends are worth watching:

- **Long:** `audhumbla_v2` 11.2, `valkyrie_v1` 8.0, `draugr_v2` 7.8, `huldra_v1` 7.7. Games over ~8
  turns are where the absolutes cluster - a long game gives the better engine time to convert every
  time, which is what turns a 70/30 matchup into a 100/0 one.
- **Short:** `hel_v2` 3.2, `skoll_v2` 3.5, `skoll_v1` 4.3. `hel_v2`'s 2.9-turn 100% cell against
  `ratatoskr_v2` is the fastest blowout measured.

## 6. Cards

**32 of 211 card rows sit at or above a 35% dead rate.** The worst are not marginal:

| card | deck | dead | note |
|---|---|---|---|
| `hoardbreaker` | fafnir_v1 | **89%** | flagged in ticket 82 and still there |
| `barrow_king` | draugr_v1 | **86%** | |
| `ash_communion` | fenrir_v2 | **83%** | 0 damage per play |
| `all_in` | skoll_v2 | **82%** | 0 damage per play |
| `tailwind` | hraesvelgr_v2 | **78%** | the same card ticket 84 cut from sleipnir_v2 |
| `numbing_gale` / `bracing_cold` / `ice_spear` / `thaw` | ymir_v2 | 69 / 68 / 56 / 35% | four of her cards |

**Two caveats on that metric.** It counts a card sitting unplayed in hand, so (a) it cannot see
discard value - `war_molt` reads 62% dead on `sleipnir_v2` and is doing exactly its job - and (b) it
punishes decks that cannot play their hand: `ymir_v2` carries a 0.605 dead ratio almost entirely
because `maxCardsPerTurn: 1` means most of her hand is unplayable by construction.

**Pricing.** 42 card-budget redlines, but **28 of them are 0.1-0.4 points over** and are noise. The
real gaps are where the static scorer cannot see a mechanic at all:

| card | static | measured | gap |
|---|---|---|---|
| `hexbloom` (huldra_v1) | 16.5 | **63.0** | +46.5 |
| `wither_feast` (nidhoggr_v1) | -10.8 | **12.8** | +23.6 |
| `glass_cannon` (skoll_v2) | -2.7 | 9.6 | +12.3 |
| `umbral_feast` (nidhoggr_v2) | 14.9 | 2.7 | **-12.2** |

`hexbloom` and `wither_feast` have been open since ticket 66's repricing. Neither is breaking a
matchup today, which is why they keep getting deferred - but the scorer being off by 46 points on a
live card means section 1.3 cannot be trusted as a gate for that card class.

## 7. Gates

| gate | where it stands | |
|---|---|---|
| field win rate inside 35-80% | 32/32 | **PASS** |
| control floor >= 60% | worst 65.0% (`hel_v2`) | **PASS** |
| no FTK outside the allowance | 2, both accepted | **PASS** |
| no NEUTRAL 0% or 100% cell | 13 + 12 remain | **OPEN** |
| every neutral cell inside 10-90% | 116 of 608 outside | **OPEN** |

The three aggregate gates pass roster-wide. **Henry's bucket standard is the one still open**, and
it is now the only standard that matters, because it is the only one that still fails.

## 8. What I would do next, in order

1. **`audhumbla_v2`.** One deck, 18 of 25 remaining neutral absolutes, the longest games on the
   roster and a 100% OS-variance wipe against her own sibling. Nothing else on this list is close.
2. **The long-game cluster.** `valkyrie_v1`, `draugr_v2`, `huldra_v1` all run 7.7-8.0 turns and all
   carry double-digit out-of-band counts. A pace question, probably shared.
3. **`ymir_v1`'s five 100% cells** - her field rate is fine, her spread is the worst at the top.
4. **The dead-card sweep**: `hoardbreaker`, `barrow_king`, `ash_communion`, `all_in`, `tailwind` on
   hraesvelgr_v2, and ymir_v2's four. These are cheap fixes that no longer need a diagnostic.
5. **The archetype-role question** - a design call, not a tuning one (section 3).
6. **The scorer's blind spots** (`hexbloom`, `wither_feast`) - a tooling ticket, not a balance one.
