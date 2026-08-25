# Apply ticket 60: mini-engine starts, enemy ladder, sim gate, collection + bench (ticket 61)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [60](60-difficulty-and-agency.md), [57](57-apply-56.md)
- Phase: Vertical Slice


> **RENUMBERED 59 → 61 on 2026-08-25**, with its parent 58 → 60 — both numbers were already in use on this map. See [ticket 60](60-difficulty-and-agency.md)'s note.

## Deliverable

Ticket 60's resolution is the authority. Four work packages — split across sessions in this order if one is too big:

1. **Starts:** replace the 5-tag `startKit` sets with the ratified 4-card mini-engine table; arrival = 4 tags + 2 generics for starter AND recruits; delete the old 5+3/3+1 paths; update the tag-validation test (exactly 4, payoff first).
2. **Enemy ladder:** wilds = full tuned kit, no OS, `AI_GREEDY`; elites = kit + OS, `AI_LITE` (port the lite flag from the deck-archetypes pipeline work if not yet in-tree); gauntlet = kit + OS + Driver, full lookahead. Tier field wires: tier 2 = wild OS on; tier 3 = wild AI lite. Remove the kitFraction-by-depth knob.
3. **Win-rate gate:** a sim harness (debug toolkit lane, not shipped) that plays N=30 seeded fights per cell: representative player decks (mini-engine 6 at biome 1, ~12 cards at biome 2, ~18 at biome 3 — build them from the tag table + top-playrate pool cards) vs each biome's wild/elite/gauntlet loadouts, asserting 95/75/60 ±5. Runs under `npm run balance:run-gate`, NOT in CI (report wall-clock; if <60s consider the short-canary slot in ticket 40).
4. **Collection + bench:** picks land in `IRunState.collection`; **a SKIPPED pick lands there too, not in the deck** (Henry, 2026-08-25: *"skipped cards now go to your in-run collection but not the current deck"*) — which retires the skip's current meaning, added 2026-08-24, of taking nothing at all, and means `BattleReport`'s SKIP button needs re-labelling from "decline" to "to collection"; deck editor (revive `DeckTerminal` run-scoped) available at run start, workshop, market, pre-gauntlet; min deck 16 (or all cards if fewer); bench array on the run; party edits at the same nodes; benched member's kit cards auto-leave the deck into the collection; species clause enforced across party+bench swaps.

## Done when

Suite green, `tsc -b`/build clean, the gate reports its three numbers per biome in the resolution, and one scripted full run (seeded) is played through in the dev build to confirm the felt loop: functioning deck from fight 1, a bench swap performed, gate numbers within band.
