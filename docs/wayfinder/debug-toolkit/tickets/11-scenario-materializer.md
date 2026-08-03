# Scenario materializer

- Type: wayfinder:task
- Status: open
- Assignee:
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
