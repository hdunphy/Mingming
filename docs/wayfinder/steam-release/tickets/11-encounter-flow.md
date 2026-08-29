# Node encounter flow: wild fights, symmetric parties, full heal, no level scaling (ticket 11)

- Type: wayfinder:task
- Status: closed
- Assignee: agent
- Blocked by: [06](06-run-data-model.md), [21](21-leveling-freeze.md)
- Phase: Vertical Slice

## Deliverable

**From [ticket 09](09-run-start.md) (2026-08-22): this ticket inherits the battle-path migration.**
Ticket 09 landed the run slice but left `createBattleState` reading `IPlayerSave`, because that
signature is what the entire balance harness and scenario system call — moving it is the same job as
building the encounter flow, so it belongs here rather than in 09. Concretely, ticket 11 owns:

- moving the six run-scoped fields (`cardInventory`, `activeDeck`, `scrapCount`, `relics`,
  `gauntlet`, `baseDecksGranted`) off the `game` slice and onto `IRunState`, where 06 put them;
- deleting `engine/save/ranchProjection.ts` and its test once nothing needs the projection;
- deleting `addToRoster`'s base-deck grant into `cardInventory` — cards are run-scoped, and the start
  kit now comes from ticket 08's `startKit` tags at run start. It survives only as the debug scenario
  launcher's card source, so give the launcher another one first;
- deleting the DEV-only legacy tabs `HubScreen`, `SectorTerminal` and `DeckTerminal`, which exist
  only because they were the last way to start a fight;
- **the node trigger itself**: ticket 07 rules that entering a node triggers it again ALWAYS, and
  `IRegionNode.visited` is a count so a re-entry rolls fresh content rather than replaying a cache.
  `RunScreen`'s travel already maintains the count and deliberately fires nothing.

Ticket 08 also lands here: **enemy decks mirror the player's kit fraction by biome depth** —
biome 1 wilds get 5 kit + 3 generics and NO OS, biome 2 gets kit + OS, biome 3 and the gauntlet get
the full tuned decks. One `kitFraction` knob. That is what makes the tuned 1v1/3v3 balance corpus the
LATE-run reference and the early fights easier by construction.

Refit `engine/data/EncounterGenerator.ts` + the `BattleArena` entry path for the ruled shape: enemy party size = player party size (symmetric by default), species drawn from the node's biome elements, enemies use their tuned per-OS decks (not the 1-daemon-+-9-random fill), NO level scaling (frozen at the calibration point — ticket 21), seeded from the run seed + node id. After a regular node the party is FULLY healed; statuses cleared. Ambush nodes (their 3 vs your 2) and alpha nodes (one elite-frame wild vs your full team) are flagged here and built in ticket 17.

## Done when

Entering a wild node from the map starts a correct fight and returns to the map on victory; defeat routes to run end (ticket 19). Determinism test: same seed → same encounter.

## Resolution

**Closed 2026-08-22.** Entering a node fights, the run owns everything run-scoped, and the
projection is gone. Suite **1064 → 1077** (via 1040 mid-refactor, see below), `tsc -b` clean, build
green.

---

## READ THIS FIRST: a defeat was going to delete your ranch

`BattleArena` called `deleteSave()` **the instant your last unit fell**, before you clicked
anything, and `handleDefeatReset` called it again along with `resetSave()` and a page reload. The
overlay said "RUN TERMINATED. DATA WIPED."

That was correct when a save *was* the run. Since ticket 23 it is the **ranch** — every assembled
individual, every blueprint, the codex. **Losing a biome-0 wild would have deleted all of it.** Both
calls are gone; defeat now dispatches `endRun('defeat')` and clears the battle, and the ranch is not
touched. This was latent rather than live (nothing could reach a run defeat before today) but it
would have gone off the first time you lost a fight.

---

## Part 1 — the shape migration

`state.game` is `IRanchState` exactly: `roster`, `blueprints`, `codex`, `gymsCleared`,
`highestTierCleared`. **`engine/save/ranchProjection.ts` and its test are deleted** — the slice is
the ratified shape, so `App`'s boot effect dispatches `loadSave(result.ranch)` verbatim.

Everything run-scoped moved: `cardInventory` + `activeDeck` + `baseDecksGranted` collapsed into
`IRunState.deck` (which carries `dataId` directly, so the instance-id indirection is gone),
`scrapCount` → `run.scrap`, `relics` → `run.drivers`, `unlockedSectors` → `gymsCleared`.

**`activeParty` left the ranch entirely.** A persistent ranch party is a concept that no longer
exists — you pick a party at run start. `setActiveParty` is deleted; the species clause now lives in
`RunStart` (via `partyBlockFor`) and in `reconcileLoadedState`, which are the two places that can
still create a party. `engine/party.ts`'s `legalParty` has no production caller today and is kept
deliberately for ticket 14's mid-run recruiting, pinned by its own test so it cannot rot while it
waits.

**`createBattleState` no longer takes a save.** It takes `IBattleSetup` (party, deck as dataIds,
drivers, persistedHp, gauntlet), built by `engine/run/battleSetup.ts` from `(ranch, run)`. There was
exactly **one** production call site, and the balance harness never touched `IPlayerSave` at all —
it goes through `buildScenarioState` — so this was far smaller than it looked.

Deleted for want of a consumer: `IPlayerSave`, `IActiveDeck`, `PlayerSaveSchema`,
`createDefaultSave`, `createStarterSave`, `DECK_SIZE`, `MIN_DECK_SIZE`, `deckGrantKey`,
`OS_SWAP_PICK_COUNT`, `IGauntletState`, `engine/deckSuggest.ts`, and the three legacy screens
(`HubScreen`, `SectorTerminal`, `DeckTerminal` + its CSS).

`addToRoster`'s base-deck grant is gone, and with it `swapOS`'s kit-pick — a reflash costs a
blueprint and grants nothing. Cards come from ticket 08's `startKit` tags at run start.

---

## Part 2 — the encounter flow

`engine/run/encounter.ts` rolls an encounter from **`run.seed` + node id + the visit count after the
increment**, so a second visit to the same wild is a genuinely different fight. Tested both ways:
same inputs are identical, visit 2 differs from visit 1.

- **Symmetric party size.** `generateEncounter` used to roll `1..playerPartyLength`; that was
  pre-run behaviour and it is deleted, not ignored. **Ambush** is `party + 1` capped at 3 (ticket
  07's "their 3 vs your 2") and **alpha** is 1. Both are counts only — ticket 17 makes them
  dangerous.
- **Ticket 08's kit fraction by depth**, as one exported knob `KIT_FRACTION_BY_BIOME`: biome 0 gets
  5 `startKit` + 3 generics and **no OS**, biome 1 gets kit + OS, biome 2 and the gym get the full
  tuned deck + OS. Biome 0's enemy deck is built by the *same* `startKitIdsFor` the player's is, so
  the two cannot drift. This is what makes the tuned balance corpus the **late-run** reference and
  the early fights easier by construction rather than by a difficulty multiplier.
- **No level scaling.** A test builds the same species at biome 0 and biome 2 and asserts the
  entity's stats are byte-identical — only the deck and the OS differ.
- **Full heal between nodes was already true by construction**, so it is asserted rather than
  implemented: `IRunState` has nowhere to put HP outside `gauntlet.persistedHp`,
  `initializeBattleEntity` sets `currentHp = maxHp` with no statuses and no temp HP, and
  `buildBattleSetup` passes `persistedHp: {}` whenever `run.gauntlet` is null — which is every node
  outside the gym. The test fights two nodes in sequence and checks all of it.
- Marketplace, workshop and event nodes **fire and say "nothing here yet"** rather than silently
  doing nothing, so it is obvious the trigger works before tickets 13, 14 and 30 fill them in.

---

## Needs your call

### Run fights are `enemyMode: 'CARDS'`, not `'MOVES'`

This changes how a fight *feels* and it should be your decision, so it is one exported constant —
`RUN_ENEMY_MODE` in `encounter.ts` — and unmaking it is one line.

The argument for `CARDS`: a `MOVES` enemy is **never dealt a hand** — `createBattleState` only
builds an enemy drawpile under `CARDS` — so under the engine default, ticket 08's entire kit-fraction
ruling would be computed, stored, and never played. The balance corpus the fraction is calibrated
against is `CARDS` on both sides too. The cost is that enemies play cards through `TacticalAI`
instead of telegraphing intents, which is a different read on the board.

### The debug toolkit lost five verbs

`grant scraps`, `grant cards`, `grant relic`, `unlock sector` and `heal party` all wrote fields the
ranch no longer has. There is no run editor to move them to, so they went. The save editor keeps
`grant blueprint`, `add to roster`, `set activeOS`, `wipe` and `replace from file`.

**That is a real capability loss for playtesting the run loop** — you cannot currently hand yourself
scrap or cards mid-run. A run-editor panel is worth a ticket in the debug-toolkit wayfinder; I have
not filed it, because that map is not mine to add to.

### Two deferrals, on purpose

- **The `game` slice is still called `game`** though it now holds only the ranch. Renaming the slice,
  its file and every selector is pure churn with zero behavioural content, and burying it inside this
  diff would have made an already-large change unreviewable. It wants its own small commit.
- **The gauntlet chain in `BattleArena` is deleted, not ported.** The old flow bumped an index,
  stashed HP and re-entered — with `IRunState.gauntlet` null for the whole run and its reducers
  explicitly ticket 18's, porting it would have replayed fight one forever. What survives is the
  durable half: winning at the gym node dispatches `markGymCleared` + `recordTierCleared` +
  `endRun('victory')`. **Ticket 18 has been amended** to own the rest.

## Also worth knowing

- Enemy OS is now **rolled** from `availableOS` rather than pinned to the first entry — seeded, so
  still deterministic, and it buys per-fight variety for nothing.
- `FIGHT_KINDS` moved from the map screen into the engine and the UI re-exports it: three consumers
  (the phase decision, the sizing rules, the map's element badge) have to agree on what a fight is.
- `fightsResolved` counts **victories only** — a fight that killed you is not one you resolved — and
  it does count farmed re-fights, because ticket 25 reads it as a duration metric rather than a
  progress bar.
- "An elite uses biome-2 rules regardless of depth" is flagged in the source as a **reading**, not a
  ruling. No ticket states it; the argument is that an elite is the biome's exam.
- The test count dipped to 1040 mid-refactor before landing at 1077. The suites that went were ones
  whose subject genuinely stopped existing: the deck-builder reducers, `swapOS`'s kit grant,
  `createStarterSave`'s determinism, and `deckSuggest`. Each is named in the commit.
- `SaveEditorPanel` had a live display bug — it printed `blueprints undefined` because it still
  called `.length` on what ticket 20 made a `Record`. Fixed in passing.

## Amendments from tickets 07/08 (Henry, 2026-08-21)

Wild decks MIRROR the player's kit fraction by biome depth — one knob `kitFraction` per depth: biome 1 = 5 startKit + 3 generics, NO OS; biome 2 = kit + OS; biome 3 + gauntlet = full tuned decks + OS. Biomes are mono-element at launch (ticket 05). Re-entering a node re-rolls its encounter from node seed + visit count and fights again.
