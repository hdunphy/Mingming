# Ticket 169: Tiers and run modifiers

> **CLOSED 2026-10-02 (housekeeping, at the move to `first-impressions`).** Every row is built: 169a–169j (`47dce56..6621b9c`). The status line below is kept as history.

**Type:** content + run systems. **Status:** OPEN, **do not start until Henry says go.** He ruled to build this after ticket 168 is in and one playtest has checked run length and scrap on the new build. This is the build ticket for steam-release ticket 29 ("Difficulty tiers and opt-in run modifiers"), and it answers ticket 27's last open question (b): the launch modifier count is **5**.

**Why.** The game has one difficulty. Most of the plumbing for more already exists, but none of it can be reached:

- `IRunState.tier` is copied from the chosen gym (`createRun.ts`, `tier: offer.gym.tier`), and all three gyms are `tier: 0` (`gyms.ts`), so every run is tier 0.
- `enemyLoadoutFor` (`encounter.ts`) already raises the wild rung at tier 2 (firmware) and tier 3 (lite AI), which is ticket 60. Tier 1 does nothing.
- The ranch saves `highestTierCleared`, but its default is 0 and `recordTierCleared(0)` is a no-op, so "nothing cleared" and "tier 0 cleared" look the same.
- `IRunState.modifiers` exists, but it only stores map reveals (`reveal:biome:N`) and banked blueprints. There are no actual modifiers.
- **Enemy Drivers already work.** `IBattleSetup.enemyDrivers` applies Drivers to the enemy party (`battleFactories.ts`). Each gym's boss fight (gauntlet fight 3) carries its signature Driver (`gauntlet.ts`, `rollGauntletFight`), and so do final-biome elites (`encounter.ts`, `gymDriverForNode`). **No engine work is needed for tier 3.**

**Henry's rulings (2026-09-29):**

> Build order: *"Yes"* (design now, build after 168 and a playtest).
> The ladder: *"Looks good."*
> Unlocks: *"Each tier unlocks for all gyms but we add an achievement for each gym (all 9 clears)."*
> Enemy Drivers at tier 3: *"Keep it, add the engine if it's missing."* (It isn't missing; see above.)
> Modifiers: *"Use 1, 2, 4, 6, 7"*, which are Junk Start, Tight Budget, Elite Hunt, No Recruits and Draft Start.
> Defaults D1 to D6: *"Good with all those defaults."*

**The standing law this ticket obeys** (ticket 29, `vision.md`, ticket 21): **a tier never scales a stat.** Harder means different content (firmware, AI, more elites, Drivers), never bigger HP, damage or IVs. Row 169a adds a test that enforces it.

Ten rows, one commit each, **failing test first**. Build them in order.

| Row | What |
|---|---|
| 169a | `tiers.json`, and the wild rung reads it (tier 1 firmware, tier 2 lite AI) |
| 169b | Tier 2: one more elite per biome |
| 169c | Tier 3: the leader's Driver in all three gauntlet fights |
| 169d | The ranch records clears per gym per tier; tiers unlock |
| 169e | Run start: the tier picker, and the tier shown during and after a run |
| 169f | The modifier framework, plus Junk Start and Elite Hunt |
| 169g | Tight Budget |
| 169h | No Recruits |
| 169i | Draft Start |
| 169j | The walker plays tiers and modifiers, and a balance check that each tier is harder |

---

## How to work this ticket (read before any row)

1. **Read the whole row first.** Paths and line numbers were checked against `77a93e2` (2026-09-29). Line numbers drift; search for the quoted code.
2. **Test first, run it on the parent, see it fail.** Put "fails on parent: yes" in the commit message.
3. **Do not change anything a row does not list.** If a row seems to need something it does not name, stop and ask Henry.
4. **Numbers move in 5s** (a standing rule). Every number here is set; do not tune them.
5. **Gate:** `npm run gate` green before each commit.
6. **Commits:** authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`), **no `Co-Authored-By` trailers**, last line `HANDOFF: <one sentence>`. **Do not push.**
7. **Line endings:** keep each file's. CRLF under `docs/wayfinder`; new files under `src/` are LF.
8. **Small single-purpose modules** (Henry's standing preference): one file per concern. New tier code goes in `src/engine/run/tiers/`, new modifier code in `src/engine/run/modifiers/`, one file per modifier.
9. **Engine purity:** no React, Redux, `Math.random` or `Date.now()` under `src/engine`. Everything random goes through `SeedStream`.
10. **Report** in plain English at the end: per row what changed, and anything you had to decide.

---

## The ladder (approved by Henry 2026-09-29)

Tiers stack like Slay the Spire's Ascension: each tier includes everything below it. The opening fight (`OPENING_FIGHT_LOADOUT`) is the same at every tier.

| Tier | Name | Adds | Where |
|---|---|---|---|
| 0 | Standard | Today's game | none |
| 1 | Armed Wilds | Wild enemies run their firmware (ticket 60's tier-2 rung, moved down) | 169a |
| 2 | Elite Territory | One more elite in every biome, and wild enemies play the lite AI (60's tier-3 rung, moved down) | 169a, 169b |
| 3 | Leaders' Drivers | The gym leader's Driver is active in all three gauntlet fights, not just the boss fight | 169c |

**Unlocks:** beating any gym at tier N unlocks tier N+1 for every gym. Tier 0 is always open. The highest tier is 3.

**Achievements:** one per gym, earned by clearing that gym at tiers 1, 2 and 3 (nine clears across the three gyms). This ticket records the data (169d) and adds the three to ticket 44's list. Steam wiring is ticket 43.

## The modifiers (approved by Henry 2026-09-29)

These are opt-in toggles on the run-start screen. They are separate from tiers, any combination is allowed, and they give **no reward** beyond a label on the run screen and the run summary.

| id | Name | Description (printed as written) | Row |
|---|---|---|---|
| `junk_start` | Junk Start | Start with 2 Corrupted Data in your deck. | 169f |
| `elite_hunt` | Elite Hunt | Every rival is an elite. | 169f |
| `tight_budget` | Tight Budget | Marketplace and workshop prices +25%. | 169g |
| `no_recruits` | No Recruits | You can't recruit. The party you start with is the party you finish with. | 169h |
| `draft_start` | Draft Start | Draft your starting cards instead of being dealt them. | 169i |

---

## Defaults, approved by Henry 2026-09-29

> *"Good with all those defaults."*

Build these as written.

- **D1. A tier-2 extra elite in the final biome pays a patch**, like every final-biome elite (`fightBonusFor`, 166e). There is no special case. A body can still only take one patch.
- **D2. Modifiers unlock after your first gym clear** (any gym, any tier). Before that the modifier row is shown locked, with the line "Beat a gym to unlock modifiers."
- **D3. The tier picker opens on the highest tier you have unlocked.**
- **D4. Tight Budget applies to marketplace and workshop prices only.** Event costs (The Toll, Data Broker, Mirror Protocol) are not changed.
- **D5. Draft Start does not guarantee the payoff card.** That is the risk of drafting.
- **D6. Elite Hunt removes rivals entirely,** so the path species (ticket 142a) can only be met at the scout or recruited from blueprints. That is the modifier's cost.

---

## 169a: `tiers.json`, and the wild rung reads it

### Data

1. **`src/engine/data/tiers.json`** (new):

   ```json
   {
     "tiers": [
       { "tier": 0, "name": "Standard", "description": "The game as it is.",
         "wildFirmware": false, "wildAi": "greedy", "extraElitesPerBiome": 0, "leaderDriverEveryFight": false },
       { "tier": 1, "name": "Armed Wilds", "description": "Wild Mingmings run their firmware.",
         "wildFirmware": true, "wildAi": "greedy", "extraElitesPerBiome": 0, "leaderDriverEveryFight": false },
       { "tier": 2, "name": "Elite Territory", "description": "One more elite in every biome. Wild Mingmings play smarter.",
         "wildFirmware": true, "wildAi": "lite", "extraElitesPerBiome": 1, "leaderDriverEveryFight": false },
       { "tier": 3, "name": "Leaders' Drivers", "description": "The gym leader's Driver is active in all three gauntlet fights.",
         "wildFirmware": true, "wildAi": "lite", "extraElitesPerBiome": 1, "leaderDriverEveryFight": true }
     ],
     "leaderDrivers": {
       "gym_emberfall": "driver_war_footing",
       "gym_tidewrack": "driver_tidal_surge",
       "gym_rootfall": "driver_root_rot"
     }
   }
   ```

   Every row lists the whole state for that tier, not just what changed, so a designer reading one row sees everything. `leaderDrivers` is what gauntlet fights 1 and 2 carry at a tier with `leaderDriverEveryFight` (169c). It is filled with each gym's current signature Driver (`bosses.ts`), and a designer can change it.
2. **`src/engine/run/tiers/tierSchema.ts`** (new): a zod schema for that file, and a parse function that throws at load on a bad file. Model it on `src/engine/run/events/eventSchema.ts`. `wildAi` is one of the `AiTier` values in `TacticalAI.ts`.
3. **`src/engine/run/tiers/tierRegistry.ts`** (new), with:
   - `TIERS`: the parsed rows, in order.
   - `MAX_TIER`: the last row's `tier` (3).
   - `tierRule(tier: number)`: the row for `tier`, **clamped** to `0..MAX_TIER`. `tierRule(9)` is tier 3's row, and a negative number gets tier 0's. This keeps ticket 60's "clamped, not extrapolated" rule.
   - `leaderDriverFor(gymId: string): string | undefined`.

### Code

4. **`encounter.ts`, `enemyLoadoutFor`**: replace the two hard-coded lines

   ```ts
   if (tier >= 3) return { ...base, deck, os: true, ai: 'lite' };
   if (tier >= 2) return { ...base, deck, os: true };
   return { ...base, deck };
   ```

   with a read of the row:

   ```ts
   const rule = tierRule(tier);
   return { ...base, deck, os: base.os || rule.wildFirmware, ai: rule.wildAi === 'greedy' ? base.ai : rule.wildAi };
   ```

   Elites and the gauntlet still return `base` untouched at every tier (the `if (grade !== 'wild') return base;` line above stays). Update the docblock above the function: tier 1 is now firmware and tier 2 is the lite AI, per Henry 2026-09-29, ticket 169.

### Tests

5. **`src/engine/run/tiers/tierRegistry.test.ts`** (new):
   - The file parses, the tiers are 0, 1, 2, 3 in order, and `MAX_TIER === 3`.
   - **Monotonic:** no row turns off something a lower row turned on (`wildFirmware`, `leaderDriverEveryFight`), `extraElitesPerBiome` never goes down, and `wildAi` never goes from `lite` back to `greedy`.
   - `tierRule(9)` equals tier 3's row, and `tierRule(-1)` equals tier 0's.
   - Every gym in `GYM_REGISTRY` has a `leaderDrivers` entry, and each id is a registered Driver (`getDriver(id)` is defined).
6. **`encounter.test.ts`**: the ticket-60 block (search `tier 2 = wild OS on`) asserts the old tier numbers. Change it to the new ones: tier 1 wilds have `os: true, ai: 'greedy'`, tier 2 and tier 3 wilds have `os: true, ai: 'lite'`, and tier 0 is unchanged. Keep the loop asserting that elites and the gym equal their `ENEMY_LADDER` rung at every tier. The `tier3` helper further down (search `const tier3 =`) keeps working as it is. If one of its assertions was about tier 2 specifically, move it to tier 1.
7. **The no-stat-scaling test** (ticket 29's "Done when"): **`src/engine/run/tiers/noStatScaling.test.ts`** (new). For a fixed seed, build a run at each tier 0..3 with the same party, roll the encounter for the same wild node, the same elite node and each of the three gauntlet fights, and assert that each enemy entity's `maxHP`, attack, defense and IVs are equal across all four tiers. (Read `IBattleEntity` in `types.ts` for the exact stat field names.) Drivers and firmware may differ, since those are content. Stats may not.

---

## 169b: Tier 2, one more elite per biome

1. **`src/engine/run/tiers/tierElites.ts`** (new): `addTierElites(nodes: IRegionNode[], seed: string, perBiome: number): IRegionNode[]`.
   - For each biome index, the candidates are nodes with `kind === 'wild'`, `pocket === false` and `layer` 1 to 3, **excluding** biome 0's `REGION_PARAMS.scriptedOpeningLayer` (the scripted first fight must stay a wild).
   - Shuffle the candidates with `new SeedStream(new SeedStream(seed).fork(\`tier-elites:${biomeIndex}\`))`, and change the first `perBiome` of them to `kind: 'elite'`.
   - If a biome has fewer candidates than `perBiome`, convert what there is. Do not convert any other kind.
   - It returns new node objects; it does not mutate its input. With `perBiome === 0` it returns the input unchanged.
2. **`createRun.ts`**: the run's tier must be known here. Add an optional `tier?: number` to `CreateRunInput` (169e passes it; until then it is undefined), and set `tier: input.tier ?? offer.gym.tier`. Then, **between** `generateRegionGraph(seed)` and `assignDriverStakes(...)`:

   ```ts
   const tiered = addTierElites(graph.nodes, seed, tierRule(tier).extraElitesPerBiome);
   ```

   and pass `tiered` to `assignDriverStakes`, so the new elites carry a Driver stake like every other elite. **At tier 0 the graph must be identical to today's**, node for node.
3. **Tests**, in **`tierElites.test.ts`** (new):
   - At tier 0, `createRun`'s nodes deep-equal today's for 20 seeds (build them with `tier: 0` and with `tier` omitted).
   - At tier 2, each biome has exactly one more elite than the same seed at tier 0, over 200 seeds. If a seed ever has no candidate, count it and assert that count is 0 (report it if it is not).
   - Biome 0's scripted opening layer has no elite at any tier.
   - Every elite at tier 2 has a `driverStake`.

---

## 169c: Tier 3, the leader's Driver in all three gauntlet fights

1. **`gauntlet.ts`, `rollGauntletFight`**: the return value ends with

   ```ts
   ...(authored ? { enemyDrivers: [authored.driver] } : {}),
   ```

   `authored` is only set on the boss fight. Replace that line with a call to a new function in **`src/engine/run/tiers/gauntletDrivers.ts`**:

   ```ts
   export function gauntletDriversFor(run: IRunState, boss: boolean): string[]
   ```

   - Boss fight: `[authoredBossFor(run.gymId).driver]` (today's behaviour), or `[]` if there is no authored boss.
   - Fights 1 and 2: if `tierRule(run.tier).leaderDriverEveryFight`, return `[leaderDriverFor(run.gymId)]`, otherwise `[]`.

   Spread it in only when it is non-empty (keep "absent" meaning "none", as the current code does).
2. **The offer screen text.** `gymSignatures` prints the boss's Driver. When the selected tier (169e) has `leaderDriverEveryFight`, the run-start screen prints one more line under the Driver: **"Tier 3: active in all three gauntlet fights."** Do this in `RunStart.tsx` where the signature is printed (search `gymSignatures`), not in `gymSignatures` itself.
3. **Tests** (**`gauntletDrivers.test.ts`**, new): at tier 0, fights 1 and 2 have no `enemyDrivers` and fight 3 has the signature Driver; at tier 3, all three fights have one Driver each, and fights 1 and 2 use `leaderDrivers[gymId]`; at tier 3 the enemy species, IVs and decks are identical to tier 0 for the same seed.

---

## 169d: The ranch records clears per gym per tier; tiers unlock

1. **Save schema, `runTypes.ts`, `RanchStateSchema`**: add

   ```ts
   tierClears: z.record(z.string(), z.array(z.number().int().min(0))).default({}),
   ```

   and the matching `readonly tierClears: Readonly<Record<string, ReadonlyArray<number>>>` on `IRanchState`. **No save version bump**: `.default({})` loads old saves, the same argument as `seenTips` and the codex fields. Add `tierClears: {}` to the initial ranch state in `gameSlice.ts` (search `highestTierCleared: 0`).
2. **`gameSlice.ts`**: a new reducer, `recordGymTierClear(state, action: PayloadAction<{ gymId: string; tier: number }>)`. Idempotent: it adds `tier` to `tierClears[gymId]` if it is not already there, and keeps each list sorted. It ignores a non-integer or negative tier.
3. **`BattleArena.tsx`**: right after `dispatch(recordTierCleared(run.tier));` (search it), add `dispatch(recordGymTierClear({ gymId: run.gymId, tier: run.tier }));`. Leave `markGymCleared` and `recordTierCleared` where they are. Mark `highestTierCleared` `@deprecated` in `runTypes.ts` with a one-line pointer to `tierClears`; do not remove it.
4. **`src/engine/run/tiers/tierUnlocks.ts`** (new):
   - `clearsByGym(ranch)`: `tierClears`, plus tier 0 for every gym in `gymsCleared` that has no entry. That is how old saves count their clears; there is no migration code.
   - `unlockedTiers(ranch): number[]`: `[0]` if nothing is cleared, otherwise `0..min(MAX_TIER, highestClear + 1)`, where `highestClear` is the highest tier in any gym's list.
   - `gymMastered(ranch, gymId): boolean`: true when that gym's clears include 1, 2 and 3. This is the achievement's condition; ticket 43 will read it.
   - `modifiersUnlocked(ranch): boolean`: true when any gym has any clear (default D2).
5. **Debug:** in `src/debug/panels/SaveEditorPanel.tsx`, next to where it prints `tier {save.highestTierCleared}`, show the `tierClears` lists, and add one button, **"Unlock all tiers"**, that writes clears for tiers 0, 1 and 2 on `gym_emberfall`. Henry needs this to playtest tier 3 without clearing three gyms.
6. **Ticket 44:** append to `docs/wayfinder/steam-release/tickets/44-achievements-design.md` (CRLF), at the end of its Question section:

   > **Added by ticket 169 (Henry, 2026-09-29):** one achievement per gym for clearing it at tiers 1, 2 and 3 (nine clears across the three gyms): Emberfall, Tidewrack and Rootfall. The condition is `tierUnlocks.gymMastered(ranch, gymId)`, read from `IRanchState.tierClears`.
7. **Tests** (**`tierUnlocks.test.ts`** and `gameSlice.ranch.test.ts`): an empty ranch unlocks `[0]`; a ranch whose only record is `gymsCleared: ['gym_tidewrack']` unlocks `[0, 1]`; a tier-1 clear on any gym unlocks `[0, 1, 2]`; a tier-3 clear unlocks `[0, 1, 2, 3]` and never 4; `gymMastered` needs all three of 1, 2 and 3 on the same gym; recording a clear twice stores it once; an old save without `tierClears` loads.

---

## 169e: Run start, the tier picker, and the tier shown during and after a run

1. **`RunStart.tsx`**, the gym-offer screen ("Choose a gym"): add a tier row above the offer grid (search `ranch-offer-grid`).
   - One button per tier 0..`MAX_TIER`, labelled `Tier N`. Selected shows as pressed.
   - A locked tier (not in `unlockedTiers(ranch)`) is disabled and shows **"Beat any gym on Tier N−1 to unlock."**
   - Under the row, print the selected tier's `name` and `description` from `tiers.json`.
   - It opens on the highest unlocked tier (default D3). The choice is component state, like the chosen offer, and is not saved.
   - Each gym offer card shows that gym's clears as small pips: `Cleared: 0 1 2` (from `clearsByGym`), or nothing if it has none.
   - **Fix the label:** the offer card prints `tier {offer.gym.tier + 1}` (line ~149). Remove it; the tier row replaces it. Tiers display as 0 to 3 everywhere, matching `RunSummary`.
2. **`launch()`** passes the selected tier to `createRun` as `tier: selectedTier` (the input field 169b added).
3. **During the run:** `RunScreen.tsx` prints `{run.fightsResolved} fights · {run.scrap} scrap` in two places (lines ~410 and ~437). Prefix both with `Tier {run.tier} · `.
4. **Run summary:** `RunSummary.tsx` already prints `tier {run.tier}`. Leave it; 169f adds the modifiers next to it.
5. **Run log:** `RUN_STARTED` (`runLog.ts`, line ~105, written in `runLogMiddleware.ts`) already has `tier`. Nothing to change here; 169f adds `modifiers`.
6. **Tests:** a component test (model it on existing screen tests such as `CodexScreen.test.tsx`): with an empty ranch only Tier 0 is enabled; with a tier-1 clear, Tiers 0 to 2 are enabled and Tier 2 is pre-selected; launching with Tier 2 selected produces a run with `tier === 2`.

---

## 169f: The modifier framework, plus Junk Start and Elite Hunt

### Data and storage

1. **`src/engine/data/modifiers.json`** (new): the five modifiers from the table above, one object each: `id`, `name`, `description`, plus these numbers:
   - `junk_start`: `"junkCount": 2`
   - `tight_budget`: `"pricePercent": 25`

   Validated by **`src/engine/run/modifiers/modifierSchema.ts`** (new), in the same way as `tiers.json`.
2. **Storage:** active modifiers are stored in the existing `IRunState.modifiers` array as `mod:<id>` strings (for example `mod:junk_start`). This follows the precedent `reveal:biome:N` set (ticket 15; see the docblock in `macroRegistry.ts` above `revealedBiomesFrom`). No save version bump.
3. **`src/engine/run/modifiers/modifierRegistry.ts`** (new): `MODIFIERS` (parsed), `MODIFIER_IDS`, `activeModifiers(run: Pick<IRunState, 'modifiers'>): string[]` (reads the `mod:` entries), and `hasModifier(run, id): boolean`. **Every later row checks modifiers only through `hasModifier`.**
4. **`createRun.ts`**: add an optional `modifiers?: ReadonlyArray<string>` to `CreateRunInput`, validate each id against `MODIFIER_IDS` (throw on an unknown one), and write `modifiers: input.modifiers?.map((id) => \`mod:${id}\`) ?? []`.

### UI

5. **`RunStart.tsx`**, the party screen ("Choose your party"): a **Modifiers** row above the launch button, with one toggle chip per modifier showing its name and, on hover, its description (use the portal tooltip from 167f). If `modifiersUnlocked(ranch)` is false, the chips are disabled and the row reads **"Beat a gym to unlock modifiers."** `launch()` passes the selected ids as `modifiers`.
6. **Labels:** `RunSummary.tsx`, next to `tier {run.tier}`, prints the active modifier names joined by `, ` when there are any. `RunScreen.tsx`'s two `Tier N ·` lines (169e) add ` · N modifiers` when there are any, and hovering it lists them.
7. **Run log:** add `readonly modifiers: ReadonlyArray<string>` to the `RUN_STARTED` event (`runLog.ts`), written from `activeModifiers(run)` in `runLogMiddleware.ts`. Old logs without the field still parse (make it optional or defaulted in the log's schema, if it has one).

### Junk Start

8. **`src/engine/run/modifiers/junkStart.ts`** (new): if `hasModifier(run, 'junk_start')`, `createRun` adds `junkCount` copies of `JUNK_CARD_ID` (`junk.ts`) to the starting deck. **Mint them after the normal starting deck**, from the same `deckStream` (`deckStream.nextId('card')`), so every other card's instance id is unchanged. They belong to no member: `ownerId: null`, exactly as 168c's junk outcome does (`applyJunk` in `src/ui/events/applyOutcome.ts`).

### Elite Hunt

9. **`src/engine/run/modifiers/eliteHunt.ts`** (new): `applyEliteHunt(nodes)` changes every `kind === 'rival'` node to `kind: 'elite'`. In `createRun`, run it **after** `addTierElites` and **before** `assignDriverStakes`, only when the modifier is on. The scout (the 142b elite with the scout flag) is already an elite and is untouched.

### Tests

10. `modifierRegistry.test.ts`: the file parses; `hasModifier` reads `mod:` entries and ignores `reveal:` and blueprint entries; `createRun` throws on an unknown id. `junkStart.test.ts`: with the modifier, the deck is the normal deck plus 2 `corrupted_data`, and every other instance id matches the same seed without the modifier; without it, no junk. `eliteHunt.test.ts`: with it, no node is `rival` and every former rival is an elite with a `driverStake`; without it, the graph is unchanged. A component test: modifier chips are disabled on an empty ranch and enabled after one clear.

---

## 169g: Tight Budget

**The rule:** every price the player pays at a **marketplace or workshop** is raised by `pricePercent` (25), **rounded up to the next multiple of 5**, because numbers move in 5s. A price of 0 stays 0 (the gym gate's free upgrade, free event upgrades). Event costs are not changed (default D4). Sell prices are not changed; selling is income.

| Base | With Tight Budget |
|---|---|
| Cards 15 / 25 / 35 / 45 | 20 / 35 / 45 / 60 |
| Upgrades 25 / 30 / 35 / 40 | 35 / 40 / 45 / 50 |
| Macros 32 / 48 | 40 / 60 |
| Blueprint 50, refresh 50 | 65, 65 |
| Junk removal 25 | 35 |
| Shop patch 45 | 60 |

(Upgraded-card, recruit and reflash prices follow the same rule from whatever their base is.)

1. **`src/engine/run/modifiers/shopPrice.ts`** (new):

   ```ts
   export function shopPrice(run: Pick<IRunState, 'modifiers'>, base: number): number
   ```

   Returns `base` unchanged without the modifier, or when `base === 0`. Otherwise `Math.ceil(base * (100 + pricePercent) / 100 / 5) * 5`.
2. **Apply it at every buy site.** This is the whole list; check each one, and if you find a price the list does not name, stop and ask Henry:

   | Site | File | Search for |
   |---|---|---|
   | Market card offers (plain and upgraded) | `marketplace.ts`, `rollMarketStock` | `slot === 'upgraded' ? upgradedCardPrice(dataId) : cardPrice(dataId)` |
   | Macro shelf | `marketplace.ts`, `rollMacroStock` | `price: macroPrice(macroId)` |
   | Market blueprint | `marketplace.ts`, `rollBlueprintOffer` | `price: MARKET_BLUEPRINT_PRICE` |
   | Stall refresh | `MarketplaceNode.tsx` | `MARKET_REFRESH_PRICE` (all uses: dispatch, disabled check, both labels) |
   | Junk removal | `MarketplaceNode.tsx` | `isJunkCard(dataId) ? JUNK_REMOVAL_PRICE : sellPrice(dataId)` (junk branch only) |
   | Upgrade bench (display) | `UpgradeBench.tsx` | `upgradePrice(stack.dataId)` |
   | Upgrade (charge) | `runSlice.ts`, the upgrade reducer | `upgradePrice(card.dataId)` |
   | Shop patch | `PatchBench.tsx` | `SHOP_PATCH_PRICE` |
   | Workshop recruit and assembly | `workshop.ts`, `planRecruit` | `scrap: WORKSHOP_ASSEMBLY_SCRAP` |
   | Workshop reflash | `workshop.ts`, `planReflash` | `scrap: WORKSHOP_REFLASH_SCRAP` |

   The three market functions and the two workshop plans already receive `run`. The upgrade reducer has `run` in state. The UI sites read `run` from the store they already use.
3. **Tests** (**`shopPrice.test.ts`**): the table above, row for row; 0 stays 0; without the modifier every value is unchanged. Then one test per site in the table: with the modifier on, the offer or plan shows the raised price, and the reducer charges it.

---

## 169h: No Recruits

1. **`src/engine/run/modifiers/noRecruits.ts`** (new): `recruitingBlocked(run): boolean` returns `hasModifier(run, 'no_recruits')`.
2. **The choke point:** `workshop.ts`, `planRecruit`: return `null` at the top when `recruitingBlocked(run)`.
   **The Stray Mingming event does not go through `planRecruit`.** Its eligibility is `workshopWouldOfferARecruit` in `eventEligibility.ts`, which checks the party size and the ranch's blueprints itself. Add `if (recruitingBlocked(ctx.run)) return false;` as its first line.
3. **Belt and braces:** `runSlice.ts`, `recruitIntoParty` and `recruitToBench`: return `{ run }` unchanged when `recruitingBlocked(run)`.
4. **Workshop UI:** `WorkshopNode.tsx`: when blocked, the recruit section shows **"No Recruits is on: your party is set for this run."** instead of the species list. Reflash and upgrades are unaffected.
5. **What it does NOT block:** blueprint drops, Wild Tracks and the market's blueprint slot still bank blueprints to the ranch (that is meta progress, not recruiting), and benching or swapping members you already have still works.
6. **Tests:** `planRecruit` returns null with the modifier and a plan without it; both recruit reducers leave the run unchanged with the modifier; Stray Mingming is never drawn with the modifier (run the draw over 200 node seeds); a blueprint drop still banks.

---

## 169i: Draft Start

**The rule:** instead of being dealt its 5 start-kit cards, each party member drafts 5 cards, one pick at a time, from 3 offers each. The offers come from that member's **tuned deck for its OS** (`getDeckForOS(definitionId, activeOS)`), one entry per copy in the deck. A picked entry leaves the pool; offered-but-not-picked entries go back. The 3 generic hits the first member brings are dealt as usual. The payoff is not guaranteed (default D5).

1. **Engine, `src/engine/run/modifiers/draftStart.ts`** (new):
   - `draftPool(member): string[]`: the tuned deck ids.
   - `draftOffer(seed: string, memberIndex: number, pickIndex: number, remaining: ReadonlyArray<string>): string[]`: 3 distinct **positions** from `remaining` (so duplicate copies can both be offered), drawn with `new SeedStream(new SeedStream(seed).fork(\`draft:${memberIndex}:${pickIndex}\`))`. If fewer than 3 remain, offer all of them.
   - `DRAFT_PICKS = START_KIT_SIZE` (5).
2. **`createRun.ts`**: add an optional `startKitOverrides?: Readonly<Record<string, ReadonlyArray<string>>>` to `CreateRunInput`, keyed by member id. `startDeckFor` gets an optional fourth argument, `kitIds?: ReadonlyArray<string>`, used instead of `startKitIdsFor(member, START_KIT_SIZE)` when present. `createRun` throws if `draft_start` is on and any member has no override, or an override is not exactly `DRAFT_PICKS` long.
3. **UI, `src/ui/screens/DraftStart.tsx`** (new): when Launch is pressed with Draft Start on, `RunStart` rolls the seed **once**, holds it in state, and shows this screen instead of starting the run.
   - Header: **"Draft: {member name}, pick {n} of 5"**.
   - Three cards, drawn with `HandCardFace` (`src/ui/components/HandCardFace.tsx`). Clicking a card picks it.
   - Below them, the cards picked so far for this member.
   - After the last member's fifth pick, dispatch `startRun(createRun({ seed, offer, party, tier, modifiers, startKitOverrides, startedAt }))` with the **same** seed.
   - A Back button returns to the party screen and throws the draft away. Closing the app mid-draft also throws it away: no run exists until the draft ends, so there is nothing to resume.
4. **Tests:** `draftOffer` is deterministic for the same inputs, returns 3 distinct positions, and returns fewer only when fewer remain; a full 5-pick draft on each of the six launch species never runs out of offers; `createRun` with overrides builds exactly those kit cards plus the generics; `createRun` throws on a missing or short override when the modifier is on; a component test clicks through a one-member draft and checks the resulting deck.

---

## 169j: The walker plays tiers and modifiers, and a check that each tier is harder

1. **`runWalker.ts`**: add `readonly tier?: number` and `readonly modifiers?: ReadonlyArray<string>` to `WalkInput`, and pass them to its `createRun` call (search `store.dispatch(startRun(createRun({ seed, offer, party`). Add the same two as optional trailing parameters of `walkStarter`, forwarded to `walkRun`. Defaults (undefined) must reproduce today's walks exactly.
2. **Walker policy for Draft Start** (the walker cannot click): in `walkRun`, when `draft_start` is on, build `startKitOverrides` by drafting with `draftOffer`. Each pick takes the first offered card that is in `startKitIdsFor(member, START_KIT_SIZE)` and not yet used up; if none is, it takes the offer with the highest `scoreOf` (the walker's own card score; ties go to the first offer).
3. **No Recruits and Tight Budget** need no walker policy: the walker already goes through `planRecruit` (`executeWorkshopRecruit`) and the priced offers.
4. **The balance check**, **`src/debug/balance/tierLadder.balance.ts`** (new; it runs under `npm run balance`, not the unit gate):
   - For each tier 0..3, walk every EA starter (`eaStarters()`) on the **same** seeds (label `tier-ladder`, 30 seeds per starter), with no modifiers.
   - Measure the **mean number of fights won per run** at each tier.
   - Assert it **never goes up** from one tier to the next (tier N+1 ≤ tier N). The seeds are fixed, so this is deterministic rather than flaky. If it fails, **do not tune anything**: report the numbers to Henry.
   - Print a table to the console: per tier, mean fights won, wild win %, elite win %, the share of runs reaching the gym, and the gym clear %.
5. **Modifier report** (print only, no assertion) in the same file: tier 0 with each modifier alone, on the same seeds, against tier 0 with none. Same columns, plus mean scrap unspent at run end.
6. **Record the output** in `docs/balance/tier-ladder-169.md` (LF, like the other `docs/balance` reports): the two tables, the commit hash, and the run date.

---

## Done when

- All ten rows are committed, the gate is green, and `npm run balance` runs `tierLadder.balance.ts` green (or its failure is reported to Henry with the numbers).
- A fresh save offers Tier 0 only, with modifiers locked. After one gym clear, Tier 1 and all five modifiers are open. The debug "Unlock all tiers" button opens Tier 3.
- Steam-release ticket 29's "Done when" holds: tiers and modifiers are selectable and saved, and a test asserts no entity stat differs across tiers (169a).

## Resolution

Closed 2026-10-02: all rows built on `playtest-polish` (`47dce56..6621b9c`), merged to `main` in PR #13.
