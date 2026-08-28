# Per-OS deck data model: registry shape, accessor, suite wiring, size floor

- Type: wayfinder:task
- Status: closed
- Assignee: wayfinder (Claude session, 2026-08-05)
- Blocked by: —

## Question

Implement the mechanical layer that per-OS decks stand on, per the [data-model audit](02-per-os-deck-data-model-audit.md) recommendations and the [template](04-archetype-identity-template.md) decisions: registry shape + accessor, the 10-site consumer sweep, per-OS balance-suite wiring, and the size floor drop — behavior-identical while both deck slots hold copies. OS-swap/grant *design behavior* explicitly excluded (stays with [ticket 03](03-os-swap-deck-rules.md)).

## Resolution

Landed 2026-08-05. Gates: **734/734 vitest**, `tsc -b` clean, `vite build` clean — and the decisive check passed: **`npm run balance` is numerically identical to the pre-change report** (every card score, matchup number and redline unchanged; only `registryHash` moved, `1:5e763093` → `1:e900e03a`). The plumbing changed zero behavior, as specified.

What landed:

- **Registry** — `IMingmingDefinition.baseDeck` → `decks: Record<osId, string[]>`, one entry per `availableOS`, plus `getDeckForOS(definitionId, osId?)` defaulting to `availableOS[0]` (mirroring `initializeBattleEntity`) with defensive copy and unknown-OS fallback. All 16 species ported; ticket-04 assignments annotated in place (fenrir's designed deck sits in the v2 slot, kraken's in v1, ratatoskr's in v1; every other slot holds a commented copy awaiting its deck pass). Stub returns `decks: {}`.
- **Consumer sweep** — `createStarterSave` (now grants the **full** deck, never truncating — the old code sliced to exactly 10 and would have eaten cards from 10-card decks at the new floor), `gameSlice.addToRoster` (grants the deck of the OS the member was compiled with), `SynthesisLab` celebration (shows the selected OS's deck), `deckSuggest` phase 1 (walks the member's active-OS deck), `composeScenario.baseDeckFor` (per-unit OS), and the registry stub.
- **Balance suite per-OS wiring** — the audit's three `balanceScenarios.ts` edits: the species guard requires every OS slot non-empty, `enemyUnit` and `matchupScenario` resolve decks through `getDeckForOS` with each side's own OS. **`osVarianceScenario` now hands each side its own deck** — the shared-deck confound is mechanically dead; §2.3's premise comment reworded. Schema v1, no version bump, exactly as the audit predicted.
- **Size floor** — `MIN_DECK_SIZE` 10 → 8 (DeckTerminal/SectorTerminal/HubScreen inherit via the constant); `suggestDeckFill`'s target becomes 8 × party — which is precisely Henry's stated per-mingming sweet spot from the template.
- **Tests** — `baseDecks.test.ts` rewritten: key-parity with `availableOS`, 8–12 cards, ids resolve, element-locked, no tokens, accessor semantics; copy cap asserted at ≤3 *legacy* (skoll/valkyrie run triples) with a written TODO to tighten to the template's 2 as each deck pass lands. Stale expectations updated in `deckSuggest.test` (fill targets 10→8 basis), `gameSlice.test`, `saveEdit.test`, `registryHash.test`.

[The kraken pilot](14-kraken-pilot-decks.md) is unblocked: drop two different lists into `decks.kraken_v1` / `decks.kraken_v2` and §2.3 measures them fairly — the first species where that has ever been true.
