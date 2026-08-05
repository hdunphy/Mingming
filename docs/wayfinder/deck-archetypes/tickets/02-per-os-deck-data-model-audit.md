# Per-OS deck data-model audit

- Type: wayfinder:research
- Status: open
- Assignee: —
- Blocked by: —

## Question

Moving from one shared `baseDeck` per species to per-OS decks is a data-model change with an unknown blast radius. Before the [OS-swap rules grilling](03-os-swap-deck-rules.md) can present real options, map where decks actually live and flow:

1. **Registry & types.** `IMingmingDefinition.baseDeck` in `src/engine/types.ts` / `mingmingRegistry.ts` — every consumer. What shape fits per-OS decks (keyed by OS id? parallel to `availableOS`?) with the least churn?
2. **Battle creation.** `src/engine/data/battleFactories.ts` and `EncounterGenerator.ts` — where do player and **enemy** decks get assembled? Enemy mingmings in CARDS mode presumably draw from `baseDeck` too: do wild/warden enemies have an OS, and would they pick a per-OS deck?
3. **Save & run state.** Where does the player's *current* deck live mid-run (save schema in `gameTypes.ts` / `SaveSystem.ts` / `gameSlice.ts`)? What happens **today** when the player swaps OS in `FirmwareTerminal.tsx` — is the deck untouched? How do drafted/rewarded cards attach to the deck vs. the species?
4. **UI surfaces.** `DeckTerminal.tsx`, `RosterTerminal.tsx`, `FirmwareTerminal.tsx`, `SynthesisLab.tsx`, breach draft — which screens display or mutate the deck/OS pairing and would need to present per-OS decks?
5. **Scenario & balance plumbing.** Scenario schema v1 encodes the shared deck at `ComposedSetup.player.deck`; the debug-toolkit map already bounded the migration (moves to `PartyMemberSetup.deck`, `CURRENT_SCENARIO_VERSION` → 2, absorbed by `migrateScenario`). Confirm that bound still holds and list what `balanceScenarios.ts` / `runBatch.ts` / the launcher panel need.
6. **Tests.** `baseDecks.test.ts`, `movesets.test.ts`, `deckSuggest.ts` and anything else asserting on deck shape.

Output: a written blast-radius list (files × change type), the recommended registry shape, and the facts [ticket 03](03-os-swap-deck-rules.md) needs about current OS-swap behavior. Findings land in [`../research/02-data-model.md`](../research/02-data-model.md).
