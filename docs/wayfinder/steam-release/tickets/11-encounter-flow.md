# Node encounter flow: wild fights, symmetric parties, full heal, no level scaling (ticket 11)

- Type: wayfinder:task
- Status: open
- Assignee: 
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

_(open)_

## Amendments from tickets 07/08 (Henry, 2026-08-21)

Wild decks MIRROR the player's kit fraction by biome depth — one knob `kitFraction` per depth: biome 1 = 5 startKit + 3 generics, NO OS; biome 2 = kit + OS; biome 3 + gauntlet = full tuned decks + OS. Biomes are mono-element at launch (ticket 05). Re-entering a node re-rolls its encounter from node seed + visit count and fights again.
