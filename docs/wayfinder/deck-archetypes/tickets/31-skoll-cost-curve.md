# Sköll: the 2e cost curve, and the answer to the glass-cannon question

- Type: wayfinder:task
- Status: closed
- Assignee: implementation session (Opus), 2026-08-07
- Blocked by: [30-status-card-rework](30-status-card-rework.md) (closed)

## Question

Sköll's dead-card ratio has been the last open first-pass breach since ticket 26. Ticket 29
blamed the stat line; ticket 30's sweep disproved that and pointed at the deck's cost curve
against a 2-Energy economy. Henry: "do we need to swap one of the 2e cards?"

## Resolution: two, not one - and not the two you would guess

**One swap is never enough.** Every single-swap option leaves the breach open:

| variant | 2e count | §2.3 | mirror turns | dead cards |
|---|---|---|---|---|
| current | 3 | 0.690 | 3.4 | 50.9% |
| `overdrive` -> `fire_punch_v2` | 2 | 0.620 | 3.4 | 43.0% |
| `core_overclock_daemon` -> `cinder_slash` | 2 | 0.670 | 3.5 | 46.3% |
| `brute_force` -> `fire_punch_v2` | 2 | 0.620 | 3.4 | 44.8% |

**Enlarging the deck does not help either.** It moves §2.3 a lot and dead cards barely,
because the metric counts card INSTANCES that reached a hand and went unplayed - a bigger deck
just means more instances seen:

| variant | deck | §2.3 | dead cards |
|---|---|---|---|
| 9 -> 11 cards, all three 2e kept | 11 | 0.630 | 51.5% |
| 9 -> 12 cards, all three 2e kept | 12 | 0.480 | 45.5% |
| 9 -> 11 + `overdrive` swap + stats | 11 | 0.500 | 42.5% |

Only reducing the 2e COUNT moves it. On 2 Energy a 2e card is the whole turn, so three of them
in a 9-card deck means the optimal line is "0e + one 2e" every turn and the five 1e cards are
locked out by construction.

### What landed (option V)

Two 2e cards addressed, but `core_overclock_daemon` - sköll's identity card - is **kept**:

- **`overdrive` cut** from skoll_v1, replaced by a second `fire_punch_v2`.
- **`brute_force` re-costed 2e -> 1e**, 50 (+22 conditional) -> **25 power, +8 with Strength**.
  Score 3.10 against a 3.00 cap.
- **Stats hp 60 -> 70, attack 105 -> 95** (defense unchanged at 55).

The re-cost also closes ticket 29's OS-guaranteed-conditional redline on this card. `brute_force`
took the 0.7 uncertainty discount while TREACHERY_KERNEL makes Strength near-certain; priced as
certain it was 72 power against a 65 cap. At 25+8 it is 33 against 30 - a rounding error instead
of a redline.

| | §2.3 | mirror turns | dead cards |
|---|---|---|---|
| before | 0.690 | 3.4 | 50.9% |
| **after** | **0.640** | **3.7** | **32.3%** |

Both metrics in band. Sköll was the last open first-pass breach.

### The glass cannon, answered

It was never fighting the firmware - the firmware is **over-feeding**. Measured peak Strength on
skoll_v1 is **13.7 stacks in 3.4-turn games** and 16.5 at 4.1 turns, against a 12.5-stack damage
cap and an 8-stack cap on `CORE_OVERCLOCK`'s scaler. The ramp is pinned by turn 2 and everything
after is discarded, which is why dropping that multiplier 1.2 -> 1.10 moved the mirror by 0.02
turns. skoll_v2 hits its `SOLAR_FLARE` requirement (3 Burn) in every game too.

So "gets scarier the more it is hurt" has never played as a *curve* - it is on from turn 2.
Henry's call was to keep the glass cannon but soften it: at 70/95/55 sköll still has the highest
attack and lowest defense of any tuned species, with 10 HP of room for the ramp to be visible
rather than instant.

**Still open, deliberately:** TREACHERY_KERNEL's generosity. Nothing in the card layer can make
that ramp feel like a ramp while the OS saturates it by turn 2. That is a firmware question and
it is the natural next sköll ticket.

### Options measured and not taken

- **Cut `overdrive` + `brute_force`, keep the daemon, add `crimson_draw`** - 0.600 / 3.8 turns /
  31.4% dead. Marginally better numbers, but it adds lifesteal sustain to a glass cannon and
  drops the Strength payoff entirely.
- **Cut `overdrive` + the daemon, keep `brute_force`** (ticket 30's "option G") - 0.570 / 4.3
  turns / 33.8% dead, and requires the 80/85/55 bruiser line. Costs sköll its identity card.
- **Energy 2 -> 3** - 0.700 / **2.6 turns** / 35.8%. Makes games faster, the wrong direction.
- **cardDraw 3 -> 2** - 32.5% dead but §2.3 blows to **0.800**.
