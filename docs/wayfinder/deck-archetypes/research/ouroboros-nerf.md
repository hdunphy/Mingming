# OUROBOROS nerf (ticket 74): it was the OS, and specifically the DRAW

Henry, 2026-08-17: *"I don't like caps, that makes playing smart feel bad and you'll end turn
with energy. You should be rewarded for playing smart. I think the biggest issue is the power per
card drawn, I'd rather reduce that."* Then, after the sweep: *"I'd rather not cut the deck and
maybe it's an OS issue we can nerf."*

**Shipped:** OUROBOROS_LOOP becomes *"Each turn, the 5th Water card you play draws 1 card."* It
was *"the 3rd Water card you play grants 1 Energy and draws 1 card."* **All of ticket 73 is
reverted** - no scaling caps, `ink_stream` back to 33 power at 1 Energy, `starfall` back to 18.
Not one card changed. `jormungandr_v1`'s deck untouched.

## 1. Why the caps were the wrong lever

Ticket 73 capped the per-event-count scalers. Henry rejected the shape, and the measurement
agrees it was the worst option on the table:

| | Jormungandr field | **Kraken field** | Kraken's ink_stream damage |
|---|---|---|---|
| no fix at all | 90.4% | 42.0% | 4,255 |
| **ticket 73's cap** | 77.3% | **38.9%** | **3,345** |
| this ticket | 50.9% | **44.9%** | 4,394 |

The cap took 3 points of field off **Kraken** to take 13 off Jormungandr, and Jormungandr is the
deck doing the killing. That asymmetry is structural: Kraken earns ~1 triggered draw a turn and
Jormungandr earns 3, so **any** change to the scaler lands hardest on the deck least able to use
it. The same is true of cutting the card's power - at 1 Energy and 12 power, Kraken's damage from
it fell to 306 and she stopped casting it at all.

## 2. Which half of the OS was the problem

One lever at a time, over the 14 cells the census found. Baseline is 43 first-turn kills.

| OUROBOROS reads | worst turn-1 | turn-1 kills | FTK | jorm field | kraken | valk |
|---|---|---|---|---|---|---|---|
| 3rd Water: +1 Energy, +1 draw *(old)* | 100% | 20/600 | **43** | 90.4% | 42.0% | 67.8% |
| 3rd Water: +1 draw only | 100% | 6 | 9 | 83.3% | 42.2% | 68.7% |
| 4th Water: +1 Energy, +1 draw | 100% | 11 | 24 | 78.2% | 42.2% | 70.4% |
| 5th Water: +1 Energy, +1 draw | 100% | 3 | 9 | 58.7% | 43.6% | 71.8% |
| 3rd Water: +1 Energy only | 100% | 3 | 2 | 46.4% | 45.3% | 73.1% |
| **5th Water: +1 draw only (SHIPPED)** | 100% | 1 | **2** | **50.9%** | **44.9%** | **73.1%** |
| 5th Water: +1 Energy only | 84% | 0 | 0 | 42.9% | 45.3% | 73.1% |
| 6th Water: +1 draw only | 84% | 0 | 0 | 39.3% | 46.0% | 73.3% |

**The draw is the lever; the Energy is not.** Removing the Energy alone: 43 -> 9. Removing the
draw alone: 43 -> 2. The Energy paid for the second `ink_stream`; the draw is what took each
`ink_stream` from 66 power to 99. Henry's read of the problem - "the power per card drawn" - was
right about the quantity and this fixes it at the source rather than at the card.

Henry chose **5th Water card, draw only** over the two zero-kill arms deliberately: it keeps the
draw-zoo identity the registry describes and holds `jormungandr_v1` at **50.9%** field rather
than dropping her to 39-43%. *"We still want him to be a good deck."*

## 3. The two kills that survive, and why they are acceptable

**Full-field scan, all 480 cells at 30 iterations x both turn orders: 2 first-turn kills, both in
`skoll_v1` vs `jormungandr`, 2 of 60 games (3.3%). Nothing anywhere else.**

- Type relationship: **Water over Fire** - Jormungandr is type-ADVANTAGED, x1.5 damage.
- Jormungandr must move first.
- She must open holding **both** `undertow`s (2 of her 9 cards) plus a third free card **and**
  both payoff cards.
- The target is Skoll: **76 HP on 27 defence**, the softest relevant frame in the game.

```
Undertow (0e)     -> 0 dmg, draw
Undertow (0e)     -> 0 dmg, draw
Blind Spot (0e)   -> 3 dmg
Ink Stream (1e)   -> 32 dmg
Ink Stream (1e)   -> 41 dmg     Skoll dead at 76 HP
```

Note she reaches **2** drawn cards, not 3 - and in the second surviving case OUROBOROS did fire,
at the 5th Water card, by which point the draw arrived too late to feed anything. The fix works;
what is left is a soft target dying to two copies of a good card on a perfect opening hand with a
type bonus. Henry: *"if it's something super rare that needs the right conditions and type
advantage it might be fine."* Accepted.

**The gate records that acceptance rather than being loosened.** `fieldCensusSuite.ts` grows an
`ACCEPTED_FTK` list: this one cell, allowed up to **8%** (~2.5x the measured 3.3%, so sampling
noise at the default 10 iterations cannot flip the gate). Every other cell is still a hard zero,
and this cell getting worse still fails.

## 4. Gates

- **480-cell scan at 30 iterations: 2 FTKs, both in the accepted cell.** Down from 43.
- `npm run balance` green including both field-census shards.
- Unit suite **841/841**, 64 files. New `ouroborosNerf.test.ts` (8 tests) pins the hook shape,
  the once-per-turn guard, the card text, and that she cannot manufacture Energy on turn one.
  `scalingCaps.test.ts` deleted with the caps; `NewArchetypes.test.ts` restored to asserting that
  a x10 draw count buys x10 damage.
- Redlines 53 -> 54; no card-budget redline added or removed (42 either way).

## 5. The one thing to watch

**`os:jormungandr` went from 98% to 34%** - v1 used to beat v2 in 98% of decided games and now
loses 66% of them. The section-2.3 gap is smaller than it was (96 points -> 32) but it has
crossed the middle rather than landing on it, and it is the extra redline in the count above.

`jormungandr_v1`'s FIELD number is healthy at 50.9%, which is what Henry asked to protect, so
this is a v1-versus-v2 relationship problem rather than a v1 problem. **`jormungandr_v2` is now
the stronger variant and is the deck to look at**, not v1 - which inverts the standing note that
had v1 queued for a cut. That queue entry should be re-read before it is actioned.

## 6. Also cleared

Ticket 73's collateral is gone with the revert: `os:ratatoskr` is back to 31% (it had been driven
to 0% by the play-count cap), `os:kraken` back to 72%, `os:valkyrie` back to 69%, `sleipnir` and
`hraesvelgr` back to their prior values. **`ratatoskr_v1`'s finding still stands though** - she
runs `seed_bomb_v2` x2 behind four 0-cost cards and `echo_chamber_v2`, the same
0-cost-engine-into-unbounded-multiplier shape as `jormungandr_v1`. She never produced a kill, and
after this ticket the engine that would have fed one is gone from Jormungandr but still present
in hers. Worth a look at her next pass, on the merits rather than as a cap casualty.
