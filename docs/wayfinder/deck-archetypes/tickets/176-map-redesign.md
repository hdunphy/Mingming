# Ticket 176: Map redesign: towns joined by branching routes

**Type:** map, engine and UI. **Status:** OPEN, **design ruled 2026-10-01; do not start until Henry says go.** Decisions M1–M8 below have recommended defaults; build those unless Henry rules otherwise.

**Henry (2026-09-30, ruling D4 on ticket 174):**

> *"Let's add a new ticket for a map redesign. I don't love the current layout."*

**Reference picture:** `docs/wayfinder/deck-archetypes/research/176-map-mock.png`. It's a hand-coded mock of one seed, drawn with the rules below. It shows the shape and the look, not final art.

---

## Henry's rulings (design session, 2026-10-01)

| Question | Ruling |
|---|---|
| What's wrong with today's map | **All four:** readability, movement, structure and the look |
| Repeat fights | **One-way travel**, Slay the Spire style: every node is visited once, and you only move forward. No re-entering, no farming. This reverses ticket 07's "room to farm". |
| Biome length | **A longer first biome** |
| Feel | **Pokémon routes:** towns joined by routes |
| Route shape | **More choice:** routes branch and merge mid-way (two paths splitting into three), a small graph rather than parallel lanes |
| What you can see | **Every node's type, on the whole map, from the start.** Species stay hidden. |
| Side nodes | **Optional detours** (alpha, ambush, bonus wild): a route shows them, and you take or skip them |
| Towns | **Every town has a market and a workshop**, and you visit each town once |

## What the map was (for the record)

`regionGraph.ts` (ticket 07): 3 biomes × 5 layers (entry, three middle layers 2–3 wide, exit). Edges walk both ways, and entering a node triggers it again. One market and one workshop sit somewhere in each biome's middle. A dead-end pocket hangs off each biome. Fog shows types one layer ahead. Playtests ran **18–20 fights** against the **10–13** target, mostly from re-fighting wilds in biome 0.

---

## The new shape

Each biome is a fixed list of **rows**, walked left to right. A row is one of:

- **start:** where the run begins (biome 0 only)
- **route row:** fights and events, N nodes wide
- **town:** one node with a market and a workshop
- **exit:** the biome's elite gate, or the gym

**Routes** are the runs of route rows between towns and exits. They're numbered across the run, Route 1 to Route 5, like Pokémon.

```
BIOME 0 (longer):  START → [1 scripted wild] → [2] → [3] → TOWN → [2] → ELITE GATE
                            └────────── Route 1 ──────────┘         └ Route 2 ┘
BIOME 1:           [2] → [3] → TOWN → [2] → ELITE GATE
                   └ Route 3 ┘        └ Route 4 ┘
BIOME 2:           [2] → [3, the scout is in here] → TOWN → GYM
                   └──────────── Route 5 ──────────┘
```

**Fight count.** Every path from start to gym is **11 steps before the gym**, without detours: biome 0 has 5 (the scripted wild, 3 more route steps and the gate), biome 1 has 4, and biome 2 has 2. The 3 town visits don't count as steps.

- About 1–2 of those steps are events, so **about 9–10 fights**, plus the **3-fight gauntlet = 12–13**.
- That's inside the 10–13 target.
- Each detour taken adds one fight. With one detour per biome, a greedy player tops out at about 15–16.

---

## Decisions (recommended defaults first)

- **M1. The rows per biome** are the table above:
  - row widths: biome 0 `1, 2, 3, town, 2`; biome 1 `2, 3, town, 2`; biome 2 `2, 3, town`
  - one town per biome
  - the scout stays in biome 2's last route row, so it comes **before** the last town, as 142b wants: you meet the leader's comp with a market and workshop still ahead of the gym

  The widths and row counts are Henry's numbers to tune.
- **M2. Paths never cross.** Each node links forward to 1 or 2 nodes in the next row. Every node has a way in and a way forward, and no two links cross when drawn. Two paths may merge into one node, which is how "two split into three" rejoins.
- **M3. Detours:**
  - one per biome, rolled from today's pocket list (wild, wild, alpha, ambush)
  - each one hangs off the **top or bottom link** between two route rows: from a node, out to the detour, and back to the node that link went to
  - so taking it costs exactly one extra fight, and it's drawn outside the route, so it never crosses anything
  - never off the scripted first fight

  "Bonus wild" means a plain wild: the bonus is one more fight's scrap and card pick.
- **M4. The map reveal becomes a species reveal.** Types are always visible now, so Ping Sweep and Relay Tower's Survey instead show **which Mingmings are in every fight in this biome** (rolled for your team as it is now). It still uses the same `reveal:biome:N` record.
- **M5. A run saved before this ticket is discarded on load.** The existing `run-schema-invalid` path already does this and tells the player. The ranch is untouched. No migration (pre-EA, Henry's saves only).
- **M6. Left to right**, as today. It fits the 1280×800 Steam Deck frame, and the map scrolls sideways to keep you in view.
- **M7. The town screen:**
  - entering a town opens a town panel with two buttons, **Market** and **Workshop**
  - you can open and close each as often as you like until you step onto the next route
  - the market shelf is frozen the first time you open the Market (171b, unchanged), so recruiting at the workshop first gets you a shelf for your new team
  - each building keeps its own `UPGRADES_PER_VISIT = 2`, so a town allows 2 + 2, the same per biome as today
- **M8. The walker skips detours by default.** A `takeDetours` flag takes every detour, for the "greedy player" measurement.

---

## How to work this ticket

1. **Read the whole row first.** Search for the quoted names; line numbers drift.
2. **Test first, run it on the parent, see it fail.** Put "fails on parent: yes" in the commit message.
3. **Do not change anything a row does not list.** In particular, encounter contents, rewards, prices, `STARTING_SCRAP`, the gauntlet, and every battle rule stay as they are. If a row seems to need something it does not name, stop and ask Henry.
4. **Engine purity:** no React, Redux, `Math.random` or `Date.now()` in `src/engine`. Everything procedural uses `SeedStream` forks, as `regionGraph.ts` does today (one labelled fork per job).
5. **Gate:** `npm run gate` green before each commit. **Commits** authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`), no `Co-Authored-By`, last line `HANDOFF: <one sentence>`. **Do not push.** One commit per row.
6. **Rewrite stale comments as you go.** `regionGraph.ts`, `runTypes.ts` (the `NodeKind` notes), `runSlice.enterNode` and `RegionMap.tsx` all explain ticket 07's "walkable both ways / triggers again" rules at length. Where a row retires a rule, replace the explanation with the 176 rule in a sentence or two. Don't leave text describing a map that no longer exists.
7. **Report** in plain English at the end, with 176f's table.

| Row | What |
|---|---|
| 176a | The new generator: rows, towns, forward-only links, no crossings, detours |
| 176b | One-way movement, and everything that read `layer` or `pocket` |
| 176c | Towns: one node, market and workshop, in the game and in the walker |
| 176d | Full visibility, and the reveal shows species |
| 176e | The map screen |
| 176f | The walker on the new map, and the measurement |

---

## 176a: The new generator

**Files:** `src/engine/run/regionGraph.ts`, `src/engine/runTypes.ts`, `src/engine/run/regionGraph.test.ts`.

1. **The node kinds and shape** (`runTypes.ts`):
   - Add `'town'` to `NodeKind` and `NODE_KINDS`. `isFightNode('town')` is false.
   - Rename `pocket` to **`detour`** on `IRegionNode` and `RegionNodeSchema`, as a required boolean. A save without it fails the schema, and that discard is M5.
   - `edges` now holds **forward links only** (the nodes you can step to from here).
   - `layer` is the row index within its biome. The schema's `.max(4)` becomes `.max(MAX_LAYER)`, a constant in `runTypes.ts` set to 6, plus a test that it equals the longest biome's row count minus 1.
   - `marketplace` and `workshop` stay in `NodeKind` (old code paths and tests use them), but the generator no longer makes them.
2. **`REGION_PARAMS`:** remove `layersPerBiome`, `middleLayerCount`, `minMiddleWidth`/`maxMiddleWidth`, `lateralEdgeChance`, `guaranteedMiddleKinds`, `pocketsPerBiome`, `scriptedOpeningLayer`, `scoutLayer` and `middleKindWeights`, and add:
   - `biomeRows`: M1's three lists, e.g. `[{ type: 'start' }, { type: 'route', width: 1 }, { type: 'route', width: 2 }, { type: 'route', width: 3 }, { type: 'town' }, { type: 'route', width: 2 }, { type: 'exit' }]` for biome 0
   - `routeKindWeights: { wild: 60, event: 14, elite: 10 }`. These are the ruled ticket 07 numbers with the shops taken out; shops live in towns now.
   - `detoursPerBiome: 1` and `detourKinds: ['wild', 'wild', 'alpha', 'ambush']` (today's `pocketKinds`)
   - `minForwardEdges`, `maxForwardEdges`, `rivalWildFraction`, `biomeExitKind` and `finalBiomeExitKind` stay as they are
3. **Exported helpers** (other rows use these; nothing outside this file may hard-code a layer number again):
   - `nodeRole(node): 'start' | 'route' | 'town' | 'exit' | 'detour'`, worked out from `biomeRows[node.biomeIndex][node.layer]` and `node.detour`
   - `exitLayerOf(biomeIndex)`
   - `isScriptedOpening(node)`: biome 0, the first route row
   - `routeNumberOf(node)`: 1–5 for route and detour nodes, else `null`. A route is a run of consecutive route rows; number them in run order.
4. **Generation,** biome by biome and row by row:
   1. **Start:** a `wild` with `visited: 1`, exactly as today. `NODE_KINDS` has no `'start'`; `nodeRole` is what calls it start.
   2. **Route rows:** `width` nodes, with kinds rolled from `routeKindWeights`. **Biome 0's first route row is one `wild`** (the scripted first fight; `encounter.ts`'s `fightsResolved === 0` rule is unchanged).
   3. **Town:** one node of kind `town`. **Exit:** `elite`, or `gym` in the last biome.
   4. **Links between consecutive rows** (M2), from a row of `m` nodes to a row of `n`, both in generation order (top to bottom):
      - if either row has one node, link every pair
      - otherwise give each node `i` a home target `floor(i × (n−1)/(m−1) + 0.5)` and link it
      - each node then has a 50% chance of a second link to the target just above or below its home, **kept only if no links cross**: for nodes `i < j`, the highest target of `i` must be ≤ the lowest target of `j`
      - finally, any target nobody links to gets a link from the nearest node above it that keeps the no-crossing rule (else the one below)
   5. **Across biomes:** each exit links to every node of the next biome's first route row.
   6. **Scout (142b), final biome only:** same preference order as today (`elite`, `wild`, `rival`, `event`), from the **last route row before the town**, else the row before it. Same `'scout'` fork.
   7. **Rivals (142a):** today's logic, unchanged. Use the same `rivals:<biome>` forks, take a third of the route wilds (never the scripted opening), at least one per biome, and fall back to an event.
   8. **Detour (M3):** pick a route row `r` that has another route row `r+1` after it. Never the scripted row. Then pick top or bottom:
      - the host link goes from the top node of `r` to the top node of `r+1` (or bottom to bottom); that link always exists because of the home rule
      - add a node with `detour: true`, `layer = r`, a kind from `detourKinds`, and the links host → detour → the host link's target
      - keep the host link too: skipping is the plain path
      - **Biome 2's detour may also hang from its last route row's top or bottom node to the town.**
      - **Rival last resort:** today's rule; if a biome has no rival, a wild detour becomes one.
5. **Tests** (replace the old shape tests in `regionGraph.test.ts`; keep the determinism and schema tests). Over 500 seeds:
   - row widths and roles match M1; one town per biome; no `marketplace` or `workshop` nodes
   - biome 0's first route row is a single `wild`
   - **every node is reachable from the start, and the gym is reachable from every node,** following `edges` forward
   - links only go from row `r` to row `r+1`, or through a detour
   - **no crossings** (the rule in step 4)
   - every start-to-gym path without detours passes **11 nodes before the gym**, not counting the start and the towns
   - exactly one detour per biome, hanging from a top or bottom link
   - at least one rival per biome; exactly one scout, in the final biome, before the town
   - every node passes `RegionNodeSchema`, and the same seed gives the same graph
   - **save discard (M5):** a fixture run saved with the old shape (`pocket`, layer-4 exits) loads as `discarded: 'run-schema-invalid'` with the ranch intact

## 176b: One-way movement, and the old `layer`/`pocket` readers

1. **`runSlice.enterNode`:** a no-op unless the target is in the **current node's `edges`** and has `visited === 0`. Rewrite its comment: one-way travel, ticket 176.
2. **The biome boundary (`resolveEncounter`, ticket 61):** replace `here.layer === REGION_PARAMS.layersPerBiome - 1` with `nodeRole(here) === 'exit'`. Keep the `elite` and "not the last biome" checks.
3. **Tier 2's extra elite (`tierElites.ts`, 169b):** `canBecomeElite` becomes `node.kind === 'wild' && nodeRole(node) === 'route' && !isScriptedOpening(node)`. Delete `FIRST_MIDDLE_LAYER` and `LAST_MIDDLE_LAYER`.
4. **Everything else that reads `layer`, `pocket` or the removed params:** `grep -rn "pocket\|layersPerBiome\|scriptedOpeningLayer\|guaranteedMiddleKinds\|scoutLayer\|COLUMNS_PER_BIOME" src`.
   - Today that's `runGate.ts`, `tips.ts`, `RewardSystem.ts` (a comment), `encounter.ts` (comments), `RunScreen.tsx` ("(pocket)" becomes "(detour)") and `RegionMap.tsx` / `regionLayout.ts`.
   - Leave the map screen's layout to 176e: only make it compile here.
5. **Tests:**
   - `enterNode` refuses a node behind you, a node beside you, an already-visited node and a node two rows ahead, and accepts a forward link and a detour
   - the boundary offer still opens after the biome 0 and biome 1 gates, and not after the gym
   - Tier 2's extra elite never lands on a detour, a town or the scripted fight

## 176c: Towns

1. **One node, two buildings.** `isMarketNode` (`marketplace.ts`) and `isWorkshopNode` (`workshop.ts`) also return true for `'town'`. Grep every caller of both.
   - Reducers that only gate on "is this a shop" now accept a town, which is right.
   - Any place that **chooses a screen or a policy from the kind** has to handle a town as both. That's `RunScreen.tsx` and the walker.
2. **Bench keys in a town** (the screens build these, today `${node.id}:${node.visited}`):
   - the Market uses `${node.id}:market:${node.visited}` and the Workshop uses `${node.id}:workshop:${node.visited}`
   - patch benches likewise, if the workshop has one
   - plain `marketplace` and `workshop` nodes keep today's keys
   - each building's upgrade bench keeps `UPGRADES_PER_VISIT` (M7)
3. **`RunScreen.tsx` (M7):**
   - On a town, show a **town panel**: a heading "Town" (with the biome name in the context line) and two buttons, **Market** and **Workshop**, each opening the existing `MarketplaceNode` / `WorkshopNode`.
   - Their LEAVE returns to the town panel, and the map below it is how you move on.
   - Replace the single `closedNodeId` with "which building is open on this node" (`'market' | 'workshop' | null`).
   - A town opens with **neither** building open, so the market's shelf isn't frozen (171b's `freezeMarketParty` runs when `MarketplaceNode` mounts) until the player chooses to go in.
4. **Labels and icon:** `NODE_LABEL.town = 'Town'`. Add a `town` icon to `icons.ts`; the `ranch` house paths are fine for now.
5. **The walker (`runWalker.ts`):** on a town, run `workshop(node)`, then `shop(node)`, then the workshop's and the market's upgrade benches, each with its own key. Workshop first, so a recruit happens before the market shelf is rolled.
6. **Tests:**
   - in a town, two upgrades at each building succeed, and a third at either is refused
   - opening the Workshop, recruiting, then opening the Market rolls the shelf for the three-member team
   - a market bought out in a town stays bought out when you close and reopen it
   - the walker records a workshop visit and a market visit at each town

## 176d: Everything visible, and the reveal shows species

1. **No fog.** Every node's type is visible on the whole map from the start (`regionLayout.ts`'s `revealed` is true for every node; delete the one-layer-ahead rule and its tests). Species stay hidden.
2. **`previewEncounter(run, node, party)`** in `encounter.ts`: the encounter `rollEncounter` would produce if you entered `node` now, as the same call with `visited` set to 1. **Test:** for 50 seeds, the preview of each fight node equals the encounter rolled on entering it, when the party hasn't changed between.
3. **The reveal (M4):** `reveal:biome:N` now means "show the species in every fight node of biome N".
   - On the map, a revealed fight node's tooltip and its line in the accessible list read like **"Rival: Sköll, Huldra"**, from `previewEncounter` with the current party.
   - Text changes:
     - Ping Sweep's `description` becomes *"Shows which Mingmings wait in every fight in the biome you are standing in. Fires from the map."*
     - Relay Tower's Survey `detail` becomes *"See who waits in every fight in this biome."*
     - "already surveyed" stays as it is.
   - If ticket 175 has landed by then, these strings go in its CSVs instead of the registry and JSON.
4. **Tests:**
   - with no reveal, no species text anywhere on the map
   - after Ping Sweep, every fight node in that biome shows species and other biomes don't
   - the Relay Tower Survey does the same

## 176e: The map screen

**Files:** `src/ui/screens/regionLayout.ts`, `RegionMap.tsx`, `RegionMap.css`. Reference: `research/176-map-mock.png`.

1. **Layout:**
   - One column per row, biomes back to back (7 + 5 + 4 = 16 columns). Replace `COLUMNS_PER_BIOME` with each biome's row count.
   - Nodes in a column keep **generation order top to bottom**; the no-crossing rule depends on it.
   - A detour sits **half a column right of its host**, outside the route: above the top row for a top detour, below the bottom row for a bottom one.
   - Keep `wanderFor` for **vertical** jitter only, at no more than 12% of the row height, so a jitter can't make two links look crossed.
2. **Drawing:**
   - **Links are roads:** thicker lines than today.
   - **The path you've taken** is highlighted. **Nodes you passed and didn't take are faded.** Delete the "×N" visit count; a visited node is spent now.
   - **Detour links are dashed,** with a small "+1 fight" label.
   - **A town** is a larger rounded box: "Town", then "Market · Workshop".
   - Elite gates and the gym stay larger than route nodes.
   - **Route labels,** "Route 1" to "Route 5" (`routeNumberOf`), along the bottom under each route's columns.
   - The biome panels and their element tint stay.
3. **Scrolling:** when the map opens, its scroll container scrolls so the current node is in view (horizontally centred where possible).
4. **The accessible list** below the picture lists only the nodes you can step to (the current node's `edges`), as today. A detour reads as "Alpha (detour, +1 fight)".
5. **Tests** (`regionLayout` unit tests and the RunScreen test):
   - 16 columns
   - each detour is placed beside its host and outside the route
   - no two nodes overlap for 200 seeds
   - only forward links are offered as travel buttons
   - passed-but-not-taken nodes get the faded class
6. **The look is Henry's call.** After this row, he checks it in the desktop app before 176f's numbers are trusted as "done".

## 176f: The walker, and the measurement

1. **`chooseStep` (`runWalker.ts`)** on forward links:
   - Distances to the gym come from a search over **reversed** links (or a forward search from each option; the graph is small).
   - Detours are never taken unless the new `WalkInput.takeDetours` is true (M8); then a detour is always taken when offered.
   - Otherwise the tie-break is today's: workshop when holding a recruitable blueprint, then market, then fight, then the rest, by id. Towns are on every path, so this mostly picks between fights and events.
2. **The measurement,** `docs/balance/map-176.md` (LF), in plain English:
   - **Fights per run:**
     - use 170a's ghost walk, which always reaches the gym, so fights to the gym are measured on every run
     - 12 EA starters × 30 seeds
     - run once with detours skipped and once taken
     - give the mean, minimum and maximum of fights before the gym, per biome and in total
     - compare with the parent commit's ghost walk on the same seeds
   - **Scrap:** 174's `npm run balance:scrap-walk` (the normal walker, upgrade policy on), the same 360 seeds, parent vs. 176, with 174's per-biome table (fights, income, spent, low point, scrap at biome end). Add **scrap on arriving at each town**.
   - **Win rates:** wild and elite fights won, walks that reached and cleared the gym, parent vs. 176.
   - **A verdict line:** whether the detour-free total (before the gauntlet) lands in **8–10**, and the run in 10–13 with the gauntlet.
3. **Do not change any number to hit the target.** If it misses, report it with the M1 widths you'd change and why.

---

## Done when

- A run is three biomes of towns joined by branching, one-way routes (M1). Every node type is visible, paths never cross, and each biome has one optional detour.
- The market and workshop live in towns, each with its own upgrade bench.
- The reveal shows species.
- The walker walks the new map, and `docs/balance/map-176.md` gives fights per run and the scrap curve against the parent.
- Henry has looked at the map in the desktop app.
