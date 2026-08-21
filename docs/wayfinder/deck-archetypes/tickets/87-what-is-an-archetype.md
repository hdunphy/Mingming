# What an archetype could actually be (ticket 87)

- Type: wayfinder:research - Henry-directed, 2026-08-18. **Report only, nothing shipped.**
- Status: **closed** (2026-08-18). Branch `archetype-web`.

Follows ticket 86. Henry: *"maybe these categories don't inherently make sense because we made it
that bigger cards deal more damage. If they didn't a 'ramp' deck would just play more smaller
cards... what could we do to make the deck archetypes more impactful? And what criteria do we have
for naming each deck? Burst doesn't really make sense either."*

Report: [research/what-is-an-archetype.md](../research/what-is-an-archetype.md).
Instrument: `scratch/shape.ts` - damage curve by turn, spike ceiling, cards and Energy per turn.

## The impasse, with a number on it

**Every deck has the same economy.** `energy: 2` on 14 of 15 species, `cardDraw: 3` on 12 of 15.
Nothing grows, nothing is starved - **there is no ramp in the game because there is nothing to ramp
to.** And the budget rule (`50 x Energy - 10`) prices the two resources against each other: per
turn, **2 Energy buys 90 power and three 0-cost cards buy 30.** Energy is worth three times what
cards are worth, by our own pricing rule - so **the deck built to spend cards is spending the cheap
resource.** Meanwhile the premium for going big is only +12.5% at 2e / +16.7% at 3e, and no deck can
reach 3e reliably on a 2-Energy frame. Both halves of the trade-off Henry described are nearly inert.

## Measured: no role's signature matches its name

18 decks profiled, 120 games each. Averages by role today:

| role | cards/turn | slope (late/early) | spike (best turn) |
|---|---|---|---|
| ZOO | 3.63 | 0.71 | **41.9%** |
| CONTROL | **3.53** | 0.67 | 30.7% |
| BURST | 2.71 | 0.89 | **37.5%** |
| RAMP | 2.01 | 0.95 | 31.2% |

- **ZOO is not wider than CONTROL**, and the widest deck in the game is `ratatoskr_v1` at **5.91
  cards a turn** - a CONTROL deck, 60% clear of the field. **Henry is right that it is a zoo deck:
  it is the only deck with zoo's resource profile** (3 Energy, 4 draw, 55% of the list free).
- **BURST spikes LESS than ZOO** (37.5% vs 41.9%). "Burst" describes the hand (few big cards), not
  the outcome (a big turn).
- **RAMP is flat** (0.95). The most back-loaded deck on the roster is `nidhoggr_v1` (1.23x), a BURST
  deck, and the entire roster fits in a 0.38-1.23 band.
- The one honest label is `hel_v2`: slope **0.38**, spike **50.7%** - a genuine all-in-early deck.

## Six levers, ordered by leverage

1. **Vary the resource line per species** (`energy` 1-3, `cardDraw` 2-5). `ratatoskr`'s 3/4 already
   produces 5.91 cards a turn from the same pool - the natural experiment is already in the repo.
2. **Let Energy GROW** for decks meant to ramp. Without this, ramp cannot exist as a strategy.
3. **Steepen the big-card premium** (`50E-10` gives only +12.5% at 2e). This is *the* number behind
   the impasse - and re-prices the whole pool, so it is a big swing.
4. **Raise what a CARD is worth** for card-based decks - either the 0e budget or, safer, per-card
   payoffs (ticket 86: `stampede` 11 -> 16 moved `sleipnir_v1` 34.5 -> 68.8).
5. **Give CONTROL a denial axis.** `huldra_v1` deals **1.1 damage per card** and beats the sustain
   cluster **76%** - denial works, it is just not systematised. Energy and card denial are unbuilt.
6. **Make TIME legible to cards.** No turn-indexed effect exists anywhere in the pool.

## Naming: compute the role, do not assert it

| tag | test |
|---|---|
| **WIDE** | >= 3.5 cards/turn |
| **TALL** | best turn >= 40% of a health bar |
| **FAST** | slope <= 0.70 |
| **LATE** | slope >= 1.10 |
| **DENIAL** | lowers opponent damage/turn >= 15% (one instrument away) |

Tags are not exclusive - `hel_v2` is WIDE+TALL+FAST, `huldra_v1` is FAST with no spike (a denial
profile), `nidhoggr_v1` is LATE. **Renames argued for: BURST -> TALL, ZOO -> WIDE, RAMP -> LATE,
CONTROL -> DENIAL** - each with a test attached, so a deck that fails its own tag is a bug rather
than a matter of taste.

## Recommendation

1. Ship ticket 86's conversion premium (measured, one number per deck).
2. Spread the resource line - cheapest structural change, biggest effect.
3. Decide whether ramp should exist at all (lever 2). That is a game-design call, and whether
   ZOO/RAMP/CONTROL can ever be a cycle depends entirely on it.
4. Adopt the computed tags as the vocabulary for the next pass.
