# Batch sim & auditor design

- Type: wayfinder:grilling
- Status: open
- Assignee:
- Blocked by: [Scenario schema v1](02-scenario-schema.md)

## Question

Design the real batch pipeline `docs/balance_testing.md` §2/§4 specs but nothing implements (audit: `runSimulation()` is a zero-arg hardcoded smoke run; `sim/Simulator.ts` is closed-form TTK, not battles; the sim test has zero assertions).

To decide:

- **Runner API.** `runBatch(scenario, { seeds | iterations, maxTurns })` consuming composed scenarios from [Scenario schema v1](02-scenario-schema.md). `TacticalAI` plays the player side (it's current with the intent system); enemies run their normal `MOVES` intents, or `TacticalAI` for `CARDS`-mode mirrors. Confirm sides-assignment per test type.
- **Test suite v1.** Mirror test (~50% win-rate sanity), archetype gauntlet (control deck vs registry), OS variance audit (same deck, both OS, ≤15% gap) — which land in v1, and what are the metrics: win rate, avg turn count, dead-card ratio, toxic-combo flags (stun-lock ≥3 turns, net-positive energy loops, FTK)?
- **Output.** `balance_report.json` shape; CSV export (reuse `BalanceTester.tsx`'s `downloadCSV`); where reports live.
- **Relationship to existing tools.** Does the closed-form TTK matrix (`sim/Simulator.ts` + `BalanceTester.tsx`) stay as a quick static view alongside the real sims? Does `CardStudio`'s budget auditor (static half of the Heuristic Auditor) fold into the same report?
- **Entry point.** npm script via `vite-node`/`tsx`, or vitest-driven (bench)? Runtime budget per batch (LCG + depth-3 minimax per turn — measure).
