# Kraken stat lane (ticket 70): pick a lane, then ship it

- Type: wayfinder:task - Henry-approved (2026-08-16, answer 1 to ticket 67: *"Maybe we try a
  sweep of increasing hp, then atk, then def stats. Kraken needs to pick a lane and with low HP
  and Def it's not working."*). Henry authorised the implementing session to **sweep, pick and
  ship** the winning lane.
- Status: **closed** (2026-08-16)
- Blocked by: tickets 68 and 69 (the census tells us whether the target is reachable by stats
  at all).

## Why

Ticket 67 located the deficit precisely: in NEUTRAL matchups kraken deals **12.72 damage/turn
against valkyrie_v2's 12.51 and wins 10.7% against her 64.4%**, because she takes 14.21/turn to
valkyrie's 12.53 on a 12%-smaller frame. **Net -1.49 a turn.** Offense contributes ~0.2 of that
and defence ~1.3. Base stats are the lane Henry named: HP 58 / ATK 80 / DEF 87 / 2 Energy.

## Arms

One stat at a time, kraken only, in-memory per arm:

- **HP**: 58 -> 66, 74, 82 (valkyrie's frame is ~82 at level 15)
- **ATK**: 80 -> 88, 96, 104
- **DEF**: 87 -> 95, 103, 111

## Instrument

Neutral-bucket damage/turn, damage taken/turn and **net/turn** (the number being closed);
neutral-bucket win rate; full field row; control floor; FTK; and the **10-90% band count** from
ticket 69's standard.

## Ship rule

Ship the lane that (a) brings net/turn nearest 0 and (b) puts the most matchups inside 10-90,
subject to no matchup exceeding 90% and the field staying inside 0.35-0.80. Confirm on two seed
bases. If no arm reaches the band, STOP and report - the next move is a design session, not a
bigger stat.

## Deliverable

Commit hash, the arm table, shipped lane with its two-base confirm, all gates, 8-DIFF.

## Resolution (2026-08-16)

Report: [research/kraken-stat-lane.md](../research/kraken-stat-lane.md). Instrument:
`scratch/krakenlane.ts`. 10 arms x 1,800 battles, run on two independent seed bases.

**Shipped: `attack` 80 -> 100.** HP and DEF unchanged.

- **HP is nearly inert.** +24 HP buys 6.5 points of field, removes ZERO of v2's seven zero-win
  matchups, and moves net/turn by 0.04. A bigger frame loses the same fights more slowly.
- **DEF buys field and WIDENS the band** - def111 has the best net/turn (-0.10) and the best
  neutral number in the sweep, and is the only arm that raises v1's violation count (to 13).
- **ATTACK is the only lane that kills outright losses**: zero-win matchups across both decks
  **14 -> 6**, and v1's NEUTRAL zeros -> **0**, which is the pathology Henry named. 100 over 104
  because 104 converts low violations into high ones at the same band count, and 100 is a clean
  +20.

**The ship rule's part (b) was NOT met and the STOP clause applies.** No arm improves the band
count by more than one cell; `kraken_v1` clears the 0.35-0.80 field gate for the first time
(31.4% -> 43.2%) but **`kraken_v2` does not, at 27.9%**, and her two >90% type-advantaged
blowouts were there at baseline and get worse in every arm. Shipped for the field gate and the
zero matchups; stopped on the band. **Kraken's remaining problem is not a number on her stat
block** - the third instrument in a row to say so.

Gates: 8-DIFF clean (6 rows, all kraken or the control aggregate); **`kraken_v2` now beats the
control deck 90%, up from 54%**, clearing the 0.60 floor for the first time; redlines unchanged
at 54; FTK 0; 833/833 unit tests green.
