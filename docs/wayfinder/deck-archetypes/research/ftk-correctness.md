# FTK correctness (ticket 73): an uncapped multiplier, and ticket 71 is what pulled the trigger

Ticket: `73-ftk-correctness.md`. Correctness, not tuning. Runs before ticket 72.

**Shipped:** two scaling ceilings (`DRAW_SCALING_CAP` 2, `PLAY_COUNT_SCALING_CAP` 3),
`ink_stream` 33 -> 28, `starfall` 18 -> 24, and the field census promoted from `scratch/` to a
standing `*.balance.ts` gate.

**Result: FTK 0 in 0 of 480 cells**, verified at 30 iterations x both turn orders (28,800
battles) on the shipped build.

## 1. The mechanism, named

Every one of the 43 FTKs is the same chain, and it is `jormungandr_v1` on turn one in **all 43**
(the ticket said 13 of 14 cells; it is 14 of 14 - the "X-vs-jormungandr at 0%" rows are the
opponent being killed by jormungandr as first mover). Replayed action by action
(`scratch/ftkrepro.ts`), the canonical case, `skoll_v1` vs `jormungandr`, seed 906595648:

```
Skoll 76 hp                                    Jormungandr 88 hp, 2 Energy
T1 e2  PLAY undertow   (0e)  dmg  0   drew 1   cd1/triggered1
T1 e2  PLAY undertow   (0e)  dmg  0   drew 1   cd2/triggered2
T1 e2  PLAY blind_spot (0e)  dmg  3   e -> 3   cd3/triggered3   <- OUROBOROS_LOOP: 3rd Water card
T1 e3  PLAY ink_stream (1e)  dmg 48   foeHp 25
T1 e2  PLAY ink_stream (1e)  dmg 25   foeHp  0
RESULT turn 1 - Skoll dead, having never acted.
```

**The energy accounting is CORRECT and is not the defect.** I checked every point: two 0-cost
cantrips, OUROBOROS_LOOP's +1 Energy on the 3rd Water card (once per turn, exactly as its
firmware caps it), and `surge_protection`'s ticket-68 refund. Five plays, four energy spent, two
gained, zero left. Nothing is leaking.

**The defect is that `ink_stream` had no ceiling.** 33 power x 3 triggered draws = **99 power
from a ONE-ENERGY card** - against a 1e budget of 30 (`BUDGET_BANDS`) - which is 63% of Skoll's
frame from a single card before she has acted. `CARDS_PLAYED`, `CARDS_DRAWN`,
`CARDS_DRAWN_TRIGGERED` and `CARDS_DISCARDED` were **the only scalers in the engine with no
cap**. `STRENGTH_STACK_CAP` is 8, `MISSING_HP_PCT_CAP` is 50, status percentages cap at 25%.
This family was simply never given one.

## 2. Ticket 71 is the cause, and my own 8-DIFF said FTK 0

Reverting **only** `ink_stream` to its pre-71 footing (12 power, `CARDS_DRAWN`) and changing
nothing else takes the full field from **43 FTKs to 0**. Ticket 71 raised the card's power 2.75x
on exactly the turn this chain needs, and shipped it.

Ticket 71's report says *"FTK 0 on every row."* That was true and useless: `npm run balance`
runs 67 matchups and `jormungandr_v1` appears in one of them. The gate could not see the thing
it was gating. **That is the same blind spot ticket 69 found, and this ticket is what closes
it** - section 4 below.

The deeper fault is one ticket 71 flagged in its own §8 and did not act on: *"One power number
serves two decks with different draw density. It is honest at the roster level and unfair at the
deck level."* The compensation was solved as a **mean-preserving fixed point**. A mean-preserving
change to a distribution with a fat right tail moves the tail by much more than the mean, and the
tail is where a first-turn kill lives.

## 3. The fix, and the frontier it was chosen from

All arms on the 14 census cells, 60 games each:

| arm | FTK | | arm | FTK |
|---|---|---|---|---|
| live (uncapped, ink 33) | **43** | | draw 2, play 3, ink 32 | 5 |
| pre-71 counterfactual | **0** | | draw 2, play 3, ink 30 | 1 |
| draw cap 4 | 29 | | **draw 2, play 3, ink 28** | **0** |
| draw cap 3 | 24 | | draw 2, play 3, ink 18 | 0 |
| draw cap 2 | 5 | | draw 2, play **infinity**, ink 28 | 5 |
| draw cap 1 | 0 | | draw 2, play **5**, ink 28 | 3 (full field) |

Two things this table settles:

- **The draw cap alone is not enough.** With `CARDS_PLAYED` uncapped, five FTKs survive, because
  `serpents_coil` ("10 Water damage for every card you played this turn", same deck) finishes
  the turn `ink_stream` starts.
- **A loose play cap of 5 does not work either.** I tried it first, specifically to keep the
  blast radius small, and the 14-cell scan said zero. **It was wrong**: a bug in my own arm
  parser was deriving the play cap from the draw cap and silently overwriting the explicit value,
  so every arm labelled "play 5" ran at 3. The **full-field scan caught it** - 3 FTKs at play cap
  5 - which is a fair advertisement for section 4. Parser fixed, with a comment.

Powers were then re-solved against ticket 71's own gate - total delivered damage, measured over
real battles - because a cap changes the mean and the compensation has to move with it:

| deck / card | uncapped (live) | **shipped** | vs live |
|---|---|---|---|
| `jormungandr_v1` / `ink_stream` | 6,523 | 5,656 | -13% |
| `kraken_v1` / `ink_stream` | 5,900 | 4,536 | -23% |
| `valkyrie_v2` / `starfall` | 3,577 | 3,729 | **+4%** |

`starfall` goes **UP**, 18 -> 24: the cap bites it on 35% of casts (valkyrie_v2 earns 2.27
triggered draws a cast, the most in the game), so holding its damage required more power per
draw, not less. Both cards now disclose the ceiling in their text - *"up to 2"* - because a cap
a player cannot read is a trap.

The alternative of cap 3 with `ink_stream` cut to 18 also reaches zero and was rejected: it costs
`kraken_v1` **76%** of the card, three days after tickets 71 and 70 got her out of the control
basement.

## 4. Task 3: the instrument hole is closed

`scratch/bandcensus.ts` is promoted to `src/debug/balance/fieldCensusSuite.ts` with two shards,
so **`npm run balance` now scans all 480 cells every run**. FTK 0 is a hard assertion there.
Artifact: `docs/balance/field_census.json` - the full grid, byte-stable across shard order.

The cost is real and the file says so plainly. Each cell is a full battle, so the authoritative
30-iteration read is ~28 minutes on two cores, four times the rest of the suite combined. The
**default is 10 iterations** (20 games a cell, ~8 minutes across both shards): a smoke alarm that
reliably catches a cell FTK-ing at the 10-17% rate all 14 census cells had, and that will miss a
1-in-60 cell. **`CENSUS_ITERATIONS=30 npm run balance` is the authoritative read** and is what a
ticket claiming FTK 0 should quote. This report quotes it.

The band data rides along as a **diagnostic**, not an assertion: at 10 iterations the standing
read is **218 of 480 cells out of band (45.4%)** and **79 neutral absolutes**, against ticket
69's 46.5% at 30 iterations. Henry's bucket-band gate (no absolute 0%/100% in a NEUTRAL cell) is
wired and logged but deliberately not asserted - it fails today, and the queue (jormungandr_v1
cut, hel_v1, hraesvelgr, dead-card cleanup) is the plan for closing it. Turning it on is one line
when the queue lands.

## 5. Collateral, stated rather than buried

The 8-DIFF is **17 of 67 rows**, wider than the three carrier decks, and the play cap is why:

| row | before | after | delta |
|---|---|---|---|
| `os:jormungandr` | 98.0% | **65.0%** | -33.0 |
| `os:ratatoskr` | 31.0% | **0.0%** | -31.0 |
| `os:kraken` | 72.0% | 47.0% | -25.0 |
| `os:valkyrie` | 69.0% | 91.0% | +22.0 |
| `gauntlet:control-vs-ratatoskr:ratatoskr_v1` | 0.0% | 9.0% | +9.0 |
| `os:sleipnir` | 33.0% | 26.0% | -7.0 |
| ...11 more under 6 points | | | |

- **`os:jormungandr` 98% -> 65%** shrinks the roster's widest section-2.3 gap from 96 points to
  30. Ticket 69 named `jormungandr_v1` as the deck most in need of a cut and it is still queued;
  this is a down payment, not that session.
- **`os:ratatoskr` 31% -> 0% is the finding, not the damage.** `ratatoskr_v1` runs
  `seed_bomb_v2` x2 ("15 power per card played") behind four 0-cost cards and `echo_chamber_v2`,
  which mints *more* 0-cost tokens - **the same 0-cost-engine-into-unbounded-multiplier shape as
  `jormungandr_v1`, one energy tier slower.** It never produced an FTK because 15 power per card
  on a 2-cost body is not lethal on turn one. The cap did not break that deck; it showed where
  its power was coming from. Henry's archetype web already lists `ratatoskr_v1` as
  Control/attrition while it is measurably playing zoo/velocity - that role mismatch is now a
  measurement, not a guess.
- **`os:valkyrie` 69% -> 91%** is the one I would watch. `valkyrie_v2`'s total damage is up 4%
  and her head-to-head against `v1` is down 22 points, which is what a cap does to a deck whose
  value was in its *peaks*: the mean holds and the blowout turns are gone.

Redlines went **54 -> 53**; no card-budget redline was added or removed (42 either way).

## 6. Gates

- **FTK 0 in 0/480 cells at 30 iterations x 2 orders** on the shipped build - the ticket's hard
  gate, on the full field rather than the 14 offending cells.
- The 14 offending cells specifically: **43 -> 0**.
- `npm run balance` clean, redlines 54 -> 53, no card-budget change.
- Unit suite **842/842 green**, 64 files. New: `scalingCaps.test.ts` (9 tests). Amended:
  `NewArchetypes.test.ts`'s `CARDS_DRAWN` test asserted a x10 multiplier bought x10 damage - it
  now pins both halves, that it scales below the cap and stops at it.

## 7. Open

1. **`jormungandr_v1`** is still the roster's most out-of-band deck (90.0% mean field, 11 cells
   above 90%) and its cut is a Henry design session. This ticket took its turn-1 kill away, not
   its power.
2. **`ratatoskr_v1`'s** power source is now visibly the uncapped multiplier it no longer has.
   It needs a rebuild or a role, and it should be sequenced with the jormungandr session because
   it is the same pathology.
3. **The band gate is wired and not asserted.** One line, when the queue closes it.
4. **`valkyrie_v2`'s** 22-point drop against her sibling is a peak-shaving effect worth a look at
   her next pass.
