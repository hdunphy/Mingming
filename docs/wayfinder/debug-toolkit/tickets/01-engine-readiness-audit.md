# Engine readiness audit

- Type: wayfinder:research
- Status: closed
- Assignee: wayfinder (research subagent)
- Blocked by: —

## Question

What does the codebase already provide for the debug toolkit, and where are the gaps? Specifically: how battles are created today and whether an arbitrary composed setup can be injected; how the PRNG/seed works and whether mid-battle RNG state can be captured; whether `IBattleState` is JSON-serializable (hooks? closures?); the real state of `SimRunner.ts` / `sim/Simulator.ts` / `TacticalAI` vs the intent-based enemy system; what `BalanceTester.tsx` / `CardStudio.tsx` are and whether they're gated; the save schema and how an editor could safely mutate it; any existing dev gating.

## Resolution

Full findings: [../research/01-engine-readiness.md](../research/01-engine-readiness.md). Headlines:

- **Snapshot-friendly core.** `IBattleState` is pure JSON (no Maps/Sets/functions); hooks are ID strings resolved from module registries; the RNG is a plain string `seed` in state, re-threaded by every consumer — mid-battle capture/restore is trivial. The reducer itself is deterministic.
- **Injection paths exist.** `battleSlice.setBattleState` accepts an arbitrary `IBattleState`; `INITIALIZE_BATTLE` exists in the reducer but is unwired. `SnapshotPattern.test.ts` hand-builds a full battle state — a template for the launcher.
- **Nondeterminism lives at creation.** `battleFactories.ts` uses `Date.now()` (seeds, ×5), `Math.random()` (gym grunt count, mock IVs), and `crypto.randomUUID()` (entity/card ids). `createBattleState` takes **no seed parameter**; `enemyMode`/`BattleOptions` are unreachable from the UI; explicit `enemyIds` only work in one branch which force-overrides levels/decks.
- **No dev gating anywhere.** Balance and Studio tabs are in `TAB_CONFIG` ungated; `main.tsx` side-effect-imports `SimRunner` to attach `window.runSim` — all ship to players. `App.tsx` early-returns hide all nav during battle (god tools must be an overlay) and lock everything behind roster>0.
- **Sim tooling is thin.** `runSimulation()` is a zero-arg hardcoded kraken-vs-fenrir smoke run; `sim/Simulator.ts` is closed-form TTK arithmetic (no battles); `SimRunner.test.ts` has zero assertions. `TacticalAI` is current with the intent system and can play the player side.
- **Save editor hazards.** Autosave validates on every store change and fails *silently* on schema-invalid saves — editors must dry-run `PlayerSaveSchema.parse()`. "Unlock species/OS" = blueprint grant + `activeOS` write (no flags exist); gauntlet stage jumps need a new reducer (`updateGauntlet` only increments).
