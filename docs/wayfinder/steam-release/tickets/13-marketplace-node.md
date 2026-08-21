# Marketplace node: buy cards, sell cards, card removal (ticket 13)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [06](06-run-data-model.md), [12](12-rewards-refit.md)
- Phase: Vertical Slice

## Deliverable

A new node screen: a stock of N cards (drawn by the same pool rule as rewards, with a small off-pool wild-card slot), buy for scrap, SELL cards from the run deck for scrap, and pay scrap to REMOVE a card (the designer-added sink). Macros appear in stock once ticket 15 lands. Pricing: propose a table keyed off rarity / energy cost (the internal `power` price is NEVER shown — power dies at the surface), Henry picks numbers. Stock size, reroll cost and removal price are Henry numbers too.

## Done when

Marketplace reachable from the map, all three verbs work, scrap is run-scoped and resets at run end, and the deck count is visible so the 20–25 target is legible.

## Resolution

_(open)_

