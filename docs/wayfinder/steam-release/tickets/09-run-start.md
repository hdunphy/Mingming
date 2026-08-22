# Run start: pick your starter, pick one of three gyms, seed the run (ticket 09)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [06](06-run-data-model.md), [07](07-region-graph.md), [08](08-start-kit-rule.md)
- Phase: Vertical Slice

## Deliverable

**From [ticket 23](23-save-v4.md) (2026-08-21): this ticket DELETES `src/engine/save/ranchProjection.ts`.** Save v4 persists `IRanchState`, but the six run-scoped fields it drops (`cardInventory`, `activeDeck`, `scrapCount`, `relics`, `gauntlet`, `baseDecksGranted`) had nowhere to live yet, so 23 left the `game` slice in its pre-roguelike shape and translated at the save boundary. Landing the run loop means: move those six into `IRunState`, delete the projection module and its test, and grow the autosave subscription in `ui/store/store.ts` a second arm that calls `saveRun` on run-slice changes (the two keys are written independently — that is the point of the split). The subscription carries a comment saying so.

Replace `MainMenuView`'s hardcoded three starters + `HubScreen`'s QUICK DEPLOY with the ruled run start: choose ONE assembled mingming from the ranch (roster), see three offered gyms (each = a boss + its three biome pairs, with difficulty tier shown), pick one, and a run is created from `IRunState` with a seed, the region graph (ticket 07), the start kit (ticket 08), 0 scrap, empty Macro slots. First-ever boot still needs a starter grant (three species, no scrap): keep the starter pick but route it through blueprint assembly so the ranch is the single path.

## Done when

A new player can boot, assemble a starter, start a run, and land on the region map with one mingming and its start kit. Tests on run creation determinism.

## Resolution

_(open)_

## Amendments from tickets 07/08 (Henry, 2026-08-21)

Run start is CONSOLIDATED: three random gym offers (each shows its three biome types in order + the start region; the generator guarantees three different opening biomes) → pick one → THEN pick the party (first run ever: pick a starter from the three offered species instead). No QUICK DEPLOY, no fixed first-run order. Start deck per ticket 08: 5 `startKit` + 3 generics; OS active.

## Ratified startKit tags (Henry, 2026-08-21) — the data this ticket lands

Principle: the kit keeps the deck's engine and identity card; the biggest payoff and redundancy are drafted back (ticket 08). `water_slap` is never tagged — it IS the generic; the start deck's 3 generics are 3× the generic hit (reuse `water_slap` or add a `basic_strike`; Legion's call, say which in the resolution). Add `startKit: string[]` (exactly 5 ids, duplicates allowed, every id present in the deck list) beside each launch deck in `mingmingRegistry.ts`, with a test enforcing both rules for the six launch species. Non-launch species: untagged (test skips them).

| deck | startKit |
|---|---|
| fenrir_v1 | blood_rite, blood_rite, berserk_rush, battle_rhythm, crimson_draw |
| fenrir_v2 | ignite, ignite, molten_core, slag_strike, pyre_sacrifice |
| skoll_v1 | fury_strike, fury_strike, brute_force, battle_rhythm, sun_devourer |
| skoll_v2 | fury_strike, fury_strike, reckless_charge, strength_burst, glass_cannon |
| kraken_v1 | undertow, whirlpool_v2, pressure_point, pressure_point, ink_stream |
| kraken_v2 | capacitor, capacitor, surge_protection, surge_protection, hydro_blast |
| jormungandr_v1 | undertow, undertow, blind_spot, serpents_coil, ink_stream |
| jormungandr_v2 | corrosive_bolt, corrosive_bolt, venom_fang, venom_fang, toxic_surge |
| ratatoskr_v1 | forage, forage, healing_mist, nettle_sting, echo_chamber_v2 |
| ratatoskr_v2 | pollen_cloud, pollen_cloud, nagging_bite, nagging_bite, crippling_vine |
| huldra_v1 | growth, growth, iron_bark, thorn_tithe, hexbloom |
| huldra_v2 | sap_vigor, sap_vigor, thornguard, thornguard, heartwood |

Recruits (ticket 14) take the FIRST 3 of the list + 1 generic. This table is also the request to the deck-archetypes map (their content, ratified here); note it in their HANDOFF when you next touch it.
