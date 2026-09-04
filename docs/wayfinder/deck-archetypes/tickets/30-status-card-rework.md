# Status card rework: variety instead of stack inflation

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-07
- Blocked by: [29-status-topup](29-status-topup.md) (closed - this replaces its approach)

## Question

Two things, both raised by Henry.

1. Ticket 29's top-up left status cards carrying absurd stack counts (`cold_snap` 8 Weakened,
   `shield_shards` 9 Sharp). What percentage per stack would keep the counts legible?
2. Sweep skoll's stat line. It was drawn as a glass cannon a year ago - does that match the
   deck it actually has?

## Resolution 1: the percentage does not move

4.5%/stack was derived, implemented, measured and then **reverted**, on Henry's call. It hits
the stack ladder exactly (1 / 2-3 / 5-6 / 8-9 for 0-3e) and the arithmetic is right, but:

- it shrinks the 25% cap from 12.5 stacks to 5.6, tightening every headroom decision above 2e;
- it silently multiplies **13 OS and daemon hooks** by 2.25x - `skoll_v1`, `sleipnir_v1`,
  `draugr_v1`, `nidhoggr_v2`, `kraken_v1`, `fenrir_v1`, `fenrir_v2`, `huldra_v1`,
  `ratatoskr_v2`, `ymir_v1` and two daemons all grant 1-3 stacks as their entire payload - and
  **firmware never passes through powerscale**, so the auditor would report nothing.

The cards got reworked instead. Full reasoning in `power_curve_spec.md` rev 3.5.

### 14 cards: original stacks restored, budget spent on a SECOND effect

| card | E | was (ticket 29) | now |
|---|---|---|---|
| `blind_spot` | 0 | 2 Dazed | 6 power. Apply 1 Dazed. |
| `disorienting_gust` | 0 | 2 Dazed | Apply 1 Dazed. Gain 1 Sharp. |
| `hoarfrost` | 0 | 2 Weakened | 6 power. Apply 1 Weakened. |
| `growth` | 0 | 2 Sharp | Gain 1 Sharp. Heal with 8 power. |
| `pollen_cloud` | 0 | 2 Weakened | 4 power. Apply 1 Weakened and 1 Poison. |
| `shield_shards` | 1 | 9 Sharp | Gain 2 Sharp and 5 BarkShield. |
| `iron_bark` | 1 | 9 Sharp | Gain 3 Sharp and 2 Regen. |
| `cold_snap` | 1 | 8 Weakened | 8 power. Apply 2 Weakened. Draw a card. |
| `strength_burst` | 2 | 13 Strengthened | Gain 5 Strength and 1 Energy. Draw a card. (Exhaust) |
| `ink_cloud` | 2 | 5 Dazed | 18 power to side. Apply 2 Dazed to side. |
| `uplift` | 2 | 5 Strengthened | Strengthen side by 2. Heal side with 26 power. |
| `crippling_vine` | 2 | 7 Weakened + 8 Dazed | 30 power. Apply 2 Weakened, 2 Dazed and 3 Poison. |
| `winters_grasp` | 2 | 8 Weakened | 22 power to side. Apply 2 Weakened to side. |
| `creeping_dread` | 2 | 3 Weakened + 3 Dazed | 8 power to side. Apply 1 Weakened and 1 Dazed to side. Draw 2. |

Every one lands inside its band. The attack-power raises ticket 29 made (`fury_strike` 25,
`overdrive` 54, `hamstring` 20, `adrenaline` 18, `dust_devil` 25, `stone_fist` 24,
`night_terror` 54) were already on-curve and are kept.

**One re-gate.** `disorienting_gust` was first drafted as a 0e side-wide Daze. Sleipnir fell
0.310 -> **0.260**, out of band. Cause: the AI's targeting bucket sends `Side`/`All` cards to
BOTH parties, so a side-scoped debuff can be aimed at your own Mingming - the same family as
ticket 28's lifesteal bug, and a reason to be wary of `Side` on any debuff. Re-cut as a
single-target Daze plus 1 Sharp: sleipnir back to **0.330**.

## Resolution 2: skoll - I was wrong in ticket 29, and the OS is the real story

Ticket 29 concluded skoll's ~50% dead cards were a consequence of its stat line. **The sweep
does not support that.** Fourteen lines at constant 220 total:

| hp/atk/def | §2.3 | mirror turns | dead cards |
|---|---|---|---|
| 60/105/55 (current) | 0.688 | 3.4 | 51.2% |
| 70/95/55 | 0.675 | 3.6 | 48.8% |
| 80/85/55 | 0.688 | 4.0 | 46.4% |
| 85/80/55 | 0.650 | 4.1 | 46.0% |
| 70/85/65 | 0.650 | 4.2 | 45.6% |
| 90/105/40 (235 total) | 0.625 | 3.2 | 52.1% |

Walking all the way off the glass cannon buys 0.7 turns and **five points of dead cards**. The
stat line is a contributing factor, not the cause.

**The cause is the deck's cost curve against a 2-Energy economy.** skoll_v1 holds three 2e
cards (`overdrive`, `brute_force`, `core_overclock_daemon`) plus a 0e. On 2 Energy the optimal
line every single turn is "0e card + one 2e card", which structurally locks all five 1e cards
out of the game. fenrir_v1 has the same draw, energy and deck size but only two 2e cards, and
runs at half the dead-card ratio.

| lever | §2.3 | mirror turns | dead cards |
|---|---|---|---|
| current | 0.688 | 3.4 | 51.2% |
| stats 80/85/55 only | 0.688 | 4.0 | 46.4% |
| deck: one 2e only | 0.662 | 3.5 | 38.3% |
| **both together** | **0.588** | **4.3** | **33.6%** |
| energy 2 -> 3 | 0.700 | 2.6 | 35.8% |
| cardDraw 3 -> 2 | 0.800 | 3.7 | 32.5% |

Neither lever alone is enough; together they clear the 0.35 band with §2.3 improving too.
Raising Energy makes games *faster* (2.6 turns) - wrong direction. Cutting cardDraw fixes dead
cards but blows §2.3 to 0.800.

### Does the glass cannon match the deck? Not the way it was drawn.

`TREACHERY_KERNEL` grants 1 Strengthened whenever skoll is hit, which reads like a ramp that
wants a long fight. It is not a ramp. Measured peak Strength on skoll_v1:

- at 60/105/55 (3.4-turn games): **13.7 stacks**
- at 80/85/55 (4.1-turn games): **16.5 stacks**

Against a 12.5-stack damage cap and an 8-stack cap on the daemon's scaler. **The ramp is
saturated by turn 2 and everything after that is discarded.** That is why dropping
`CORE_OVERCLOCK` 1.2 -> 1.10 moved the mirror by 0.02 turns - the multiplier is already pinned.
skoll_v2 hits its `SOLAR_FLARE` requirement (3 Burn) in every single game too.

So the glass-cannon stat line is not fighting the firmware; the firmware is over-feeding. The
archetype fantasy - "gets scarier the more it is hurt" - never plays as a *curve* because it
maxes immediately. Fixing that is a firmware generosity question, not a stat question.

**Left for Henry:** whether skoll keeps the glass-cannon identity (and gets a different
dead-card band), takes the 80/85/55 + one-2e combination, or has TREACHERY_KERNEL slowed so the
ramp is something the player experiences. No stat or deck change was committed.

## Gate

| species | §2.3 | mirror turns | dead cards |
|---|---|---|---|
| kraken | 0.540 | 5.1 | 10.1% |
| fenrir | 0.394 | 5.2 | 25.4% |
| jormungandr | 0.390 | 6.4 | 5.6% |
| sleipnir | 0.330 | 4.5 | 14.7% |
| hraesvelgr | 0.310 | 3.2 | 4.0% |
| skoll | 0.690 | 3.3 | 51.2% |

All six inside the 0.30-0.70 first-pass band, FTK 0, 757/757 tests. jormungandr improved
0.330 -> 0.390 on `blind_spot` alone. skoll's dead cards remain the only open breach.
