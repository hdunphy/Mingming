# OUROBOROS nerf (ticket 74): fix the first-turn kill at the OS, not the card

- Type: wayfinder:task - correctness. Henry-directed, 2026-08-17.
- Status: **closed** (2026-08-17)
- Supersedes: ticket 73's scaling caps and card-power changes, which are fully reverted.

## Why

Ticket 73 stopped `jormungandr_v1`'s first-turn kill by capping the per-event-count scalers.
Henry rejected the shape: *"I don't like caps, that makes playing smart feel bad and you'll end
turn with energy. You should be rewarded for playing smart. I think the biggest issue is the
power per card drawn, I'd rather reduce that."* Then, after seeing what a rate cut did to Kraken:
*"I'd rather not cut the deck and maybe it's an OS issue we can nerf."*

The measurement backed the objection. A cap or a rate cut both act on the SCALER, and the scaler
is shared by three decks with wildly different draw engines - Kraken earns ~1 triggered draw a
turn, Jormungandr 3 - so every version of that fix cost the deck that could least afford it and
barely touched the one doing the killing.

## Change

- **OUROBOROS_LOOP**: *"Each turn, the 3rd Water card you play grants 1 Energy and draws 1 card"*
  -> *"Each turn, the 5th Water card you play draws 1 card."* Two edits in `hooks.json`: the
  counter threshold 3 -> 5, and the `ENERGY` action removed from the trigger's `do`.
- **Ticket 73 reverted in full**: `DRAW_SCALING_CAP` and `PLAY_COUNT_SCALING_CAP` deleted,
  `ink_stream` back to 33 power at 1 Energy, `starfall` back to 18, "up to 2" removed from both
  card texts. `scalingCaps.test.ts` deleted; `NewArchetypes.test.ts` restored.
- **`fieldCensusSuite.ts` grows `ACCEPTED_FTK`** - a named, bounded allowance list, so the one
  accepted cell stays visible instead of the gate being loosened.
- No card changed. No deck changed.

## Resolution

Report: [research/ouroboros-nerf.md](../research/ouroboros-nerf.md). Instruments:
`scratch/osarms.ts` (one arm per process - the firmware registry builds hooks once, lazily, so an
arm has to mutate `hooks.json` before the first battle), `scratch/osdetail.ts` (per-cell detail
and replay).

**The DRAW was the lever, not the Energy.** Over the 14 cells the census found, from 43 kills at
baseline: removing the Energy alone -> 9; removing the draw alone -> **2**. The Energy paid for
the second `ink_stream`; the draw took each `ink_stream` from 66 power to 99. Henry's read of the
problem was right about the quantity - this fixes it at the source instead of at the card.

Shipped arm chosen over two zero-kill alternatives (5th card Energy-only, 6th card draw-only)
because it keeps the draw-zoo identity and holds `jormungandr_v1` at **50.9%** field instead of
39-43%: *"we still want him to be a good deck."*

**Full-field scan, 480 cells at 30 iterations x both turn orders: 2 FTKs, both `skoll_v1` vs
`jormungandr` (3.3% of that cell), nothing else anywhere.** Accepted by Henry - Jormungandr is
type-advantaged (Water over Fire, x1.5), must move first, must hold both `undertow`s AND both
payoffs, into the softest frame in the game at 76 HP / 27 defence. Recorded in `ACCEPTED_FTK`
with an 8% ceiling.

Gates: `npm run balance` green including both census shards; 841/841 unit tests; redlines 53 ->
54; no card-budget change.

**Watch item:** `os:jormungandr` went 98% -> 34%. v1's FIELD number is healthy at 50.9%, but
**`jormungandr_v2` is now the stronger variant** - which inverts the standing queue entry that
had v1 down for a cut. Re-read that before actioning it.
