# Prototype: the marketplace screen (ticket 63)

- Type: wayfinder:prototype
- Status: closed
- Assignee: wayfinder (Henry prototype session)
- Blocked by: —  (spec: [61's AMENDED SPEC](61-apply-60.md) §4 + [56](56-economy-numbers.md))
- Phase: Vertical Slice

## Question

The merchant's verbs are now: BUY cards (15/25/35/45 by energy) and Macros (32/48), SELL any card from deck or collection (5/10/15/20), and open the deck/roster editor (ticket 62) — paid removal is gone. Mock the shopfront for Henry: stock presentation (party-species pool + one off-pool slot), sell flow (drag to merchant? tap-to-sell with confirm?), scrap balance always visible, Macro slots shown (3, with owned), re-visit behavior (stock re-rolls per visit — how that reads so it feels like a feature not a bug), and the fiction (a merchant construct in the firmware world — name/portrait placeholder). Open for Henry: stock size on screen (6? 8?), whether sell prices print on every card or on hover, buy-confirmation friction.

## Deliverable

1–2 HTML mockups with real prices wired to fake state; Henry reacts; chosen layout linked here for the build pass.

## Resolution

Closed 2026-08-26. Mockups in [research/63-market-proto/](../research/63-market-proto/).

**CHOSEN: Option G — the STALL** ([market_G_stall.html](../research/63-market-proto/market_G_stall.html), PNG beside it; H, the buy/sell mode toggle, rejected — one extra click per compare-and-swap decision). Build spec:

- **Left/center: the merchant's stock** — named merchant construct with one line of flavour ("Salvage Broker" placeholder; fiction pass in ticket 34); CARDS section (party-species pool + one tagged off-pool slot) as ticket-62 big cards with a **price tag on the card face** (25/35/45 by energy); **SOLD slots stay visible** greyed so stock size reads; MACROS section below with the owned-slots counter (n/3).
- **Right: SELL panel, always visible** — every sellable card from deck AND collection as compact rows (cost gem, name, deck/collection tag, ×N, green **+5/10/15/20** by energy); selling from the deck respects the floor (8/13/18) — rows at the floor grey out. The panel doubles as a live deck/collection read so buy-vs-sell arithmetic never needs a mode switch.
- **Top bar**: scrap balance prominent, biome + visit count ("stock re-rolls each visit"), **EDIT LOADOUT** (opens the ticket-62 F editor), LEAVE. Floor pill in the sell panel.
- **RULED (Henry): a bought card goes STRAIGHT TO THE ACTIVE DECK, always** — no per-purchase choice (post-fight picks keep their deck-vs-collection choice; purchases are a deliberate act at a node where the editor is one click away, so overshoot self-corrects).
- Duplicate rule from ticket 62's amendment applies (×N badges, one tile/row per unique card).
