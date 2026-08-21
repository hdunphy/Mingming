# Macros: the 10 ruled single-use slots, engine + UI (ticket 15)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [06](06-run-data-model.md), [13](13-marketplace-node.md)
- Phase: Vertical Slice

## Deliverable

macros-and-drivers.md is a DESIGN, not a session — implement it. 3 slots per run, fired free on your turn: Surge (~30 power damage), Mend (~30 heal), Venom Shot (3 Poison), Kindle (2 Burn), Rally (3 Str), Cripple (3 Weak), Salve (3 Regen); rares: Free Exec (next card costs 0), Echo (replay last card), Cache Pull (draw 2), Recharge (+1 energy), **Revive** (rare; the gauntlet's in-a-pinch answer). Pricing ruled: full 1e-card value, rares 1.5× (marketplace price follows ticket 13's table). Implement as a `MACRO` action source through the existing reducer (`PLAY_PROGRAM`-shaped, no energy cost), a `macros` array on `IRunState`, UI slots beside the hand, and marketplace/event acquisition. Never call them potions.

Engine note: `Recharge` must ADD energy mid-turn — `processPreTurn` SETS `currentEnergy`, the trap that bit three OSes; do not grant via the pre-turn path.

## Done when

All 10 (+Revive) fire correctly with tests, previews show true numbers, and a macro can be bought and used inside one run.

## Resolution

_(open)_

## Amendments from tickets 07/08 (Henry, 2026-08-21)

Add a MAP-REVEAL consumable (reveals the current biome's node types) to the Macro family or as a marketplace item — Henry asked for 'items and events that reveal more of the map' under 1-layer visibility (ticket 07). Pricing at 1e-card value like the others.
