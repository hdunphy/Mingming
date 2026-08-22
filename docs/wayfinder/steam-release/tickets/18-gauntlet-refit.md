# Gym gauntlet refit: three unhealed fights, boss draws one mingming per biome (ticket 18)

- Type: wayfinder:task
- Status: closed
- Assignee: agent
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

**Closed 2026-08-22.** Three unhealed fights, a boss drawn from the run's own biomes, a Pit Stop
between them. Suite **1323 → 1380**, `tsc -b` clean, build green.

### The two questions this ticket said to ask you — readings taken, both reversible

**1. Statuses do NOT carry. HP only.** This is not really a guess: `IGauntletProgress` is a
*ratified* type (ticket 06) with `persistedHp` and `downedMemberIds` and nowhere to put a status,
and the v3 schema it replaced said it out loud — *"only HP persists between gauntlet battles (health
is the resource you manage across the run). Energy, statuses, and everything else reset fresh each
battle."* One argument of my own on top: carrying Burn would make Kindle the best macro in the game
for fight 1 and dead for the other two. Pinned as behaviour by a test called "carries HP and NOTHING
ELSE".

**2. The boss team is always THREE, whatever you bring — flagged as a reading.** The run hands you
two workshops to reach a full party (ticket 14), so arriving solo is a choice with a consequence,
which is what makes "recruiting IS drafting" mean anything. It is a difficulty decision you may want
to soften, so it is one constant (`GAUNTLET_ENEMY_COUNT`) plus `enemyPartySize` — **two lines to
reverse.** Tested at 1, 2 and 3 members, including an end-to-end 1-vs-3.

### THE LOUDEST OPEN ITEM: the gym now pays three times what it was sized for

`BLUEPRINT_DROP_RATE.gym = 0.50` per body and `SCRAP_PER_ENEMY.gym = 20–30` per body were set by
ticket 12 **when the gym was one fight**. It is three fights of three bodies now, so a gauntlet pays
roughly **4.5 blueprints and ~225 scrap**. Blueprints are the only persistent currency, so this is
the number most worth your attention. Nothing was changed — it is a one-line rate change once you
rule, and `RewardSystem`'s own comment already predicted that ticket 18 would want "one authored
award" instead of a per-body roll.

Related, smaller: the post-fight **card pick still fires between gauntlet fights**. Cards are not HP
so the no-heal rule does not forbid it, but it is a between-fights buff and you may not want one.

### What was deleted from `battleFactories`

The whole `else if (setup.gauntlet)` branch: the hardcoded `synergyMap` (Fire+Earth, Water+Nature,
Ice+Dark), tier 1's `nextInt(1,2)` grunt count, tier 2's elite `generateEncounter`, and tier 3's
`${element} Sector Warden` at 1.5x max HP with three hardcoded moves flanked by two "Firewall
Sentinel" guards and an empty deck. **`IBattleSetup.gauntlet` went with it** — that branch was its
only reader, so a gauntlet now hands the factory nothing but `persistedHp`. A comment at the deletion
site records which ruling each part contradicted.

### The boss

One species from **each of the run's three biomes** — the run trains you for its own exam — with
`boss_relic_*` signature firmware, de-duplicated across the team so two biomes sharing an element
cannot stack two identical relics. Nature draws `boss_relic_ice`, because only three relics exist and
ice is the only one whose effect names no element. Boss nicknames (`Emberfall Champion Fenrir`) are
placeholder casting for **ticket 28**.

Fights seed from `nodeSeed(run, node, ...)` with the fight index folded in, so fight 2 is not fight 1
and a resumed gauntlet rebuilds the same opponents. Decks are biome-3 depth — full tuned + OS, per
ticket 08's `KIT_FRACTION_BY_BIOME`.

### Revive: the hook, not the policy

A revived member leaves `downedMemberIds` and enters `persistedHp` — both at fire time (the explicit
`reviveGauntletMember` hook) and again at fight end (`advanceGauntlet` recomputes), so a revive
cannot be lost to ordering. `REVIVE_PERCENT_MAX_HP` is one named constant with its argument attached
and **the economy stays ticket 25's**, as `economy-session.md` defers it.

### `GauntletContext` reconciled — and NO stored scenario is affected

It now matches `IGauntletProgress`. **No version bump**, and that was checked rather than assumed:
all 37 committed `.scenario.json` carry `"gauntlet": null` or omit it (it is a *composed*-only field
and `createDraft` hardcodes null, so a v3-shaped object was unreachable, not merely absent), and all
14 files in `playtest-results/` are `kind: "snapshot"` with no `setup` at all. Bumping
`CURRENT_SCENARIO_VERSION` with nothing to migrate would re-stamp every future file to describe a
no-op, so it stays 1 and the reasoning sits above the schema.

### Balance — the gate exists; the numbers are yours to commission

`src/debug/balance/gauntlet-boss.balance.ts` runs the FTK/stall gate over `BOSS_COMPS` in
`teamComps.ts` — **all eight** teams the draw can produce (2 launch species x 3 elements is the whole
boss space, not a sample). Run it alone with:

```
npx vitest run --config vitest.balance.config.ts src/debug/balance/gauntlet-boss.balance.ts
```

`GAUNTLET_BOSS_SEEDS` buys sample; `GAUNTLET_BOSS_ONLY=<comp-id>` scopes to one comp.

**From a 1-seed smoke pass (one comp, 12 battles): FTK 0, no stalls, average 4.6 turns — and the boss
team won 12 of 12.** Far too small a sample to be a number, but it is the shape a real pass should be
pointed at. Also measured: a 3v3 battle costs **~300x a 1v1** in this harness (~20–33s against
~60ms), which is pre-existing to ticket 98's `teamScenario` rather than anything added here, and is
why the file documents its timeout arithmetic.


