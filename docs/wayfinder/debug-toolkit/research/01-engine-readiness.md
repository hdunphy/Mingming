# Research: Engine readiness for the debug toolkit

Resolves: [Engine readiness audit](../tickets/01-engine-readiness-audit.md). Produced 2026-08-02 by a wayfinder research subagent from a staged snapshot of 38 source files.

**Snapshot scope caveat:** several files referenced by staged code were absent, so claims about them are marked uncertain: `engine/events.ts`, `engine/core/HookRegistry.ts`, `engine/core/HookTypes.ts`, `engine/effectHandlers.ts`, `engine/actions/ActionExecutors.ts`, `engine/core/ConditionValidator.ts`, `engine/data/testProgramRegistry.ts`, `engine/RewardSystem.ts`, `ui/components/BattleArena.tsx`, `DeckTerminal/RosterTerminal/SynthesisLab/RelicTerminal/CardForm/TypeChart`.

---

## 1. Battle init path

**Chain:** UI → `battleSlice.startBattle` → `createBattleState` → returns a complete `IBattleState` stored at `state.battle.battle`.

**UI entry points (only two):**
- `src/ui/screens/HubScreen.tsx:38` — `dispatch(startBattle({ save, enemyIds: [enemyId] }))`; enemy hardcoded by a 3-way element counter-pick (`HubScreen.tsx:31-36`). Gauntlet continue at `HubScreen.tsx:24`.
- `src/ui/screens/SectorTerminal.tsx:47` — `startBattle({ save, enemyIds: [], sectorElement: element })` for unlocked sectors; `SectorTerminal.tsx:68` for gym gauntlets.

**Slice:** `src/ui/store/battleSlice.ts:67-72` — `startBattle` passes only `(save, enemyIds, sectorElement)`. It **never passes the 4th `options` arg**, so `BattleOptions.enemyMode` (`battleFactories.ts:44-51`) is unreachable from the UI; every UI battle is `'MOVES'`.

**Factory:** `src/engine/data/battleFactories.ts:53` — `createBattleState(save: IPlayerSave, enemyIds: string[], sectorElement?: Element, options?: BattleOptions)`.

**Inputs it actually consumes:**

| Input | Source | Line |
|---|---|---|
| player units | `save.activeParty` ∩ `save.roster` | `battleFactories.ts:60-62` |
| level / IVs / OS | each `IMingmingState` | `types.ts:159-189` (`activeOS: instance.activeOS \|\| definition.availableOS[0]`, `:184`) |
| player deck | `save.activeDeck.cards` → `save.cardInventory` | `battleFactories.ts:243-250` |
| relics | `save.relics` | `battleFactories.ts:81-105` |
| gauntlet ctx | `save.gauntlet` (persisted HP `:70-78`, branch `:113`) | `battleFactories.ts:70,113` |
| enemy group | 3 mutually exclusive branches | see below |
| **seed** | **none — no parameter exists** | `Date.now()` at `:136,145,182,235,253` |

**Three enemy branches:**
1. Gym gauntlet (`:113-176`) — procedural tiers 0/1, hand-crafted boss party at tier 2 (`:150-176`).
2. `sectorElement` set (`:177-186`) — fully procedural via `generateEncounter`.
3. Fallback (`:187-206`) — the **only** branch honoring explicit `enemyIds`, but it force-sets enemy level to `max(playerParty.level)` (`:188`) and auto-derives archetype decks (`:192-205`).

**Injection verdict — good news.** Two independent paths already exist:
- `battleSlice.ts:64-66` **`setBattleState(action.payload)`** assigns an arbitrary `IBattleState` straight into the store. Exported at `:88`. This is the ready-made scenario-launcher and battle-import hook, with no factory involvement.
- `battleReducer.ts:37` + `:60-61` **`INITIALIZE_BATTLE`** returns `action.payload` verbatim. Defined but **not wired into `battleSlice`** — currently dead.

Coupling to save state is real but escapable: `createBattleState` derives everything from `IPlayerSave` and throws on an empty party (`battleFactories.ts:64`), yet `SectorTerminal.tsx:53-62` already demonstrates the workaround — it fabricates a synthetic save object literal and passes it. A scenario launcher can do the same. `SnapshotPattern.test.ts:17-51` proves a complete `IBattleState` can be hand-built with no factory at all.

What is **not** composable through the existing path: seed, per-enemy level/IV/HP, enemy count (except branch 3), `enemyMode`, and starting statuses/energy.

---

## 2. Seed & determinism

**Algorithm:** `src/engine/core/PRNG.ts:6` — LCG, `a=1103515245`, `c=12345`, `m=0x80000000` (`:29-33`). Accepts `string | number` (`:10`); string seeds are hashed with a djb2-style loop then `Math.abs` (`:13-18`).

**Architecture — this is the strongest asset for the toolkit.** The RNG is **not** a module-level singleton and **not** a live object in state. Only a plain string lives in state (`types.ts:386` `readonly seed: string`), and every consumer constructs a throwaway `new PRNG(state.seed)`, takes `nextSeed`, and writes it back:
- `deckLogic.ts:14` `drawCards(deckState, count, seed) → { state, nextSeed, shuffled }`
- `resolutionEngine.ts:454-459` (`executeDraw`) and `:115-118` (discard shuffle)
- `HookFactory.ts:284-288` (random target selection) — comment at `:254` explicitly documents the thread-back contract

**Mid-battle RNG capture/restore: fully supported.** `state.seed` is a string; snapshotting and restoring the battle restores the RNG exactly. No hidden generator state.

**Caveats:**
- `PRNG.shuffle` (`:49-63`) does *not* use its own advancing internal state — it allocates a fresh `PRNG` per swap from `currentSeed` (`:54`). Deterministic, but O(n) allocations.
- `nextSeed: any` (`:28,40,49`); seed is typed `string` in `IBattleState` but numeric when constructed from a number. Call sites coerce with `.toString()` (`battleFactories.ts:257,270`, `deckLogic.ts:54`). Works, but it's an untyped seam.
- `generateIntents` (`IntentUtils.ts:17-18`) derives `` `${seed}_target_${turn}` `` and **does not advance `state.seed`** — pure function of (seed, turn), so replay-safe. But one `intentPrng` is reused across the party `.map` (`:31`), making intents **party-order-sensitive**.

**Determinism breakers (all at battle *creation*, none in the reducer):**

| Break | Location |
|---|---|
| `Math.random() > 0.5` for gym grunt count | `battleFactories.ts:132` |
| `Math.random()` IVs in `createMockEntity` | `battleFactories.ts:21-23` (used at `:156,170,171,189`) |
| `Date.now()` as seed source (×5) | `battleFactories.ts:136,145,182,235,253` |
| `crypto.randomUUID()` for entity + card instance ids | `battleFactories.ts:15,33` |
| `sessionId: 'battle_' + Date.now()` | `battleFactories.ts:297` |
| `Date.now()` default seed | `EncounterGenerator.ts:24` |
| `Math.random()` / `randomUUID` in save factories | `gameTypes.ts:124,130-132,146,174,179-181,187` |

**Important nuance:** the ~11 `Date.now()` calls in `battleReducer.ts` (`:285,420,586,593,650,661,678,701,749,766,817`) and `deckLogic.ts` (`:37,43,73`) are **only `timestamp` fields on emitted bus events** — they are never written into `IBattleState`. **The reducer itself is deterministic.** They only make the *event log* non-reproducible. Same for `console.log` noise at `battleReducer.ts:~813`.

---

## 3. State serializability

**`IBattleState` (`types.ts:384-416`) is pure JSON data.** Grep for `Map<`/`Set<`/`new Map(`/`new Set(` in `types.ts` returns **zero matches**. All fields are primitives, arrays, or `Record<string, number>`.

**Hooks are *not* closures in state** — this is the critical finding. `IBattleEntity.hooks` is `ReadonlyArray<string>` (`types.ts:133`): **hook IDs only**. Same for `ProgramData.hooks` (`types.ts:351`). The closures live in a module-level registry:
- `HookFactory.createHook` (`HookFactory.ts:48`) builds `HookDefinition` objects with function-valued trigger props (`:57`, `:79`)
- registered via `registerHook` (re-exported `Hooks.ts:12`) into `HookRegistry` (not staged)
- populated lazily by `initFirmwareHooks()` behind an `isInitialized` guard (`firmwareRegistry.ts:16,20`), triggered on first `getOSBehavior` call (`:61-63`, called from `Hooks.ts:28-31`)

Likewise `currentIntent` is a plain `IMove` (`types.ts:136,203-209`) and `daemons` are plain `ProgramEntity` (`types.ts:135,357-362`).

**What would block a JSON round-trip:**
- Nothing structural. `readonly`/`ReadonlyArray` is compile-time only.
- `JSON.stringify` **drops `undefined` fields**: `activeOS`, `secondaryElement`, `currentIntent`, `enemyMode`, `relicBonuses`, `nextProgramModifier`, `lastStatusConsumed`, `elementPlays`, `forcedTargetId`. Semantically harmless here — all consumers use truthiness or `?? 'MOVES'` defaults (`types.ts:410`, `IntentUtils.ts:21`, `TacticalAI.ts:172`). But a strict round-trip equality assertion would fail.
- **Registry coupling:** restored state references `dataId` / `definitionId` / `activeOS` / hook-ID strings resolved against module registries at replay time. A scenario JSON is only valid against a build with the same registry content. **No version/registry-hash stamp exists** — real gap for the sim pipeline and snapshot export.
- Redux already runs with `serializableCheck: false` (`store.ts:15`), so RTK won't police this either way.

**`SnapshotPattern.test.ts` — misleading name.** It is **not** a serialization or snapshot-file test. It's a hook priority/resolution test (159 lines):
- `createMockState()` (`:17-51`) hand-builds a complete `IBattleState` literal — a ready template for the scenario-launcher state builder.
- Test 1 (`:55-91`): `HookPriority.SYSTEM` hook cancels an action; asserts cost is still paid (`:88`) and no damage lands (`:90`).
- Test 2 (`:93-130`): multi-hit reactive thorns fires 3× between hits.
- Test 3 (`:132-157`): **a stub**. Asserts `expect(executionCount).toBe(0)` with inline comments "Placeholder" and "let's just trust the logic I wrote". Recursion-depth safety (the `triggerDepth > 5` guard) is **effectively untested**.
- Mocks `programRegistry` with `TestProgramRegistry` (`:9-15`, file not staged).

---

## 4. Existing sim tooling

**`SimRunner.ts` — a hardcoded 1v1 smoke harness, not a batch simulator.**
- `runSimulation()` (`:20`) takes **no parameters**. Hardcodes `createStarterSave('kraken')` (`:21`) and `createBattleState(mockSave, ['fenrir'])` (`:22`) — the fallback branch. `MAX_TURNS = 50` (`:23`).
- Buffers every bus event into `logBuffer` (`:26-36`).
- Loop (`:43-77`): calls `getBestAction(state)` for **both sides indiscriminately**, feeds result to `battleReducer`.
- Output: `SimResult { winner, totalTurns, finalLogs, remainingHp: {p1, e1} }` (`:13-18`) — first unit only, no win-rate aggregation, no CSV, no repeat/seed control.
- **Is it current with the intent system?** Incidentally yes — it never passes `enemyMode`, so battles default to `'MOVES'` and `getBestAction` short-circuits to intents (`TacticalAI.ts:157-164, 172-173`). But it has no awareness of `enemyMode` or movesets itself.
- Dead imports: `ProgramEntity`, `GetProgramData` (`:3,6`).
- **Ungated production backdoor:** `SimRunner.ts:102-105` attaches `window.runSim` and `console.log`s on module load — and `main.tsx:5` imports it purely for that side effect. This ships in production builds today.

**`sim/Simulator.ts` — not a battle simulator at all.**
- `simulate1v1` (`:23`) builds two entities, constructs a throwaway `mockState` (`:44-63`, `seed: '0'`), and calls `calculateDamage` **exactly once per side** with a synthetic zero-action `ProgramData` (`:66-90`). TTK = `ceil(maxHp / damage)` (`:101`).
- **Closed-form arithmetic only** — no turns, no cards, no statuses, no hooks, no AI, no RNG, no intents/movesets. Stale relative to the intent system by construction.
- Instance literals are cast `as any` missing IVs (`:36-37,40`), so IVs silently default to 0 via `?? 0` (`types.ts:160-162`) — batch results assume 0-IV units.
- `runBatchSimulation(level, power)` (`:130`) is an O(n²) all-pairs loop over `MingmingRegistry`.

**`SimRunner.test.ts` (22 lines) — a no-assertion smoke test.** Calls `runSimulation()` inside a `console.log` spy; contains **zero `expect()` calls**. It only `console.error`s if `"=== Game Over ==="` is missing (`:14-16`). Passes as long as nothing throws.

**Is `TacticalAI` still used for the player side?** Yes, but only in tooling. `SimRunner.ts:4,49` is the sole live consumer in the snapshot. `TacticalAI.ts:176-177` claims it serves "the player side (Balance Tester / SimRunner auto-battles)" — the Balance Tester half is **stale**: `BalanceTester.tsx:5` imports only `sim/Simulator`, never `TacticalAI`. The live game does not use it for the player; `battleSlice.ts:47` `executeIntent` suggests the UI drives enemy intents directly (unconfirmed — `BattleArena.tsx` not staged).

`TacticalAI` itself **is** current with the intent system: `EXECUTE_INTENT` handling (`:157-164`), `enemyMode` gate (`:172-173`), depth-3 minimax over card plays (`:178-182`).

Possible latent issue: `globalBattleEventBus.mute()`/`unmute()` (`TacticalAI.ts:181-183`) is not visibly refcounted — a nested `getBestAction` inside a hook could unmute early. Unverifiable; `events.ts` not staged.

`docs/balance_testing.md` §2 already specs the batch pipeline (Mirror Test ×100, Archetype Gauntlet, win-rate/turn-count/dead-card metrics) and §4 specs `Auditor.ts` → `balance_report.json`. All aspirational — none implemented. `docs/roadmap.md:16` marks "Milestone 1.7 Headless Simulation Runner" `[x]` (overstated), `:40` "Milestone 5.2 Seeded Replays" and `:79` "Milestone 9.3 The Heuristic Auditor" `[ ]`.

---

## 5. Existing dev screens

**Both are wired into `App.tsx` and completely ungated — they ship to players today.**
- `Tab` union: `App.tsx:19` includes `'balance' | 'studio'`
- `TAB_CONFIG`: `App.tsx:28` `{ id: 'balance', label: 'Balance', icon: '⚖️' }`, `App.tsx:29` `{ id: 'studio', label: 'Studio', icon: '🏗️' }`
- Render: `App.tsx:96-97`

**`BalanceTester.tsx` (365 lines):** species A/B dropdowns, level sliders 1-100, power slider 1-150, live `simulate1v1` in a `useMemo` (`:22-28`), "Run All Matchups" → `runBatchSimulation` (`:83-88`), sortable tables with modal report, CSV export via Blob+anchor (`:96-111`, exporters `:113-134`).
**Reusable for batch sims:** the `downloadCSV` helper (`:96`) and the sortable-table/modal-report shell transfer directly. The simulation core does **not** — it's closed-form TTK, not battles.

**`CardStudio.tsx` (333 lines):** card budget/powerscale auditor. `ACTION_WEIGHTS` (`:11-18`), `calculatePowerscale` (`:24+`) implementing `docs/balance_testing.md` §1 with assumed baselines (`:28-31`). Imports `getInflatedProgramRegistry` + `CardForm` (`:2-4`), so it also edits/creates cards. CSV export at `:212`.
**Reusable for batch sims:** this is already a partial "Milestone 9.3 Heuristic Auditor" (`roadmap.md:79`) — the static-analysis half. Fold it in rather than rewrite.

Neither is dead code. Both are prime candidates to **move under the new gated Debug tab**, which also fixes the current production leak.

---

## 6. Save system

`src/engine/SaveSystem.ts`. Key `'mingming_save'` (`:9`), localStorage, `CURRENT_SAVE_VERSION = 2` (`:56`).

**Schema** (`PlayerSaveSchema`, `:58-70`) — zod, validated on both read and write:

| Field | Constraint | Line |
|---|---|---|
| `version` | int ≥1 | `:59` |
| `roster` | `MingmingInstanceSchema` — level ≥1, exp ≥0, **IVs int 0..31** | `:13-24` |
| `activeParty` | string[], **max 3** | `:61` |
| `cardInventory` | `{instanceId, dataId}[]` | `:62` |
| `activeDeck` | nullable `{id,name,cards[]}` | `:63` |
| `scrapCount` | **int ≥0** | `:64` |
| `blueprints` / `relics` / `unlockedSectors` / `baseDecksGranted` | `.catch([])` | `:65,66,68,69` |
| `gauntlet` | nullable, `.catch(null)`; `persistedStats` is **HP-only** by design | `:43-54,67` |

`migrateSave` (`:78-94`) runs **before** validation (v1→v2 backfills). `saveGame` (`:98`) validates then writes; `loadGame` (`:117`) parse→migrate→validate; `deleteSave` (`:141`); `hasSave` (`:145`).

**Not persisted:** any battle state, and per-mingming current HP outside a gauntlet.

**How a save editor can mutate safely.** Prefer existing `gameSlice` actions over raw writes — `addScrap` (`:121`), `addRelic` (`:232`), `addToRoster` (`:23`, also auto-grants the species base deck `:27-36`), `addCardsToInventory` (`:57`), `addBlueprint` (`:131`), `startGauntlet` (`:182`), `updateGauntlet` (`:173`), `completeGauntlet` (`:191`), `updateMingmingOS` (`:221`), `loadSave` (`:150`, wholesale replace), `resetSave` (`:228`).

**⚠️ Autosave hazard.** `store.ts:18-31` subscribes to the store and calls `saveGame` on **every** game-state change, which validates. Any editor write that violates the schema (IV = 99, negative scrap, 4-member party) makes autosave **fail silently** — only a `console.error` at `store.ts:27` — and progress stops persisting from that point. A save editor **must** dry-run `PlayerSaveSchema.parse()` before dispatch. `loadSave` is the safest wholesale path since it accepts exactly what `loadGame` produces.

**Gap for "unlock species/OS":** neither concept exists as a flag. Species availability derives from `blueprints` (`IBlueprint {architectureId, name, compileCost}`, `gameTypes.ts:30-34`) plus SynthesisLab (not staged). OS availability comes from `IMingmingDefinition.availableOS` (`types.ts:79`) with per-instance `activeOS` (`types.ts:93`) — a static registry list, not a save field. "Unlock" therefore means *grant blueprint* and *set `activeOS`*, not flip a flag.

---

## 7. Dev gating

**There is none.** A grep for `import.meta.env` / `process.env` / `DEV` / `__DEV__` / `NODE_ENV` across the entire snapshot returns only two unrelated **comment** hits: `battleReducer.ts:125` ("for debugging") and `SimRunner.ts:101` ("Console debugging"). Zero feature flags, zero env usage.

`vite.config.ts` is 5 lines: `base: '/Mingming/'` + react plugin. No `define`, no mode-specific config, no `manualChunks`. `import.meta.env.DEV` works out of the box (true in `vite`, false in `vite build`) and dead-code-eliminates when used as a static top-level guard. `package.json` scripts are `dev/build/lint/preview/test` — no separate tooling build.

**Adding a hidden Debug tab touches three places in `App.tsx`:**
1. `Tab` union type — `App.tsx:19`
2. `TAB_CONFIG` array — `App.tsx:21-30` (filter by `import.meta.env.DEV`)
3. Render chain — `App.tsx:90-97`

**Two structural blockers in `App.tsx`:**
- `App.tsx:68-70` — `if (isInBattle) return <BattleArena />` replaces the *entire* nav during battle. **Mid-battle god tools cannot be a tab.** They must be an overlay rendered inside `BattleArena`, or a debug overlay hoisted above this early return.
- `App.tsx:64-66` — `if (rosterSize === 0) return <MainMenuView />` makes the debug tab unreachable with an empty roster, which is precisely the state a scenario launcher wants to start from.

Also note the existing ungated backdoor to remove or gate: `main.tsx:5` side-effect-imports `SimRunner` solely to attach `window.runSim` (`SimRunner.ts:102-105`).

---

## 8. Gaps

**Blocking / architectural**
1. **Battle init takes no seed parameter.** `createBattleState` (`battleFactories.ts:53`) has no seed arg; it calls `Date.now()` at `:136,145,182,235,253`. Needs a `seed` threaded into `BattleOptions` and forwarded to `generateEncounter` (which already accepts one, `EncounterGenerator.ts:15`). Required for launcher, sims, export.
2. **Non-seeded `Math.random()` inside creation.** `battleFactories.ts:132` (gym grunt count) and `:21-23` (`createMockEntity` IVs) bypass the PRNG entirely — same seed still yields different battles.
3. **`crypto.randomUUID()` for entity/card ids** (`battleFactories.ts:15,33`) makes states non-reproducible even at a fixed seed, and breaks id-stable diffing between a recorded and replayed run. Needs a seeded id generator for scenario mode.
4. **`enemyMode` is unreachable from the UI.** `battleSlice.ts:68` drops the `options` arg, so `'CARDS'` enemies (`battleFactories.ts:44-51`) can't be created outside tests. The scenario launcher must plumb `BattleOptions`.
5. **Explicit enemy groups are only honored in one branch.** `enemyIds` is used solely in the no-sector/no-gauntlet fallback (`battleFactories.ts:187-206`), which force-overrides enemy level (`:188`) and auto-derives decks (`:192-205`). No way to specify per-enemy level, IVs, HP, statuses, moveset, or count.
6. **`App.tsx:68-70` hides all nav during battle** — mid-battle god tools need an overlay inside `BattleArena` (file not staged; the actual mount point is unverified). `App.tsx:64-66` also locks out the toolkit at roster size 0.
7. **No dev gating primitive exists at all** (§7). Every new debug surface, plus the two existing screens and `window.runSim`, needs a gate introduced from scratch.

**Serialization / replay**
8. **No scenario schema and no version stamp.** `IBattleState` is JSON-clean, but restored state resolves `dataId`/`definitionId`/`activeOS`/hook IDs against module registries with no recorded registry version or hash. A scenario JSON silently misbehaves against a drifted build. Needs a zod `ScenarioSchema` mirroring `PlayerSaveSchema`'s approach.
9. **`JSON.stringify` drops ~9 optional `undefined` fields** (`activeOS`, `enemyMode`, `currentIntent`, `relicBonuses`, `nextProgramModifier`, `elementPlays`, `lastStatusConsumed`, `secondaryElement`, `forcedTargetId`). Benign at runtime (all consumers default), but blocks naive round-trip equality assertions in replay verification.
10. **`INITIALIZE_BATTLE` is defined but unwired** (`battleReducer.ts:37,60-61`) — no `battleSlice` action dispatches it. Either wire it or standardize on `setBattleState` (`battleSlice.ts:64`); having both is ambiguous.
11. **Event log is non-reproducible** — ~14 `Date.now()` timestamps on emitted events (`battleReducer.ts:285,420,586,593,650,661,678,701,749,766,817`; `deckLogic.ts:37,43,73`). State is unaffected, but any replay diff that includes the event stream will always mismatch. Needs an injectable clock or timestamp exclusion.
12. **No action-log recording.** Nothing captures the dispatched `BattleAction` sequence; only `state.logs` (human-readable strings) exists. Export currently means snapshotting state, not recording a replayable action tape.

**Sim / balance**
13. **No parameterized batch runner.** `runSimulation()` takes zero args (`SimRunner.ts:20`) and hardcodes kraken-vs-fenrir. Batch sims need `runSimulation(scenario, { seed, iterations })` plus win-rate/turn-count aggregation — all specced in `docs/balance_testing.md` §2, none built.
14. **`sim/Simulator.ts` is closed-form TTK, not battle simulation** — one `calculateDamage` call per side (`:92-93`), zero-IV units, no statuses/hooks/intents. Cannot serve as the balance auditor's engine; only `SimRunner` + `TacticalAI` can.
15. **`SimRunner.test.ts` has no assertions** (22 lines, zero `expect()`) — there is no regression net under the sim path the auditor would build on.
16. **`SnapshotPattern.test.ts:132-157` recursion-safety test is a stub** asserting `toBe(0)` on an unused counter. The `triggerDepth > 5` guard is untested — relevant because god-tools that inject cards/statuses mid-resolution are exactly what would trip it.
17. **`window.runSim` ships in production** (`SimRunner.ts:102-105` via `main.tsx:5`), console-logging on every boot.

**Save editor**
18. **Autosave + validation makes bad edits fail silently** (`store.ts:18-31`, error swallowed to `console.error` at `:27`). A save editor needs a pre-dispatch `PlayerSaveSchema.parse()` dry run, or it can wedge persistence with no visible symptom.
19. **"Unlock species/OS" has no representation in the save** — must be expressed as blueprint grants (`gameTypes.ts:30-34`) and `activeOS` writes (`gameSlice.ts:221`); `availableOS` is static registry data (`types.ts:79`).
20. **Jumping gauntlet stages is only forward-incrementing.** `updateGauntlet` (`gameSlice.ts:173-181`) hardcodes `currentBattleIndex + 1`; there is no set-to-N action. A stage jumper needs a new reducer or a `loadSave` round-trip.
