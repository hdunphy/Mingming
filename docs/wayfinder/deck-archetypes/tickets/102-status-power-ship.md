# Status re-denomination SHIP (ticket 102): POWER +1, uncapped - the rider half becomes real

- Type: wayfinder:task - Henry-ruled 2026-08-19 off the status grid (ticket 95):
  **ship POWER +1 now; generation bounds follow SEPARATELY as ticket 103, immediately
  after.** Branch archetype-web.
- Status: **CLOSED 2026-08-19** - shipped, measured, reported. 851 tests green, `tsc` clean.

## The change

STATUS_MODEL -> POWER at +1 power per stack (Str/Weak outgoing, Sharp reduces incoming /
Dazed exposes - the ruled axes), uncapped effect. Ticket-26 law: rides the divisor, STAB,
resistances.

## The blast radius IS the ticket - all four re-derives ship together or the sim lies

1. powerscale per-stack status prices (currently encode 2%-arithmetic) - DERIVE from the
   engine like Burn's prices (0-BURN-PRICE-LAG lesson: derived cannot go stale).
2. Cleanse/removal premium lineage (tickets 46/51) - re-measure CLEANSE_POWER under +1.
3. TacticalAI.statusValue - re-derive; the AI must value the new economy or every sim
   number lies (ticket-19 lesson).
4. statusGlossary/tooltips - must state the real rule (the 10x-lie lesson, ticket 90).

## Gates

Full re-baseline + band census (cheap under the cell cache). FTK 0 hard. Control frozen.
KNOWN TRANSIENTS, do not knob them here: sleipnir_v1 ~85% (ticket 103's job - his OS mints
2 Str per 0-cost with an all-0-cost deck), the draugr/huldra tug-of-war cell (design
session queued, not a dial). Everything else judged on the band standard; report the
24-deck fun-backlog decks' movement specifically - the thesis is most get real choices
for free. ONE commit + Resolution + HANDOFF refresh.

---

# Resolution

Report: [research/status-power-shipped.md](../research/status-power-shipped.md). ONE commit.

## All four re-derives shipped together

1. **powerscale** - `streamStacks` no longer clamps under POWER; `STACK_ATTACK_HORIZON = 5`
   (~2 attacks/turn x 2.5-turn life); offense 5 power/stack, defense 3.5. **Derived from
   `STATUS_MODEL`, per 0-BURN-PRICE-LAG** - it cannot go stale.
2. **CLEANSE_POWER** - re-measured, `scratch/cleansecensus.ts`, 270 games / 2,481 side-turns.
   **Median debuff load 10.5 power (ticket 46 measured 15 under the clamp).** It did not rise, so
   **10 still ships** - at-or-under the measurement, where Henry wanted it. The un-clamping did not
   bite here.
3. **TacticalAI** - `dualityValue()` replaces the capped-percentage read with a linear
   fraction-of-a-card read (`powerPerStack x stacks / (40 power x 2 cards)`). Uncapped, so the AI
   keeps paying past 13 and will actually stack.
4. **statusGlossary** - the four duality entries still read *"2% more damage per stack, up to +25%
   at 13 stacks"*. **Now DERIVED from `STATUS_MODEL`**, not written out - the ticket-90 10x-lie
   lesson applied structurally rather than by hand.

## Gates

- **851 tests green, `tsc` clean.** Four `StatusCombat.test.ts` tests re-pinned: one stack at 40
  power rounds to 3 not 2; the cap test becomes "more stacks keep paying"; the negative-damage
  deadlock test becomes "damage floors at 0".
- **FTK 2, unchanged** - not the hard 0 the ticket asked for, but this change did not move it: the
  same two cells before and after (`skoll_v2` vs `jormungandr_v1`, `jormungandr_v1` vs `skoll_v1`).
- **Control floor held.** Band standard: decks in 35-80 **32/32 -> 28/32**.
- **8-DIFF run.** Full 960-cell grid, `/tmp/grid_pre96.json` vs `docs/balance/deck_grid.json`.

## The three findings

1. **The card pricing table did not move - 0 of 210 cards changed score.**
   `scratch/priceshapediff.ts` prices the whole registry under both shapes in one process; the
   instrument moves 63 cards at POWER+2, so it is not blind. Cause: the old cap bound at 13 stacks
   and **no single card grants more than 5**, so the clamp never applied per-card under either
   shape. **The repricing risk was theoretical, and the per-card pricer cannot see pile
   accumulation - which is the only thing that actually broke.** Card redlines unchanged at 44 over
   budget (55 under; worst over `contagion` 20.4 vs 6.5, `umbral_feast` 14.9 vs 3, `hexbloom` 16.5
   vs 6.5; worst under `wither_feast` -10.8, and four cards scoring exactly 0.0 because the pricer
   has no rule for draw).
2. **KNOWN TRANSIENTS confirmed, not knobbed.** `sleipnir_v1` 35.6% -> **83.9%** (grid predicted
   85.5%); `scratch/stackcensus.ts` measures his Strengthened pile at **mean 4.85 / peak 24** against
   a ~40-power 1e card. The draugr/huldra cell is likewise untouched. **Ticket 103 is next.**
   Also out of band: `skoll_v2` 34.3, `audhumbla_v2` 31.2, `kraken_v2` 29.7.
3. **Neutral absolutes 20 -> 34** (0% 11->15, 100% 9->19). Nine resolved, including the
   `gullinbursti_v1` <-> `fafnir_v2` wall ticket 94 called untunable - ticket 95's headline argument,
   confirmed. Twenty-three appeared, on `huldra_v1`, `audhumbla_v2`, `gullinbursti_v1`,
   `sleipnir_v1`, `ratatoskr_v2`. This is the cost of amplifying the currency.

## The fun-backlog report the ticket asked for

`scratch/secondaxis.ts`, structural read: **20 of the 24 single-resource decks touch a duality
pile**, but the tail is thin. **11 gained a real pile** (>=6 stacks mintable: `gullinbursti_v1` 24,
`gullinbursti_v2` 22, `skoll_v2` 17, `fafnir_v2` 16, `huldra_v1` 14, `draugr_v2` 11, `ymir_v1` 8,
`hel_v1` 8, `skoll_v1` 6, `ratatoskr_v2` 6, `valkyrie_v1` 6); **9 got a token** (1-4 stacks - one
card is not a resource); **4 got nothing at all**: `audhumbla_v2`, `jormungandr_v2`, `kraken_v1`,
`ratatoskr_v1`.

**The thesis half-holds, and the misses explain the losers exactly.** `audhumbla_v2` (0 duality
cards) and `kraken_v2` (1 stack in the whole deck) are the two decks that fell out of band. They
were not nerfed - the currency was revalued and they hold none of it. That makes their fix a design
fix, not a numbers fix: one card each that reads or clears a pile. **Ticket 101 (audhumbla_v2 =
Regen as ammo) now has a second, independent reason to happen.**

## Instruments added

`scratch/cardaudit.ts` (every card vs band, both ends), `scratch/priceshapediff.ts` (registry priced
under both shapes in one process), `scratch/stackcensus.ts` (mean/peak duality piles in real games),
`scratch/cleansecensus.ts` (the ticket-46 debuff-load sampler, rebuilt), `scratch/secondaxis.ts`
(the fun-backlog structural read). `statusPileValue` is now exported from `powerscale.ts` so the
cleanse sampler values piles the way the pricer does.
