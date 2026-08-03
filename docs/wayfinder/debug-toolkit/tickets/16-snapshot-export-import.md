# Snapshot export & import

- Type: wayfinder:task
- Status: closed
- Assignee: subagent-16-snapshot-io (cowork-2026-08-03-opus5)
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

## Resolution

**Closed 2026-08-03.** Gates green (run in the cloud sandbox on Linux while Henry was AFK; `tsc -b`, `vitest run` 47 files / 542 tests, `npm run build` incl. `assert-no-debug`, all exit 0).

`src/debug/snapshotIO.ts` + `SnapshotPanel`. Export normalizes, wraps in the ticket-02 envelope,
stamps `registryHash`, and downloads as `snapshot-t<turn>-<seed>.scenario.json` with no prompt.
Import accepts **both** `snapshot` and `composed` files (the latter materialized through ticket 11's
`buildScenarioState`), works mid-battle, no confirm. 24 tests.

Notes from implementation:

- **`DebugRoot` mounts twice** — `App.tsx` renders the floating layer *and* a docked instance when
  the Debug tab is open. A per-instance listener would download two files per keystroke, so hotkey
  owners are refcounted behind one window listener. This is a real bug that would have been very
  hard to diagnose from symptoms.
- `downloadCSV`'s pattern leaks its object URL; the copy here adds `URL.revokeObjectURL`.
- The parent added a `getTape` option (a getter, not an array) because `DebugRoot` does not
  re-render on every dispatch, so a plain `tape` array would be stale at keypress time.
- An imported tape is displayed, never replayed — gated on determinism, now satisfied, so replay is
  available to a future regression-suite ticket.
