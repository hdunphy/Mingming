# Ticket 168 — Events: the node that does nothing becomes twenty events

> **CLOSED 2026-10-02 (housekeeping, at the move to `first-impressions`).** Every row is built: 168a–168g (`a8e3ed7..8382ff6`). The status line below is kept as history.

**Type:** content + run systems. **Status:** OPEN. This is the build ticket for steam-release ticket 30 ("Events node system + the first event set"), and it answers ticket 27's open question (b), the launch event count: **20**.

**Why.** About 14% of every biome's middle nodes are rolled as `event` (`regionGraph.ts`, `middleKindWeights.event: 14`), and nothing handles them: the node is drawn, the player walks onto it, and nothing happens. There is no event data anywhere in `src`.

**Henry's rulings (2026-09-29):**

> *"Yes junk cards. Also you have to pay to remove them instead of selling them for scrap at the shop."*
> *"[A negative event's HP cost] should be a temporary driver basically."*
> *"[At most 1 Driver and 1 patch per run from events:] Yes."*
> *"I like the list, it's good to go."*
> *"Make sure events only trigger on the first visit. Other visits don't do anything."*

Seven rows, one commit each, **failing test first**. Build them in order: 168a is the framework every other row plugs into.

| Row | What |
|---|---|
| 168a | The framework: event data, the draw, the once-per-run and first-visit rules, the event screen, the run log, the walker, and the first three events |
| 168b | Temporary Drivers, and the two events that use them |
| 168c | Junk cards, paid removal at the shop, and the two events that give junk |
| 168d | The six pick-a-reward events |
| 168e | The six trade and cost events, including the Driver Shrine and the Black-Market Patch |
| 168f | Firmware Reflash |
| 168g | Ambush Bait (an optional fight) |

---

## How to work this ticket (read before any row)

1. **Read the whole row first.** Paths and line numbers were checked against `b86cb5b` (2026-09-29). Line numbers drift; search for the quoted code.
2. **Test first, run it on the parent, see it fail.** Put "fails on parent: yes" in the commit message.
3. **Do not change anything a row does not list.** If a row seems to need something it does not name, stop and ask Henry.
4. **Numbers move in 5s** (a standing rule). Every number in the event table is Henry-approved as part of the list; do not tune them.
5. **Gate:** `npm run gate` green before each commit.
6. **Commits:** authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`), **no `Co-Authored-By` trailers**, last line `HANDOFF: <one sentence>`. **Do not push.**
7. **Line endings:** keep each file's. CRLF under `docs/wayfinder`; new files under `src/` are LF.
8. **Small single-purpose modules** (Henry's standing preference): one file per concern (the catalogue, the draw, the eligibility checks, each outcome), not one big `events.ts`.
9. **Report** in plain English at the end: per row what changed, and anything you had to decide.

---

## The rules every event follows

1. **First visit only.** An event plays the first time the player steps on its node. On any later visit the node shows one line, *"The relay is dark. Nothing here now."*, and a Leave button. This is an explicit exception to ticket 07's "entering a node triggers it again, always" (which still holds for fights). The test is "this node has a resolved event", **not** `visited === 1`, so a player who closes the app mid-event gets the same event back on resume.
2. **Every event can be left without taking anything,** except the two bad events, **Corrupted Stream** and **The Toll**, which have no free option. Choosing is the only way to close an event screen.
3. **Each event appears at most once per run.**
4. **Rarity.** When an event node is entered, roll the rarity first: **Common 60, Uncommon 30, Rare 10**. **Rare events only roll in the second and third biome** (`biomeIndex` 1 and 2); in the first biome the Rare weight is 0 and the other two are drawn as 60:30. Then pick uniformly among the **eligible, not-yet-seen** events of that rarity. If none is left in that rarity, fall back to the next rarity down (Rare → Uncommon → Common), then up. If nothing at all is eligible, the node pays the **Empty Relay** fallback: +15 scrap, no choice, and it does **not** count as a seen event.
5. **The power cap:** at most **1 Driver and 1 patch per run from events**. Once an event has granted a Driver, every event that can grant a Driver is ineligible for the rest of the run; the same for patches.
6. **Deterministic.** The draw uses `new SeedStream(nodeSeed(run, node, 'event'))`, so the same run state on the same node always draws the same event and the same offers.
7. **Costs respect the deck floor.** A card you "give up" can come from the deck or the run collection, but a deck card cannot be given up if that would drop the deck below `minimumActiveDeck(partySize)` (the same rule `sellRunCard` enforces). Junk cards never count toward the floor (168c).
8. **Printed odds.** The one gamble (Corrupted Cache) prints its odds on the button (Henry's "no hidden math" rule).
9. **Fiction:** firmware, programs, relays and constructs; never potions, relics or campfires (the standing naming law). There is **no heal event**: every body heals fully between nodes, so a heal does nothing.

---

## The launch set (20 events, approved by Henry 2026-09-29)

"Pool" below means `rewardCardPool(party)` (the party's elements, the same pool fight rewards draw from), filtered by rarity. "Give up a card" follows rule 7.

### Common (weight 60)

| id | Name | Text | Choices | Eligible when |
|---|---|---|---|---|
| `scrap_cache` | Scrap Cache | A sealed maintenance locker, still humming. | **Take it:** +25 scrap. **Dig deeper:** +50 scrap, and your party gains **Static Haze** for the next fight (168b). **Leave.** | always |
| `abandoned_terminal` | Abandoned Terminal | An old compiler, still warm. It will take one program. | **Upgrade a card**, free (the gate's `UpgradeBench` with `free` and bench key `event:<nodeId>`). **Leave.** | at least one card in the deck has a `+` |
| `data_fragments` | Data Fragments | Loose code drifts through the static. | **Pick 1 of 3 cards** from the pool (Common or Uncommon, one rarity roll per card, as fight rewards roll). **Take 15 scrap instead.** **Leave.** | always |
| `wild_tracks` | Wild Tracks | Fresh signal trails lead off the path. | **Pick 1 of 3 blueprints**: three different species this run's region fields (`regionSpeciesPool`), banked to the ranch at once. **Leave.** | always |
| `relay_tower` | Relay Tower | A survey relay, half-buried. It still has power for one sweep. | **Survey:** reveal this biome's map (the same `fireMapReveal` the Ping Sweep macro uses). **Strip it:** +20 scrap. **Leave.** | the biome is not already revealed; otherwise only Strip and Leave |
| `corrupted_stream` | Corrupted Stream | The path runs through a torn data stream. It will cost you to cross. | **Push through:** your party gains **Frayed Signal** for the next fight (168b). **Pay to reroute:** −25 scrap. *(No free option.)* | always (Pay is greyed if you have under 25 scrap) |

### Uncommon (weight 30)

| id | Name | Text | Choices | Eligible when |
|---|---|---|---|---|
| `rare_vault` | Rare Vault | A locked archive. The lock is already broken. | **Pick 1 of 3 Rare cards** from the pool. **Leave.** | the pool has at least 1 Rare |
| `macro_crate` | Macro Crate | A crate of single-use routines, factory-sealed. | **Pick 1 of 3 macros**: 166d's `MacroRewardPick` and `takeRewardMacro`, including its drop-one-to-make-room row. **Leave.** | always |
| `trader` | Trader | A construct offers to swap. It only trades up. | **Give up a card**, get a random card **one rarity higher** from the pool (Common → Uncommon → Rare; a Rare gets a different Rare). **Leave.** | at least one card can be given up |
| `overclock_rig` | Overclock Rig | An overclock rig. It works, mostly. | **Upgrade two cards**, free, and **Corrupted Data** is added to your deck (168c). **Leave.** | at least two cards have a `+` |
| `data_broker` | Data Broker | A broker with a price list. | **Pay 40:** pick 1 of 3 Rare cards. **Pay 15:** pick 1 of 3 Uncommon cards. **Leave.** (Buttons you can't afford are greyed.) | the pool has at least 1 Rare |
| `stray_mingming` | Stray Mingming | A lost Mingming is following your signal. | **Recruit**, free: the workshop's recruit screen at price 0, for one recruit. **Leave.** | the party has an open slot and the workshop would offer at least one recruit (`workshop.planRecruit`) |
| `ambush_bait` | Ambush Bait | Something is nesting in the wreckage, guarding a cache. | **Fight it:** a wild fight at this node, paying **double** the normal win scrap (168g). **Leave.** | always |
| `mirror_protocol` | Mirror Protocol | A copier. It charges by the job. | **Pay 25: duplicate a card** from your deck or collection (the copy goes where the original is). **Leave.** | at least one non-junk card |

### Rare (weight 10, biomes 2 and 3 only)

| id | Name | Text | Choices | Eligible when |
|---|---|---|---|---|
| `driver_shrine` | Driver Shrine | An old Driver, still humming, cradled in a data shrine. It wants an offering. | **Offer two cards** (deck or collection) **or offer one blueprint** (any species you hold one of), then **pick 1 of 2 Drivers** you don't hold. **Leave.** | no event has granted a Driver this run; you hold fewer than all player Drivers; you can pay one of the two offerings |
| `black_market_patch` | Black-Market Patch | A patch dealer, no questions asked. | For one unpatched body, fit its best patch (`bestPatchFor`, as the elite offers): **Pay 30** or **give up a Rare card**. **Leave.** | no event has granted a patch this run; at least one party body has no patch |
| `corrupted_cache` | Corrupted Cache | A cache wrapped in corrupted code. Maybe it's fine. | **Open it (50% / 50%):** either pick 1 of 3 Rare cards, or Corrupted Data is added to your deck and you lose 15 scrap. The button prints both outcomes and the odds. **Leave.** | the pool has at least 1 Rare |
| `the_toll` | The Toll | A construct blocks the path. It wants payment. | **Pay 30 scrap** or **give up a card**. *(No free option.)* | you can do at least one of the two; if you can do neither, the event is ineligible |
| `firmware_reflash` | Firmware Reflash | A reflash station. One body can be rewritten. | **Reflash one body** to its other OS (v1 ↔ v2) for the rest of this run (168f). **Leave.** | at least one party body has no patch |
| `recompiler` | Recompiler | A recompiler. What goes in is not what comes out. | **Give up a card** and get a random card of the **same element and rarity** from the whole rewardable set. **Leave.** | at least one card can be given up |

---

## 168a — The framework, and the first three events

### Data

1. **`src/engine/data/events.json`** (new): the 20 events as data. One object per event:

   ```json
   {
     "id": "scrap_cache",
     "name": "Scrap Cache",
     "rarity": "Common",
     "text": "A sealed maintenance locker, still humming.",
     "grants": [],
     "choices": [
       { "id": "take", "label": "Take it", "detail": "+25 scrap", "outcomes": [{ "type": "SCRAP", "amount": 25 }] },
       { "id": "dig", "label": "Dig deeper", "detail": "+50 scrap. Static Haze next fight.", "outcomes": [{ "type": "SCRAP", "amount": 50 }, { "type": "TEMP_DRIVER", "driverId": "driver_static_haze", "fights": 1 }] },
       { "id": "leave", "label": "Leave", "detail": "", "outcomes": [] }
     ]
   }
   ```

   `grants` lists `"driver"` and/or `"patch"` for the power cap (only `driver_shrine` and `black_market_patch` have one). Write all 20 now, even though 168a only implements three outcome types; the others are built by later rows.
2. **`src/engine/run/events/eventSchema.ts`** (new): a zod schema for that file, with an outcome union (`SCRAP`, `CARD_PICK`, `UPGRADE`, `BLUEPRINT_PICK`, `MAP_REVEAL`, `TEMP_DRIVER`, `JUNK`, `MACRO_PICK`, `TRADE_UP`, `DUPLICATE`, `TRANSFORM`, `RECRUIT`, `FIGHT`, `DRIVER_PICK`, `PATCH`, `REFLASH`, `GAMBLE`, `GIVE_CARD`, `GIVE_BLUEPRINT`) and a parse function that throws at load on a bad file. Model it on the scenario schema (`src/debug/scenarios/scenarioSchema.ts`).

### Run state

3. **`src/engine/runTypes.ts`**: add to `IRunState`, with the same `.default(...)` pattern `patchBenchesUsed` uses in `RunStateSchema`:

   ```ts
   /** TICKET 168: every event resolved this run, in order. The once-per-run and first-visit rules, and the power cap, read this. */
   readonly eventHistory?: ReadonlyArray<{ readonly nodeId: string; readonly eventId: string; readonly choiceId: string; readonly grants: ReadonlyArray<'driver' | 'patch'> }>;
   ```

   Schema: `eventHistory: z.array(z.object({ nodeId: z.string(), eventId: z.string(), choiceId: z.string(), grants: z.array(z.enum(['driver', 'patch'])) })).default([])`. Do the same in `createRun` as it does for `patchBenchesUsed`.

### The draw

4. **`src/engine/run/events/eventDraw.ts`** (new): `drawEvent(run, node, ranch): EventDefinition | null`, implementing rules 3–6 exactly. The per-event eligibility checks live in **`src/engine/run/events/eventEligibility.ts`** (new), one small function per event id, each returning a boolean. Start them all as written in the table; the rows that build an event are responsible for its check being right. `null` means the Empty Relay fallback.

### Resolving a choice

5. **`src/ui/store/runSlice.ts`**: a reducer `resolveEvent({ nodeId, eventId, choiceId, grants })` that appends to `eventHistory` and does nothing else. The outcomes are dispatched separately (below), because several touch the ranch slice too. Refuse (return `{ run }`) if the node already has an entry.
6. **`src/ui/events/applyOutcome.ts`** (new): one function per outcome type that dispatches the existing actions. In 168a implement only `SCRAP` (`addRunScrap`; negative amounts go through the existing scrap-spend path, never below 0), `CARD_PICK` (the picked card into the deck through `addRunCards`, or the collection, with the same deck/store toggle the reward screen has) and `MAP_REVEAL` (`fireMapReveal(biomeIndex)`). **Order:** the outcome dispatches first, then `resolveEvent`, so a crash in between leaves the event unresolved rather than paid and lost (the codebase's "generous state" rule).

### The screen

7. **`src/ui/screens/EventNode.tsx`** (new) + CSS: a panel over the live map, built like `WorkshopNode`/`MarketplaceNode` (read both first): the event name, its text, one real `<button>` per choice (label, detail, greyed with the reason when unaffordable), and any pick UI inline under the choice that opened it. For a revisited node it shows the "The relay is dark" line and Leave. For the Empty Relay fallback it shows "The relay is empty. You salvage 15 scrap." and applies the 15 on the button press.
8. **`src/ui/screens/RunScreen.tsx`**: open `EventNode` when `current.kind === 'event'`, the same way the marketplace and workshop panels open (`stallOpen` / `setClosedNodeId`). Closing is only possible by choosing.

### The log and the walker

9. **Run log** (`src/engine/run/runLog.ts` + `runLogMiddleware.ts`): add `{ kind: 'EVENT_RESOLVED'; eventId: string; choiceId: string }`, recorded on `run/resolveEvent`. Update any kind list or schema the file keeps, as 166d did for `MACRO_WON`.
10. **The balance walker** (`src/debug/balance/runWalker.ts`): when it steps onto an event node, draw the event and take the **first choice whose outcomes are all free and have no cost**, or Leave if none. Implement only what 168a's outcomes support; later rows extend it. Record `EVENT_RESOLVED`. This keeps walker numbers honest now that event nodes pay something.

### Events built in this row

`scrap_cache` (its Take and Leave choices only; Dig deeper is 168b), `data_fragments` and `relay_tower`. Every other event is **not eligible** until its row lands: gate them behind a `BUILT_EVENTS` set in `eventDraw.ts`, and each later row adds its ids.

### Tests (first)

1. `events.json` parses; 20 events; unique ids; rarities are Common/Uncommon/Rare; every `grants` is only `driver`/`patch`.
2. `drawEvent`: never returns an event already in `eventHistory`; never returns a Rare in `biomeIndex` 0; deterministic (same run and node give the same event); returns `null` when every built event has been seen.
3. With a history entry granting `driver`, no event with `grants: ['driver']` is drawn (use a test-only catalogue if the real Driver event isn't built yet).
4. `resolveEvent` refuses a second resolution for the same node.
5. `EventNode` (jsdom): first visit shows the event; after resolving, re-entering shows "The relay is dark"; closing without a choice is impossible (no close button).
6. The walker test file: a walk that crosses an event node records `EVENT_RESOLVED` and doesn't throw.

**Commit:** `feat(events): the event node plays, first visit only, with the first three events (168a)`.

---

## 168b — Temporary Drivers, and the two events that use them

**Henry:** the negative cost *"should be a temporary driver basically."* So a bad event gives your party a **Driver that lasts for the next fight only**. It is shown with the other Drivers, marked "next fight", and it's gone after that fight.

1. **Two new Drivers**, in `src/engine/data/lib/hooks.json`, written in the same grammar as the existing player Drivers (read `driver_bulwark_reflex` and any `onTurnStart` hook that uses a once-per-fight counter first):
   - `driver_frayed_signal`, **FRAYED SIGNAL**: *"At the start of your first turn, each member loses 25% of its max HP."* An `onTurnStart` hook with a per-member (`scope: OWNER`) once counter, doing `{ "type": "HP", "target": "SELF", "percentMaxHP": -25 }` and a LOG line. `proc: true`.
   - `driver_static_haze`, **STATIC HAZE**: *"At the start of your first turn, each member gains 2 Weakened."* Same shape, doing a STATUS Weakened 2.
2. **Keep them out of every offer.** They must **not** be in `PLAYER_DRIVER_IDS`, the elite stake pool (`driverStakes.driverStakePool`) or `playerDriverOptions()`. Add them to a new exported `TEMPORARY_DRIVER_IDS` in `driverRegistry.ts` so `describeDriver` and the UI can still name them.
3. **Run state:** `tempDrivers?: ReadonlyArray<{ readonly driverId: string; readonly fightsLeft: number }>` on `IRunState`, schema `.default([])`. A reducer `addTempDriver({ driverId, fights })`; if the same Driver is already there, add to its `fightsLeft`.
4. **Applied like any Driver:** `src/engine/run/battleSetup.ts` builds `drivers: [...run.drivers]`; make it `[...run.drivers, ...tempDriverIds(run)]`.
5. **Counted down after every fight the player wins or loses:** in `resolveEncounter`, `advanceGauntlet` and `finishGauntlet`, subtract 1 from every `fightsLeft` and drop entries at 0. (A defeat ends the run, so it needs nothing.)
6. **UI:** wherever the run's Drivers are listed (search `run.drivers` in `src/ui`), also list the temporary ones, with "· next fight" after the name.
7. **Outcome** `TEMP_DRIVER` in `applyOutcome.ts`.
8. Build `scrap_cache`'s **Dig deeper** and **`corrupted_stream`**; add both to `BUILT_EVENTS`. The walker never picks a choice that adds a temporary Driver unless it's the only option (Corrupted Stream with under 25 scrap).

**Tests (first):**

1. Frayed Signal: a 3v3 battle built with it; after the player's first `beginTurn`, each member is at 75% max HP (rounded as the engine rounds); after the second turn, no further loss.
2. Static Haze: 2 Weakened on each member at the first turn, once.
3. A temporary Driver is in the next fight's `activeDrivers` and gone from the one after.
4. Neither id appears in `playerDriverOptions()`, the stake pool or the Driver Shrine's offer (the last once 168e exists).

**Commit:** `feat(events): temporary Drivers, Frayed Signal and Static Haze (168b)`.

---

## 168c — Junk cards, and removing them costs scrap

**Henry:** *"Yes junk cards. Also you have to pay to remove them instead of selling them for scrap at the shop."*

1. **The card**, in `programs.json`: `corrupted_data`, **Corrupted Data**, `"description": "Does nothing. Exhaust."`, element `None`, category `Skill`, `baseCost` 1, `exhaust: true`, and a new field **`"junk": true`**. Its cost is the point: it clogs your hand, and clearing it spends an Energy. Actions: an empty list. **If the engine or any validator refuses a card with no actions, stop and report** rather than inventing an effect.
2. **`junk` in the types:** add `readonly junk?: boolean` to `ProgramData` in `src/engine/types.ts`.
3. **Never offered, never counted:** `isRewardable` returns false for junk; exclude junk from market stock, the codex denominator, card-budget audits (`cardBudgetAudit`, `powerscale`), and `upgrades.json` (no `+`). The gate will tell you where; fix each by excluding junk, not by giving it a score.
4. **The deck floor ignores junk:** `minimumActiveDeck` compares against the number of **non-junk** deck cards, in `sellRunCard` and everywhere else it is checked (search `minimumActiveDeck(`).
5. **Removal costs scrap:** at the marketplace's SELL list, a junk card shows **"Remove — 25 scrap"** instead of a sell price. A new reducer `removeJunkCard({ instanceId, price })` refuses a non-junk card or an unaffordable price, takes the scrap, and removes the card from the deck or collection. It is never blocked by the floor. Name the price `JUNK_REMOVAL_PRICE = 25` in `marketplace.ts` beside `sellPrice`, with a comment quoting Henry.
6. **The AI and the walker:** the enemy never gets junk. The TacticalAI can play it (it costs 1 and does nothing, so it will only play it with spare Energy); check the AI doesn't break on an empty action list. The walker plays by the same AI; its shop policy removes junk when it can afford to.
7. **Outcome** `JUNK` (adds one Corrupted Data to the deck with a deterministic instance id from the node seed). Build **`overclock_rig`** (needs the `UPGRADE` outcome for two cards, reusing `UpgradeBench` `free` with bench key `event:<nodeId>` and an allowance of two) and **`corrupted_cache`** (`GAMBLE` with a seeded 50/50, the Rare pick from 168d's helper, or JUNK + SCRAP −15). If 168d isn't built yet, build `corrupted_cache` in 168d instead and say so.

**Tests (first):** junk is not rewardable; the floor counts non-junk cards (a deck at the floor plus one junk can still remove the junk); `removeJunkCard` charges 25 and refuses a non-junk card; the sell list shows the Remove row with the price; the AI returns a legal action with Corrupted Data in hand.

**Commit:** `feat(cards): junk cards, paid removal at the shop, Overclock Rig and Corrupted Cache (168c)`.

---

## 168d — The pick-a-reward events

Build **`abandoned_terminal`**, **`wild_tracks`**, **`rare_vault`**, **`macro_crate`**, **`data_broker`** and **`stray_mingming`**, and add them to `BUILT_EVENTS`. Reuse what exists; add nothing new that an existing piece already does:

| Outcome | Reuse |
|---|---|
| `UPGRADE` | `UpgradeBench` with `free` and bench key `event:<nodeId>` |
| `CARD_PICK` by rarity | one helper `rollCardChoices(pool, rarity, count, stream)` in `src/engine/run/events/eventCards.ts`, the same rarity filtering `RewardSystem.rollCardFromPool` uses, with distinct cards |
| `BLUEPRINT_PICK` | three distinct species from `regionSpeciesPool`; on pick, dispatch `addBlueprint(species)` then `recordBankedBlueprint(species)`, exactly as `BattleArena` banks a gym-clear blueprint |
| `MACRO_PICK` | `rollMacroChoices(seed)`, `MacroRewardPick`, `takeRewardMacro` (166d) |
| paid choices | the price rides the action, scrap and item in one step (the codebase's `buyMarketCard` rule) |
| `RECRUIT` | the workshop's recruit flow (`workshop.planRecruit` and the ranch-first dispatch order in `WorkshopNode`) at price 0, for one recruit |

**Tests (first):** each event's eligibility check (a positive and a negative case from the table), each outcome's effect on the run (and on the ranch for blueprints and recruits), and Data Broker's two prices.

**Commit:** `feat(events): the six pick-a-reward events (168d)`.

---

## 168e — The trade and cost events

Build **`trader`**, **`mirror_protocol`**, **`recompiler`**, **`the_toll`**, **`driver_shrine`** and **`black_market_patch`**.

1. **`GIVE_CARD`**: a card picker over the deck and collection; deck cards that would break the floor are greyed with the reason. Removing uses the same path `sellRunCard` uses, at price 0 (the card is spent, not sold).
2. **`TRADE_UP`**, **`DUPLICATE`** (a new deterministic instance id; the copy goes to the same pile as the original) and **`TRANSFORM`** (same element and rarity, from `isRewardable` cards, never the same card): small helpers in `src/engine/run/events/`.
3. **`GIVE_BLUEPRINT`** needs a ranch reducer that doesn't exist yet: add `spendBlueprint(speciesId)` to `src/ui/store/gameSlice.ts`, refusing when the count is 0. Model it on how `assembleMingming` decrements.
4. **`DRIVER_PICK`**: two Drivers from `playerDriverOptions()` that the run doesn't hold, seeded; on pick, `addDriver`. **Order: grant the Driver first, then take the payment** (cards or blueprint), then `resolveEvent` with `grants: ['driver']`. A crash in the middle then leaves the player paid, not robbed.
5. **`PATCH`**: `fitPatch({ memberId, patchId: bestPatchFor(...), price })` for the chosen unpatched body; the "give up a Rare card" option gives up a Rare card from the deck or collection instead of paying. `resolveEvent` with `grants: ['patch']`.
6. The Toll's two choices are its only choices; the event is ineligible if you can do neither.

**Tests (first):** the power cap end to end (after `driver_shrine` grants a Driver it can never be drawn again; same for the patch); `spendBlueprint` refuses at 0; the floor greys the right cards; the Driver Shrine never offers a Driver already held or a temporary one.

**Commit:** `feat(events): trades and costs, the Driver Shrine and the Black-Market Patch (168e)`.

---

## 168f — Firmware Reflash

Switch one body to its other OS (v1 ↔ v2) **for the rest of this run**. The ranch is untouched, so the roster member keeps its OS for the next run.

1. **Run state:** `osOverrides?: Readonly<Record<string, string>>` (member id → OS id), schema `.default({})`, and a reducer `reflashMember({ memberId, osId })` that refuses an OS the species doesn't have, a member not in the party, or a member with a patch.
2. **One helper** `effectiveOS(run, member)` in `src/engine/run/` returns the override or `member.activeOS`. Then **every run-time read of a party member's OS** uses it. Find them with `grep -rn "activeOS" src/engine/run src/ui/screens src/ui/components`; at least `battleSetup.toMingmingState`, `PatchBench` and the reward-roll party. List every site you changed in the report. **Do not change `activeOS` on the ranch member.**
3. **Cards don't change.** The deck is what the run built; only the firmware changes. Say so on the event button: "Its OS changes; its cards don't."
4. **Patched bodies can't be reflashed** (a patch is fitted to a firmware). The event lists them greyed with that reason.
5. `REFLASH` outcome; add `firmware_reflash` to `BUILT_EVENTS`.

**Tests (first):** after a reflash, the next battle's entity runs the new OS hooks; the ranch member's `activeOS` is unchanged; a patched member is refused.

**Commit:** `feat(events): Firmware Reflash switches a body's OS for the run (168f)`.

---

## 168g — Ambush Bait: an optional fight

**Fight it:** a wild fight on this event node, paying **double** the normal win scrap. **Leave:** nothing.

1. A reducer `startEventFight()` that sets `phase: 'encounter'` for an `event` node and records `eventFight: true` on the run (a new optional field, schema `.default(false)`).
2. `RunScreen`'s fight trigger today requires `isFightNode(node.kind)`. Let it also start when `run.eventFight` is true, rolling the encounter with the node treated as a **wild** (`rollEncounter({ run, node: { ...node, kind: 'wild' }, party })`), so it gets the wild rung, the wild's beam and the node's seed.
3. On victory the reward bundle's `scraps` is doubled; everything else (cards, blueprints) is a normal wild's. `resolveEncounter` clears `eventFight`. Record the event as resolved **when the choice is made**, so a loss or a crash can't re-offer it.
4. Add `ambush_bait` to `BUILT_EVENTS`; the walker takes the fight.

**Tests (first):** choosing Fight starts an encounter on an event node; a win pays twice `scrapForWin('wild', n)`; the node shows "dark" afterwards.

**Commit:** `feat(events): Ambush Bait, an optional fight for double scrap (168g)`.

---

## After 168g: one measurement

Run the walker on the parent of 168a and on 168g, same seeds (60 seeds × 12 starters, full runs), and report: how often each event was drawn, how many runs got a Driver or a patch from events (must be at most 1 of each per run), scrap held at the gym (mean), and the gym clear rate. Don't tune anything.

## Resolution

Closed 2026-10-02: all rows built on `playtest-polish` (`a8e3ed7..8382ff6`), merged to `main` in PR #13.
