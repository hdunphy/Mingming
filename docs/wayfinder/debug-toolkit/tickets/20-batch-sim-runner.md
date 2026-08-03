# Batch sim runner

- Type: wayfinder:task
- Status: open
- Assignee:
- Blocked by: [Determinism groundwork](09-determinism-groundwork.md), [Scenario materializer](11-scenario-materializer.md)

## Question

Build the parameterized batch runner. Specified by
[Batch sim & auditor design](08-batch-sim-auditor-design.md) sections 1–3.

Checklist:

- `runBatch(scenario, { seeds | iterations, maxTurns })` consuming **composed** scenarios from
  [Scenario schema v1](02-scenario-schema.md), materialized via
  [Scenario materializer](11-scenario-materializer.md). Replaces `runSimulation()`'s zero-argument
  hardcoded kraken-vs-fenrir (`SimRunner.ts:20-23`).
- **`TacticalAI` drives both sides**, which requires `enemyMode: 'CARDS'`. That mode is unreachable
  until [Determinism groundwork](09-determinism-groundwork.md) plumbs `BattleOptions` through
  `battleSlice.startBattle` (`:67-72`, audit gap #4) — hence the block.
- Aggregate per batch: win rate, average turn count, dead-card ratio (track cards that sat in hand
  unplayed), FTK flag (win on turn 1).
- `npm run balance` → `vitest run --config vitest.balance.config.ts`, matching `*.balance.ts` only.
  **Verify `npm test` and `npm run build` are unaffected** — that was an explicit requirement.
- Write the three §2 tests as `*.balance.ts` with the redlines as assertions: Mirror ~50%,
  Archetype Gauntlet >70% / >30 turns, OS Variance >15% gap.
- **Land and run the Mirror Test first.** Until identical decks win ~50/50, no other result means
  anything — a failure there is a real AI or determinism bug, not a balance finding.
- `SimRunner.test.ts` currently has 22 lines and zero `expect()` calls (audit gap #15). Replace or
  delete it rather than leaving it as false cover.

Done when: `npm run balance` runs the three tests, `npx vitest run` + `npx tsc -b` + `npm run build`
are green and unchanged in duration, and the Mirror Test passes.
