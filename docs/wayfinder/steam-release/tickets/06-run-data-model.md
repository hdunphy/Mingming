# Run data model: what a run IS in state, and save schema v4 (ticket 06)

- Type: wayfinder:prototype
- Status: open
- Assignee: 
- Blocked by: [01](01-gap-audit.md)
- Phase: Vertical Slice

## Question

Today there is no run object — "run" is the whole save, and defeat calls `resetSave`. The rulings need a real `IRunState` next to the persistent ranch. Prototype the TypeScript types + zod schema (no UI) and walk Henry through them:

- **Persistent (ranch):** roster of assembled individuals with their stat rolls + active OS; blueprint inventory as COUNTS per species (consumable); codex (seen/played); unlocked tiers/gyms; settings. **No `cardInventory`, no `scrapCount`, no `level`/`experience`.**
- **Run-scoped (`IRunState`):** seed, chosen gym, the three biomes, region graph + node states + current node, party (ids into the roster, max 3, no duplicate species), the shared run deck (card instance ids), scrap, Macro slots (3), Drivers, run modifiers, tier, fight count/clock, gauntlet progress (HP carry-over, the `persistedStats` idea already in `IGauntletState`).
- Migration v3 → v4: what happens to existing saves (convert `cardInventory`/`activeDeck` away; `blueprints` from dedup'd list to counts; drop scrap).

Open sub-questions to settle WITH Henry: does an in-progress run survive app close (yes — Steam players expect it; then the run state lives in the save) and is there one run slot or several.

## Done when

`src/engine/runTypes.ts` + `RunStateSchema` exist with tests for the v3 → v4 migration, and Henry has ratified the shape. This ticket gates everything in the Vertical Slice.

## Resolution

_(open)_

