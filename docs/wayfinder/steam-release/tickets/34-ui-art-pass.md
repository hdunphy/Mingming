# UI art and theming pass: icons, backgrounds, logo, node icons (ticket 34)

- Type: wayfinder:task
- Status: open
- Assignee: (unclaimed — LEGION did the pass below; frames and the battle HUD are open)
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

## Resolution

_(open — see Progress above; card frames and the battle-HUD glyphs remain)_

