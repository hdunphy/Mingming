# Determinism groundwork

- Type: wayfinder:task
- Status: closed
- Assignee: subagent-09-determinism (cowork-2026-08-03-opus5)
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

## Implementation status — 2026-08-03

Code landed by subagent `ade453f8f7472217c`; **open until Henry's gates pass.**

New `src/engine/core/SeedStream.ts` (stateful seed carrier + `rollSeed()` + seeded collision-safe
`nextId`). `battleFactories.ts` resolves one `battleSeed` (`options?.seed ?? rollSeed()`) into a
single `SeedStream` threaded through gym grunt count, all three `generateEncounter` calls, deck
instantiation and shuffles, draws, and `generateIntents`. `crypto.randomUUID()` and `Math.random()`
IVs are gone from the file entirely — made unconditional rather than scenario-only, which is
strictly stronger than the ticket asked. `sessionId` is now `'battle_' + battleSeed`.
`EncounterGenerator.ts:24` `Date.now()` → `rollSeed()`. `battleSlice.startBattle` forwards
`options`, **so `enemyMode: 'CARDS'` is reachable from a dispatch and ticket 08's block lifts.**

Verified without the gates: all six creation branches are JSON-identical across two seeded calls
including `sessionId`, entity ids and card instance ids; different seeds diverge; 200 unseeded runs
kept ids unique.

Findings:

- **A determinism gap remains, outside this ticket's file list:** `createStarterSave` /
  `createMingmingInstance` / `createOwnedProgram` in `src/engine/gameTypes.ts` still use
  `crypto.randomUUID()` and `Math.random()` IVs. Battle creation is deterministic; *save* creation
  is not, so `createStarterSave()` cannot be used in a determinism test. Graduated as
  [Seeded save factories](22-seeded-save-factories.md).
- Pre-existing and untouched: `drawCards` only advances its seed when it reshuffles, so an opening
  draw returns the seed unchanged (`deckLogic.ts`, outside the file list). Harmless.
- Line numbers drifted again (`Date.now()` seeds at 136/145/184/237/255, `sessionId` at 299).
- The `PRNG.nextSeed: any` seam is normalized at `SeedStream`'s boundaries, not fixed globally.

## Resolution

**Closed 2026-08-03.** Gates green on Windows: `npm run build` (including `assert-no-debug`), `npx vitest run` (412 tests across 40 files), `npx tsc -b`. Battle creation is now reproducible from a seed, and `enemyMode: 'CARDS'` is reachable from a dispatch — which lifts the block on [Batch sim & auditor design](08-batch-sim-auditor-design.md). Save creation remains nondeterministic; graduated as [Seeded save factories](22-seeded-save-factories.md).
