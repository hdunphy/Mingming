# The enemy ladder, and the three bands the run gate says we are failing (ticket 67)

- Type: wayfinder:grilling
- Status: open
- Assignee:
- Blocked by: [61](61-apply-60.md)
- Phase: Vertical Slice

## Why this exists

Ticket 61 built `npm run balance:run-gate` and pointed it at the game. **All three bands fail, two of
them by more than thirty points**, and the shape of the failure is not the shape a tuning pass fixes.

| band | target | measured | miss |
|---|---|---|---|
| WILDS | 95% | 52.8% | -42pt |
| ELITES | 75% | 41.7% | -33pt |
| GAUNTLET | 60% | 50.0% | -10pt |

Per cell, with the two cheapest re-run to 1,200 samples so their misses are not noise:

| cell | n | win rate |
|---|---|---|
| `wild:biome0` | 1200 | 67.1% |
| `wild:biome1` | 120 | **26.7%** |
| `wild:biome2` | 12 | 50.0% |
| `elite:biome0` | 1200 | 36.9% |
| `elite:biome1` | 120 | 42.5% |
| `elite:biome2` | 12 | 41.7% |
| `gauntlet:fight0` | 12 | 75.0% |
| `gauntlet:fight1` | 12 | 66.7% |
| `gauntlet:fight2` (boss) | 12 | **8.3%** |

Clearing all three gauntlet fights: **4.2%** — and that is an upper bound, because the harness cannot
carry HP between fights.

Ticket 61's package 2 (the enemy ladder) was written *before* any of this was measured and never
built. It belongs with the numbers rather than on its own, which is why it is here.

## The three questions for Henry

Each is a design decision an implementation agent may not make.

1. **The IV asymmetry.** `createMingmingInstance` rolls the player `nextInt(0, 31)` — mean 15.5.
   `encounter.ts:416-418` rolls enemies `nextInt(10, 31)` — mean 20.5, with a floor the player has no
   equivalent of. **Every enemy in the game out-rolls the player by about 5 in every stat.** Is that
   deliberate (a difficulty knob, and the ladder should be rebuilt around it) or is it a leak? It is
   upstream of all three bands and the single cheapest thing to test a change against.
2. **The kit fraction is not monotonic.** Biome 1 (26.7%) is *harder* than biome 2 (50.0%) and much
   harder than biome 0 (67.1%). Ticket 08's table produces a spike in the middle rather than a ramp,
   and the likely mechanism is concentration rather than size — biome 1 fields five pure engine cards
   per body with no filler, biome 2 fields the nine-card tuned list. Should difficulty ramp with
   biome at all, and is package 2's "kill the `kitFraction` knob" still the answer now that we can
   see what it produces?
3. **The gym boss is not in the same game as the two fights before it** — 8.3% against 75.0% and
   66.7%, and that is from full HP, which a real gauntlet is not. Ticket 18's own smoke run said the
   same thing in 12 battles. Is the boss meant to be a wall, and if so is 60% the right band for a
   gauntlet whose last fight is one?

## The build that follows, once those are ruled

Ticket 61's package 2, verbatim, plus whatever the answers change:

- wilds = full tuned kit, **no OS**, `AI_GREEDY`
- elites = kit + OS, `AI_LITE`
- gauntlet = kit + OS + Driver, full lookahead
- tier field wires: tier 2 = wild OS on; tier 3 = wild AI lite
- remove the `kitFraction`-by-depth knob

## Done when

`npm run balance:run-gate` reports all three bands inside ±5, at a sample size whose Wilson interval
is narrower than the window (the tool flags `UNDER-SAMPLED` when it is not), and the per-cell table
shows no non-monotonic step the ruling did not ask for.

## Notes for whoever takes it

- The gate's default invocation is 8m 23s because six of nine cells are 3v3 (30-70s a battle).
  `--cells wild:biome0 --iterations 1200` is 85 seconds and lands inside ±5, so iterate on one cell
  and only run the full board to confirm.
- The harness does **not** model gauntlet HP carry, so every gauntlet number reads high against a
  played run. Fixing that needs `persistedHp` on `ComposedSetup`, which is a versioned scenario
  format with 51 committed files behind it — its own decision.
- The gate's decks are the **un-drifted opening decks** (no market or workshop purchases), so the
  wild and elite bands read low against a played run. That is the conservative direction.
