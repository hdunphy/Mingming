# Marketplace node: buy cards, sell cards, card removal (ticket 13)

- Type: wayfinder:task
- Status: closed
- Assignee: agent
- Blocked by: [06](06-run-data-model.md), [12](12-rewards-refit.md)
- Phase: Vertical Slice

## Deliverable

A new node screen: a stock of N cards (drawn by the same pool rule as rewards, with a small off-pool wild-card slot), buy for scrap, SELL cards from the run deck for scrap, and pay scrap to REMOVE a card (the designer-added sink). Macros appear in stock once ticket 15 lands. Pricing: propose a table keyed off rarity / energy cost (the internal `power` price is NEVER shown — power dies at the surface), Henry picks numbers. Stock size, reroll cost and removal price are Henry numbers too.

## Done when

Marketplace reachable from the map, all three verbs work, scrap is run-scoped and resets at run end, and the deck count is visible so the 20–25 target is legible.

## Resolution

**Closed 2026-08-22.** Buy, sell, remove and reroll all work from the map. Suite **1107 → 1163**,
`tsc -b` clean, build green.

### AWAITING HENRY — every number is a proposal

The anchor, stated once in `engine/run/marketplace.ts`: ticket 12 measured a run at **450–500
scrap**, and ticket 07 guarantees exactly one marketplace per biome, so a run sees **three** markets
(more if you backtrack). 450 / 3 = **~150 scrap per market visit**, used as the conservative divisor.

| constant | proposal | why |
|---|---|---|
| `MARKET_STOCK_SIZE` | 5 | a ~150 visit buys ~3 cards, so a 5+1 stock can never be bought out — it stays a choice — and fits the Steam Deck frame unscrolled |
| `MARKET_WILDCARD_SLOTS` | 1 | `economy-session.md`'s "optional off-pool wild-cards"; 1-in-6 gives a mono-species run three strangers across a run without making the market a general store |
| `CARD_PRICE_BY_RARITY` | 24 / 40 / 64 / 96 | Common floor sits just under removal, so the sink is between "cheapest thing here" and "the thing you came for". ~1.6x per step, not 2x, because rarity means *specialised* here — ticket 21 froze power scaling |
| `ENERGY_PRICE_STEP` | 8 | a third of a rarity step: energy correlates with effect size but is not a quality ranking, so it nudges rather than drives |
| `SELL_MULTIPLIER` | 0.4 | a 60% haircut makes round-tripping visibly bad while still paying to dump dead cards |
| `REMOVAL_PRICE` | 30 | see the arithmetic below |
| `REROLL_PRICE` | 20 | under the cheapest card (24) because a reroll buys only choices, close to it because at stock 5 the correct play is to spin |

**The removal-price arithmetic**, which the ticket gave a target for: one visit = 450 / 3 = 150.
Generics per run = `START_GENERICS` (3) + `RECRUIT_GENERICS` (1) x 2 recruits on the ruled 1→2→3
party = **5**. 150 / 5 = **30 each**. Stripping all five therefore costs 100% of a visit at the 450
anchor and 90% at 500 — which is the ticket's "roughly one market visit's scrap". **The test computes
this from the constants**, so retuning `START_GENERICS` or the visit count fails the test rather than
quietly falsifying the comment.

### Power dies at the surface, and now there is a test saying so

The standing law (map § Notes) is that the internal `power` number is a balance instrument, not a
player-facing quantity. A price derived from it would leak it, so `cardPrice` is a pure function of
(rarity, energy cost) and a test builds two cards identical but for `power` and asserts they price
identically. A second test asserts the rendered markup contains no `/power/i` anywhere.

That last one had a real consequence: **card descriptions are not rendered on an offer row**, because
several of them say the number out loud — `water_slap`'s own text reads "priced at 12 power to
compensate". The row shows name, element, rarity and energy.

### Not farmable to zero

`sell < buy` for **every card in the registry**, by construction rather than by vigilance: the sell
price is derived from the buy price. There is a test over all 216 cards.

### Two things `IRunState` had no field for, solved without changing it

`runTypes.ts` is ratified, so neither of these could add a field:

- **"Sold out" is derived, not stored.** Each offer's `IRunCard` is minted inside `rollMarketStock`
  from the node seed, so an offer is sold exactly when its instance id is already in the deck. This
  survives a resume for free, and the buy reducer refusing a duplicate id is also a correctness
  guard — two deck cards sharing an id would both vanish on one removal.
- **The reroll is a paid re-entry**: it increments the market node's `visited`. That buys precisely
  what walking away and coming back would buy, which is what ticket 07 already allows. The reducer
  gates on `kind === 'marketplace'` so a stray dispatch cannot re-roll a fight.

### Also worth knowing

- `nodeSeed(run, node, purpose)` is extracted to `engine/run/nodeSeed.ts` and `encounterSeed` now
  calls it. The derived string is **byte-identical**, so every stored encounter still rolls the same
  fight — there is a test pinning that.
- **Stock draws are uniform, not rarity-weighted** (unlike the reward pick). The price is already the
  rarity gate; weighting the stock too would tax rarity twice.
- The marketplace is a **panel on `RunScreen`, not a route** — the map stays visible, so there is no
  "leave the shop" button to get stuck behind.
- `getScrapYield` (the old sell-side price list) was found and **deliberately not adopted** — sell is
  derived from buy. It is left standing with a note recommending deletion once Henry ratifies, rather
  than deleting something that is under review.
- A slot for **Macros in stock is marked in the screen for ticket 15**.


## Amendments from tickets 07/08 (Henry, 2026-08-21)

Generic None-element filler (3 in the start deck, 1 per recruit) is what removal is for — price removal so stripping all generics over a run costs roughly one market visit's scrap. Revisiting a market is allowed (node re-entry), so stock re-rolls per visit and prices must not be farmable to zero.
