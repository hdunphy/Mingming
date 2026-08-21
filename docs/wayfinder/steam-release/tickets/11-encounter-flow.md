# Node encounter flow: wild fights, symmetric parties, full heal, no level scaling (ticket 11)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [06](06-run-data-model.md), [21](21-leveling-freeze.md)
- Phase: Vertical Slice

## Deliverable

Refit `engine/data/EncounterGenerator.ts` + the `BattleArena` entry path for the ruled shape: enemy party size = player party size (symmetric by default), species drawn from the node's biome elements, enemies use their tuned per-OS decks (not the 1-daemon-+-9-random fill), NO level scaling (frozen at the calibration point — ticket 21), seeded from the run seed + node id. After a regular node the party is FULLY healed; statuses cleared. Ambush nodes (their 3 vs your 2) and alpha nodes (one elite-frame wild vs your full team) are flagged here and built in ticket 17.

## Done when

Entering a wild node from the map starts a correct fight and returns to the map on victory; defeat routes to run end (ticket 19). Determinism test: same seed → same encounter.

## Resolution

_(open)_

## Amendments from tickets 07/08 (Henry, 2026-08-21)

Wild decks MIRROR the player's kit fraction by biome depth — one knob `kitFraction` per depth: biome 1 = 5 startKit + 3 generics, NO OS; biome 2 = kit + OS; biome 3 + gauntlet = full tuned decks + OS. Biomes are mono-element at launch (ticket 05). Re-entering a node re-rolls its encounter from node seed + visit count and fights again.
