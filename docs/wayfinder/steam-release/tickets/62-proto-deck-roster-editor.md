# Prototype: the deck + roster editor (the four-surface edit screen) (ticket 62)

- Type: wayfinder:prototype
- Status: closed
- Assignee: wayfinder (Henry prototype session)
- Blocked by: —  (spec: [61's AMENDED SPEC](61-apply-60.md); build lands via 61 package 4)
- Phase: Vertical Slice

## Question

One editor serves all four edit surfaces (marketplace, workshop, biome-boundary alert, pre-gauntlet). Before Legion builds final UI, Henry reacts to clickable HTML mockups. What the screen must express, from the amended spec: ACTIVE DECK vs RUN COLLECTION as two visible pools with cards moving between them; the deck floor (8/13/18 by party size) as a hard, visible limit; party slots + BENCH with drag/tap swaps, species clause enforced; a benched member's 5 engine cards auto-leaving the deck (show where they go); per-member energy/OS at a glance; STAB hints per card against the current party (DeckTerminal's existing logic). Open layout questions for Henry: one combined screen or party-tab + deck-tab; how the boundary ALERT presents (modal offer vs map banner); sort/filter defaults for a 30+ card collection at 1280×800.

## Deliverable

2–3 static-data HTML mockups (distinct layouts) reacting to real card/party data shapes; Henry picks and marks up; the chosen layout + his notes become the spec addendum Legion builds from. Link mockups from this ticket (research/62-editor-proto/).

## Resolution

Closed 2026-08-26 after two mockup rounds (6 layouts). Mockups in [research/62-editor-proto/](../research/62-editor-proto/).

**CHOSEN: Option F — Hearthstone-style, big cards, paged** ([editor_F_big_paged.html](../research/62-editor-proto/editor_F_big_paged.html), PNG beside it). The spec for the build (ticket 61 package 4 / follow-up):

- **Roster strip on TOP**: party chips (portrait, name, OS, energy, cards-in-deck count) + benched chips (dimmed, dashed); drag a benched mingming onto a party slot to swap — its 5 engine cards follow it; species clause enforced.
- **Center: RUN COLLECTION as a paged book** — 8 large cards per page (≈196×252), page-flip arrows, NO scrolling. Each card shows: cost gem (top-left), **ATTACK / SKILL / DAEMON type banner** (top-right), art box (placeholder gradient until ticket 33), name, **full description text**, tag line (payoff / benched / pick), element edge bar; payoff cards get an element-glow border. Filter chips above: elements, ATTACKS/SKILLS, BENCHED ENGINE, sort, search.
- **Right panel: ACTIVE DECK as compact rows** — cost gem, name, ×count for duplicates, tag, element left-border; click a collection card to add, click a row to send back.
- **Top bar**: context (node kind, biome, scrap), the **DECK n / floor m pill** (Henry keeper), UNDO, CONFIRM.
- **Boundary alert = round-1 Option C** (Henry keeper, [editor_C_boundary_alert.html](../research/62-editor-proto/editor_C_boundary_alert.html)): after the biome-exit elite, a quick-swap modal over the dimmed map — party column + suggested cards column, IGNORE — CONTINUE vs EDIT LOADOUT (opens the full F editor).
- Rejected on review: A (one-screen three-pane — too dense, small text), B (tabs — split party from deck), D (scrolling mid cards), E (left rail; its select-a-member STAB filter idea is recorded as a possible filter chip, not required).
- Same F editor serves all four edit surfaces (market, workshop, boundary accept, pre-gauntlet); at the marketplace the sell verb appears on collection/deck cards per ticket 61 §4.

Henry's requirements that drove it: energy cost, skill-vs-attack, and descriptions readable on every card; Hearthstone collection feel; deck on the right; roster top.
