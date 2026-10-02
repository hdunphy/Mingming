# Ticket 164 — Eight fixes from the 2026-09-26 code review

**Type:** engine + AI + sim harness. **Status:** RULED by Henry on 2026-09-26: *"please create a handoff plan to fix these bugs"*. The eight bugs below are the ones to fix, and **only these eight**. The review found more (`research/code-review-2026-09-26.md`). Everything not listed here stays as it is, even where it sits in the same file you are editing:

- the AI beam slice;
- the AI reading draw order;
- the lookahead seeds;
- the hand-value energy;
- the 50%/51% HP split;
- the Sky Burial tokens;
- double death processing;
- `crypto.randomUUID`;
- all of section C of the review (plain bugs);
- all of section D of the review (performance);
- the walker's gauntlet HP carry and its Driver stakes.

**Relates to:** 48 (Asleep), 53 (REBIRTH_CYCLE / `onDeckShuffled`), 137 (the AI reads the engine's status constants), 144a (the AI may not read draw order), 162a (which caster a conditional sees), 163d/163e (patches in a run, the patch price sweep), 157 (the walker). Also relates to `d30106e`, the enemy first-hand fix: row 164c is the player-side twin of that bug.

---

## Rows, in the order to take them

The ordering principle: **the PRNG goes last.** Every other row is measured before/after on the current generator and the same seeds, so each row's A/B is clean. Then 164h reseeds everything, and a single re-baseline follows, the one already owed since `d30106e`.

| row | bug | area | moves numbers? |
|---|---|---|---|
| 164a | The AI thinks Burn wears off each turn; it doesn't | AI eval | yes, for Burn decks |
| 164b | Attacks never chip or wake a sleeping unit | engine | yes, for Asleep decks and whoever hits them |
| 164c | The player's turn 1 skips the start-of-turn step | engine | yes, for every deck with an `onTurnStart` hook |
| 164d | Valkyrie's rebirth only fires from party slot 0 | engine | 3v3 only; 1v1 is unchanged by construction |
| 164e | Reprogram / Echo / VALHALLA replay both branches of a two-branch card | engine | yes, for replay users |
| 164f | Patches never reach a simulated fight | sim harness | walker only (instrument change) |
| 164g | In the walker, blueprints and recruits are free | sim harness | walker only (instrument change) |
| 164h | The random-number generator repeats after 7,298 values | engine core | **everything** (reseed) |

---

## 164a — Burn is permanent; the AI prices it as if it decays

**What is wrong.** `burnTotalPercent` in `src/engine/ai/TacticalAI.ts` (around line 110) walks the tier table from S down to 1, which models Burn losing one stack per turn. But `BURN_CONFIG.decayPerTurn` has been **0** since ticket 93 (`StatusBehaviors.ts`, around line 275): Burn is permanent, so the engine pays `tier[S]` every turn. Over the eval's `STATUS_HORIZON_TURNS` (2.5), the AI undervalues Burn:

| Burn stacks | AI's value (% max HP) | engine pays (% max HP) | undervalued by |
|---|---|---|---|
| 1 | 1.5% | 3.75% | 2.5× |
| 2 | 4.5% | 7.5% | 1.7× |
| 3 | 9.5% | 12.5% | 1.3× |
| 4 | 17.5% | 20% | 1.14× |

This is the same "the price lags the engine" pattern ticket 137 fixed for Regen. `aiStatusPricing.test.ts` has no Burn case, which is why it slipped through.

**Fix.**
1. Derive the walk from `BURN_CONFIG.decayPerTurn`, not from a hardcoded 1. Simulate the horizon tick by tick: on tick `t` the stack count is `max(0, S − t·decay)`, and the final half tick (horizon 2.5) is weighted by its fraction.
2. With `decayPerTurn = 0` this reduces exactly to `tier[S] × STATUS_HORIZON_TURNS`. Keep the existing ticket-44 cap (`perTurn × horizon`) as it is; it becomes the same number.
3. Do not model detonation or defense shred here. They are not part of this bug.

**Tests.** Add them to `aiStatusPricing.test.ts`, beside the ticket-137 blocks.
1. For 1–4 stacks, `statusValue(Burn)` equals the engine's per-turn tick × `STATUS_HORIZON_TURNS`. Read the tick by running `getStatusBehavior('Burn')` on a `HUGE_HP` frame, the way the Poison test does. This test must fail on the parent.
2. With `BURN_CONFIG.decayPerTurn` temporarily set to 1 (restore it in `finally`), the value equals the old decaying walk. This proves the eval follows the constant rather than holding its own copy.

**Measure.** `BALANCE_ONLY=<species> npm run balance` for the Burn decks, before and after: `fenrir_v1`, `fenrir_v2`, `skoll_v2`, `hraesvelgr_v1`, `hraesvelgr_v2`. Report the field-rate deltas. **Do not tune anything off them.**

---

## 164b — Real attacks never chip or wake Asleep

**What is wrong.** Ticket 48's rule is that Asleep loses one stack per incoming attack. It lives in `handleAttack` (`src/engine/effectHandlers.ts`, around line 169) and is gated on `sourceId !== 'SYSTEM'`. But `handleAttack` has exactly **one** caller, `applyMutations` (`src/engine/resolutionEngine.ts`, around line 47), and that caller always passes `sourceId: 'SYSTEM'`. So the rule never fires for anything:

- sleepers only wake by the natural 1/turn decay;
- `onStatusRemoved` / StableOS-on-wake never happens from a hit;
- `glacier_wall`'s "fully absorbed hit still counts" branch is dead.

The one existing test calls the handler directly with a real source, which is why it passes. The review's probe: `fire_punch_v2` on an Asleep(3) target did 106 damage and left Asleep at 3.

**Fix — key the rule on the damage's CAUSE, not on the source id.**
- `AttackExecutor` already stamps `cause: 'attack'` (or `'recoil'` for self-hits) on its HP mutation (`ActionExecutors.ts`, around line 474), and `applyMutations` already forwards `cause`.
- Change the sleep check to fire only when `cause === 'attack'` **explicitly**. Do not use `cause ?? 'attack'`, the defaulting the event emit does below it.
- The other HP-mutation callers carry no cause or a non-attack one. That keeps ticket 48's other half intact: *"statuses do not wake him"*. The callers are:
  - `TriggerStatusExecutor`;
  - `HookFactory` HP actions;
  - firmware recoil (`CustomFirmware.ts`);
  - tolls.
- **Do not change the `sourceId: 'SYSTEM'` that `applyMutations` passes.** Passing the real source would also re-attribute the damage ledger and could wake up other source-dependent code in `handleAttack`, and that is not this bug.
- Put the predicate in its own small function, for example `chipsSleep(cause)`, with a comment that names ticket 48's two halves.

**Stop and ask Henry if** you find a multi-hit card's per-hit mutations chipping one stack per HIT. That is the literal reading of "per incoming attack", but it means a 3-hit card wakes a fresh sleeper in one play. Report the cards affected and let him rule per-hit or per-card before committing.

**Tests.**
1. Through the REAL reducer (`PLAY_PROGRAM`), not the handler: an attack card on an Asleep(3) target leaves 2 stacks. The third attack wakes the target and emits `STATUS_REMOVED`.
2. A `TRIGGER_STATUS` detonation and a Burn tick on a sleeper do **not** chip.
3. Both must fail/pass as expected against the parent: test 1 fails on the parent, test 2 passes on both.

**Measure.** The Asleep appliers (grep `hooks.json` and `programs.json` for `Asleep`; at least the `draugr` decks), plus a field row for anyone whose win rate leaned on sleepers staying asleep. Report; don't tune.

---

## 164c — The player's turn 1 skips the pre-turn step the enemy gets

This is the same seam as `d30106e`, from the other side.

**What is wrong.** `createBattleState` (`src/engine/data/battleFactories.ts`, around lines 359–370) builds the player's first turn by hand: it deals `playerCardDraw` cards and never runs `processPreTurn` (`battleReducer.ts`, around line 1296). Every other turn start, both sides', goes through `processPreTurn`. So on turn 1:
- **The player's `onTurnStart` hooks never fire.** Ymir has no Bark Shield on turn 1 and has Bark Shield 4 on turn 2. The same is true of gullinbursti, fafnir_v2, and the deep_cache / first_blood per-turn resets. The enemy's first turn does fire its hooks.
- **The opening draw counts downed gauntlet members.** The creation formula sums `cardDraw` over the whole party, while `processPreTurn` counts living units only. A gauntlet fight with one member at `persistedHp` 0 opened on 10 cards; every later refill was 7.
- **`cardsDrawnThisTurn` is 0 on turn 1** and equals the refill on every later turn, which affects anything scaling on `CARDS_DRAWN`.

`buildScenarioState` (the sim's twin of the factory) has the same hand-built turn 1.

**Fix — one path for every turn start, no second copy of its steps.**
- Extract the body of `processPreTurn` into a single-purpose function, for example `beginTurn(state, side, turnNumber)`. It covers everything after the side toggle:
  - TURN_START emit;
  - energy refill and Energized;
  - the OWNER_TURN_START status tick;
  - `onTurnStart` hooks;
  - the refill draw over living units.
- `processPreTurn` becomes "toggle the side, then `beginTurn`".
- Both factories stop drawing the player's opening hand. They build turn 1 with an empty hand and hand the state to `beginTurn(state, 'PLAYER', 1)`.
- If exporting it from `battleReducer.ts` creates an import cycle with the factories, move `beginTurn` and what it needs into its own module (for example `src/engine/turnStart.ts`) rather than duplicating anything.
- `drawCards` consumes the PRNG only on a reshuffle, so the player's opening cards should come out the same.

**Check before committing, and say what you found in the commit:**
1. Do any statuses exist at creation? Examples would be a Driver or `onBattleStart` hook applying Burn or Regen, or a gauntlet carrying statuses. If so, they now tick on turn 1. Name them.
2. The TURN_START emit now happens at battle creation: the "your turn" banner and the `turnPlayer` sound. Confirm the UI shows one banner, not two. `useBattleVfx` subscribes before or after the state lands, so check which.
3. Does the run log treat the creation-time TURN_START correctly? It ignores events while `fightOpen` is false.

**Tests.**
1. A new `playerTurnOne.test.ts`, through the real factory: a Ymir player has Bark Shield on turn 1.
2. A party with a member at `persistedHp` 0 opens on the living-units draw count.
3. `cardsDrawnThisTurn` on turn 1 equals the opening draw.
4. The same three via `buildScenarioState`.

All of these fail on the parent.

**Measure.** Field rows for the `onTurnStart` decks (grep `hooks.json` for `onTurnStart`, at least `ymir_*`, `gullinbursti_*`, `fafnir_v2`), plus `npm run balance:walk -- --seeds 200 --fight 1` for the opener. Report; don't tune.

---

## 164d — Valkyrie's REBIRTH_CYCLE only fires when she is in slot 0

**What is wrong.** `executeDraw` (`src/engine/resolutionEngine.ts`, around line 572) dispatches `onDeckShuffled` once, with `source` set to the shuffling side's `party[0]`. That happens even when slot 0 is dead, and even when the draw carried a real `sourceId`. `valk_v2_rebirth` (`hooks.json`, around line 1022) requires `source: SELF`, so it fires only when Valkyrie sits in slot 0. In the review's probe, the same reshuffle with Valkyrie in slot 0 hit the enemy for 35 and healed her; in slot 1, nothing happened. It is the only `onDeckShuffled` consumer in the registry.

**Fix.** The deck is shared, so a reshuffle happens to the whole side. Dispatch `onDeckShuffled` **once per LIVING member of the shuffling side**, each as its own `source` and `target`. That is exactly how `processPreTurn` dispatches `onTurnStart` (`battleReducer.ts`, around line 1358). Consequences:
- A dead Valkyrie no longer fires.
- Two Valkyries (duplicates are legal) each fire.
- Nothing else listens, so no other deck changes.
- Keep the loop-safety comment ticket 53 wrote. It still holds: the hook does not draw.

**Tests.**
1. A 3v3 fixture that forces a reshuffle, with Valkyrie v2 in slot 1: the hook fires. It fails on the parent.
2. Valkyrie dead in slot 0 with a living ally: no fire.
3. Two living Valkyries: two fires.

**Measure.** 1v1 is unchanged by construction; a `BALANCE_ONLY=valkyrie npm run balance` row should confirm it bit-identical. The movement is 3v3: run the comp grid rows that field `valkyrie_v2` (`scratch/compshard.ts` / `compgrid.mjs`, per the HANDOFF). Report; don't tune.

---

## 164e — Replays fire both branches of a two-branch card

**What is wrong.** A card's action-level `conditionals` are evaluated in exactly one place: the reducer's player path (`battleReducer.ts`, around lines 503–565), with the ticket-162a caster rule. The two replay paths re-run every action and never check `conditionals`:
- `PlayLastCardExecutor`, used by Reprogram and the Echo macro (`ActionExecutors.ts`, around lines 1037–1061);
- `resolveProgramFree`, used by VALHALLA_UPLINK (`ActionExecutors.ts`, around lines 1108–1131).

48 card actions carry conditionals. The review's probe: `equilibrium` at 90% HP gave Strength 3; Reprogram of it gave Strength 6 **and** healed 90→100.

**Fix — one conditional evaluator, called from all three paths.**
- Extract the reducer's block into its own module, for example `src/engine/actions/actionConditions.ts` exporting `actionConditionsMet(...)`. It takes:
  - the state;
  - the action;
  - the card's declared target id;
  - the per-hit target;
  - the pre-cast caster snapshot;
  - the live caster.
- It must carry the ticket-68 note (state is threaded through) and the full 162a rule: per-turn counters read the LIVE caster; statuses and health read the PRE-CAST snapshot.
- The reducer calls it. That refactor must be **bit-identical**: run `npm run balance` before and after; not one cell may move.
- `PlayLastCardExecutor` and `resolveProgramFree` call it too. Capture the caster snapshot once, before their action loop. The card target is the replay's `targetId` for Reprogram / Echo, and the free cast's resolved `defaultTargetId` for VALHALLA.
- Leave the legacy MOVES intent path (`battleReducer.ts`, around line 992) alone. Runs are CARDS mode, and it is not in this ticket.

**Tests.** Reprogram, Echo and a VALHALLA free cast of `equilibrium`, each at 90% HP and at 30% HP: exactly one branch fires each time. These fail on the parent. Keep the existing `replayFidelity.test.ts` green.

**Measure.** Field rows for the Reprogram / Echo / VALHALLA users (grep `PLAY_LAST_CARD` and `resolveProgramFree` callers; at least `valkyrie_*`). Report; don't tune.

---

## 164f — Patches never reach a simulated fight

**What is wrong.** In the game, `battleSetup.ts` (around line 94) carries `run.patches` into `createBattleState`, which sets `entity.patches` (`battleFactories.ts`, around line 211), and `entityHooksFor` rebuilds the firmware's hooks from it. The sim has no path for patches:
- `ComposedSetup` / `PartyMemberSetup` (`src/debug/scenarios/scenarioSchema.ts`, around lines 362 and 378) have no patches field;
- `buildScenarioState` never sets one;
- the walker's `setupFor` (`runWalker.ts`, around line 488) never passes one.

So the walker fits patches, pays scrap for them, and the patch changes nothing. **163e's patch take-rate and the sweep that moved `SHOP_PATCH_PRICE` 50 → 45 measured a patch that does nothing.**

**Fix.**
1. Add `patches?: string[]` to `PartyMemberSetup` **and** to its zod schema (`PartyMemberSetupSchema`, around line 230), so a saved scenario keeps it through a parse.
2. `buildScenarioState` sets `entity.patches` for a member with a non-empty list, exactly as the factory does.
3. Confirm `normalizeBattleState` does not strip `patches` from an entity. If it does, fix it there.
4. The walker's `setupFor` / `asSetupMember` copies `run.patches[member.id]` onto each member's setup.
5. The run gate samples fights without a run, so it has no patches and is not in scope.

**Tests.**
1. A scenario whose player member carries a patch builds an entity with that patch, and its hooks differ from the unpatched entity's.
2. A walker run that fits a patch produces a battle whose entity carries it.

Both fail on the parent.

**Measure.** Re-run 163e's pair, `npm run balance:walk -- --upgrades both`, and the `--patch-price` sweep at 45 and 50. Report the take-rate and whether 45 still reads right. The price is Henry's to re-rule; do not move it. **Commit message rule:** this is an instrument change that removes a gap that should never have existed. Per Henry's law, it moves the walker's numbers once, on purpose, and the commit says so.

---

## 164g — In the walker, blueprints and recruits are free

**What is wrong.** Three leaks in `src/debug/balance/runWalker.ts`:

1. **Market blueprints are never charged** (around line 722). The walker dispatches `addRunScrap(-bp.price)`, but `runSlice.addRunScrap` refuses negative amounts (`runSlice.ts`, around line 287), so the scrap never leaves. It also logs a `SCRAP −price` row that did not happen, and it never checks `isBlueprintSlotSold`, so every market revisit hands out another free blueprint. Verified by probe.
2. **Recruits cost 0** (around line 803: `recruitIntoParty({ …, price: 0 })`). The game charges `WORKSHOP_ASSEMBLY_SCRAP` (25) through `planRecruit` (`WorkshopNode.tsx`, around line 251).
3. **Any blueprint recruits any species.** The walker keeps one `blueprints` integer. The game requires a blueprint of *that* species (`workshopBlockFor`: `ranch.blueprints[speciesId] >= 1`) and spends it. This is part of "recruits are free": the recruited species' own blueprint was never paid.

**Fix.**
1. Buy market blueprints with `buyMarketBlueprint({ nodeId, price })`, the game's reducer, which charges and records the slot. Skip the purchase when `isBlueprintSlotSold(run, node)`. Only count the blueprint if the run's `boughtBlueprints` actually grew.
2. Replace the integer with a small single-purpose `BlueprintLedger` class (per-species counts: `add(species)`, `has(species)`, `spend(species)`, `recruitable(excludingHeld)`). Feed it from:
   - fight drops (`bundle.blueprints`, by species);
   - market purchases (`offer.speciesId`).
3. `chooseStep` takes whether any **recruitable** species has a blueprint instead of a bare count.
4. The workshop recruit ranks only species the ledger holds, charges `WORKSHOP_ASSEMBLY_SCRAP`, skips when the run cannot afford it, and spends that species' blueprint. The price and the rule must come from the game's own code: use `planRecruit`'s `scrap`, or import the constant. Do not write the number again.
5. **Leave Driver stakes and the gauntlet HP carry alone.** They were in the review, but not in this ticket.

**Tests.**
1. A walker run that buys a market blueprint loses exactly its price, and a revisit to the same shelf does not buy it again.
2. A recruit costs 25 scrap and consumes the recruited species' blueprint.
3. A blueprint for species X cannot recruit species Y.

All fail on the parent.

**Measure.** `npm run balance:walk -- --seeds 30` (the 157 run report): recruits per run, scrap curve, fights reached, gym clears, before vs after. **Same commit-message rule as 164f.**

---

## 164h — The seeded RNG has a period of 7,298

**What is wrong.** `src/engine/core/PRNG.ts` has three problems:
- **The cycle.** It emits `nextSeed` as a **decimal string**, and the next `new PRNG(string)` *hashes* that string instead of parsing it. Every step is therefore `hash(string(lcg(x)))`, a random map rather than a generator. Every seed tested (`seed-0001`, `battle_abc`, `x`, `ticket-22-save-seed`) falls into the **same** cycle of 7,298 states within about 1,000 draws. Late-battle shuffles across a balance corpus are correlated, not independent.
- **Precision.** `a * this.seed` exceeds 2^53, so the arithmetic loses precision.
- **Range.** `value = seed / (m − 1)` can equal exactly 1.0, which makes `nextInt(min, max)` return `max + 1`. It is rare, but it is out of range.

**Fix.**
- Keep the class and its API exactly as it is: `PRNG<S>`, `next()`, `nextInt()`, `shuffle()`, and `nextSeed` of the same kind as the input. Every caller, `SeedStream` and the stored `state.seed` strings keep working unchanged.
- Replace the core with a proper 32-bit generator. **mulberry32** is recommended: period 2^32, uses `Math.imul` so there is no float overflow, and `value = uint32 / 2^32 ∈ [0, 1)`.
- Seed strings get a canonical encoding of the state, for example `m1:` + 8 hex digits:
  - a string in that format is **parsed**;
  - any other string (run seeds, node seeds, `SeedStream` fork labels, old saves) is **hashed** once into an initial state with a proper string hash, for example cyrb53 folded to 32 bits;
  - a number seed maps to the state with `>>> 0`.
- **Stop and ask Henry** before committing if you want a different generator. It's a one-line ruling, not a design question.

**Consequences, to state in the commit:**
- Every seeded result in the game re-rolls: shuffles, encounters, market stock, IV rolls, the AI's lookahead samples.
- A run saved mid-way resumes deterministically but differently from how it would have gone.
- Tests that pin exact seeded outputs will go red. Update only the ones that pin an RNG-derived value, list them in the commit, and never loosen an assertion to make it pass.

**Tests.**
1. The period: no repeat within 10^6 draws from several seeds.
2. `nextInt(0, n)` never returns `n + 1` over a large sweep.
3. Round-trip: `new PRNG(nextSeed)` continues the same sequence for both string and number seeds.
4. Distribution: a chi-square on `nextInt(0, 9)` stays inside a loose bound.
5. An old-format decimal seed string is still accepted.

---

## After 164h — the one re-baseline

This is owed since `d30106e` and covers all eight rows. It takes hours on a 2-core container, so hand Henry the exact commands to run on his machine unless he says otherwise:

1. The full 1v1 field: `npm run balance` (about 15–18 min at 10 iterations; the HANDOFF gives the full-precision settings).
2. The comp grid, via `scratch/compshard.ts` / `compgrid.mjs` as the HANDOFF describes. Note: the beam is still as shipped; this ticket does not touch it.
3. The walker: `npm run balance:walk -- --seeds 200 --fight 1`, the per-node read in `results/t0925_playtest/`, and a 30-seed full walk.
4. The run gate's wild band, against the new **85% floor**.

Promote the new baselines with one commit that names this ticket.

---

## Rules for whoever implements this

- **One commit per row**, authored as Henry: `git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com'`. No Co-Authored-By trailers. End each message with a `HANDOFF:` line.
- **Never push.** Report the exact push command.
- **Each row:** write the failing test first and prove it fails on the parent, then fix, then `npm run gate` green, then the row's measurement.
- **Report, don't tune.** If a measurement moves a deck out of band, say so. Henry rules on numbers; nobody changes a card, a constant or a price in this ticket.
- **Structure.** Small single-purpose modules or classes over growing existing files: `chipsSleep`, `beginTurn`, `actionConditionsMet`, `BlueprintLedger`, the PRNG core. Composition over inheritance. One path for one rule; never a second copy that can drift.
- **Line endings:** CRLF in `docs/wayfinder`; LF for tests, `src/debug`, JSON and scratch. Otherwise keep each file's existing endings (`.gitattributes` normalizes the index).
- **Never commit** `build.py`, `browser.html` or `registry.json` from a container.
- **Report** in plain English. Every report ends with the decisions Henry needs to make, or the next steps if there are none. The decisions this ticket may raise:
  - 164b: sleep chip per hit or per card;
  - 164h: the generator, if not mulberry32;
  - 164f: the patch price, after the re-measure.
