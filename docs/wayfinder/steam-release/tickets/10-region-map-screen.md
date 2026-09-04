# Region map screen: render the graph, fog, routing, node states (ticket 10)

- Type: wayfinder:task
- Status: closed
- Assignee: agent
- Blocked by: [07](07-region-graph.md)
- Phase: Vertical Slice

## Deliverable

A new screen (`ui/screens/RegionMap.tsx`) that renders the generated graph: node type icons (types visible, contents hidden), element badges on encounter nodes, visited/current/reachable states, the visibility horizon, the gym marked, and click-to-travel along edges. Keyboard navigable. Replaces `SectorTerminal` as the run's hub. Responsiveness: must survive the 16:10 Steam Deck frame (1280×800) — see ticket 37 for the general rule, but do not build this screen at a fixed pixel size.

## Done when

Henry can route a full run on the map in the dev build; the screen is the only way to reach fights; `SectorTerminal` is removed or demoted to debug.

## Resolution

**Closed 2026-08-22.** `ui/screens/RegionMap.tsx` renders the run's graph and `RunScreen` frames it.
Suite **1045 → 1064**, `tsc -b` clean, build green, new files lint-clean.

### Layout is a pure module, not part of the component

`ui/screens/regionLayout.ts` turns the node set into positions, fog flags and reachability;
`RegionMap.tsx` only draws what it is handed. That split exists because ticket 06 deliberately
removed `x`/`y` from `IRegionNode` — position is *derivable* from `(biomeIndex, layer)`, and storing
pixels in the save would freeze a UI decision into the persisted format. The consequence is that the
fog rule is testable without a DOM, and ticket 34 can re-lay-out the map without touching a save.

Position is `column = biomeIndex * 5 + layer`, so the whole run is 15 columns left to right. Pockets
sort last within their column, so a dead end hangs off the bottom of its layer instead of shoving the
main route around — the route reads as a spine.

### The fog rule, with the two clauses the ticket implies but does not say

Ruled: one layer ahead, types visible, contents hidden. Two additions, both following from the rest
of the ruling rather than inventing anything, and both tested:

1. **Anywhere you have already stood stays revealed** (`visited > 0`). Fog that forgets where you
   walked is not fog, it is amnesia — and it would make the map useless for the backtracking ticket
   07 explicitly allows.
2. **Fog hides the KIND, never the node.** You can see that a fork exists four layers out; you cannot
   see what is on it. That is "types visible, contents hidden" one step further out, and it is what
   makes routing a decision rather than a guess. There is a test asserting the **gym icon is not on
   screen on turn one** — the specific leak an "always show the destination" convenience would open.

### Visit counts, not a dead/alive state

Ticket 07 rules that entering a node triggers it again, always, and that farming is fine. A map that
greyed out a cleared wild would be telling the player the opposite, so a visited node shows **×2**
and stays fully live. A test asserts the markup contains no "cleared"/"spent"/"exhausted".

### Accessibility: two renderings of one thing

The SVG is the picture and is `aria-hidden`. Underneath it is a real `<nav>` of focusable buttons,
one per reachable node, each labelled with kind, element, biome, layer, dead-end and visit count.

That is deliberate rather than lazy. Making an SVG `<g>` behave like a button means hand-rolling
focus, roles and key handling and still ending up with something a screen reader narrates badly; a
button list is correct by construction and stays correct when **ticket 34** restyles the picture.
**Ticket 38** therefore inherits a screen that is already keyboard-operable rather than one that
needs retrofitting.

### Steam Deck

Drawn in `viewBox` units, scrolling inside its own `overflow-x` container. A 15-column region is
genuinely wider than 1280px, and the honest answer is to pan it rather than shrink nodes below a
readable size — **ticket 37** gets a window onto the map, not a squashed layout. Nothing is sized in
fixed pixels outside the SVG's own coordinate space.

### Not done here, and why

**`SectorTerminal` is not removed.** It is already DEV-only (ticket 20 demoted it) and it is the last
way to start a fight until ticket 11 lands the encounter flow. **Ticket 11 deletes it** along with the
other legacy tabs — that amendment is already written into 11.

**Travel does not trigger the node.** `RunScreen`'s handler moves `currentNodeId` and increments the
destination's `visited`. The trigger is ticket 11's, and `visited` is a count precisely so a second
visit rolls a second encounter rather than replaying a cached one.

## Amendments from tickets 07/08 (Henry, 2026-08-21)

Visibility is ONE layer ahead (types visible, contents hidden), with map-reveal arriving as an item/event. Edges are walkable both ways and ENTERING A NODE TRIGGERS IT AGAIN (re-fight wilds, revisit markets/workshops) — the screen must show visit counts, not a dead/alive state. No rest nodes exist.
