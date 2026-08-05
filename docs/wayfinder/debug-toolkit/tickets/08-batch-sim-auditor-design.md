# Batch sim & auditor design

- Type: wayfinder:grilling
- Status: closed
- Assignee: cowork-2026-08-03-opus5
- Blocked by: — ([Scenario schema v1](02-scenario-schema.md) closed)

## Question

Design the real batch pipeline `docs/balance_testing.md` §2/§4 specs but nothing implements (audit: `runSimulation()` is a zero-arg hardcoded smoke run; `sim/Simulator.ts` is closed-form TTK, not battles; the sim test has zero assertions).

To decide:

- **Runner API.** `runBatch(scenario, { seeds | iterations, maxTurns })` consuming composed scenarios from [Scenario schema v1](02-scenario-schema.md). `TacticalAI` plays the player side (it's current with the intent system); enemies run their normal `MOVES` intents, or `TacticalAI` for `CARDS`-mode mirrors. Confirm sides-assignment per test type.
- **Test suite v1.** Mirror test (~50% win-rate sanity), archetype gauntlet (control deck vs registry), OS variance audit (same deck, both OS, ≤15% gap) — which land in v1, and what are the metrics: win rate, avg turn count, dead-card ratio, toxic-combo flags (stun-lock ≥3 turns, net-positive energy loops, FTK)?
- **Output.** `balance_report.json` shape; CSV export (reuse `BalanceTester.tsx`'s `downloadCSV`); where reports live.
- **Relationship to existing tools.** Does the closed-form TTK matrix (`sim/Simulator.ts` + `BalanceTester.tsx`) stay as a quick static view alongside the real sims? Does `CardStudio`'s budget auditor (static half of the Heuristic Auditor) fold into the same report?
- **Entry point.** npm script via `vite-node`/`tsx`, or vitest-driven (bench)? Runtime budget per batch (LCG + depth-3 minimax per turn — measure).

## Resolution

Decided 2026-08-03 with Henry (session `cowork-2026-08-03-opus5`). Implementation graduates as
[Batch sim runner](20-batch-sim-runner.md) and [Balance auditor & report](21-balance-auditor-report.md).

### 1. Sides — Tactical AI on both, which blocks this on determinism

`TacticalAI` plays **both** sides in every test. The Mirror Test is meaningless otherwise: enemies
default to `'MOVES'` (telegraphed intents, no cards) while the player side plays cards through the
AI, so "identical decks" would not be identical play.

**Consequence, and it is the gating one:** `TacticalAI` only drives a side that holds cards, so these
battles need `enemyMode: 'CARDS'` — currently unreachable because `battleSlice.startBattle`
(`battleSlice.ts:67-72`) drops the 4th `options` argument entirely (audit gap #4). The build tickets
are therefore **blocked on [Determinism groundwork](09-determinism-groundwork.md)**, which owns both
the `BattleOptions` plumbing and the seeded creation path.

### 2. Runner — vitest with its own config

`npm run balance` → `vitest run --config vitest.balance.config.ts`, matching only `*.balance.ts`.
Nothing new to install; `npm test` and `npm run build` use the default config and never match those
files, so **the build and the normal test run are untouched** — an explicit requirement from Henry.

Redlines come free as assertions, so a breach prints the measured value against its threshold rather
than being a number to spot in a JSON file. Accepted cost: vitest's reporter is test-shaped, so a
long batch reports as one slow test with no progress output. Cheaply reversible — the sim core is a
plain function, so swapping the wrapper for a CLI later is small.

Runner API: `runBatch(scenario, { seeds | iterations, maxTurns })`, consuming **composed** scenarios
from [Scenario schema v1](02-scenario-schema.md) so sims and the launcher share one definition.

### 3. Test suite v1 — all three §2 tests, FTK only from §3

| Test | Setup | Redline (from `docs/balance_testing.md` §2) |
|---|---|---|
| Mirror | identical mingming + deck, ~100 seeds | win rate must be ~50% — **validates the harness itself** |
| Archetype Gauntlet | control deck vs the registry | >70% win rate = overtuned; >30 avg turns = stalling |
| OS Variance | same deck, each OS | >15% performance gap = weaker OS needs a buff |

Metrics: **win rate**, **average turn count** (both free from the sim loop), **dead-card ratio**
(needs the loop to track what sat in hand unplayed), and the **FTK flag** (trivial — a win on turn 1).

**Deferred from §3:** permanent stun-lock and net-positive energy loops. Not because they don't
matter — a combo that wins without interaction may never show as an anomalous win rate — but because
they are *action-stream analysis* rather than outcome statistics, and are likely to need iteration to
avoid false positives. Additive later: the sim drives `battleReducer` directly and can record its own
action sequence at any time.

Run the Mirror Test first and trust nothing until it passes. If identical decks do not win ~50/50,
every other number is noise and the failure is a real AI or determinism bug.

### 4. Output — a committed, diffable report

- `docs/balance/balance_report.json`, **overwritten each run and checked in**. Because the sims are
  seeded and ticket 09 makes creation reproducible, the file is *stable*: change a card, rerun, and
  `git diff` is the answer to "what did that do". This is the single most useful property a balance
  report has, and it only works at a fixed committed path.
- A CSV alongside for sorting and eyeballing in a spreadsheet (`BalanceTester.tsx:96-111`'s
  `downloadCSV` is the existing precedent, though the vitest run writes via node `fs`).
- Accepted cost: repo churn when balance changes — which is the point, but also noise in unrelated
  diffs.

### 5. Existing tools

- **`CardStudio`'s budget math is half the auditor, not a neighbour of it.** §4's report wants cards
  over their energy budget *and* anomalous win rates. `calculatePowerscale` / `ACTION_WEIGHTS`
  (`CardStudio.tsx:11-24+`, implementing §1) are extracted into a shared module so the Studio panel
  and the auditor use one implementation. Static redlines need no simulation, so they are also the
  faster half of the report.
- **`sim/Simulator.ts` + `BalanceTester` stay, explicitly labelled a fast approximation, not balance
  truth.** The model is stale by construction (one `calculateDamage` per side, TTK = `ceil(maxHp /
  damage)`, zero-IV units, no statuses/hooks/cards/AI) — but it is *instant*, which is the only
  reason BalanceTester can recompute live as a slider drags. Real battles take seconds and cannot
  drive that interaction. Keeping it labelled means the two tools disagreeing reads as expected
  rather than as a bug.
