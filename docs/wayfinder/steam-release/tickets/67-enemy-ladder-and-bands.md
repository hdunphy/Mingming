# The enemy ladder, and the three bands the run gate says we are failing (ticket 67)

- Type: wayfinder:grilling
- Status: open
- Assignee: session-67-build (steps 1-2 only; the grilling is Henry's)
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

## Rulings (Henry, 2026-08-26) — read before working this ticket

1. **The IV asymmetry FLIPS.** Player: 0–31 unchanged. **Wilds roll 0–20** (mean 10 — below the player's 15.5; a tunable, bounded edge; no more god-roll wilds wiping early runs). **Elites roll 0–31 uncapped** (elite variance is the elite's spice). **The gauntlet boss gets FIXED authored IVs** per comp — exactly as hard as designed, tuned directly.
2. **Sequencing is BUILD-THEN-GRILL, and no knob moves before the re-measure**: (1) implement the ticket-60 enemy ladder (wilds full kit / NO OS / AI_GREEDY → elites +OS / AI_LITE → gauntlet +OS+Driver / lookahead) + the IV flip above; (2) re-run `balance:run-gate` at full samples; (3) STOP and return the new bands — the numbers session with Henry happens on the real baseline. The −42/−33/−10 misses were measured without the ladder; do not tune against that baseline (deck-archetypes METHOD law).
3. Expected survivor: the gym boss (8.3% from full HP; 4.2% full gauntlet). If the ladder + fixed IVs cannot plausibly reach the 60% band, bring options with numbers to the grilling, do not redesign.
4. **Assembly stat reveal CONFIRMED as shipped**: ?? until the blueprint is spent; the roll is never previewed (planRecruit ruling stands; the mockup's numbers depicted the post-assembly ceremony).

---

> **BEFORE GRILLING ON THESE NUMBERS, READ
> [research/67-gate-validity-and-the-power-ceiling.md](../research/67-gate-validity-and-the-power-ceiling.md).**
> Henry's reaction to the re-measure (2026-08-26) was that the gate is modelling a player who cannot
> exist: it picks the party **blind to the biome's element** (at the boss it brought a favourable
> matchup 7 times in 60, against a 1.5×-per-attack type multiplier the combat code's own experiment
> found produced an 89/11 split), and it fights with the un-shopped starting deck. He also identified
> that **no card in the game is stronger than what a tuned deck already holds** — 148 of 216 programs
> are inside the 12 launch decks — so "build a deck better than the enemy's" is not currently
> reachable. The research note carries the measurements behind both and the three decisions that
> follow — **all three now ruled (2026-08-26): report a control band and a prepared band for every
> number; add a power tier of 2-3 anti-boss cards per deck; and 95/75/60 grade the PREPARED
> player.** The bands below stand as a floor, not as a forecast, and cannot be graded until the
> prepared arm and the anti-boss cards exist.
>
> **THE BOSS DIAGNOSTIC HAS BEEN RUN (2026-08-26, note §10).** The gate now has a `--matchup`
> flag and both of ruling Q1's arms. At the gym boss: **PREPARED 0/60, CONTROL 0/60**, against
> the blind arm's 2/60. The boss is a wall and type advantage cannot rescue it — average battle
> length 5.3 turns, so these are routs rather than near-misses. The anti-boss cards of ruling Q2
> are therefore being asked to carry a 0% fight to 60%, which is worth knowing before they are
> designed, and `BOSS_IVS` may have to move as well.

## THE RE-MEASURE — steps 1 and 2 done, 2026-08-26. Stopping here, as ruled.

The ladder and the IV flip are built; nothing was tuned against them. What follows is the baseline
the grilling happens on. **No knob in this ticket has been moved since these numbers were taken.**

### What was built (steps 1-2 of ruling 2)

**The ladder** — `encounter.ENEMY_LADDER`, replacing `KIT_FRACTION_BY_BIOME`:

| rung | deck | OS | AI | IVs |
|---|---|---|---|---|
| wild | full tuned | **no** | greedy | 0-20 |
| elite | full tuned | yes | lite | 0-31 |
| gauntlet | full tuned | yes | **full lookahead** | 0-31, boss fixed |

Depth stopped being an axis. Every enemy holds the list the balance corpus is calibrated on; what a
rung raises is **how well it plays it**. The grade is by node KIND, so `elite` no longer needs the
special case the old table wrote as *"elites use the deepest rule regardless of depth"*, and
`ambush`/`alpha` are wilds (ticket 07 makes those two special by varying the enemy COUNT, and giving
them a rung as well would be two knobs for one idea).

The tier raises **the wild rung and nothing else** — tier 2 turns its firmware on, tier 3 takes it to
lite, clamped there. An elite already runs firmware and a gauntlet already thinks ahead, so a tier
that touched them would have nothing left to give but a number.

**The IV flip** (ruling 1) is applied exactly as ruled: wilds 0-20, elites 0-31 uncapped, boss fixed
(`gauntlet.BOSS_IVS`). The boss table is **20/20/20 for all three slots** — the mean of the 10-31
band these enemies rolled from before, chosen so that this re-measure isolates what the LADDER did.
A boss handed 26s would make the new number a reading of two changes at once. **That table is the
knob for the grilling**, one triple per slot so a boss can be lopsided on purpose.

**One seam had to be built to make any of it measurable.** The three AI grades existed only as
`AI_GREEDY=1` / `AI_LITE=1` — process-wide switches read once at module load, which is right for
ticket 99's corpus (one grade per run of it) and cannot express three grades inside one game session.
So the grade became a property of the battle: `IBattleState.enemyAiTier`, set at creation exactly as
`enemyMode` is, defaulting to the process value when unset. **The enemy side only** — in a harness
both sides are `getBestAction`, and grading the player too would measure two changes at once.

### The numbers

Sampled at equal `n` **within** each band, so a band is the unweighted mean of its three cells rather
than a figure dominated by whichever cell was cheapest to run. Wall clock **4h 09m** of simulation
across two cores (1,080 battles).

| band | target | **before** (no ladder) | **after** | Δ | 95% CI | verdict |
|---|---|---|---|---|---|---|
| WILDS | 95% | 52.8% (n=36) | **79.5%** (477/600) | **+26.7** | 76.1-82.5 | FAIL by 10.5pt |
| ELITES | 75% | 41.7% (n=36) | **46.3%** (139/300) | +4.6 | 40.8-52.0 | FAIL by 17.8pt |
| GAUNTLET | 60% | 50.0% (n=36) | **51.1%** (92/180) | +1.1 | 43.9-58.3 | FAIL by 1.1pt* |

\* the gauntlet band's interval (±7.2) still straddles the window; the tool flags it `UNDER-SAMPLED`
and it should be read as "somewhere between 44% and 58%", not as 51.1%. The wilds band is the only
one sampled tightly enough (±3.2) for its verdict to be evidence on its own.

Per cell, against the same cells before the ladder:

| cell | before | n | **after** | n | Δ |
|---|---|---|---|---|---|
| `wild:biome0` (1v1) | 67.1% | 1200 | **73.5%** | 200 | +6.4 |
| `wild:biome1` (2v2) | **26.7%** | 120 | **79.0%** | 200 | **+52.3** |
| `wild:biome2` (3v3) | 50.0% | 12 | **86.0%** | 200 | +36.0 |
| `elite:biome0` (1v1) | 36.9% | 1200 | **39.0%** | 100 | +2.1 |
| `elite:biome1` (2v2) | 42.5% | 120 | **48.0%** | 100 | +5.5 |
| `elite:biome2` (3v3) | 41.7% | 12 | **52.0%** | 100 | +10.3 |
| `gauntlet:fight0` | 75.0% | 12 | **68.3%** | 60 | -6.7 |
| `gauntlet:fight1` | 66.7% | 12 | **81.7%** | 60 | +15.0 |
| `gauntlet:fight2` (boss) | 8.3% | 12 | **3.3%** | 60 | -5.0 |

Compounded, clearing all three gauntlet fights is **1.8%** — and still an upper bound, because the
harness does not carry HP between fights.

### The three shapes, re-read

1. **The non-monotonic curve is FIXED.** Both bands now rise with the biome, which is the shape a
   ramp is supposed to have: wilds **73.5 → 79.0 → 86.0**, elites **39.0 → 48.0 → 52.0**. The 26.7%
   trough at biome 1 was the kit-fraction table's middle row — five pure engine cards a body with no
   filler, a *sharper* list than the tuned one — and deleting the axis deleted the trough. This was
   the single biggest movement in the re-measure (+52pt on that cell).
2. **The gym boss survived, as ruling 3 predicted, and it is worse than it looked.** 8.3% was one win
   in twelve; **3.3% is two in sixty**, and 3.3% sits between fights that measure 68.3% and 81.7%.
   The boss is not a difficulty step, it is a different game — with fixed IVs at the old band's mean,
   so this is the same boss finally measured properly rather than a boss made harder.
3. **The IV flip did most of the work at the bottom of the ladder and almost none in the middle.**
   Wilds gained 27 points; elites gained 5. That is the flip behaving exactly as ruled — wilds
   dropped to 0-20 (mean 10, below the player's 15.5) while elites went 10-31 → 0-31, which lowers
   their mean by the same 5 points the wilds lost *and* hands them a low tail they did not have. The
   elite band is nearly where it was.

### What did NOT survive the re-measure, and is the thing to grill on

**The elite band is a bigger miss than the boss, and it has a shape.** 46.3% against a 75% target is
-28.7 before the ladder and **-28.7 after it** — the ladder moved it 4.6 points and the target is
still 29 away. Ruling 3 anticipated the boss as the survivor; on these numbers the ELITE rung is the
one that did not respond.

The common thread across the two misses is the **early solo run**. `elite:biome0` is 39.0% and
`wild:biome0` is 73.5% — both the worst cell in their band — and both are the same fight: **one
mingming, eight cards, against an enemy holding a complete tuned per-OS list.** That is a direct
consequence of the ladder's central choice. Under the old table a biome-0 enemy held the same eight
cards the player did; now it holds a gym leader's deck and merely plays it badly. Against a party of
three with eighteen cards that trade is clearly good (biome 2 wilds went 50% → 86%); against a solo
starter it is the hardest position in the run.

Options with numbers, as ruling 3 asks for — **not applied, and each is one edit:**

- **A fourth rung for biome 0, or a "first biome" clause on the wild rung.** Restores something like
  the old gentlest row for the opening biome only. Directly targets the two worst cells; costs the
  ladder its "one deck everywhere" legibility.
- **Move the wild IV band down again** (0-20 → 0-14, say). Cheapest possible edit, applies evenly,
  and the flip has already shown this lever moves wilds ~27 points for 5 points of mean. It does
  nothing for the elite band, which is where the larger miss is.
- **`BOSS_IVS`** for the boss alone. 20/20/20 today; the boss is the one enemy whose difficulty is
  now a single authored number rather than a distribution, which is what ruling 1 bought.
- **Re-read the targets.** 95/75/60 was ruled against a game whose biome-1 wilds measured 26.7%. A
  95% wild band means a player loses one ordinary fight in twenty across a run of ~8-10 of them —
  worth confirming that is still the intent now that the curve underneath it is monotonic.

### Reproducing this

```
npm run balance:run-gate -- --cells wild:biome0,wild:biome1,wild:biome2 --iterations 200
npm run balance:run-gate -- --cells elite:biome0,elite:biome1,elite:biome2 --iterations 100
npm run balance:run-gate -- --cells gauntlet:fight0,gauntlet:fight1,gauntlet:fight2 --iterations 60
```

Two cores, ~4h 09m total. The 1v1 cells are seconds; the 3v3 cells are 27-57s a battle and are the
whole cost. `--cells wild:biome0 --iterations 1200` is 90 seconds if a single cell needs deepening
between rulings.

### Suite

**1773 green across 128 files** (1768 → 1773). No assertion weakened: the tests that pinned ticket
08's table were **inverted** — `encounter.test.ts` now asserts every rung fields the tuned deck, that
a wild runs no firmware at every depth, that the tier raises only the wild rung, and that a wild's
IVs never exceed 20 while an elite's do. The biome-0 "same cards the player opens with" assertion was
not deleted with the table: it **moved to the scripted opening fight**, which is the one loadout that
still fields it and the ticket-24 ruling the sentence came from. `tsc -b`, `eslint .`, `vite build`
and the debug-absence gate all clean.

### One thing the ladder asks for that does not exist

Ticket 60's gauntlet rung reads *"kit + OS + **Driver**"*. There is no enemy-driver machinery:
`createBattleState` applies `setup.drivers` to the **player's** party only, and there is no registry
or ticket for the enemy side. The gauntlet's boss already carries `boss_relic_*` **signature
firmware**, which is the closest thing in the tree to the +Driver rung and is what ticket 18 built
for that purpose, so that is what the rung ships as. **Building a second enemy-passive system was not
in this ticket and was not invented.** If the Driver was meant literally, it is its own ticket.
