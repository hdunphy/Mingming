# Prototype: the region map screen, visual pass (ticket 64)

- Type: wayfinder:prototype
- Status: closed
- Assignee: wayfinder (Henry prototype session)
- Blocked by: [10](10-region-map-screen.md)
- Phase: Vertical Slice

## Question

Ticket 10 built the functional map; this prototypes how it should LOOK and read before ticket 34 themes it. Must express: mono-element biome zones (color + backdrop per element), node-type icons at a glance (wild/elite/market/event/workshop/alpha/ambush/gym), 1-layer visibility fog (and what a Scout reveal looks like), visit COUNTS on re-enterable nodes, the biome-boundary edit alert's presentation, current position + reachable edges, and the gym as a destination with three silhouettes. Open for Henry: top-down node graph vs side-scrolling route; how much "staged overworld" flavor (the vision doc's walkable-world future) the framing should hint at; Steam-Deck-size legibility (1280×800 check in the mock).

## Deliverable

2 HTML/SVG mockups over a real generated graph (reuse research/07-region-graph-prototype/regiongraph.py output); Henry picks; notes feed ticket 34's theming and any ticket-10 layout fixes.

## Resolution

Closed 2026-08-26. Mockups in [research/64-map-proto/](../research/64-map-proto/).

**CHOSEN: Option N — the WINDING ROUTE** ([map_N_route.svg](../research/64-map-proto/map_N_route.svg), PNG beside it; M, top-down zones, kept in research/ as the rejected comparison). Henry's one correction is applied: **nodes spaced with a minimum ~74px separation** (the build should enforce a min-distance pass after layout — the reference SVG's relaxation loop is the model). Build spec for the theming of ticket 10's screen:

- Serpentine left-to-right route across three mono-biome color zones (zone tint + labeled header per biome; cleared biome gets a ✓).
- Node states: **gold ×N visit badge** (re-enterable nodes), **pulsing element glow** = current, **white ring** = reachable now, **dark + dotted** = beyond the 1-layer sight (Scout reveals them), dashed border = pocket (dead-end alpha/wild/ambush).
- Node icons W/E/$/K/?/A/X/G until ticket 34 supplies real icons; legend row at the bottom.
- **Biome boundary banner** near the exit elite ("beat the elite → loadout alert" — the ticket-62 C modal).
- Gym shows its name + three team silhouettes; keep it ≥80px from the right edge (the mock clips — noted).
- Top-right status: scrap · macro slots · DECK n/floor. 1280×800 legibility is the floor.
