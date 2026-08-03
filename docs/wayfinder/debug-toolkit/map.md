# Debug & Testing Toolkit — Wayfinder Map

Label: `wayfinder:map`

**Tracker conventions (local-markdown fallback):** tickets are files in [`tickets/`](tickets/). Each carries `Type` (`wayfinder:research|prototype|grilling|task`), `Status` (`open|closed`), `Assignee` (blank = unclaimed), and `Blocked by` (links). A session claims a ticket by writing its name into `Assignee` before working. The **frontier** is every ticket that is open, unblocked (all Blocked-by closed), and unclaimed. Resolutions are recorded in the ticket's `## Resolution` section on close, and gisted below.

## Destination

A dev-build-only debug toolkit, built and working on the repo: a hidden **Debug tab** (scenario launcher + save/run editor), a **mid-battle debug overlay** (live state manipulation), **JSON scenario files** (composable by hand, exportable from a live battle, replayable), and a **headless batch-sim / balance auditor** that reuses scenario definitions — all tree-shaken out of production builds. Done when at least one real bug and one real balance question have each been driven end-to-end through the toolkit.

## Notes

- **Execution override:** unlike wayfinder's plan-only default, this map carries implementation — build tickets graduate out of the fog as design tickets resolve.
- Domain: React 19 / TypeScript / Vite / Redux Toolkit; headless engine in `src/engine`. Repo conventions: `npx vitest run` + `npx tsc -b` + `npx vite build` before shipping; never commit `package-lock.json`; git lock-sweep before device-side git commands.
- First leg: scenario launcher. UI form: Debug tab + battle overlay (both). Gating: `import.meta.env.DEV` only. Scenarios: JSON files checked into the repo, with live-battle export.
- Key asset (from the audit): `IBattleState` is pure JSON data, the RNG seed is a plain string in state, and hooks are ID strings resolved against module registries — snapshot/replay is architecturally cheap. The main debt is creation-path nondeterminism and the total absence of dev gating.

## Decisions so far

- [Engine readiness audit](tickets/01-engine-readiness-audit.md) — Engine is snapshot-friendly (pure-JSON state, string seed threaded through reducers, registry-resolved hooks); nondeterminism is confined to battle *creation* (`Date.now`/`Math.random`/`randomUUID` in `battleFactories.ts`); `battleSlice.setBattleState` already injects arbitrary battles; **no dev gating exists anywhere** — Balance/Studio tabs and `window.runSim` ship to players today. Full findings: [research/01-engine-readiness.md](research/01-engine-readiness.md).

## Not yet specified

- Build-out of each surface (launcher UI, battle overlay, save-editor panel, sim CLI) — graduates into implementation tickets as [Scenario schema v1](tickets/02-scenario-schema.md), [Debug gating architecture](tickets/03-debug-gating-architecture.md), [Live-manipulation command set](tickets/05-live-manipulation-command-set.md), [Save/run editor verbs](tickets/07-save-run-editor-verbs.md), and [Batch sim & auditor design](tickets/08-batch-sim-auditor-design.md) resolve.
- Scenario regression suite — running checked-in scenario JSONs as vitest replay tests; needs the schema and [Determinism groundwork](tickets/09-determinism-groundwork.md) first. Includes the injectable-clock / event-timestamp policy (event logs carry `Date.now()` and will never diff clean).
- Whether the pending shared-deck vs per-mingming-deck structural decision (tracked outside this map) changes the scenario schema — revisit when that lands.
- Auditor report format and redline thresholds (`balance_report.json`, budget rules from `docs/balance_testing.md` §1) — sharpens after batch-sim design.
- Electron/Steam packaging interaction with dev gating — far off; revisit near release.

## Out of scope

- Card *authoring* tooling — Card Studio/Card Form improvements, JSON registry migration, editor file IO (Epic 9.1/9.2/9.4). This effort tests existing content. (Moving the existing Studio/Balance tabs behind the gate **is** in scope, via [Debug gating architecture](tickets/03-debug-gating-architecture.md).)
- Player-facing debug access in shipped builds — the gating decision locked dev-build-only.
- The shared vs per-mingming deck structural decision itself — only its schema impact is watched here.
- Fixing the gameplay bugs the toolkit repros — normal dev work outside this map.
