# Batch sim runner

- Type: wayfinder:task
- Status: closed
- Assignee: cowork-2026-08-03-opus5
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


## Resolution

Implemented 2026-08-03. Verified: `npx vitest run` 51 files / 600 tests green, `npx tsc -b` clean,
`npm run build` clean including `assert-no-debug`. Default suite duration unchanged (~20s) and it
collects no `*.balance.ts`, which was the explicit requirement.

Landed under `src/debug/balance/`: `runBatch.ts` (`runOne`, `runBatch`, `runPairedBatch`,
`aggregate`, `deriveSeeds`), `balanceScenarios.ts`, `balanceReporting.ts`, the three
`*.balance.ts` tests, and `runBatch.test.ts` (17 assertions). `vitest.balance.config.ts` +
`npm run balance`. `SimRunner.ts`/`SimRunner.test.ts` deleted.

**Gate placement.** The runner lives in `src/debug/`, not `src/engine/`, because it consumes
`ComposedSetup` and calls `buildScenarioState` — both debug-side. The alternative was hoisting zod,
the registry-hash policy and the normalizer into shipped engine code to serve a tool that never
ships. From `src/debug/` all imports point downward into the engine, which the gate allows.

**Amends [Debug gating architecture](03-debug-gating-architecture.md) §3.** That decision kept
`window.runSim` as a DEV-only import in `main.tsx`. `SimRunner.ts` no longer exists, and restoring
the global would require `main.tsx` to import into `src/debug/` — a second gate exception beyond
the sanctioned `App.tsx → DebugRoot` edge. The global is **removed**, not relocated. Raise it if
the console shortcut is missed; a `DebugRoot`-attached version is the cheap fallback.

### The Mirror Test — a harness finding, not a balance one

A single-orientation mirror does **not** come out 50/50 (fenrir 57/34, kraken 38/62). That is not
an AI bug: `buildScenarioState` always gives turn 1 to PLAYER, and base-deck battles resolve in 2–3
turns, so the first mover often gets an extra action phase. Isolated by replaying identical
materialized states with `activeSide` flipped — the engine and AI are side-symmetric; turn order is
the whole effect. `firstMoverEdge` ranges from **+24.5%** (skoll) to **−39.3%** (ratatoskr, whose
deck wants to move second).

So each mirror runs the same 200 seeds under **both** turn orders, and the redline applies to the
pooled result over **decided** games (scoring a draw as a PLAYER loss manufactures bias out of
stalling). Pooled decisive win rate across 400 battles per species, all 10 that resolve: 47.9%–52.3%,
side bias ≤4.5% everywhere. The AI-action rejection counter is **0** across every battle.

### `npm run balance` fails, and that is the point

9 of 37 tests breach their redlines. **These are real findings, not weakened assertions.** Balance
fixes are out of scope for this map (see Out of scope), so they are recorded here, not fixed:

- **Mirror stalemate.** 7 of 16 base decks cannot beat a copy of themselves inside 60 turns —
  `fafnir, gullinbursti, ymir, draugr, hel, nidhoggr` at 400/400 draws, `valkyrie` at 267/400.
- **OS variance (7 tests).** Firmware-only differences, everything else identical:
  `sleipnir_v2` and `gullinbursti_v2` at **100%**, `jormungandr_v2` 86%, `kraken_v1` 85%,
  `hraesvelgr_v2` 81%, `ratatoskr_v2` 68%, `fenrir_v2` 67%. Cap is a 15% gap. Worst is
  `sleipnir_v2` (WAR_STEED_OS, a free 0-cost token per Air attack): 100% on turn 1, half of them FTK.
- **FTK.** `kraken vs skoll`, 1/100 runs, won on turn 1 with the opponent never acting.

Dead-card ratio is measured and reported but **not** asserted — `docs/balance_testing.md` §2.2 lists
it as a metric with no threshold, and inventing one would be a redline the repo never agreed to.
