# Gym gauntlet refit: three unhealed fights, boss draws one mingming per biome (ticket 18)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [11](11-encounter-flow.md), [15](15-macros.md)
- Phase: Vertical Slice

## Deliverable

Refit `startGauntlet`/`updateGauntlet`/`completeGauntlet` + `battleFactories` gym tiers: three fights, NO heal between them (HP carries — extend `persistedStats`; whether statuses also carry is Henry's call, ask before building), always full 3v3 curated (if the player has fewer than 3, the fight is still 3 vs N — confirm with Henry, see Questions), the BOSS team draws one species from each of the run's three biomes (the run trains you for its own exam) and carries signature firmware (the `boss_relic_*` OSes exist — authored bosses are ticket 28). A member that faints in fight 1 or 2 is **revivable, never gone-for-gauntlet**; the Revive Macro (ticket 15) is the first shape; the exact revive economy is DEFERRED TO PLAYTESTING (ticket 25), so build the hook, not the policy. A between-fights screen (the old "Pit Stop" idea) showing HP, Macros, and the next opponent's visible types.

## Done when

A run can be completed end-to-end through a gauntlet in the dev build; FTK/stall gates hold for the boss comps (`teamComps.ts` reused).

## Resolution

_(open)_

