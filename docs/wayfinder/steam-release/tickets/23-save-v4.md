# Save schema v4: ranch + run, migration from v3, in-progress run survives restart (ticket 23)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [06](06-run-data-model.md)
- Phase: Vertical Slice

## Deliverable

Land ticket 06's ratified shape (prototyped in `src/engine/runTypes.ts`) in `engine/SaveSystem.ts`: `CURRENT_SAVE_VERSION = 4`, blueprint counts, codex, no `cardInventory`/`scrapCount`/`level`/`experience`.

**Two storage keys, not one blob** (Henry, 2026-08-21). Ranch and run are written independently so a corrupt run costs the run and nothing else — the ranch holds the only irreplaceable things in the game (blueprints are the only persistent currency; individuals carry unrepeatable stat rolls). The price is that the two cross-object laws can no longer be schema refinements: port `reconcileLoadedState()` from the prototype, which enforces them at load and, on any failure, **discards the run and keeps the ranch** — never half-repairs. **One run slot**; an in-progress run survives app close.

**NO v3 → v4 MIGRATION — v4 is the floor** (Henry, 2026-08-21). Anything whose `version` is not 4 reads as *no save*, not as corruption. That distinction is load-bearing: ticket 04's `loadGame` treats a parse failure as corruption and clings to the last good save, which is exactly the wrong response to a v3 save that is meant to be abandoned. The `playtest-results/` files named in this ticket's original text are **not saves** — all 14 are battle snapshots (`{"kind":"snapshot"}`) on `debug/scenarios/scenarioIO.ts`'s own `registryHash` versioning, untouched by any of this. The only v3 data in existence is in Henry's own browser.

So this ticket **deletes** rather than extends:

- `migrateSave()` and its v1→v2 / v2→v3 branches (`SaveSystem.ts`, ~45 lines), and the migration cases in `SaveSystem.test.ts`.
- `migrateSave`'s import and use in `debug/saveEdit.ts:206` (`parseSaveFileText`) — the save-editor's file-import path validates instead of migrating. `debug/saveSlots.ts` and `debug/panels/SaveSlotsPanel.tsx` document that path in comments and need the same edit.
- `SaveSlots.ts`'s legacy `mingming_save` adoption-by-copy, which exists to rescue pre-slot saves and has nothing left to rescue.

**Revisit v3's `.catch()` habit while you are in here.** `PlayerSaveSchema` uses `.catch([])` on `blueprints`, `relics`, `unlockedSectors` and `baseDecksGranted`. `.catch` replaces *malformed* input with the fallback and lets the parse succeed — harmless when blueprints were a dedup'd list nobody could spend, data loss now that they are consumable currency, because the next autosave writes the emptiness over the good save. The prototype uses `.default()` (fills a **missing** field, fails on a **malformed** one) and its own test caught the bug. Use `.default()` here too.

Autosave writes each key on its own slice change. `SaveSlots` keeps working (player-facing slot UI stays a later ticket).

**Also introduce the storage-adapter seam** (added 2026-08-21, Henry's call, from [ticket 26](26-wrapper-research.md)'s findings). Steam Cloud syncs **files**; `localStorage` is not one, so the desktop build has to write a JSON file under `app.getPath('userData')` while the web build keeps using `localStorage`. Production code touches `localStorage` at only **six call sites in three files** — `SaveSystem.ts` (4), `SaveSlots.ts` (1, already a `storage(): Storage | null` accessor), `AudioEngine.ts` (1, the same accessor shape) — so the seam is one small interface behind that existing accessor, backed here by `localStorage` and later by a file backend in [ticket 42](42-desktop-packaging.md).

It belongs in this ticket rather than 42 for one reason: **42 would otherwise have to re-open the save layer immediately after 23 rewrote it**, and editing `SaveSystem.ts` twice for two unrelated reasons is how a migration gets broken. This ticket does not need to write the file backend — only to make sure nothing outside the adapter names `localStorage`.

## Done when

An app close mid-run resumes at the same node with the same seed; a v3 blob in storage starts a new game rather than reporting corruption; a corrupt run leaves the ranch intact (the prototype's `reconcileLoadedState` cases ported and green); `grep -rn "migrateSave" src` returns nothing; and `grep -rn "localStorage" src --include=*.ts --include=*.tsx | grep -v '\.test\.'` returns hits **only inside the storage adapter** (comments aside).

## Resolution

_(open)_

