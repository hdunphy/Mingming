# Kraken stat lane (ticket 70): pick a lane, then ship it

- Type: wayfinder:task - Henry-approved (2026-08-16, answer 1 to ticket 67: *"Maybe we try a
  sweep of increasing hp, then atk, then def stats. Kraken needs to pick a lane and with low HP
  and Def it's not working."*). Henry authorised the implementing session to **sweep, pick and
  ship** the winning lane.
- Status: **open**
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
