# Region graph: generation, branch width, visibility depth, node mix (ticket 07)

- Type: wayfinder:prototype
- Status: closed
- Assignee: wayfinder (Henry prototype session, 2026-08-21)
- Blocked by: [06](06-run-data-model.md)
- Phase: Vertical Slice

## Question

exploration-map.md rules: explorable graph (not three lanes), room to farm, types visible / contents hidden, 8–10 battles + the gauntlet, node types = wild / elite / marketplace / event / workshop / gym, alpha + ambush as marked exceptions. Un-ruled and needed to build: node count per biome, branch width, how far ahead the player sees, node-type mix, workshop/marketplace placement, how the biomes connect, whether farming is bounded.

## Resolution

**Prototype:** [research/07-region-graph-prototype/regiongraph.py](../research/07-region-graph-prototype/regiongraph.py) (seeded Python generator + SVG dump; `full_11.svg`, `full_12.svg` are two seeds at the ruled parameters, `fog_11.svg` is the player's view). Henry reacted to rendered graphs; the numbers below are his.

**RULED parameters (Henry, 2026-08-21):**

| Knob | Value |
|---|---|
| Biomes per run | 3, sequential, mono-element at launch (ticket 05) |
| Layers per biome | 5 — entry, 3 middle, exit |
| Width | 2–3 nodes per middle layer; lateral edges between siblings ~60% of layers |
| Middle-node mix | wild 60 / event 14 / elite 10 / market 8 / workshop 8 %, with **exactly one market and one workshop guaranteed per biome** |
| Biome exit | an elite; biome 3's exit is the gym |
| Pockets | 1 dead-end side node per biome: wild / alpha (guards a guaranteed blueprint) / ambush (their 3 vs your 2) |
| Fight envelope | **LOOSE — deliberately not floored or capped.** Shortest path averages ~6.7 fights, longest ~14.6 (200 seeds); an under-built rusher loses at the gym and a farmer's run goes long. The 8–10 ruling is the *typical* run, not a generator constraint. Telemetry (ticket 19's run clock) watches it. |
| Visibility | **1 layer ahead** (types visible, contents hidden) — plus **map-reveal as an item/event outcome** (a Macro-shaped consumable or an event choice reveals the biome; ticket 15 / ticket 30 carry it). |
| Node re-entry | **Entering a node triggers it again, always.** Wilds re-fight (full rewards — "farming is fine"), markets and workshops can be revisited at the price of re-fighting the wilds on the way. Edges are walkable in both directions; the graph is genuinely explorable, not a frontier picker. |
| Rest nodes | **None.** Full heal between regular nodes stands (exploration-map ruling), so a Spire campfire has nothing to heal; card removal lives at marketplaces (and optionally workshops — ticket 14). |

**Run start — CONSOLIDATED (amends ticket 09):** every run starts the same way: the ranch offers **three random gym offers**, each showing its three biome types in order and the starting region; the player picks one, **then** picks the party (first run ever: picks a starter from the three offered species instead of a party). No fixed first-run order. The first-biome counter problem (ticket 05 caution) is solved by ordering, not by a hidden rule: because the party is chosen *after* the offer, the player can always pick the starter that hits the opening biome, and the three offers should be generated with three different opening biomes so that choice always exists (generator guarantee — the one rule Legion adds).

**Implementation notes for the TS port (ticket 10 builds the screen on it):** generator in `src/engine/run/regionGraph.ts`, seeded from `IRunState.seed`, output = nodes `{id, biome, layer, kind, pocket}` + directed edges both ways; tests: determinism (same seed → same graph), every node reaches the gym, exactly one market + one workshop per biome, pocket count, no isolated nodes, and the three-offers-three-different-openings guarantee. Contents (which species, which event) are rolled at node entry from the node's seed + visit count so re-entry re-rolls honestly.

**Questions this closes in the map:** #6 (graph numbers), the first-biome caution from #5. **New small items it opens:** repeat-fight reward policy if farming proves degenerate (watch, do not pre-patch); map-reveal item design (ticket 15/30).
