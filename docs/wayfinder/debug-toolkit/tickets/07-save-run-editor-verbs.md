# Save/run editor verbs

- Type: wayfinder:grilling
- Status: open
- Assignee:
- Blocked by: —

## Question

What can the save/run editor do, and how does it stay safe against the silent-autosave hazard?

To decide:

- **Verb list v1.** Candidates: grant scraps / blueprints / relics / cards; grant XP or set level on a roster mingming; set a mingming's `activeOS` ("unlock OS" has no flag — it's an `activeOS` write; "unlock species" = blueprint grant, per audit); unlock sectors; jump to an arbitrary gauntlet stage (**needs a new reducer** — `updateGauntlet` only increments, audit gap #20); wipe/replace the whole save (`loadSave` exists); "max everything" one-click preset.
- **Safety.** The store autosaves on every game-state change and a schema-invalid save fails *silently* (`store.ts:18-31`, audit gap #18). Rule: every editor mutation dry-runs `PlayerSaveSchema.parse()` before dispatch, and the editor surfaces validation errors loudly. Confirm, and decide whether edits go through existing `gameSlice` actions (preferred per audit) vs a wholesale `loadSave` round-trip.
- **Placement.** Panel inside the Debug tab; anything needed mid-battle stays out of scope here (that's the overlay's job).
