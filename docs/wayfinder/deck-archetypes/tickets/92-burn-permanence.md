# Permanent Burn measured, and the zeros confirmed by hand (ticket 92)

- Type: wayfinder:research - Henry-directed, 2026-08-19. **Measurement + dial only, no balance change shipped.**
- Status: **closed** (2026-08-19). Branch `archetype-web`.

Report: [research/burn-and-playtest-2.md](../research/burn-and-playtest-2.md).

## Burn

Henry: *"I thought it was supposed to be permanent and not decrement between turns. If we change
that to stick between turns will that make anyone OP?"*

**He remembered right** - `power_curve_spec.md` rev 3 changed Burn from permanent to 1 stack a
turn. **And yes, exactly one deck breaks.** Measured with `BURN_CONFIG.decayPerTurn` 1 -> 0, cap
and tiers and detonation untouched:

| deck | live | permanent | delta |
|---|---|---|---|
| `hraesvelgr_v2` | 60.2% | **75.5%** | **+15.3**, >90% cells **4 -> 12** |
| `fenrir_v2` | 47.2% | 56.7% | +9.5 |
| `skoll_v2` | 36.8% | 35.7% | -1.1 |

The cause is one card: **`firestorm_talon`** multiplies by the target's Burn stacks, so against a
decaying pile it has to be timed and against a permanent one it compounds. `fenrir_v2` at 56.7% is
the healthy case - his Burn is largely self-inflicted, so permanence pays him for a cost he was
already carrying.

Three ways to have permanence if Henry wants it, in the report: reprice `firestorm_talon` (cap the
Burn it reads at the stack cap), lower the detonation cap alongside, or slow the decay to 1 every
other turn rather than removing it. `decayPerTurn` now exists as a dial so any of them is a sweep,
not a rebuild. **Shipped value is 1 - current behaviour, unchanged.**

## The B block answered its question: the zeros are REAL

Henry piloted all three of the neutral 0% cells the AI loses 0-of-60. **He lost all three**, and
named the mechanism in each:

- **B1** `kraken_v1` vs `audhumbla_v1` - *"Audhumbla gets so much energy and then plays supernova
  and crushes me for 23 HP."* The Energy engine, which is ticket 88's finding from the receiving end.
- **B2** `draugr_v2` vs `huldra_v1` - *"the draugr payoff card keeps getting countered by the
  sharp, so my payoff was only doing 4 dmg."* His payoff counts DISTINCT negative statuses and
  **Dazed and Sharp annihilate stack for stack**, so huldra deletes the statuses it counts. Nothing
  in the balance suite can see that; it reads as a card underperforming.
- **B3** `fafnir_v2` vs `gullinbursti_v1` - *"Stone Fist hits too hard and Fafnir has no real
  payoff cards."* Correct on both counts.

**The 13 neutral zero cells are now confirmed balance bugs rather than suspected AI artifacts.**
That retires the hypothesis and promotes them to the top of the queue.

Also recorded, and my fault: *"Its really frustrating to play the low damage decks that have no
chance."* The B block handed him the three worst matchups in the game back to back because that was
the cheapest test of the hypothesis. **Round 2 should be balanced matchups and decks worth playing**,
with at most one diagnostic cell in it.

## Queue after this

1. `audhumbla_v1`/`v2` - strongest deck and half the remaining absolutes, now confirmed by hand.
2. The Dazed/Sharp annihilation as it hits `draugr_v2`'s payoff - a design bug, not a tuning one.
3. `fafnir_v2` needs a payoff card, not another stat point.
4. Burn permanence, if wanted, with `firestorm_talon` repriced in the same ticket.
