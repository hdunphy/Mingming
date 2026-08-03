# Save reward actions

- Type: wayfinder:task
- Status: open
- Assignee:
- Blocked by: — ([Save/run editor verbs](07-save-run-editor-verbs.md) closed)

## Question

Add two **general-purpose** game actions to `gameSlice` that the save editor consumes first and
future reward content (a sector-unlock relic, an XP card) consumes later. Specified by
[Save/run editor verbs](07-save-run-editor-verbs.md) sections 2 and 3. Pure production game work,
no debug dependency.

Checklist:

- `unlockSector(element: string)` — appends to `save.unlockedSectors` if absent. Note this field is
  currently written **only** at save creation (`gameTypes.ts:108,164`) and never mutated; this is the
  first mutation path. `SectorTerminal.tsx:71,134,140,160` reads it.
- `grantExperience({ mingmingId, amount })` — adds XP to a roster instance and runs the **same
  level-up loop the battle path uses** (`getExpForLevel`, `handleLevelUp` in `effectHandlers.ts`), so
  a grant that crosses several thresholds behaves identically to earning it.
- **Do not** wire `IRewardBundle.totalXP` into `applyRewardBundle`. The "rewards grant no XP" rule at
  `gameSlice.ts:169-170` is deliberate and stays — see 07 section 3. Leave `totalXP` unused.
- **Do not** add a gauntlet-stage setter. Ruled out of v1: no plausible game mechanic grants it, so
  it would be debug-only code in a production slice. Audit gap #20 stays open by design.
- Tests: unlocking an already-unlocked sector is a no-op; a large XP grant levels up correctly across
  multiple thresholds; both leave the save `PlayerSaveSchema`-valid.

Done when: `npx vitest run` + `npx tsc -b` + `npm run build` all green.
