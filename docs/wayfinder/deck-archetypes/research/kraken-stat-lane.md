# Kraken stat lane (ticket 70): it is ATTACK, and it is not enough

Ticket: `70-kraken-stat-lane.md`. Henry, 2026-08-16, answer 1 to ticket 67: *"Maybe we try a
sweep of increasing hp, then atk, then def stats. Kraken needs to pick a lane and with low HP and
Def it's not working."* Henry authorised sweep-pick-and-ship.

**Shipped: `kraken.baseStats.attack` 80 -> 100.** HP and DEF stay at 58 / 87.

**Instrument.** `scratch/krakenlane.ts`: both kraken decks x 15 opponent species, 30 iterations x
both turn orders = **1,800 battles an arm**, 10 arms, run twice on independent seed bases
(`lane`, `lane2`) per the seed-base law. Reads field mean, ticket-69 band violations split into
high and low, outright zero-win-rate matchups, the NEUTRAL-bucket sub-table, net damage a turn,
FTK and dead cards. Baseline is `7e616e0` — after tickets 68, 71 and 69.

## 1. The arm table (seed base `lane`)

`viol` is ticket 69's band count out of 15, `hi/lo` its split, `zeros` outright 0% matchups.

| arm | v1 field | v1 viol (hi/lo) | v1 zeros | v1 NEU | v2 field | v2 viol | v2 zeros | v2 net/turn |
|---|---|---|---|---|---|---|---|---|
| **baseline** hp58/atk80/def87 | 31.4% | 10 (2/8) | 7 | 19.8% | 17.1% | 9 (0/9) | 7 | **-2.97** |
| hp 66 | 34.0% | 10 (2/8) | 6 | 22.6% | 19.1% | 9 (0/9) | 7 | -3.02 |
| hp 74 | 35.8% | 10 (2/8) | 5 | 24.8% | 21.1% | 9 (0/9) | 7 | -2.95 |
| hp 82 | 37.9% | 11 (3/8) | 5 | 27.1% | 23.0% | 9 (1/8) | 7 | -3.01 |
| atk 88 | 36.4% | 10 (2/8) | 5 | 24.5% | 22.7% | 9 (1/8) | 6 | -1.92 |
| atk 96 | 41.0% | 11 (3/8) | 2 | 31.2% | 26.0% | 9 (1/8) | 4 | -1.25 |
| **atk 100** | **43.2%** | **10 (4/6)** | **2** | **34.0%** | **27.9%** | **9 (1/8)** | **4** | **-0.91** |
| atk 104 | 44.4% | 10 (5/5) | 2 | 35.0% | 29.3% | 9 (1/8) | 3 | -0.72 |
| def 95 | 37.2% | 11 (3/8) | 6 | 28.1% | 22.7% | 10 (1/9) | 7 | -1.66 |
| def 103 | 40.4% | 11 (3/8) | 6 | 32.6% | 27.4% | 9 (1/8) | 7 | -0.79 |
| def 111 | 42.7% | **13 (5/8)** | 4 | 36.9% | 29.8% | 9 (1/8) | 6 | -0.10 |

## 2. Reading the lanes

**HP is nearly inert and Henry's instinct was half right.** +24 HP (+41% of her frame) buys 6.5
points of field on v1 and 5.9 on v2, **removes two zero matchups on v1 and none at all on v2**,
and moves net/turn by 0.04 — from -2.97 to -3.01, i.e. not at all. A bigger frame makes her lose
the same fights more slowly. It is the worst points-per-stat of the three and it does nothing to
the shape of her problem.

**DEF buys the most field per point and makes the band WORSE.** def111 gives the best neutral
number in the whole sweep (36.9%) and the best net/turn (-0.10, essentially closed) and the best
dead-card ratio (0.213 vs 0.246). It is also **the only arm that increases v1's violation count,
to 13**, and it leaves 6 zero matchups on v2 where attack leaves 3-4. Defence lets her survive
the fights she was already winning and does not let her win the ones she was losing: her low
violations stay at 8 across the entire DEF lane while her high violations climb to 5.

**ATTACK is the lane, because it is the only one that kills the outright losses.** Across v1 and
v2 the zero-win-rate matchups fall from **14 to 6** at atk 100, and **v1's NEUTRAL zeros go to
zero** — which is the pathology Henry named in answer 2 (*"we don't want type matchups to be an
automatic loss"*), and the four neutral zero-cells ticket 69 said to read the sweep against.

**Why 100 and not 104.** 104 buys 1.2 more points of field and one more dead zero, and pays for
it by converting low violations into **high** ones: v1 goes 4hi/6lo at 100 to 5hi/5lo at 104 —
the same band count, but now she is the one blowing matchups out. The ticket-69 standard counts
both ends. 100 is also a clean +20 per Henry's numbers-move-in-5s rule; 105 was measured (43.9%
v1, 30.4% v2, 5hi/6lo) and rejected for the same reason as 104.

**Two-base confirm.** Base `lane` / base `lane2` at atk 100: v1 43.2% / 42.2%, v2 27.9% / 27.7%,
v1 band 10 / 10, zeros 2 / 2. The lane conclusion is identical on both; only the third digit
moves, as the seed-base law predicts.

## 3. The ship rule was not met, and that is the finding

The rule was: *"(a) net/turn nearest 0 and (b) the most matchups inside 10-90, subject to no
matchup exceeding 90% and the field staying inside 0.35-0.80. If no arm reaches the band, STOP
and report — the next move is a design session, not a bigger stat."*

- **(a) net/turn**: met by a wide margin. v2's -2.97 goes to -0.91; def111 gets closer (-0.10) but
  fails (b) hard.
- **(b) band count**: **not met by any arm.** Baseline is 19 violations across the two decks.
  atk 100 gives 19 on base `lane` and **18** on base `lane2` — the only arm anywhere in the sweep
  that improves it at all, and by one cell, inside noise.
- **"no matchup exceeding 90%"**: **already violated at baseline** — `kraken_v1` beats `fenrir`
  100% and `fafnir` 92%, both type-advantaged. No stat arm fixes that; every arm makes it worse.
- **"field inside 0.35-0.80"**: `kraken_v1` clears it for the first time (31.4% -> 43.2%).
  **`kraken_v2` does not, at 27.9%**, and no arm in the sweep gets her there.

So: **shipped for the field gate and the zero matchups, which it fixes decisively; STOPPING on
the band, which it does not.** Stats move a matchup's *level*, not its *variance*, and ticket
69's census says the roster's problem is variance. This is the third instrument in a row to land
on the same conclusion, and I would treat it as settled: **kraken's remaining problem is not a
number on her stat block.** Specifically still open — `kraken_v2` below the field floor, her two
type-advantaged blowouts, and 6 remaining zero matchups.

## 4. Gates

- **8-DIFF clean.** 6 of 67 rows moved and every one is a kraken row or the registry-wide control
  aggregate:

| row | before | after | delta |
|---|---|---|---|
| `gauntlet:control-vs-kraken:kraken_v2` | 46.0% | **10.0%** | -36.0 |
| `gauntlet:control-vs-kraken:kraken_v1` | 4.0% | 0.0% | -4.0 |
| `mirror:kraken` | 52.0% | 49.5% | -2.5 |
| `gauntlet:control-overall:slot2` | 6.1% | 3.9% | -2.2 |
| `gauntlet:control-overall` | 5.4% | 4.2% | -1.2 |
| `os:kraken` | 71.0% | 72.0% | +1.0 |

  **`kraken_v2` now beats the control deck 90%, up from 54%** — she clears the 0.60 control floor
  for the first time. `kraken_v1` is at 100%. Combined with ticket 71's `undertow` swap, both
  kraken decks are out of the control basement they have occupied since ticket 45.
- **Redline count unchanged at 54** (42 card budget, 12 matchup). Nothing added, nothing removed.
- **FTK 0** on every row. `mirror:kraken` dead-card ratio 0.266 against the 0.35 gate.
- Unit suite **833/833 green**. One test needed amending: `drawScaling.test.ts`'s linearity
  assertion was exact and is now a ratio band, because the two-draw state carries an extra Dazed
  stack from ABYSSAL_INK_SYS and the higher attack made the difference visible. The comment in
  the test says so.

## 5. What I would do next, in order

1. **The FTK finding from ticket 69** — 43 first-turn kills the balance suite cannot see, with
   `jormungandr` on one side of 13 of the 14 cells. Correctness, not tuning.
2. **`jormungandr_v1`** at a 90.0% mean field and 11 cells above 90%, which ticket 71 raised
   further. The roster's most out-of-band deck.
3. **`kraken_v2`** at 27.9% field. She is a different deck from v1 with a different problem — the
   `capacitor` ramp Henry kept — and a stat lane shared with v1 cannot serve them both.
4. **The elemental shape decision** (ticket 69 question 2), which gates roughly 43% of the band
   violations including kraken's two blowouts.
