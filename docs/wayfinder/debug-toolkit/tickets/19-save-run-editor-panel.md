# Save/run editor panel

- Type: wayfinder:task
- Status: open
- Assignee:
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
