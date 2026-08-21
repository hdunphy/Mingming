# Save schema v4: ranch + run, migration from v3, in-progress run survives restart (ticket 23)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [06](06-run-data-model.md)
- Phase: Vertical Slice

## Deliverable

Land ticket 06's ratified shape in `engine/SaveSystem.ts`: `CURRENT_SAVE_VERSION = 4`, `RunStateSchema` embedded (nullable — no run in progress), blueprint counts, codex, no `cardInventory`/`scrapCount`/`level`. `migrateSave` v3 → v4 with tests (existing playtest saves in `playtest-results/` are fixtures). Autosave continues to write the whole save on `state.game`/`state.run` change. `SaveSlots` keeps working (player-facing slot UI is a later ticket if ticket 06 rules several slots).

## Done when

`SaveSystem.test.ts` covers v1 → v4 chain; an app close mid-run resumes at the same node with the same seed.

## Resolution

_(open)_

