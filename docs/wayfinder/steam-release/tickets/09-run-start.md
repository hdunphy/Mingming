# Run start: pick your starter, pick one of three gyms, seed the run (ticket 09)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [06](06-run-data-model.md), [07](07-region-graph.md), [08](08-start-kit-rule.md)
- Phase: Vertical Slice

## Deliverable

Replace `MainMenuView`'s hardcoded three starters + `HubScreen`'s QUICK DEPLOY with the ruled run start: choose ONE assembled mingming from the ranch (roster), see three offered gyms (each = a boss + its three biome pairs, with difficulty tier shown), pick one, and a run is created from `IRunState` with a seed, the region graph (ticket 07), the start kit (ticket 08), 0 scrap, empty Macro slots. First-ever boot still needs a starter grant (three species, no scrap): keep the starter pick but route it through blueprint assembly so the ranch is the single path.

## Done when

A new player can boot, assemble a starter, start a run, and land on the region map with one mingming and its start kit. Tests on run creation determinism.

## Resolution

_(open)_

