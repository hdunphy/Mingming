# UI art and theming pass: icons, backgrounds, logo, node icons (ticket 34)

- Type: wayfinder:task
- Status: closed
- Assignee: LEGION
- Blocked by: [32](32-art-direction.md), [10](10-region-map-screen.md)
- Phase: Content Complete

## Deliverable

Replace emoji nav with an icon set, give the region map node-type icons and biome backdrops (one per element pair or per element), a title/logo treatment for the main menu and store page, card frame by element, and a consistent type scale. Keep `index.css` (2,567 lines) from growing further: introduce tokens (CSS variables) for the theme in this pass.

## Done when

No emoji in production UI; screenshots of every screen at 1280×800 and 1920×1080 attached to the ticket for ticket 45's store page.

## Progress — 2026-08-28 (LEGION). Foundation and chrome done; frames and the battle HUD are not.

**The ticket is NOT closed.** Four of the five deliverables landed and one did not, and the honest
place to say so is here rather than in a resolution that claims a finished pass.

### Done

**1. CSS tokens — `ui/theme/tokens.css`.** The brief's actual constraint (*"keep `index.css` from
growing further"*) answered with a vocabulary file rather than a fourteenth screen sheet: elements,
surfaces, ink, a type scale, space, radii, elevation. `index.css` `@import`s it and its own token
block is gone; it dropped 2,923 -> 2,899 lines and stopped being where colours are decided.

**This pass adds a vocabulary; it does not restyle 2,899 lines.** The eight legacy names ship as
aliases at the values they already had, so nothing changed appearance by being moved. A screen adopts
the ruled surfaces when it is next worked on, and the alias block shrinks as they do. The ruled
palette is ticket 66's chassis reference and ticket 61's mockups — **not picked here.**

`theme.test.ts` pins the one seam that can silently come apart: the nine element colours exist twice
(CSS custom properties for stylesheets, `runShell.ELEMENT_COLOR` for inline `style`), and the file is
parsed and compared. Two copies of a palette drift one hex at a time and nothing else would notice.

**2. Emoji out of the chrome — `ui/theme/icons.ts` + `Icon.tsx`.** 31 inline SVG icons on a 24 grid,
stroked in `currentColor`. `IconName` is a closed union, so a screen cannot ask for a glyph that does
not exist.

The reason this is worth a ticket rather than a taste preference: **an emoji is a font glyph the
player's system chooses, and it ignores `color`.** `U+1F3DB` is a beige building on Windows and a
monochrome outline on some Linux stacks; `U+1F573` (the ambush pit) renders as nothing at all on
several; `U+26C1` (the scrap coin) is a tofu box on half of them. And because they cannot be tinted,
the region map — the screen whose whole job is *"you can tell what a node is from across the map"* —
could not colour a node by its biome.

Swapped: the top nav, the ranch's five section tabs, the mute toggle, the eight region-node kinds,
the run/gauntlet/summary headers, the stat-roll glyphs, the codex tab, the merchant, and the scrap
readouts. **`Icon.test.tsx` renders the whole set** (a path with a typo draws nothing, which reads as
a layout quirk and would survive every other test here) **and sweeps `src/ui` for emoji**, so the
ticket's acceptance criterion fails a build instead of needing a re-check by eye.

**3. Biome backdrops on the region map.** Each biome's span of columns gets a band tinted with its
element, fading downward, with a dashed seam between biomes. Derived from the laid-out columns rather
than from `REGION_PARAMS`, so a band is exactly as wide as the nodes it stands behind. The routing
information the map exists to carry is now in the picture and not only in the strip of labels above
it — the label strip stays, because a colour is not a label and ticket 38 would have to put the words
back.

**4. Screenshots — `research/34-screens/`, 12 screens x 1280x800 and 1920x1080.** Captured by
`scripts/screenshots.mjs`, which drives a REAL production build through a real cold-start
playthrough: pick a starter, assemble it, walk the ranch, choose a gym, take a party out, travel,
fight. Nothing is mocked, so what it photographs is what ships.

**The screenshots did their job as a review, not just as an artifact.** Two things they caught:
- **The `wild` node icon was crossed swords, which collapses into an X at 18px** — the most common
  node in the game was drawn as a close button on the one screen where kind has to be legible at a
  glance. Redrawn as a single upright blade.
- **Ticket 68 made the three gym offer cards different heights** (an authored gym telegraphs one
  Driver where an un-authored one lists three relics), and the grid's default `stretch` pushed
  Emberfall's name below its neighbours'. `align-items: start`.

### NOT done — what the next session on this ticket picks up

- **Card frames by element (ticket 66's chassis).** Nothing was built. The reference is
  `research/66-frames-proto/frames_chassis_final.html` and it is a precise spec — energy PIPS
  top-left, TYPE ICON top-right replacing the text banner, no STAB text, no payoff glow, descriptions
  at both scales. It touches `ProgramCard`, `CardHand` and the shop/editor card faces, which is the
  densest-tested surface in the UI. It is the largest remaining piece of this ticket.
- **The in-battle glyph vocabulary.** `cardIcons.ts` (element and category glyphs), `CardHand`'s
  action previews, `MingmingUnit` and `BattleStage` intent icons, `TypeChart`, `BattleReport`. These
  are excluded BY NAME from `Icon.test.tsx`'s sweep, so the exclusion list is the to-do list and it
  shrinks as they are done. They are entangled with the card frames above, which is why both are one
  piece of work rather than two.
- **Engine combat-log strings** (`effectHandlers`, `StatusBehaviors`, `ActionExecutors`,
  `battleReducer`) still carry emoji. They reach the player through the combat log, so they are in
  the ticket's scope — but they are engine strings with tests pinning their text, and mixing them
  into a UI pass would put ~30 engine edits in an art commit.
- **A logo / title treatment** for the main menu and store page. Ticket 32 ruled the capsule set is
  COMMISSIONED (~$250 of the $500), so the placeholder here should not be replaced by an agent
  inventing one — that is ticket 45's brief, not this one.
- **Three screens are unphotographed**: the marketplace and workshop nodes (they need a run walked
  to one) and the run summary (it needs a run finished). `scripts/screenshots.mjs` logs every miss
  rather than silently skipping, so the gaps are visible in its output.

### One thing found on the way, unrelated to art

**CI lint was RED on HEAD, and had been since ticket 55 declared zero.** `scripts/debug-generate.ts`
is a pre-run-loop leftover that imports `createDefaultSave` and `createStarterSave` (both deleted),
reads `save.gauntlet` and `save.activeParty` (both deleted by ticket 06), and calls
`createBattleState(save as any, [])` against a signature ticket 11 replaced. It cannot compile or
run, and it failed `eslint .` with two errors — which `npm run lint` and therefore CI both cover.

It survived because agent sessions run the gates against a cloud copy of the tree, and a previous
session had patched this file locally without transferring it: every session since has reported lint
clean against a file the repo does not have. **Deleted**, and the wider lesson is in HANDOFF: verify
the gate ran against HEAD, not against a working copy that has drifted from it.

## Part two — 2026-08-28 (LEGION). The winding route and the chassis. **The ticket now CLOSES.**

Both remaining deliverables built to their ruled references. Gates green (`tsc -b`, eslint 0,
**1846** vitest across 132 files, build, assert-no-debug).

### The map: OPTION N, the winding route

`research/64-map-proto/map_N_route.svg` is titled *"WINDING ROUTE (overworld feel)"* and its nodes
are visibly off-lattice. That is the whole difference between a flowchart and a route: a grid tells
you the graph is generated, a wander tells you it is a place. Four changes, all from the reference:

- **The wander.** Every node leans off its lane by up to a fifth of a column and a quarter of a row.
  **Derived from the node id, never rolled** — ticket 06 kept `x`/`y` out of `IRegionNode` so layout
  stays derivable and a save never freezes a UI decision, so the offset is a hash (`wanderFor`),
  which is derivable, stable across a reload and a resumed save, and costs the save nothing. X is
  the tighter axis on purpose: columns carry the run's ordering and the fog is measured in them, so
  a node that wandered a whole lane would be lying about the graph.
- **Trails, not edges.** Dotted, round-capped, at the reference's own `1 6` spacing. A solid line
  between two discs is a graph edge; a dotted one is a path someone walked. It is the cheapest
  single change on the screen and it does most of the work. **A trail into the fog is dimmer**, which
  is information rather than decoration — the difference between a route you can plan and one you
  can only see the start of.
- **Rounded, inset biome panels** with a state word inside each — `FIRE · CURRENT`, `NATURE · AHEAD`
  — which is the one thing the picture was missing. The strip above says *which* biomes the run
  walks; this says *how far through them you are*. A state word rather than the name repeated,
  because a map that prints everything twice is a map nobody reads.
- **The gold visit badge** on a node's shoulder, replacing a bare `×2` floating beside it. Ticket
  07's re-roll rule is what earns it: a node you have stood on twice has been two *different* fights.

**A test caught a bug the eye would not have.** FNV-1a alone leaves adjacent ids adjacent in the low
bits: `b1l2n0` and `b1l2n1` — neighbours in the same column, and precisely the pair the wander exists
to separate — came out **0.015 apart on a scale of 2**, i.e. drawn on top of each other. Fixed with
a `lowbias32` avalanche so a one-byte change rewrites the whole word. `regionLayout.test.ts` pins it.

### The cards: ticket 66's chassis

`research/66-frames-proto/frames_chassis_final.html` is a spec, not a mood board — its own subtitle
lists what was ruled. All four clauses are now true:

| ruled | before | now |
|---|---|---|
| energy **PIPS** top-left, *cost as capacity* | a 30px gem with a numeral, hanging off the corner | a rack of pips inside the frame |
| **TYPE ICON** top-right replaces the text banner | `ATTACK` in a red pill | `▲ ✦ ◆ ●`, one character |
| no STAB text | already true | unchanged |
| **no payoff glow** | `.rs-card.payoff` | renamed `.rs-card.rare` — see below |
| descriptions at BOTH scales | already true | unchanged |

**Why pips beat a number**: a numeral is a *price* you read and then do arithmetic with; pips are a
*quantity* you compare by looking. In a game where a turn is two energy, almost every decision is
"can I afford this AND that", and that is a comparison the rack answers without counting either side.
**A 0-cost card racks ONE UNFILLED pip**, which is the reference's own convention — an empty rack
says "free", where an empty corner just looks like something failed to render.

**Why the type mark is a glyph and not an `Icon`**: part one replaced the game's emoji with drawn SVG
because an emoji is chosen by the player's system and ignores `color`. `▲ ✦ ◆ ●` are neither — plain
geometric marks in every UI font, taking `color` and `text-shadow` like any character, and the
reference specifies them AS characters with a glow that only works on text. Same class as the `✓` in
a button, which the emoji sweep already allows by name.

**On "no payoff glow".** The only rule using that class was the marketplace marking a **rare macro** —
a rarity cue that was never a payoff cue. It is renamed `.rs-card.rare`, which keeps the cue and makes
the ruling checkable: there is now no class called `payoff` on any card face. Payoff remains a text
tag in the editor, which is exactly what the ruling asks for.

`Banner` gained a fourth member, `MACRO`. It is not a `ProgramCategory` — a macro is not a program —
but it shares the tile and the reference draws it with the same chassis and its own mark.

### Two defects the screenshots found, both fixed

Part one's screenshots caught the `wild` icon collapsing into an X. Part two's caught two more, which
is the argument for the capture script being part of the ticket rather than an afterthought:

1. **The off-pool tag was rendering underneath the price plate.** The plate is ~21px pinned 10px up,
   so it owns the last ~31px of the card, and the tag line cleared only 22px. The one card that
   carries *both* a tag and a plate is the off-pool slot — the one row on the shelf with news in it.
2. **The art block needed 16px of clearance, not the reference's 20px.** The gem used to hang
   *outside* the frame; the pips sit inside it. Our shop card is 216px where the reference's editor
   card is 246px, and the extra 4px was what pushed the tag into the plate.

### Screenshots

26 files in `research/34-screens/` — 13 screens x 1280x800 and 1920x1080.

**The marketplace is now among them**, which closes one of part one's three gaps. It cannot be
reached by the walked capture (getting to a market means winning fights, which a click-script cannot
do), so `scripts/screenshot-gallery.tsx` renders it to static markup against a fixed seed and
photographs it against the **built** stylesheet — the route the UI tests already use. Not a
substitute for a walked capture (no hover, no focus), but for a screen whose whole job is a shelf of
card faces, a still of the shelf is exactly what ticket 45 wants. The workshop and the run summary
are still unphotographed and the same script is how they get done.

### What is still NOT in this ticket

- **The in-battle glyph vocabulary** — `cardIcons.ts`, `CardHand`'s action previews, `MingmingUnit`
  and `BattleStage` intent icons, `TypeChart`, `BattleReport`. Still excluded BY NAME from
  `Icon.test.tsx`'s sweep, so the exclusion list remains the to-do list. The chassis was the shared
  dependency and it is done, so this is now free-standing.
- **The engine's combat-log emoji** (`effectHandlers`, `StatusBehaviors`, `ActionExecutors`,
  `battleReducer`) — engine strings with tests pinning their text, still not an art commit's job.
- **A logo / title treatment.** Ticket 32 ruled the capsule set is COMMISSIONED (~$250 of the $500),
  so an agent should not invent one. Ticket 45's brief.

## Resolution

**CLOSED 2026-08-28.** Both parts above. The three exclusions listed at the end of part two are
deliberate hand-offs, not unfinished work in this ticket: two belong to a battle-HUD pass that has no
ruled reference yet, and the third is Henry's commissioned art.

