# Region graph: generation, branch width, visibility depth, node mix (ticket 07)

- Type: wayfinder:prototype
- Status: open
- Assignee: 
- Blocked by: [06](06-run-data-model.md)
- Phase: Vertical Slice

## Question

exploration-map.md rules: explorable graph (not three lanes), room to farm, types visible / contents hidden, 8–10 battles + the gauntlet, three biomes of two elements each, node types = wild / elite / marketplace / event / workshop / gym, alpha + ambush as marked exceptions. **Un-ruled and needed to build:** node COUNT per biome, branch width, how far ahead the player sees (the routing decision), node-type mix per biome, where workshops and marketplaces sit, how the three biomes connect (sequential zones vs one interleaved graph), and whether farming is bounded (a scrap/HP cost to linger, or a node cap).

Build a seeded generator (`src/engine/run/regionGraph.ts`) with a text/SVG dump in the debug toolkit so Henry can react to real graphs. Propose a starting parameter set with numbers (e.g. 3 zones × 6–7 nodes, width 3, see 2 nodes ahead, mix 55% wild / 10% elite / 10% market / 15% event / 10% workshop, 1 alpha per run) — Henry picks.

## Done when

Generator + tests (determinism, reachability of the gym, fight-count envelope 8–10 before the gauntlet) and Henry's ruled parameters recorded in the resolution.

## Resolution

_(open)_

