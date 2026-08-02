# Scenario schema v1

- Type: wayfinder:grilling
- Status: open
- Assignee:
- Blocked by: — ([Engine readiness audit](01-engine-readiness-audit.md) closed)

## Question

What exactly is a scenario, v1? The schema every other surface consumes — launcher composes it, export produces it, sims batch over it, regression tests replay it.

To decide:

- **Two kinds or one?** A *composed* scenario (battle-start setup: player units with species/level/IVs/OS, deck lists, enemy group with per-enemy level/IV/HP/moveset overrides, seed, `enemyMode`, relics, optional gauntlet context) vs a *snapshot* scenario (a full mid-battle `IBattleState`). Export naturally produces snapshots; the launcher naturally produces compositions; sims want compositions. Likely both under one envelope with a `kind` field — confirm.
- **Validation & versioning.** A zod `ScenarioSchema` mirroring `PlayerSaveSchema`'s approach (validate + migrate). What registry-drift protection: a schema `version` int, a registry hash, or both? (Audit gap #8: restored state resolves `dataId`/`activeOS`/hook IDs against module registries with no stamp today.)
- **Serialization policy** for the ~9 optional fields `JSON.stringify` drops (`activeOS`, `enemyMode`, `currentIntent`, …) — normalize on write, or tolerate on read (audit gap #9)?
- **Storage & naming.** Proposed `docs/scenarios/*.scenario.json` checked into the repo; naming convention for bug repros vs balance cases.

Useful facts: `SnapshotPattern.test.ts:17-51` (`createMockState`) is a hand-built full-state template; `SaveSystem.ts:58-70` is the zod precedent; `battleSlice.setBattleState` is the injection point.
