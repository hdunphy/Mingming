# Per-OS deck data-model audit

- Type: wayfinder:research
- Status: closed
- Assignee: wayfinder (research subagent)
- Blocked by: —

## Question

Moving from one shared `baseDeck` per species to per-OS decks is a data-model change with an unknown blast radius. Before the [OS-swap rules grilling](03-os-swap-deck-rules.md) can present real options, map where decks actually live and flow: registry & types, battle creation (player and enemy deck assembly), save & run state (where the current deck lives, what OS-swap does today), UI surfaces, scenario & balance plumbing (the bounded schema-v2 migration), and tests asserting on deck shape.

## Resolution

Full findings: [../research/02-data-model.md](../research/02-data-model.md). Headlines:

- **The change is small and well-contained: 10 consumer sites total**, and `battleFactories.ts` is *not* one of them (its fallback decks are hardcoded lists). Recommended shape: `decks: Record<osId, string[]>` replacing `baseDeck` outright, softened by one accessor `getDeckForOS(definitionId, osId?)` that defaults to `availableOS[0]` exactly like `initializeBattleEntity` already does. The parallel-array shape was rejected (silent index-coupling; `availableOS[0]` ordering is already load-bearing in three places).
- **The balance suite can get per-OS decks on schema v1 — no version bump.** The player deck is side-level (`player.deck`) and OS variance runs 1-unit parties; `EnemySetup.deck` already exists. Three small edits in `balanceScenarios.ts` (:31, :51, :77) do it. The v2 migration (`player.deck` → `PartyMemberSetup.deck`) stays bounded exactly as the debug-toolkit map recorded, and is only needed for multi-unit parties — separable, not blocking.
- **Facts for the OS-swap grilling:** the run deck is one party-shared `activeDeck` of inventory instance ids; rewards go to `cardInventory` only, never auto-deck; OS swap today costs 25 scrap, hub-only, and touches *nothing but* `roster[i].activeOS`; the base-deck grant fires once per **species** (`baseDecksGranted`), so under per-OS decks a swapper could own zero cards of the new OS's deck; `blueprintsCollected` ("for OS swapping") is checked nowhere — dead affordance; FirmwareTerminal hardcodes `_v1/_v2` instead of reading `availableOS`.
- **Enemies never play `baseDeck` and have their OS stripped in real battles** (`battleFactories.ts:230-235`, "they use intents now"); wild CARDS enemies play procedurally generated elemental decks. Giving enemies per-OS decks/firmware is an opt-in design choice at two marked choice points, not forced by the migration.
- **Implementation order:** registry+accessor with v2-deck=copy-of-v1 → rewrite `baseDecks.test.ts` (32-deck invariants + key parity) → mechanical consumer sweep (compile-green, behavior-identical) → land real decks species-by-species with `npm run balance` as harness → schema v2 migration when the multi-unit decision lands → design-decision work (grant keying, FirmwareTerminal behavior, enemy opt-in) last.
