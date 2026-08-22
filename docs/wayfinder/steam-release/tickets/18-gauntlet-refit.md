# Gym gauntlet refit: three unhealed fights, boss draws one mingming per biome (ticket 18)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [11](11-encounter-flow.md), [15](15-macros.md)
- Phase: Vertical Slice

## Deliverable

**From [ticket 11](11-encounter-flow.md) (2026-08-22): the gauntlet chain is gone and this ticket
rebuilds it.** `BattleArena`'s old flow — `updateGauntlet` (bump the index, stash HP) → re-enter →
`completeGauntlet` — was deleted rather than ported, because `IRunState.gauntlet` stays null for the
whole run today and porting it would have replayed fight one forever. What survives is the durable
half: winning at the gym node dispatches `markGymCleared` + `recordTierCleared` + `endRun('victory')`.

So ticket 18 owns: the reducers that drive `IGauntletProgress` (`fightIndex`, `totalFights`,
`persistedHp`, `downedMemberIds`), the three-unhealed-fights chain itself, and the boss drawing one
mingming per biome. Two notes for whoever picks it up:

- **`persistedHp` is the ONLY HP carry-over in the codebase.** Everywhere else, a full heal between
  nodes is true by construction (ticket 11 asserts it), so the gauntlet is the single exception and
  `buildBattleSetup` already threads it.
- **`GauntletContext` in `debug/scenarios/scenarioSchema.ts` still carries the v3 shape** (`type`,
  `element`, `currentBattleIndex`, `totalBattles`, `persistedStats`). It is a debug file format with
  its own registry-hash versioning and `buildScenarioState` ignores the field entirely, so ticket 11
  left it alone — reconcile it with `IGauntletProgress` here.

Refit `startGauntlet`/`updateGauntlet`/`completeGauntlet` + `battleFactories` gym tiers: three fights, NO heal between them (HP carries — extend `persistedStats`; whether statuses also carry is Henry's call, ask before building), always full 3v3 curated (if the player has fewer than 3, the fight is still 3 vs N — confirm with Henry, see Questions), the BOSS team draws one species from each of the run's three biomes (the run trains you for its own exam) and carries signature firmware (the `boss_relic_*` OSes exist — authored bosses are ticket 28). A member that faints in fight 1 or 2 is **revivable, never gone-for-gauntlet**; the Revive Macro (ticket 15) is the first shape; the exact revive economy is DEFERRED TO PLAYTESTING (ticket 25), so build the hook, not the policy. A between-fights screen (the old "Pit Stop" idea) showing HP, Macros, and the next opponent's visible types.

## Done when

A run can be completed end-to-end through a gauntlet in the dev build; FTK/stall gates hold for the boss comps (`teamComps.ts` reused).

## Resolution

_(open)_

