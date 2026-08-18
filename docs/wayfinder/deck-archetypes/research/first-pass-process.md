# First-pass deck design process (Henry, 2026-08-06)

Standing structure for every remaining species pass. Goal: all 32 decks to a first-pass state FAST, creative control with Henry, token-light (10-80-10: primary model designs and analyzes; secondary model runs token-heavy implementation from crafted prompts). In-depth tuning happens only after ALL decks have a first pass.

## The 4-step loop (one species per loop)

1. **Propose** — the assistant proposes three mingmings (current OS + firmware text + candidate archetypes each could fill, with any carried card packages noted).
2. **Select** — Henry picks the species + archetype and gives general thoughts on cards he wants in the deck.
3. **Draft** — the assistant maps Henry's thoughts to existing cards where possible, proposes new cards only for missing roles (rev-3 priced), and presents: the 8-card deck, 2-3 add/change options, and a static assessment (power-curve math + archetype logic — NO balance runs at this step).
4. **Confirm & gate** — Henry confirms; the deck is implemented and run through the lightweight gate below. Max TWO tuning iterations at first pass; anything stubborn is noted in the ticket for the deep pass and we move on.

## The lightweight gate (first-pass acceptance)

One scoped run per species: `set BALANCE_ONLY=<species>&& npm run balance` (PowerShell: `$env:BALANCE_ONLY='<species>'; npm run balance`) — seconds, never touches docs/balance. It already covers: the §2.3 v1-vs-v2 head-to-head, the species mirror, and the gauntlet slice vs the kraken control deck (a completed on-curve cross-element check).

First-pass bands (deliberately loose; the deep pass tightens):
- §2.3 decisive win rate between **30 and 70** (final ≤15% gap is a deep-pass goal)
- Mirror: ≥60% of games decided, average turns ≤ 30 (no stall archetypes)
- Dead cards: per-side deadCardRatio ≤ 0.35 (a dead slot = kraken ink_cloud lesson)
- Static budget: no NEW unexplained redlines (documented exceptions like Tackle's 0.2-over stand)

Full committed `npm run balance` runs only when a pass actually lands (its registry-hash + report update is the commit gate), not per iteration.

## Division of labor

Design sessions (this structure) = primary model + Henry. Implementation + sim grinding = secondary model via handoff prompt (exact anchors, tolerances, STOP conditions — see the ticket-20 prompt as the template). [HANDOFF.md](../HANDOFF.md) is kept current every session so any model can resume.
