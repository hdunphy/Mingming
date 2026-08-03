# Determinism groundwork

- Type: wayfinder:task
- Status: open
- Assignee:
- Blocked by: —

## Question

Mechanical prerequisite, no design decision: make battle *creation* as deterministic as the reducer already is, so seeded scenarios and batch sims are meaningful. (Audit gaps #1–#4, #17.)

Checklist:

- Thread a `seed` parameter through `createBattleState` / `BattleOptions`, forwarding to `generateEncounter` (which already accepts one, `EncounterGenerator.ts:15`). Absent seed → roll once, then thread.
- Replace creation-path escapes with the threaded PRNG: `Math.random()` gym grunt count (`battleFactories.ts:132`) and `createMockEntity` IVs (`:21-23`); `Date.now()` seed sources (`:136,145,182,235,253`).
- `sessionId` is `'battle_' + Date.now()` (`battleFactories.ts:297`) and lives *inside* `IBattleState`, so it breaks replay diffs on its own — make it seed-derived. (Added 2026-08-03 by [Scenario schema v1](02-scenario-schema.md).)
- Seeded, collision-safe id generator to replace `crypto.randomUUID()` for entity/card instance ids (`battleFactories.ts:15,33`) — at least in scenario/sim mode — so recorded and replayed runs are id-stable.
- Plumb `BattleOptions` (incl. `enemyMode`) through `battleSlice.startBattle` (`battleSlice.ts:67-72` currently drops the 4th arg).
- ~~Remove or DEV-gate the `window.runSim` production backdoor.~~ Decided by [Debug gating architecture](03-debug-gating-architecture.md) (keep it, DEV-only) and delegated to [Retire the ungated surfaces](13-retire-ungated-surfaces.md). Not this ticket's work.

Done when: same seed + same inputs ⇒ deep-equal `IBattleState` (modulo the documented optional-field policy), full suite + `tsc -b` + `vite build` green.
