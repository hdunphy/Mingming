# Action tape

- Type: wayfinder:task
- Status: open
- Assignee:
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
