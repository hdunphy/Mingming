# Apply ticket 60: mini-engine starts, enemy ladder, sim gate, collection + bench (ticket 61)

- Type: wayfinder:task
- Status: open
- Assignee: session-61-pkg1 (mini-engine starts)
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

---

## Progress — sections 1, 4 and 5 applied 2026-08-26; 2 and 3 remain

Built against the amended spec only. Every conflicting line above it was treated as dead, including package 1's own "mini-engine 6".

### 1. Start decks — DONE

The 12 five-card engines were **verified against their own deck lists before anything was written**: every tagged id present, multiplicities honoured (`ignite` x2, `fury_strike` x2, `pressure_point` x2, `surge_protection` x2, `undertow` x2, `nagging_bite` x2, `growth` x2, `thornguard` x2, `capacitor` x2, `corrosive_bolt` x2, `pollen_cloud` x2, `forage` x2), and every launch deck covered — no species left on the untagged fallback.

`START_KIT_SIZE`/`RECRUIT_KIT_SIZE` 4 -> 5. `RUN_GENERICS` (2) became `STARTER_GENERICS` (3): renamed rather than retuned each time its MEANING moved, which is now three times, and the name is what stops the next reader multiplying it by party size. Recruits take no generics. Base 8 / 13 / 18, and `runSummary.SOLO_START_DECK` follows the constants to 8.

`startKits.test.ts` asserts the shape, not the count: `KIT_PAYOFF` transcribes the ratified first column and every kit must lead with it. All 12 payoffs were unchanged by this amendment — only the fifth card is new — which is itself worth knowing.

### 4. Marketplace verbs — DONE

**Selling is back**, `SELL_PRICE_BY_ENERGY = [5, 10, 15, 20]`. The no-loop law is checked **rung against its own rung** rather than in aggregate: "sell is under buy on average" is the true-sounding version that would let one rung mint scrap. Also checked per card across all 216 registry ids, which is the form ticket 13 used before ticket 57 deleted it.

**Paid removal is deleted** — `REMOVAL_PRICE`, `WORKSHOP_REMOVAL_PRICE`, `removeRunCardForScrap`, the market's Strip section and the workshop's whole Strip section. `sellRunCard` replaces the reducer and sells from **the deck or the collection**: a sale that only worked on the active deck would force the player to edit a card back IN to sell it, which is the shape of nonsense the collection exists to remove.

The tests that pinned the old rulings are **inverted, not deleted** — `MarketplaceNode.test.tsx` asserted the markup never contained "sell" and now asserts a priced control in all four states it used to check the ban in; `WorkshopNode.test.tsx` asserts the strip section's absence against a run that provably holds generics, so the zero is not true for the wrong reason.

Two lines of player copy were fixed as part of this, both pointing at controls that no longer exist: the market's over-target advice said *"Pay to remove"* and the workshop's empty shelf said *"the deck bench below is open"*.

### 5. Deck floor — DEFINED, not yet enforced

`createRun.minimumActiveDeck(partySize)` -> 8 / 13 / 18, replacing the earlier min-16. Its **enforcement lives in the editor**, which is section 3, so the function and its tests land now and the screen that obeys it lands with the editor.

### 2 and 3 — NOT DONE

`IRunState.collection` exists and is wired (schema with `.default([])` so an in-progress save resumes, `createRun` seeds it empty, `sellRunCard` reads it, the market lists it). What is not built: the **per-card ADD/STORE choice** on the reward screen, and the **free party+deck editor at the four surfaces** including the biome-boundary alert. Those are one build — the editor is the thing all four surfaces open — and they are the next sitting.

### The run-gate numbers — BLOCKED, and it is a real gap

The instruction was to report 95/75/60 in this resolution after the loadout changed. **`npm run balance:run-gate` does not exist.** The scripts are `balance` and `balance:deck`; the run gate is package 3 of this ticket's original plan and nothing has built it. There is no harness that measures win rate by fight class at tier 1, so any number reported here would be invented.

The loadout change certainly moves those rates — a starter went from 6 cards with a 4-card engine to 8 with a 5-card engine — so the measurement is worth having. It needs the gate built first.

**Suite 1674 green across 124 files; `tsc -b`, lint, build and the debug-absence gate all clean.**
