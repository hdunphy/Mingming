# Scenario schema & normalizer implementation

- Type: wayfinder:task
- Status: closed
- Assignee: subagent-10-schema (cowork-2026-08-03-opus5)
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

## Implementation status — 2026-08-03

Code landed by subagent `a5647a3b407673646`; **open until Henry's gates pass.** All files are new,
under `src/debug/scenarios/`: `scenarioSchema.ts`, `registryHash.ts`, `normalizeBattleState.ts`,
`scenarioIO.ts`, `scenarioTestSupport.ts`, four test suites, `repro/`+`balance/` keepers, and a
hand-written composed fixture using real registry ids. The optional `tape` field is included per
06's amendment. Verified via the TypeScript compiler API (0 diagnostics) and a transpiled 21-assertion
harness.

Findings that qualify the resolution:

- **`entity.activeOS` cannot always hold its documented default.** `GetMingmingData(id).availableOS[0]`
  is `undefined` for an unresolvable `definitionId` (the fallback definition has `availableOS: []`).
  In that one case the key is left **absent**, because present-and-undefined breaks round-trip
  equality. Every other fill-class field holds its default without a type change.
- **The normalizer canonicalizes presence/absence, not key order.** Replay diffs must therefore
  compare structurally (`toEqual`), never by `JSON.stringify` comparison. Worth carrying into the
  regression-suite work.
- **`computeRegistryHash()` must force `initFirmwareHooks()` open** before reading
  `FIRMWARE_REGISTRY`, because that registry sits behind the *same* lazy `isInitialized` guard the
  resolution cited when excluding the hook registry. Forcing it is the only way to include
  firmware/OS as specified. It hashes the raw `ProgramRegistry`, not `getInflatedProgramRegistry()`
  (also lazily built).
- `elementPlays`/`counters` validate as `z.record(z.string(), z.number())` — a zod enum-keyed record
  demands exhaustive keys and would reject a legitimately partial snapshot *before* the normalizer
  zero-fills it, since validation runs first. Matches `GauntletStateSchema`'s existing precedent.
- **One-time chore on Windows:** the fixture's `registryHash` is a placeholder `"1:00000000"` — the
  real hash cannot be computed on the Linux VM. Load and re-save it once to stamp it. It currently
  exercises the non-blocking drift path, which is at least the right code path.
- No `import.meta.glob` scenario index yet — deliberately left to the launcher/materializer tickets.

## Resolution

**Closed 2026-08-03.** Gates green on Windows, and `assert-no-debug` confirms none of `src/debug/scenarios/` reaches `dist/`. One outstanding chore: re-stamp the fixture's placeholder `registryHash` by loading and re-saving it on Windows.
