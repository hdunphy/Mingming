# Per-OS deck data model: registry shape, accessor, suite wiring, size floor

- Type: wayfinder:task
- Status: open
- Assignee: —
- Blocked by: —

## Question

Implement the mechanical layer that per-OS decks stand on, per the [data-model audit](02-per-os-deck-data-model-audit.md) recommendations and the [template](04-archetype-identity-template.md) decisions. Scope is the engineering only — the OS-swap/grant design behavior stays with [ticket 03](03-os-swap-deck-rules.md) and is NOT implemented here.

1. **Registry shape** — `IMingmingDefinition.baseDeck` → `decks: Record<osId, string[]>` (audit option A) + the `getDeckForOS(definitionId, osId?)` accessor defaulting to `availableOS[0]`. Port all 16 existing decks as each species' assigned slot per the template (fenrir's → v2, kraken's → v1, ratatoskr's → v1, everything else → v1 for now); the unassigned slot gets a **copy** of the existing deck so behavior is identical until real decks land.
2. **Consumer sweep** (the audit's 10 sites): `gameTypes.ts` createStarterSave, `gameSlice.ts` addToRoster grant, `SynthesisLab.tsx` celebration, `deckSuggest.ts` phase 1, `composeScenario.ts` baseDeckFor, `balanceScenarios.ts` ×3, `GetMingmingData` stub. Compile-green, behavior-identical while both slots match.
3. **Balance suite per-OS wiring** — the audit's three `balanceScenarios.ts` edits so `osVarianceScenario` hands each side its own deck (schema v1, no version bump). §2.3's premise comment in `os-variance.balance.ts` reworded ("each OS with its native deck").
4. **Size floor** — `MIN_DECK_SIZE` 10 → 8; fix the `createStarterSave` pad loop, `SectorTerminal` deploy validation, and rewrite `baseDecks.test.ts`: iterate `availableOS × decks`, per-deck invariants (8–12 cards, ≤2 copies, ids resolve, element ∈ {primary, None}, no tokens, key parity with `availableOS`).
5. **Gates + baseline** — full gates; `npm run balance` should be **numerically identical** to `1:5e763093` while every v-slot pair holds copies (any drift = a wiring bug). Record confirmation here.

Done when: compile + tests green, the balance report is unchanged, and [the kraken pilot](14-kraken-pilot-decks.md) can drop two different deck lists into `decks` and have §2.3 measure them.
