# Power curve re-price: rev 3.2 (10 / 35 / 75 / 120)

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-07
- Blocked by: [23-pace-amendment](23-pace-amendment.md) (closed - this is its second half)

## Question

Ticket 23 slowed the game with a global divisor and landed evens at 4.4-6.0 turns. Henry's
target is a **5-6 turn average with a 3-4 turn floor**, and measurement showed why 23 could
not get there on its own: **the curve itself was calibrated to ~3-turn games.**

At the balance frame, damage = **0.30 x power** and a health pool is ~79 HP = **263 power**.
A deck spending both its Energy on 1e damage therefore removes 80 power = **31% of a pool
per turn**, i.e. ~3.2 turns. Sleipnir sat exactly on that number (28.6%/turn, 3.17 turns);
kraken reached 4.6 only by spending a third of its energy on utility, and jormungandr 7.0 by
spending most of its energy on setup. Pace was being set by how much energy a deck *wasted*,
not by design.

## Resolution

Landed 2026-08-07. Gates: 749 vitest, tsc, build, full committed balance.

**Curve `50E-10` -> `10 / 35 / 75 / 120`.** 48 card powers and 4 OS-hook powers re-priced.
`BUDGET_BANDS` 1.0/4.0/9.0/14.0 -> **1.0/3.5/7.5/12.0**.

**The power UNIT is unchanged and the per-status prices were deliberately NOT rescaled.** A
point of power still buys the same fraction of a health pool - cards carry less power, so
they deal proportionally less damage, and "1% maxHP = 3 power" still holds. Only the budget
per Energy moved. Rescaling the status prices too would have double-counted.

### Pace, measured

| mirror | rev 3.1 | rev 3.2 |
|---|---|---|
| fenrir | 3.4 | 3.6 |
| sleipnir | 3.2 | 3.7 |
| skoll | 3.9 | 4.3 |
| kraken | 4.4 | 4.6 |
| hraesvelgr | 5.9 | 6.5 |
| jormungandr | 6.0 | 5.9 |

Tuned-species average **4.73 turns**, floor **3.6**, and **FTK 0 registry-wide**.

### The A/B that got us here

Four curves were re-priced and simulated end to end, not modelled:

| curve | kraken mirror | jorm mirror | sleipnir mirror | avg |
|---|---|---|---|---|
| CURRENT 10/40/90/140 | 4.4 | 6.0 | 3.5 | 4.6 |
| **10/35/75/120** | **4.6** | **7.6** | **3.7** | **5.3** |
| 5+10E^2 = 5/15/45/95 | 12.0 | 19.0 | 10.1 | 13.7 |
| 5+10E^1.5 = 5/15/33/57 | 12.0 | 19.0 | 10.1 | 13.7 |

**Two findings worth keeping, both recorded in the spec's rev-3.2 note:**

1. **An exponential curve is incompatible with a turn-count floor.** Under both exponential
   shapes every v1 deck in the registry lost **0/100**. They cut 1e by 62% while cutting 3e
   by only 32%, so cheap decks collapse and expensive decks win everything - the *ramp* deck
   becomes the fastest deck. Structural to the shape, not the constants.
2. **A global curve change under ~20% is invisible to status cards.** Status is quantised in
   whole stacks: at a 0.875 ratio `corrosive_bolt`'s 4 Poison stacks round back to 4. Across
   the whole registry only **5 status stacks** would have changed. Attack cards take the full
   cut and status cards take none, so any small curve cut favours status decks by default.

### Re-gate

Finding 2 hit jormungandr exactly as predicted - its v2 is a pure status deck, so the
re-price took 12.5% off v1 and nothing off v2: **§2.3 0.33 -> 0.04**. Buffing the attack side
proved the finer instrument (the smallest stack step is a 25% cut against the curve's 12.5%):

1. `serpents_coil` 13 -> **17** power (v1's engine, restored above its pre-curve 15) -> 0.25
2. `corrosive_bolt` Poison 4 -> **3** -> **0.44, in band**

| | §2.3 before | after re-price | after re-gate |
|---|---|---|---|
| kraken | 0.620 | **0.580** | 0.580 |
| sleipnir | 0.550 | **0.550** | 0.550 |
| jormungandr | 0.330 | 0.040 | **0.440** |

**Sleipnir's dead-card breach closed on its own**: v2 was 0.384 against a 0.35 ceiling and the
re-price took it to **0.316**. Kraken 0.117/0.150, jorm 0.100/0.228 - all in band.

Also folded in (approved separately): **`momentum_crash`'s `STRENGTH_STACKS` scaler is now
capped at 8 stacks.** Uncapped it measured 29.3 damage a play - 38% of a health pool off a
nominal 10 power, an effective ~98 power for 1 Energy against a 40 budget, and 46% of
sleipnir v1's whole output.

### Card-budget redlines: 20 -> 27

Expected and correct: the bands dropped 12.5% while status cards kept their stacks. The
overhang is the honest list of what a status re-pricing pass would work through. On cards in
tuned decks it is all either documented or long-standing - `water_slap` +0.2 (the Tackle
None-tier exception), `lance` +0.9 (pays a discard the static scorer scores at 0),
`corrosive_leak` +1.8 (open since ticket 20), `surge_protection` +0.8, `blind_spot` +0.5,
`disorienting_gust` +0.5, `slipstream` +0.4. The largest in the registry is `scorch` at
**+9.3** (2e, score 16.8 vs a 7.5 budget) in an untuned Fire deck - flagged for that pass.

### Where it landed vs the target

Tuned-species mirrors: kraken **4.62**, jormungandr **5.86**, sleipnir **3.70** - average
**4.73**, floor **3.6** (fenrir), all 400/400 decided, **FTK 0 registry-wide**.

The floor is exactly on spec. The average is ~0.3 turns short of the 5-6 band, and that is a
real trade rather than a miss: another ~15% shave would bring the average to ~5.5 but push
the floor to ~4.2. A 3-4 floor and a 5-6 average need a wide spread, and the current spread
is 3.6-6.5 across tuned species. Left as-is; revisit if Henry wants the average over the
floor.
