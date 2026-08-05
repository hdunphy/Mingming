# Action tape

- Type: wayfinder:task
- Status: closed
- Assignee: subagent-17-action-tape (cowork-2026-08-03-opus5)
- Blocked by: [Scenario schema & normalizer](10-scenario-schema-implementation.md) ([Debug gating scaffold](12-debug-gating-scaffold.md) closed)

Correction 2026-08-03: originally listed as unblocked, but this ticket adds the optional `tape` field to
the `ScenarioSchema` that ticket 10 creates, so it cannot land first.

## Question

Record dispatched actions so an exported snapshot carries the sequence that produced it. Specified by
[Battle snapshot export](06-battle-snapshot-export.md) section 1.

Checklist:

- `src/ui/store/store.ts` — add a **general-purpose** tap point: a module-level `actionTap`, an
  exported `setActionTap(fn)`, and a forwarding middleware that calls it when set. ~15 lines.
  **Nothing debug-shaped, no import from `src/debug/`** — this preserves ticket 03's single
  import edge, exactly as ticket 05 did for the reducer.
- `DebugRoot` installs itself as the tap on mount and clears it on unmount, buffering actions since
  battle start into a ring buffer in `src/debug/`.
- Reset the buffer when a new battle starts (`state.battle.sessionId` changes).
- Extend the ticket-02 `ScenarioSchema` with an **optional** `tape` field on the `snapshot` kind.
  Optional means **no `CURRENT_SCENARIO_VERSION` bump** — older files lack it and still validate.
  Confirm `migrateScenario` is a no-op for this.
- Known limit, do not try to fix here: ticket 05's god-tool verbs dispatch
  `setBattleState(verb(...))`, so they appear in the tape as opaque state replacements rather than
  named verbs. [Battle debug overlay](15-battle-debug-overlay.md) can stamp labels later.
- Test: the tap is inert when nothing installs it; the buffer resets across battles; a recorded tape
  survives an export/import round trip.

Done when: `npx vitest run` + `npx tsc -b` + `npm run build` all green, and a production build
contains no tap consumer (the tap point itself ships, inert, by design).

## Resolution

**Closed 2026-08-03.** Gates green (run in the cloud sandbox on Linux while Henry was AFK; `tsc -b`, `vitest run` 47 files / 542 tests, `npm run build` incl. `assert-no-debug`, all exit 0).

`src/ui/store/store.ts` gains the general-purpose tap point (`ActionTap`, `setActionTap`, forwarding
middleware, ~20 lines, no import from `src/debug/`); `src/debug/actionTape.ts` holds a 256-entry ring
buffer installed by `useActionTape()` from `DebugRoot`. 11 tests.

Notes from implementation:

- **Battle boundary detected via `sessionId` change** through `store.subscribe`, so it catches both
  `startBattle` and a mid-battle snapshot import without naming either action. The boundary action
  itself is kept as the new tape's first entry — the tape opens on its own first cause.
- Installs are refcounted and disposers idempotent, because `DebugRoot` mounts twice and StrictMode
  double-invokes effects; otherwise leaving the Debug tab would silently disarm recording.
- No measurable dispatch cost when nothing is installed: one null check, and `dispatch` still returns
  the action unchanged.
- **Known and accepted:** entries are raw and unfiltered, so `setBattleState` records a whole
  `IBattleState` — which is exactly why the 256-entry bound exists. God-tool verbs therefore still
  appear as opaque state replacements.
- Flagged, not fixed: the tap call is not wrapped in try/catch, so a throwing tap would propagate
  into `dispatch`.
