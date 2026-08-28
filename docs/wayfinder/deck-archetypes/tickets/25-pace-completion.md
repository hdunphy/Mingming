# Pace completion: curve rev 3.3 (10 / 30 / 65 / 105)

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-07
- Blocked by: [24-power-curve-reprice](24-power-curve-reprice.md) (closed - this finishes it)

## Question

rev 3.2 put the tuned-species average at 4.73 turns. The 3-4 floor was on spec but the
average sat ~0.3 short of Henry's 5-6 band. This is the last ~14%.

## Resolution

Landed 2026-08-07. Gates: 749 vitest, tsc, build, full committed balance (registry
`1:26e8307c`).

**Curve `10/35/75/120` -> `10/30/65/105`;** budget bands 1.0/3.5/7.5/12.0 ->
**1.0/3.0/6.5/10.5**. 48 card powers + 4 hook powers re-priced.

| | §2.3 | mirror turns | dead v1/v2 | ftk |
|---|---|---|---|---|
| kraken | **0.570** | 5.13 | 0.096 / 0.138 | 0 |
| jormungandr | **0.330** | 6.63 | 0.091 / 0.190 | 0 |
| sleipnir | **0.380** | 4.43 | 0.179 / 0.264 | 0 |

Deciding mirrors registry-wide: fenrir 3.8, sleipnir 4.4, skoll 5.0, kraken 5.1,
jormungandr 6.6, hraesvelgr 7.7, ratatoskr 29.4.

**Tuned average 5.40 turns, floor 3.8, FTK 0 registry-wide** - the target, both halves.

### Re-gate

The 1e band takes a slightly harder cut than 3e under this step, which favours the big-card
OS, so kraken fell to **0.28**. Two knobs, one at a time:

1. TIDAL_CRUSH multiplier 1.2 -> **1.15** -> 0.30 (band edge, too thin)
2. `ink_stream` 11 -> **12** -> **0.57**

`ink_stream` is a CARDS_DRAWN scaler and correspondingly twitchy: 13 overshot to 0.65 *and*
pulled the kraken mirror back to 4.9 turns. 12 is the seat.

### Watch items

- **jormungandr slipped 0.44 -> 0.33.** Still inside the first-pass band, but a 17% gap trips
  the tighter §2.3 final redline (<=15%). It is the one tuned species now carrying a matchup
  redline; worth a knob in its deep pass, not urgent.
- **Card-budget redlines 28 -> 32** - the bands dropped again while status stacks did not.
  Same status-repricing backlog as ticket 24, one notch larger.
- **ratatoskr's mirror is at 29.4 turns**, a hair under the 30-turn stalemate redline. It is
  untuned legacy, but it will cross on the next pace change.
