# Start-kit rule: which third of a species' kit begins the run (ticket 08)

- Type: wayfinder:grilling
- Status: closed
- Assignee: wayfinder (Henry grilling session, 2026-08-21)
- Blocked by: [06](06-run-data-model.md)
- Phase: Vertical Slice

## Question

economy-session.md: every run starts with a PARTIAL deck — the starter brings ~a third of its kit ("generic hits + a signature, Spire-strike-shaped"), each recruit brings a similar fraction, and the run builds toward 20–25 cards by the gauntlet via picks, marketplace, events, removal. Shipped decks are 8–9 cards per OS; the 3v3 target is 20–25.

To implement this the rule must be mechanical, per species × OS (32 decks): how many cards a member brings, which ones, whether duplicates count, and what the OS contributes.

## Resolution

**RULED (Henry, 2026-08-21).** The arithmetic that drove it: draw is `sum(cardDraw) − (N−1)` = 3 / 5 / 7 cards per turn at 1 / 2 / 3 members, and the tuned decks are 8–11 cards (launch decks: 8–9, ratatoskr_v1 11), so a tuned solo fight cycles its deck every ~3 turns. A literal "⅓ kit" (3 cards) solo start redraws the same three cards every turn — no variance, doubles meaningless — and discards the 1v1 balance corpus for the early run. Henry did not want the full tuned deck either: the start must be **weaker than the base deck** and the first fights easier than the corpus.

**The rule:**

1. **Start deck = 8 cards: 5 `startKit`-tagged cards from the starter's species × OS deck list + 3 generic None-element hits** (a fixed `basic_strike`-class card — new, or the existing None filler; `water_slap` is the shipped precedent for a generic in 9 of the 12 launch decks). The 5 = the signature + the OS-enabling card + 3 supporting. Shape A (curated) chosen over a run-start draft; a draft may return as a tier-3 / modifier feature.
2. **A recruit joins with 4: 3 `startKit` cards + 1 generic.**
3. **A species' untagged kit cards enter the pick / marketplace pool while it is in the party** — recruiting IS drafting; the kit completes through play. (Ties to the reward-pool question: the party-species pool includes these.)
4. **The player's OS is active from the start.**
5. **Generics are the removal sink's food**: marketplace removal (ticket 13) — and Henry leans toward allowing removal at workshops too (ticket 14 decides the price).
6. **Enemy decks mirror the player's kit fraction by biome depth** (`kitFraction` per depth, one knob in ticket 11): biome 1 wilds = 5 kit + 3 generics, **no OS**; biome 2 = kit + OS; biome 3 and the gauntlet = full tuned decks + OS. The tuned 1v1/3v3 corpus is therefore the LATE-run reference and early fights are easier by construction.
7. **Arithmetic check:** 8 + 4 + 4 + ~9 picks + ~3 buys − ~3 generic removals ≈ **25 at the gauntlet** (target 20–25).

**Tags:** an agent proposes the 5 `startKit` cards for each of the 12 launch decks from the balance data (play rate, the OS enabler, the signature), Henry ratifies all 12 in one sitting — filed as a request to the deck-archetypes map (their content), referenced from ticket 09. Species beyond the launch six get tags when they ship.

Data shape: a `startKit: string[]` (5 ids, duplicates allowed) beside each deck list in `mingmingRegistry.ts`, validated by a test that every id is in the deck list and every launch deck has exactly 5.
