# Matchup band census (ticket 69): the 10-90% rule fails on 46.5% of the roster

Ticket: `69-matchup-band-census.md`. Henry's standard, 2026-08-16: *"I think we target 10%-90%
single deck matchup bands. I.e. no single matchup should win >90% of matches."*

**Instrument.** All 32 decks x 15 opponent species, 30 iterations x both turn orders = **60 games
a cell, 480 cells, 28,800 battles** (`scratch/bandcensus.ts`, `runPairedBatch`, decisive win
rate, stat jitter on). Measured at `198ac2c` — after tickets 68 and 71, so it describes the world
we are actually in. Opponents play their `availableOS[0]` deck.

## 1. The headline

| | cells | share |
|---|---|---|
| **inside the 10-90% band** | 257 | **53.5%** |
| above 90% | 110 | 22.9% |
| below 10% | 113 | 23.5% |
| **violations** | **223** | **46.5%** |

- **52 cells sit at an absolute 100%. 56 sit at an absolute 0%.**
- **Not one deck of the 32 is clean.** The best is `hraesvelgr_v1` and `sleipnir_v1` at 2
  violations each; the worst are at 11.

**Verdict on the question the ticket asked: this is a ROSTER problem, not a kraken problem.**
Kraken is the worst species, but removing her entirely would leave 203 violations across the
other 30 — 45.1%, essentially unchanged.

## 2. The distribution is bimodal, and that is the real finding

| decile | cells | |
|---|---|---|
| 0-10% | **113** | `######################################` |
| 10-20% | 30 | `##########` |
| 20-30% | 31 | `##########` |
| 30-40% | 31 | `##########` |
| 40-50% | 32 | `###########` |
| 50-60% | **19** | `######` |
| 60-70% | 34 | `###########` |
| 70-80% | 33 | `###########` |
| 80-90% | 39 | `#############` |
| 90-100% | **118** | `#######################################` |

**231 of 480 cells live in the two extreme deciles and only 19 live in the middle one.** The
roster is not a spread of close matchups with some outliers; it is a rock-paper-scissors of
blowouts with a thin middle. A gate that reads aggregates — field win rate, control floor,
mirror — cannot see this shape at all, which is why it has never been reported.

## 3. Type correlation — the number the ticket said would decide the elemental question

| bucket | cells | violations | rate | >90% | <10% | mean WR |
|---|---|---|---|---|---|---|
| ADVANTAGED | 88 | 43 | 48.9% | 41 | 2 | **78.5%** |
| NEUTRAL | 304 | 128 | 42.1% | 67 | 61 | 51.9% |
| DISADVANTAGED | 88 | 52 | 59.1% | 2 | 50 | **18.2%** |

Within a single deck, holding the deck constant and varying only the opponent's bucket (24 decks
have all three): **ADV 80.9% / NEU 46.2% / DIS 19.3% — a 61.5-point swing.** A x1.5 damage
multiplier with no resistance is worth sixty points of win rate. That is the size of the
elemental effect, measured, for the first time.

**But it is an amplifier, not the cause.** **128 of the 223 violations (57.4%) are in NEUTRAL
matchups.** If the elemental system were made perfectly fair tomorrow — every ADV and DIS cell
pulled into band — **128 violations would remain, 26.7% of the roster**, and the neutral
violations split almost evenly high/low (67 / 61), so they are deck-power spread rather than any
systematic bias.

**Recommendation on ticket 35's standing question:** an elemental shape change is *justified* —
61.5 points is far more than a x1.5 multiplier reads like on paper, and it is the single largest
lever in the game. But **it will not get the roster inside 10-90 on its own**, and doing it first
would move 95 cells while leaving the larger 128 untouched. Deck power spread is the bigger
half of this problem and it is not blocked on the elemental decision.

## 4. Worst offenders

| deck | violations /15 | >90% | <10% | mean win rate |
|---|---|---|---|---|
| `jormungandr_v1` | **11** | 11 | 0 | 90.0% |
| `gullinbursti_v1` | **11** | 7 | 4 | 54.0% |
| `kraken_v1` | **10** | 2 | 8 | 33.1% |
| `kraken_v2` | **10** | 0 | 10 | 17.7% |
| `fafnir_v1` | **10** | 2 | 8 | 30.1% |
| `audhumbla_v2` | **10** | 4 | 6 | 45.2% |
| `fafnir_v2` | **9** | 2 | 7 | 35.4% |
| `draugr_v2` | **9** | 2 | 7 | 30.4% |
| `hel_v2` | **9** | 8 | 1 | 80.3% |
| `fenrir_v1` | **8** | 1 | 7 | 26.4% |
| `gullinbursti_v2` | **8** | 3 | 5 | 42.3% |
| `ymir_v1` | **8** | 8 | 0 | 76.0% |

`jormungandr_v1` at **90.0% mean across the entire field, 11 cells above 90% and none below 10%,**
is the most out-of-band deck in the game and it got *stronger* in ticket 71. `gullinbursti_v1` is
the interesting one: 11 violations at a 54.0% mean — a deck that is perfectly balanced on every
aggregate and wins or loses almost every individual matchup outright. **That is exactly the deck
this census exists to find, and no previous instrument could see it.**

Species roll-up:

| species | mean win rate | violations /30 |
|---|---|---|
| `kraken` | 25.4% | 20 |
| `fafnir` | 32.8% | 19 |
| `fenrir` | 35.4% | 13 |
| `draugr` | 37.5% | 13 |
| `ratatoskr` | 40.0% | 8 |
| `sleipnir` | 40.8% | 9 |
| `skoll` | 43.4% | 13 |
| `gullinbursti` | 48.2% | 19 |
| `huldra` | 50.7% | 14 |
| `hel` | 51.9% | 14 |
| `audhumbla` | 55.4% | 17 |
| `hraesvelgr` | 60.4% | 8 |
| `valkyrie` | 61.7% | 13 |
| `nidhoggr` | 73.4% | 12 |
| `jormungandr` | 75.9% | 17 |
| `ymir` | 76.9% | 14 |

## 5. Unplanned finding: there are 43 FTKs and the balance suite reports zero

FTK is a hard gate and every ticket for months has reported **FTK 0**. It is 0 in the matchups
the balance suite runs. Across the full 480-cell field there are **43 first-turn kills in 14
cells**:

| cell | FTKs /60 | win rate |
|---|---|---|
| `skoll_v1` vs `jormungandr` | 10 | 0% |
| `jormungandr_v1` vs `skoll` | 10 | 100% |
| `skoll_v2` vs `jormungandr` | 6 | 0% |
| `fenrir_v2` vs `jormungandr` | 3 | 0% |
| `jormungandr_v1` vs `fenrir` | 3 | 0% -> 100% |
| ...9 more cells at 1-2 | | |

**`jormungandr` is one side of 13 of the 14 cells.** `skoll_v1` vs `jormungandr` kills or is
killed on turn one in **1 game in 6**. This is a live gate failure that the current suite is
structurally blind to, and it is arguably more urgent than the band standard itself.

## 6. What this says about ticket 70 (kraken)

Ticket 71's `undertow` swap fixed kraken_v1's **control-floor** failure (control's win rate
against her went 59% -> 4%). It did **not** fix her against the field: `kraken_v1` is at 33.1%
with 8 zero-cells and `kraken_v2` at 17.7% with 10, and kraken remains the roster's weakest
species at 25.4%. **Ticket 70's premise survives the re-baseline** — she still needs the lane.

Her shape is now legible, though, and it argues against a pure stat sweep: her wins are
`fenrir` 100%, `fafnir` 92%, `skoll` 90%, `hel` 73%, `gullinbursti` 67% — four of the five are
type-advantaged — and she has **seven outright 0% cells, four of them NEUTRAL** (`jormungandr`,
`valkyrie`, `audhumbla`, `nidhoggr`). Stats move a neutral matchup a few points; they do not
move a 0% to 10%. Ticket 67 measured the neutral deficit at **net -1.49 damage a turn**, and the
HP/ATK/DEF arms in ticket 70 are sized to close roughly that. **Run the sweep as written, but
read it against the four neutral zero-cells, not the field mean** — if 8 HP of frame does not
move `kraken`-vs-`valkyrie` off 0%, the lane is not stats.

## 7. Questions for Henry

1. **Is 46.5% the number you expected?** The standard as written condemns nearly half the game.
   A 10-90 band on *every* deck-vs-deck cell is a strict target for a type-based roster — most
   card games of this shape live with 20-30% out-of-band. Do you want 10-90 as a **hard gate**,
   or as a **direction of travel** with a softer near-term target (say, no cell at absolute 0%
   or 100%, which is 108 cells)?
2. **Elemental shape change: authorise or defer?** It is the largest single lever (61.5 points)
   but fixes only 43% of violations. Ticket 35's note says shaving the 1.5 was measured not to
   work and the mechanism's SHAPE has to change. I can spec options (resistance floor, damage
   cap, converting advantage from a multiplier to a flat bonus) as a ticket if you want it.
3. **The FTK finding — separate ticket, ahead of everything?** 43 FTKs against a "0" gate is a
   correctness problem, not a tuning one, and `jormungandr` is on one side of essentially all
   of them.
4. **`jormungandr_v1` at 90.0% mean** is the roster's outlier and ticket 71 raised it further.
   Cut it now, or hold until the elemental decision?

## 8. Method notes

- Decisive win rate throughout (draws excluded), pooled across both turn orders — the
  first-mover edge runs to 12 points between base decks and a single-orientation read cannot
  separate "stronger deck" from "went first."
- 60 games a cell puts the 1-sigma error at ~6 points mid-band and much less at the extremes,
  so the *count* of 100%/0% cells is solid and a cell reading 88% vs 92% is not. Per
  `0-DECISION-GRADE`, treat individual near-band cells as rankings and re-read at higher
  iterations before acting on one.
- Opponents play `availableOS[0]`, so this is 32 decks against 15 *species*, not 32x31 against
  every deck. A full deck-vs-deck grid is 992 cells and roughly 2 hours; worth doing once the
  standard is settled.
