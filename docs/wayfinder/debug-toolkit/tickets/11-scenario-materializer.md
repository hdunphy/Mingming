# Scenario materializer

- Type: wayfinder:task
- Status: closed
- Assignee: subagent-11-materializer (cowork-2026-08-03-opus5)
- Blocked by: [Determinism groundwork](09-determinism-groundwork.md), [Scenario schema & normalizer](10-scenario-schema-implementation.md)

## Question

Turn a validated `composed` scenario into a live `IBattleState` — the bridge between the schema and
every surface that runs one. Mechanical, but genuinely blocked: it needs the seeded creation path
from 09 to produce the same state twice.

Checklist:

- `buildScenarioState(setup: ComposedSetup): IBattleState` — bypasses `createBattleState`'s
  procedural branches entirely (audit gap #5: `enemyIds` is honored in exactly one branch, which
  force-overrides enemy level at `battleFactories.ts:188`). Builds both parties directly via
  `initializeBattleEntity`, applies per-entity `currentHp` / `maxHpOverride` / `statusEffects` /
  `moves` / `activeOS` overrides, expands `player.deck` and per-enemy `deck` dataIds into card
  instances using 09's seeded id generator, and threads `seed` and `enemyMode` through.
- Synthetic-save shim where the existing helpers demand an `IPlayerSave` — `SectorTerminal.tsx:53-62`
  already demonstrates the pattern.
- Output passes through `normalizeBattleState` before returning, so composed and snapshot paths
  produce byte-identical canonical states.
- Injection standardizes on whatever [Debug gating architecture](03-debug-gating-architecture.md)
  picks for the dispatch surface (`battleSlice.setBattleState` vs wiring `INITIALIZE_BATTLE`,
  audit gap #10) — if 03 is unresolved when this is picked up, use `setBattleState` and leave a
  TODO rather than blocking.
- Test: same setup + same seed ⇒ deep-equal normalized `IBattleState` across two builds.

Done when: the determinism test passes and full suite + `tsc -b` + `vite build` are green.

## Implementation status — 2026-08-03

Code landed by subagent `acdcef7bd8b68f88e`; **open until Henry's gates pass.** New
`src/debug/scenarios/buildScenarioState.ts` + 21-case test. Same setup + seed is deep-equal across
two builds including all 13 generated ids, in both MOVES and CARDS mode.

Findings that qualify this ticket:

- **The synthetic-save shim was unnecessary.** Nothing on the direct-build path takes an
  `IPlayerSave` — `initializeBattleEntity` takes instance+definition, `instantiateDeck` takes
  dataIds, `drawCards` takes a deck. Only `createBattleState`, the function being bypassed, wants a
  save. The `SectorTerminal.tsx:53-62` pattern the ticket cited turned out not to be needed.
- **`maxHpOverride` requires recomputation**, as suspected: `initializeBattleEntity` sets
  `currentHp` to the computed maxHp, so an override must move both, and an explicit `currentHp` is
  applied afterwards and clamped to maxHp with a warning (the schema bounds it below, not above).
- **The enemy-`activeOS` strip is unrepresentable in canonical form.** `createBattleState` clears
  enemy `activeOS` (enemies use intents), but `normalizeBattleState`'s fill class puts
  `availableOS[0]` straight back, so replicating the strip would be a no-op after normalization. The
  resolved value is kept. **Matters if anyone diffs a scenario-built state against a
  `createBattleState` one** — they will differ on exactly this field.
- `experience` is required by `IMingmingState` but absent from the schema; derived as
  `getExpForLevel(level)` rather than 0, so a high-level unit doesn't mis-trigger the post-battle
  level-up queue.
- `GetRelic` **throws** on an unknown id, unlike `GetMingmingData`/`GetProgramData` which warn and
  return a fallback. Caught and warned, per ticket 02's warn-not-block drift policy.
- Deck shuffling is kept, matching `createBattleState`. Preserving author order would have been
  nicer for repro clarity, but ticket 02 lets batch sims re-roll the seed on composed scenarios —
  without a shuffle, re-rolling would change nothing and collapse sim variance.
- `setup.gauntlet` is ignored by the builder: `IBattleState` has no gauntlet field, and the one way
  gauntlet reaches battle creation (patching `currentHp` from `persistedStats`) is already expressed
  as per-member `currentHp`. It is run context for the injection layer. Documented in the module
  header so it doesn't read as an oversight.
- No injection, as instructed — the state is returned, nothing is dispatched.


## Resolution

Shipped in `a6388a4`; the ticket was left open by the session that did the work.
Closed during a bookkeeping sync on 2026-08-03 after verifying the code is present and the
full suite, `tsc -b` and `npm run build` (including `assert-no-debug`) are green.

Landed: buildScenarioState.ts + tests under src/debug/scenarios/.
