# Apply ticket 56 to the built slice: scrap rescale, no selling, Relay, 3-vs-N check (ticket 57)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [56](56-economy-numbers.md)
- Phase: Vertical Slice

## Deliverable

Tickets 10–15/18–20/22/24 were built in parallel with the ticket 56 grilling; reconcile the code with its ruled numbers (the reconciliation section in 56 is the authority):

1. **Scrap tables** (`src/engine/run/marketplace.ts`, rewards tables from ticket 12, `workshop.ts`): income = 10 + 5 per enemy beyond the first, elite 30; buy prices 0e 15 / 1e 25 / 2e 35 / 3e 45; card removal 20 (market AND workshop); workshop assembly fee 25, reflash fee 15. Rescale, do not re-derive — ratios that ticket 13 established within a band survive only where they already match.
2. **Remove selling** entirely (marketplace UI + `sellPrice` + its tests). Removal is the only card sink.
3. **Macro prices stay at full-1e-value (commons 32, rares 48)** — no change if that is what is built. **Add RELAY** (rare, 48): move 1 energy from one party member to another this turn, on the existing `TRANSFER_ENERGY` reducer; no free transfer UI anywhere (ticket 22's rule).
4. **Blueprint drops:** confirm built = per defeated enemy, wild/ambush 0.20, elite 0.25, alpha 1.00; align the gym row with ticket 18's authored award.
5. **Verify the reward pick pool** draws from the current party's species pools weighted toward untagged kit cards (56 ruling 1), and **the gauntlet boss is always 3** (3 vs N — 56 ruling 4); fix if the build differs, report if it already complies.
6. Note in `docs/wayfinder/deck-archetypes/HANDOFF.md` (one line) that the startKit tag table in ticket 09 is ratified content touching their registry decks.

## Done when

Suite green, `tsc -b` and build clean, and the resolution lists each of the six items as changed / already-compliant, with the one-run income arithmetic re-measured (~150–180 scrap).
