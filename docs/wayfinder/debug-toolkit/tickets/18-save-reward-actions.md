# Save reward actions

- Type: wayfinder:task
- Status: closed
- Assignee: subagent-18-save-actions (cowork-2026-08-03-opus5)
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

## Implementation status — 2026-08-03

Code landed by subagent `a39fa428ebc86d02d`; **open until Henry's gates pass.** `grantExperience` and
`unlockSector` added to `gameSlice.ts` (CRLF preserved) plus
`src/ui/store/gameSlice.rewardActions.test.ts`.

Level-up semantics match `handleLevelUp` exactly: `while (exp >= getExpForLevel(level + 1)) level++`,
cumulative XP never spent, no cap (there is no `MAX_LEVEL` anywhere in `src/`). Confirmed by
simulation that 100 sliced grants land on the identical level and XP as one large grant.

Three structural divergences from the engine path, none behavioural drift:

1. `handleLevelUp` also rebuilds `maxHp`/`attack`/`defense` on an `IBattleEntity`. `IMingmingState`
   stores none of those — they are recomputed by `initializeBattleEntity` — so a granted level yields
   the same battle-entry stats as an earned one.
2. No `LEVEL_UP` bus event or `levelUpQueue` push: those live in `addExperience`'s battle-state
   caller, and there is no battle state out of combat.
3. Guards the engine lacks — non-finite and non-positive amounts return early, and the amount is
   floored — required to keep `experience` a non-negative integer for `PlayerSaveSchema`, given the
   silent-autosave hazard. The engine only ever passes `calculateDeathXp`'s positive integer.

`IRewardBundle.totalXP` left unused as decided. No gauntlet-stage setter; gap #20 open by design.
Note: `getExpForLevel` was already imported into `gameSlice.ts` and unused before this change.

## Resolution

**Closed 2026-08-03.** Gates green on Windows. `unlockSector` is the first mutation path that field has ever had; `grantExperience` matches the engine's level-up progression exactly.
