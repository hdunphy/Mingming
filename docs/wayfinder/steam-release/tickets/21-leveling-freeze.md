# Leveling removal: freeze the engine at the calibration point everywhere (ticket 21)

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [01](01-gap-audit.md)
- Phase: Vertical Slice

## Deliverable

vision.md: NO leveling — engine frozen at the level-15 calibration; progression is acquisition. Code still carries `level`/`experience` on `MingmingInstance`, `avgPlayerLevel ± 2` in `EncounterGenerator`, XP in `RewardSystem`, `syncPartyStats`, the XP bar in `RosterTerminal`, the `levelUp` SFX, and level inputs across `battleFactories`/debug scenarios. Remove or constant-fold them so every entity is created at the calibration level; keep the stat-roll jitter (that is the collection depth). Coordinate with deck-archetypes: the sim pipeline must keep producing identical numbers (registry hash unchanged or the change documented).

## Done when

`grep -rn "level\|experience" src/engine src/ui` shows only the frozen constant; `npm test` green; one `npm run balance` row-check shows no movement.

## Resolution

_(open)_

