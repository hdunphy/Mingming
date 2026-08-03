# Snapshot export & import

- Type: wayfinder:task
- Status: open
- Assignee:
- Blocked by: [Scenario schema & normalizer](10-scenario-schema-implementation.md), [Debug gating scaffold](12-debug-gating-scaffold.md)

## Question

Wire the export/import loop. Specified by [Battle snapshot export](06-battle-snapshot-export.md)
sections 2 and 3.

Checklist:

- Export: normalize via `normalizeBattleState()`, wrap in the ticket-02 envelope with
  `kind: 'snapshot'`, `registryHash` from `computeRegistryHash()`, and the `tape` if one is recorded.
- Blob download reusing the `downloadCSV` pattern (`BalanceTester.tsx:96-111`). Auto-name
  `snapshot-t<turn>-<seed prefix>.scenario.json`. **No dialog, no prompt.**
- Trigger: a button in the `DebugRoot` overlay **and** Ctrl+Shift+E, which must work without the
  overlay being open. Same input-focus guard as Ctrl+Shift+D.
- Import: file picker in the overlay and in the launcher panel; `loadScenario` → `setBattleState`.
  Works mid-battle, replaces the battle in progress, **no confirm step**.
- Registry-hash mismatch shows the loud non-blocking banner from ticket 02.
- An imported `tape` is displayed but **not** replayed (gated on
  [Determinism groundwork](09-determinism-groundwork.md)).
- Test headlessly: export→import round-trips to a deep-equal normalized state.

Done when: `npx vitest run` + `npx tsc -b` + `npm run build` all green, and a live battle can be
exported and loaded back mid-battle in `npm run dev`.
