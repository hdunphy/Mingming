# Ticket 176: Map redesign (design session first)

**Type:** design session, then a build ticket. **Status:** OPEN. Nothing gets built until Henry rules the questions below; the build rows are written after that.

**Henry (2026-09-30, ruling D4 on ticket 174):**

> *"Let's add a new ticket for a map redesign. I don't love the current layout."*

---

## What the map is today

**The rules it was built on** (`docs/wayfinder/deck-archetypes/research/exploration-map.md`, ticket 07):

> *"Map shape: an explorable GRAPH, explicitly NOT Spire's three lanes — you find your way to the boss, with room to FARM if you don't feel ready."*
> *"Length: 35–45 minutes; 8–10 battles plus the gauntlet = 10–13 fights total."*

**The generator** (`src/engine/run/regionGraph.ts`, `REGION_PARAMS`):

- **Shape:** 3 biomes walked in order, **5 layers each**: an entry node, three middle layers 2–3 nodes wide, then the exit (an elite, or the gym in the final biome).
- **Links:** each node links forward to 1–2 nodes in the next layer. About 60% of layers also get a sideways link between two siblings. One dead-end "pocket" per biome hangs off a middle node.
- **What's on the middle nodes:**
  - one market and one workshop are guaranteed per biome
  - the rest roll wild 60 / event 14 / elite 10
  - a third of wilds become rivals (142a), and one final-biome node becomes the scout elite (142b)
  - biome 0's first middle layer is always a wild (the scripted first fight)
- **Movement:** you can go back to any node, and **entering a node triggers it again**: a wild fight repeats, and a shop gets fresh visit allowances. Events are the exception; they play once (168).
- **Visibility:** node types one layer ahead; places you've visited stay visible; Ping Sweep and Relay Tower reveal a whole biome.

**The screen** (`src/ui/screens/RegionMap.tsx`, `regionLayout.ts`): biomes laid left to right, `COLUMNS_PER_BIOME = 5` (one column per layer), with a small per-node random offset (`wanderFor`) so it doesn't look like a grid.

**What play has shown:**

- **Runs are 18–20 fights** against the 10–13 target (four logged playtests).
- **The repeat-fight rule is where the grinding happens.** Two of four runs fought 8 times in biome 0 and re-entered one wild node up to five times (ticket 174's table). 174 eases the scrap squeeze that drove it, but the rule still allows it.
- **Shops are over-represented:** because one market and one workshop are guaranteed in only 6–9 middle nodes, each ends up about 13% of a biome against the 8% ruled.

---

## Questions for Henry

These set the direction; the build ticket follows from the answers.

1. **What don't you like about it?**
   - the **look** (how it's drawn on screen)
   - the **structure** (the shape of the graph, how many choices, how long biomes are)
   - the **movement** (backtracking, re-entering, the grind)

   Two or three things you'd change first are enough.
2. **Repeat fights:** keep "re-enter a node and fight again" (room to farm, as ruled in 07), or switch to one-way travel like Slay the Spire, where every node is visited once and you only move forward? One-way travel ends grinding and shortens runs toward 10–13 fights. It reverses 07's "room to farm". A middle option: re-entered wild nodes stay open but pay no scrap or card pick.
3. **Biome length:** keep 5 layers each, or vary it (for example biome 0 longer, the final biome shorter)?
4. **Orientation:** keep left-to-right, or go bottom-to-top like Slay the Spire? Bottom-to-top uses a taller screen and reads as "climbing toward the gym".
5. **Any maps you like the feel of?** Some reference points:
   - **Slay the Spire:** one-way branching paths, the whole act visible
   - **Monster Train:** fixed rows with a choice of two each step
   - **FTL:** a sector map with free movement but a pursuing deadline
   - **Pokémon:** towns (shops and services) joined by routes of fixed fights

   Your pick (or your dislike of one) steers the redesign more than anything else.

## What happens after the rulings

A build ticket (176a…) is written from the answers. It will cover:

- the generator changes in `regionGraph.ts`, and the save schema if the layer count changes (`RegionNodeSchema` caps `layer` at 4)
- the screen in `RegionMap.tsx` / `regionLayout.ts`
- updates to the walker (`chooseStep` in `runWalker.ts`) and the scripted first fight
- a measurement of fights per run and scrap per biome, using 174's report, against the 10–13 target
