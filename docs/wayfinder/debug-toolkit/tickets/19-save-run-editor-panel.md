# Save/run editor panel

- Type: wayfinder:task
- Status: closed
- Assignee: subagent-19-save-editor (cowork-2026-08-03-opus5)
- Blocked by: [Save reward actions](18-save-reward-actions.md)

## Question

Build the save editor panel inside the docked Debug tab. Specified by
[Save/run editor verbs](07-save-run-editor-verbs.md).

Checklist:

- Verbs: grant scraps / blueprints / relics / cards, add to roster, set `activeOS`, heal party,
  unlock sector, grant XP, wipe save, replace save from file. No "max everything" preset.
- **Every mutation dry-runs `PlayerSaveSchema.parse()` on the prospective save before dispatch** and
  surfaces failures loudly in the panel. Never dispatch first and check after — that races the
  autosave subscription (`store.ts:20-31`) whose silent failure this exists to prevent.
- Label verbs accurately: "grant blueprint", not "unlock species"; "set activeOS", not "unlock OS".
  Neither is a flag in the save.
- Panel lives in the docked Debug tab only; nothing save-related in the floating overlay.
- Surface the current save's validity somewhere visible, so a wedged autosave is noticeable.
- Tests: each verb produces a schema-valid save; a deliberately invalid edit is refused before
  dispatch and leaves the store untouched.

Done when: `npx vitest run` + `npx tsc -b` + `npm run build` all green, and an invalid edit is
provably refused rather than silently wedging the autosave.

## Resolution

**Closed 2026-08-03.** Gates green (run in the cloud sandbox on Linux while Henry was AFK; `tsc -b`, `vitest run` 47 files / 542 tests, `npm run build` incl. `assert-no-debug`, all exit 0).

`src/debug/saveEdit.ts` (React-free) + `SaveEditorPanel`. 29 headless tests, including the two
obligations: every verb yields a schema-valid save, and an invalid edit is refused with `dispatch`
never called and the store still reference-identical.

Notes from implementation:

- **The dry run is tighter than specified.** `gameSlice`'s reducer is pure, so `projectSave` calls
  `gameReducer(current, action)` directly outside the store to build the *exact* prospective state,
  validates that, then dispatches the same action object. Immer's copy-on-write means nothing
  observes it and no subscriber runs. `prepareEdit` also catches a reducer that *throws* on a
  malformed payload.
- Caveat: `addToRoster`'s base-deck grant mints ids with `crypto.randomUUID()`, so projected and
  dispatched saves differ in those id *values*. The schema treats them as opaque strings, so validity
  — all the dry run claims — is identical.
- **`healParty` is a genuine no-op on the save**: roster HP is not persisted. The only HP the save
  carries is `gauntlet.persistedStats`, and no existing action resets it without also advancing
  `currentBattleIndex`. The verb is present and the panel says plainly that it changes nothing.
- Validity banner has three states: red **AUTOSAVE WEDGED** (live state fails the schema, with the
  offending paths), amber **stored copy is behind** (valid but the last autosave did not land), green
  in-sync.
