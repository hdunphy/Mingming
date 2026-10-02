# Difficulty tiers and opt-in run modifiers (ticket 29)

- Type: wayfinder:task
- Status: closed
- Assignee: 
- Blocked by: [19](19-run-end.md), [27](27-content-plan.md)
- Phase: Content Complete

## Deliverable

Tiers unlock by beating gyms (ranch-persistent); each tier = a content ladder (curated team lists, elite density from ticket 07's mix, enemy Drivers), never stat scaling. Run modifiers (ascension-shaped, opt-in) per ticket 27's list. Surface both on the run-start screen (ticket 09). Keep the data-driven: a `tiers.json` the designer can edit without code.

## Done when

Tiers + modifiers selectable and saved; a test asserts no entity stat differs across tiers.

## Resolution

**CLOSED 2026-10-01 (Henry).** Built by deck-archetypes 169 (commits 47dce56..6621b9c).

**Ruled by Henry 2026-09-29; build ticket: [deck-archetypes 169](../../deck-archetypes/tickets/169-tiers-and-modifiers.md).**

- **Ladder** (stacking, `tiers.json`): 0 Standard; 1 Armed Wilds (wild firmware); 2 Elite Territory (+1 elite per biome, wild lite AI); 3 Leaders' Drivers (the gym's Driver in all three gauntlet fights). No stat changes at any tier; 169a's test enforces it.
- **Unlocks:** beating any gym at tier N unlocks N+1 for every gym. One achievement per gym for clearing it at tiers 1, 2 and 3 (added to ticket 44).
- **Modifiers (5, opt-in, label only, no reward):** Junk Start, Tight Budget, Elite Hunt, No Recruits, Draft Start.
- **Build after** ticket 168 and one playtest of run length and scrap.

