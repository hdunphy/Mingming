# The control is the floor, not the median — and it needed an answer to a status clock

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-09
- Blocked by: [44-terminal-eval-and-burn-horizon](44-terminal-eval-and-burn-horizon.md) (closed)

## Question

The first attempt to tune nidhoggr against the ticket-42 control found the instrument, not the deck.
**Four separate levers moved the measurement by nothing**, and reading an actual game explained why.

## What the nidhoggr attempt found (all four are negative results worth keeping)

| lever | control vs v1 | vs v2 |
|---|---|---|
| baseline | 0.0% | 3.8% |
| revert ticket 39's knobs (they were aimed at §2.3) | 0.0% | 0.0% |
| **cap ROOT_CORRUPTION's maintained pile** (new `maxStacks` condition) | 0.0% | 0.0% |
| cut poison per card ~35%, power compensated | 0.0% | 0.0% |
| frame **105/100/80 → 75/80/70** | 27.1% | 43.8% |

1. **The `maxStacks` cap is a no-op, and the reason generalises: nidhoggr applies poison faster
   than it decays.** Ten stacks by the end of turn one, decaying one a turn — so ROOT_CORRUPTION's
   "maintain the pile" clause never binds, because the pile was never going to shrink. **A
   maintenance effect is worthless on top of an application rate that already outruns decay.** The
   `maxStacks` condition was reverted rather than shipped unused.
2. **Even at 75/80/70 — a smaller frame than every species in the roster — the control still
   loses.** So nidhoggr's strength is not one card, not the OS, and not mainly the stat line.

## The real finding: the control had no answer to damage-over-time

From a logged game: the control's on-curve cards convert to **6 damage for a 30-power strike and 14
for a 65-power slam**, while nidhoggr's poison reaches 13 stacks and ticks for **11 a turn**. The
control had no cleanse and no heal — it simply absorbed a compounding clock until it died.

That is a blind spot in the instrument, not a fact about nidhoggr: it would over-report **every** DoT
deck. The round robin put nidhoggr at 87–94% against the field; the control said 100%.

## Henry's two calls

**1. The control is the FLOOR, not the median.** Ticket 42 calibrated it to ~50% because that is
where an instrument has the most resolution. Henry's framing is better: the control should be the
worst deck in the game, so "beats the control" is a low bar every real deck clears and the
interesting reading is *by how much*. **Re-targeted to ~25%.**

**2. The cleanse is 2 Energy, deliberately.** A cheap cleanse is a hard counter to poison and would
have made the control a hoser rather than a yardstick. At 2e on a 2-Energy frame it costs a whole
turn — a real answer at a real price. `baseline_purge` (30 power + cleanse) replaced one
`baseline_slam` (65 power), which costs the control about 5 points of raw power. That is the trade.

## Calibration

Measured across all 16 species, the frame sweep:

| frame | overall |
|---|---|
| 110/105/95 *(ticket 42)* | 33.0% |
| **105/100/95 — shipping** | **26.9%** |
| 105/105/90 | 22.1% |
| 105/100/90 | 17.4% |
| 90/90/85 | 3.3% |

**Defense is the dominant stat, not HP**: 90 → 95 is worth ~14 points on its own, while HP
105 → 110 moved it about 2. Worth remembering for any future re-calibration.

## Gate

Full committed run, registry `1:a68df9cc`. **Redlines 45 → 45, nothing added or removed.**
766/766 tests, `tsc -b` and `vite build` clean. **§2.3 and the mirror are completely unchanged** —
the control is excluded from both, which is the property that lets it be re-calibrated freely.

**Control overall 0.407 → 0.237**, on target. The roster now reads as a floor test:

| control's win rate | species |
|---|---|
| 0.00 | audhumbla, gullinbursti, hel, ymir |
| 0.02–0.11 | ratatoskr, fafnir, **nidhoggr**, sleipnir, huldra |
| 0.18–0.31 | sköll, kraken, hraesvelgr, fenrir |
| **0.71–0.98** | **jormungandr, draugr, valkyrie** |

That last row is the useful new sentence: **three decks lose to the worst deck in the game.**

## Left open

- **`baseline_purge` scores 3.00 against a 6.5 band** with `manualReview: ["CLEANSE"]`. CLEANSE is
  one of three genuinely unpriced actions, so a cleanse card cannot sit exactly at band the way the
  other five control cards do. The attack half is on curve; the cleanse half is hand-priced.
- **nidhoggr is still top-cluster at 0.04** and none of the four levers moved it. Its strength is
  the shape — many cheap poison applications compounding into a permanent rate — so the next attempt
  should target application *volume per turn* or the deck's card count, not individual card numbers.
- **jormungandr (0.71), draugr (0.86) and valkyrie (0.98)** now have a crisp diagnosis instead of a
  vague one.
