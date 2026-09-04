# Ticket 109 Part 2 — canary results

Run against pinned commit `a30774c` in an isolated clone, so nothing here can have been
disturbed by other work in the repo. Screening tier is lite + beam 8; the confirm pass is
full beamless lookahead.

## Comps vs the reference panel

| comp | pairings | mean win | turns | stalls | FTK | flag |
|---|---|---|---|---|---|---|
| `guess-5-zoo-plus-payoff` | 6/6 | 79.2% | 6.2 | 0 | 0 | — |
| `triple-sustain-STALL` | 6/6 | 66.7% | 10.4 | 0 | 0 | — |
| `triple-control` | 6/6 | 62.5% | 7.9 | 0 | 0 | — |
| `guess-2-treachery-engine` | 6/6 | 58.3% | 7.4 | 0 | 0 | — |
| `tag-treachery` | 6/6 | 58.3% | 5.1 | 0 | 0 | — |
| `tag-rebirth-pile` | 6/6 | 58.3% | 6.0 | 0 | 0 | — |
| `tag-energy-ramp` | 6/6 | 58.3% | 7.2 | 0 | 0 | — |
| `tag-poison-at-length` | 6/6 | 50.0% | 7.0 | 0 | 0 | — |
| `guess-4-sharp-wall` | 6/6 | 45.8% | 14.3 | 1 | 0 | **STALLS** |
| `tag-sidewide-burn` | 6/6 | 45.8% | 6.3 | 0 | 0 | — |
| `tag-solar-jackpot` | 6/6 | 45.8% | 7.3 | 0 | 0 | — |
| `triple-burst` | 6/6 | 41.7% | 6.0 | 0 | 0 | — |
| `guess-1-length-tax` | 6/6 | 33.3% | 10.2 | 0 | 0 | — |
| `triple-ramp` | 6/6 | 33.3% | 8.0 | 0 | 0 | — |
| `tag-antiheal-vs-stall` | 6/6 | 25.0% | 7.8 | 0 | 0 | — |
| `guess-3-solar-runaway` | 6/6 | 20.8% | 9.6 | 0 | 0 | — |

**Hard gates across 384 games: FTK 0 (must be 0), stalls/undecided 1.**

## The three comps that mattered most

- `triple-sustain-STALL` — **66.7%** vs panel, 10.4 turns, 0 stalls, 0 FTK
- `tag-solar-jackpot` — **45.8%** vs panel, 7.3 turns, 0 stalls, 0 FTK
- `tag-treachery` — **58.3%** vs panel, 5.1 turns, 0 stalls, 0 FTK

## Beamless confirm — panel-zoo (the web-inversion finding)

| pairing | win rate |
|---|---|
| panel-zoo vs panel-control | 100.0% |
| panel-zoo vs panel-ramp | 100.0% |
| panel-zoo vs panel-burst | 62.5% |
| panel-zoo vs panel-mixed-a | 75.0% |
| panel-zoo vs panel-mixed-b | 100.0% |

Under `research/archetype-web.md`, control PREYS on zoo and a prey licence is 65–80%.

## Status piles (the Part 1 indictment, re-measured here)

| status | stacks per game |
|---|---|
| Strengthened | 19.86 |
| Sharp | 16.88 |
| Poison | 15.85 |
| BarkShield | 14.84 |
| Weakened | 9.51 |
| Dazed | 5.89 |
| Burn | 4.05 |
| Regen | 3.83 |
| Energized | 1.23 |
| Stunned | 0.77 |
| Asleep | 0.58 |