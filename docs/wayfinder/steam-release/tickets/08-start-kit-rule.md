# Start-kit rule: which third of a species' kit begins the run (ticket 08)

- Type: wayfinder:grilling
- Status: open
- Assignee: 
- Blocked by: [06](06-run-data-model.md)
- Phase: Vertical Slice

## Question

economy-session.md: every run starts with a PARTIAL deck — the starter brings ~a third of its kit ("generic hits + a signature, Spire-strike-shaped"), each recruit brings a similar fraction, and the run builds toward 20–25 cards by the gauntlet via picks, marketplace, events, removal. Shipped decks are 8–9 cards per OS; the 3v3 target is 20–25.

To implement this the rule must be mechanical, per species × OS (32 decks): how many cards a member brings (3? 4? 5?), which ones (a `startKit` tag on the deck list, or a rule: cheapest N + signature), whether duplicates count, and what the OS contributes. Run the arithmetic with Henry: 3 members × N + ~10 picks + purchases − removals = 20–25.

Cross-dependency: tagging 32 decks is deck-archetypes content; this ticket rules the RULE, the tags are requested from that wayfinder.

## Done when

The rule is written with numbers, a `startKit` field (or equivalent) exists on the deck type, and a request ticket is filed with deck-archetypes for the 32 tags.

## Resolution

_(open)_

