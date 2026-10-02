# Achievements and Steam Cloud design: the list, in numbers (ticket 44)

> **2026-09-24 — RE-SCOPED. "All 16 species assembled" → the EA six (blueprintPool is the EA roster, 142 §8); codex milestones use 31a's EA denominators. New material to list: first `+` upgrade, first patch, a gym won with the counter-disadvantage (Henry's own 142 §8 example).**

- Type: wayfinder:grilling
- Status: open
- Assignee: 
- Blocked by: [31](31-codex.md)
- Phase: Steam

## Question

Decide the launch achievement list with Henry (propose 15–25: first run won, each gym, each tier, codex milestones, all 16 species assembled, a 3-mono-element run, a no-marketplace run, gauntlet with no faints, etc.), which are hidden, and icon sourcing (ticket 32's path). Cloud: what syncs (everything in the save) and the conflict rule (newest wins, with a local backup).

> **Added by ticket 169 (Henry, 2026-09-29):** one achievement per gym for clearing it at tiers 1, 2 and 3 (nine clears across the three gyms): Emberfall, Tidewrack and Rootfall. The condition is `tierUnlocks.gymMastered(ranch, gymId)`, read from `IRanchState.tierClears`.

## Done when

`steam/achievements.md` with ids, names, descriptions, trigger conditions and icon plan.

## Resolution

_(open)_

