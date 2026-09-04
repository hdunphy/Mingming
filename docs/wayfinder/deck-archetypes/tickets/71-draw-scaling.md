# Draw scaling (ticket 71): "per card drawn" should mean per card you MADE yourself

- Type: wayfinder:task - Henry-approved (2026-08-16: *"fix card draw scaling as well but then
  compensate by increasing the power per draw"*). Designed and implemented in the same session;
  the design agent is out of tokens.
- Status: **closed** (2026-08-16)
- Supersedes: ticket 68's "Deliberately NOT changed" section, which flagged this and did not
  take it. Henry took it.
- Blocked by: ticket 68 (shipped, `6fcfbbf`) - the triggered counter this reads is 68's field.
- Blocks: tickets 69 and 70. Both measure a world this changes; a census taken before it would
  be stale on arrival.

## Why

`CARDS_DRAWN` scaling multiplies resolved damage by `state.cardsDrawnThisTurn`, and that counter
is incremented by the draw-phase refill (HANDOFF `0-DRAW-COUNTER`). So "12 power per card drawn"
is really "12 power per card drawn INCLUDING the three or four the game dealt you", and the card
pays its headline rate on turn one with no draw engine at all. It is the same defect ticket 68
fixed for the *constraint* - fixed there, left standing here.

## Measured (scratch/drawcount.ts, real battles, all three carrier decks x 15 opponents x 4 seeds x 2 sides)

Carrier decks: `kraken_v1`, `jormungandr_v1`, `valkyrie_v2`.

| card | casts | natural-incl mean | TRIGGERED mean | zero-triggered casts | dmg/cast | ratio |
|---|---|---|---|---|---|---|
| `ink_stream` | 886 | 3.71 | 0.92 | 368 (41.5%) | 10.1 | 4.04x |
| `starfall` | 479 | 4.76 | 1.85 | 112 (23.4%) | 8.1 | 2.57x |

The ratio column is the compensation factor: it is exactly how much of each card's damage was
coming from cards it did not earn.

## Change

- **New scaling `CARDS_DRAWN_TRIGGERED`** in `ActionExecutors`, reading
  `state.nonNaturalCardsDrawnThisTurn ?? 0`. `CARDS_DRAWN` is left exactly as it is - the same
  additive discipline ticket 68 used for the constraint, so nothing that wants "any draw" loses
  it.
- **`ink_stream`**: scaling repointed, power **12 -> 48** (12 x 4.04). Text: *"Deal 48 power for
  each card a card, OS or daemon drew you this turn."*
- **`starfall`**: scaling repointed, power **10 -> 26** (10 x 2.57). Text: *"26 power for each
  card a card, OS or daemon drew you this turn."*
- **`powerscale.ts`**: `ASSUMED_CARDS_DRAWN = 3` was a guess and is now wrong for the new
  scaling. Add a separate, measured `ASSUMED_TRIGGERED_CARDS_DRAWN`, cast-weighted across both
  carriers: (886 x 0.92 + 479 x 1.85) / 1365 = **1.25**. `CARDS_DRAWN` keeps its old constant.

## Resolution (2026-08-16)

Two things were wrong with the plan above and the measurements corrected both.

**1. The naive ratio over-compensates by 77%.** `getBestAction` prices a card as it will
actually resolve, so raising the payoff makes the AI sequence its draws before casting and the
triggered mean climbs *with* the power (0.92 at power 12, 1.33 at power 48). Compensation is a
FIXED POINT, not a ratio. Solved by sweep: **`ink_stream` 33, `starfall` 18**, holding each
card's total delivered damage to within 3% of pre-fix.

**2. `kraken_v1` had no real draw engine and the bug had been hiding it.** One power number
cannot serve two decks that earn different numbers of draws: at power 33 `jormungandr_v1` gets
1.75 triggered draws a cast and `kraken_v1` 0.92, so the same card paid them 17.1 and 8.1. Her
four "draw cards" are two `whirlpool_v2` and two `pressure_point`, and `pressure_point` only
draws **if the target is Dazed**. First balance run put control's win rate against `kraken_v1` at
59%, i.e. she beat control 41% - **below the 0.60 control floor**, the only deck to fail it.
Fixed inside this ticket because this ticket caused it: `water_slap` filler -> `undertow`, the 0e
Water draw `jormungandr_v1` already runs. Control's rate against her went to **4%**.

**3. The variance flag below did not survive measurement.** The 41.5% figure was counterfactual -
it counted triggered draws on casts the AI made for other reasons. Post-fix it is **12.9%**.
Kept below as written, because the reasoning was right even though the number was not.

## The design consequence, stated rather than shipped silently

Mean-preserving is not variance-preserving. **41.5% of `ink_stream` casts have zero triggered
draws**, so after this change the card deals *nothing* on nearly half its casts and ~4x its old
damage on the rest. It converts from a reliable 1-Energy baseline attack into a payoff card that
requires a draw engine - the same shape `BURN_TIMES_ENERGY` and `STATUS_CONSUMED` already have,
and arguably what "per card drawn" was always supposed to mean. But it is a real shape change to
three decks, and `kraken_v1` is one of them while ticket 70 is trying to raise her. Flagged to
Henry in the report; the acceptance gate below is what decides whether it stands.

## Acceptance

1. Delivered damage per cast is preserved within tolerance: `ink_stream` ~10.1, `starfall` ~8.1
   (+/- 15%), re-measured on the same instrument.
2. Full unit suite green; `npm run balance` clean.
3. **8-DIFF**: only `kraken_v1`, `jormungandr_v1` and `valkyrie_v2` rows move. Met - 8 of 67
   rows moved, all of them carrier-species rows or the registry-wide control aggregate.
4. FTK 0; dead-card rate <= 0.35/side; control floor >= 0.60 for the three carriers.
5. A test pins that a NATURAL draw contributes zero to the new scaling, and that the two cards
   are wired to it.

## Report

`docs/wayfinder/deck-archetypes/research/draw-scaling.md` - before/after per-cast damage, the
variance table, the 8-DIFF, and an explicit recommendation on whether the `ink_stream` shape
change should stand.
