# Scenario schema & normalizer implementation

- Type: wayfinder:task
- Status: open
- Assignee:
- Blocked by: — ([Scenario schema v1](02-scenario-schema.md) closed)

## Question

Mechanical build-out of the schema locked in [Scenario schema v1](02-scenario-schema.md) sections
1–4. No design decisions remain; every shape, default and file path is specified there.

Checklist:

- `ScenarioSchema` (zod, discriminated on `kind`) + `ComposedSetup` / `PartyMemberSetup` /
  `EnemySetup`, with `CURRENT_SCENARIO_VERSION = 1` and a `migrateScenario` step in the
  `parse → migrate → validate` order `SaveSystem.ts:78-94` uses. IV bounds and the max-3 party cap
  mirror `MingmingInstanceSchema` / `PlayerSaveSchema` (`SaveSystem.ts:13-24,61`).
- `computeRegistryHash()` — FNV-1a over sorted `id \0 JSON.stringify(def)` across the Mingming,
  Program and firmware/OS registries; returns `<algoVersion>:<8 hex>`. Hook registry excluded (lazy
  init — see the resolution's rationale).
- `normalizeBattleState(state)` — fill class and strip class exactly per the resolution's section 3
  table. This is the only exported path to a comparable state.
- `loadScenario` / `saveScenario` helpers that route through both of the above, plus the
  registry-hash mismatch warning (loud, non-blocking).
- `src/debug/scenarios/{repro,balance}/` created with a `.gitkeep` and one hand-written `composed`
  fixture so the loader has something to prove itself against.
- Unit tests: round-trip equality through normalize (the gap #9 regression), migration no-op at v1,
  hash stability across two calls, hash change when a registry entry changes.

Code lands under `src/debug/`; the exact sub-layout defers to
[Debug gating architecture](03-debug-gating-architecture.md) if that resolves first — the schema
module is import-clean either way, so this ticket does not wait on it.

Done when: `npx vitest run` + `npx tsc -b` + `npx vite build` all green, and `vite build` output
contains no scenario JSON.
