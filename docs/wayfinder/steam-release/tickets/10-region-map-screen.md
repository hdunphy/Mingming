# Region map screen: render the graph, fog, routing, node states (ticket 10)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [07](07-region-graph.md)
- Phase: Vertical Slice

## Deliverable

A new screen (`ui/screens/RegionMap.tsx`) that renders the generated graph: node type icons (types visible, contents hidden), element badges on encounter nodes, visited/current/reachable states, the visibility horizon, the gym marked, and click-to-travel along edges. Keyboard navigable. Replaces `SectorTerminal` as the run's hub. Responsiveness: must survive the 16:10 Steam Deck frame (1280×800) — see ticket 37 for the general rule, but do not build this screen at a fixed pixel size.

## Done when

Henry can route a full run on the map in the dev build; the screen is the only way to reach fights; `SectorTerminal` is removed or demoted to debug.

## Resolution

_(open)_

