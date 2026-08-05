# 02 — Data Model: Per-OS Starting Decks (Blast Radius & Current Behavior)

Resolved 2026-08-05 by a wayfinder research subagent from a staged snapshot of the repo; line numbers are from that snapshot. Current model: `IMingmingDefinition.baseDeck: string[]` (`src/engine/types.ts:80`), one 10-card list per species, 16 species (`src/engine/data/baseDecks.test.ts:8-10`), each with `availableOS: [<id>_v1, <id>_v2]` (`src/engine/data/mingmingRegistry.ts:16` et seq.). Target: 32 decks, one per OS.

---

## 1. REGISTRY & TYPES

### 1.1 Every consumer of `IMingmingDefinition.baseDeck`

Complete grep of the staged tree (`baseDeck`, case-sensitive; `baseDecksGranted` listed separately in §3):

| # | Site | What it does with `baseDeck` |
|---|------|------------------------------|
| 1 | `src/engine/types.ts:80` | Field declaration on `IMingmingDefinition`. |
| 2 | `src/engine/data/mingmingRegistry.ts:17, 56, 102, 134, 166, 198, 230, 262, 294, 333, 365, 397, 429, 475, 521, 560` | The 16 species definitions (data). |
| 3 | `src/engine/data/mingmingRegistry.ts:619` | `GetMingmingData` not-found stub returns `baseDeck: []`. |
| 4 | `src/engine/gameTypes.ts:148-154` | `createStarterSave`: starter's inventory + `activeDeck` are the species `baseDeck`, padded/sliced to `MIN_DECK_SIZE` (comment at :150 assumes "base decks are exactly 10"). No OS is in scope here — the starter `IMingmingState` (:133-144) carries **no** `activeOS`. |
| 5 | `src/ui/store/gameSlice.ts:27-36` | `addToRoster`: first synthesis of a species pushes each `baseDeck` id into `cardInventory` and appends the species id to `baseDecksGranted`. The payload `IMingmingState` **does** carry `activeOS` (set by SynthesisLab at `src/ui/screens/SynthesisLab.tsx:235-238`), so an OS is available at grant time. |
| 6 | `src/ui/screens/SynthesisLab.tsx:250` | Celebration overlay fans out `def.baseDeck` as the "BASE DECK ACQUIRED" card list (chosen OS is in scope: `selectedOS`, :171, :237). |
| 7 | `src/engine/deckSuggest.ts:97-113` | `suggestDeckFill` phase 1 walks each party member's `definition.baseDeck` in order (copy-count aware). Member `activeOS` is available on `IMingmingState` but unused. |
| 8 | `src/debug/scenarios/composeScenario.ts:271-274, 316` | `baseDeckFor(party)` = union of party species `baseDeck`s; feeds `resolveDeck` deck-mode `'base'`. `LauncherUnit.activeOS` is in scope (:73) but unused for the deck. |
| 9 | `src/debug/balance/balanceScenarios.ts:31, 51, 77` | `BALANCE_SPECIES` guard (`baseDeck.length > 0`); `enemyUnit` gives the enemy side `[...baseDeck]`; `matchupScenario` gives the player side `[...baseDeck]`. OS **is** in scope at both :51 and :77 (`activeOS` param). |
| 10 | `src/engine/data/baseDecks.test.ts:12-48` | Four invariants asserted per species (see §6). |

Not a consumer despite appearances: `src/engine/data/battleFactories.ts` never reads `baseDeck` — its player fallback and fixed-encounter enemy decks are hardcoded archetype lists (:214-227, :240-259).

### 1.2 Candidate registry shapes

**A. `decks: Record<string /*osId*/, string[]>`, delete `baseDeck`** — cleanest model; keys self-document which OS a deck belongs to; impossible to desync with `availableOS` ordering. Breaks: all 10 consumer groups above at compile time (which is the point — every call site is forced to answer "which OS?"). Sites with no OS in scope must pick a rule: `createStarterSave` (`gameTypes.ts:148`) and the `GetMingmingData` stub (`mingmingRegistry.ts:619`, needs `decks: {}`).

**B. Parallel array `baseDecks: string[][]` indexed like `availableOS`** — smallest diff in the registry file. Breaks the same 10 sites, *plus* introduces a silent index-coupling bug class (reorder `availableOS`, every deck swaps OS with no type error). The codebase already leans on `availableOS[0]` as an implicit default in three places (`types.ts:185`, `buildScenarioState.ts:86`, `balanceScenarios.ts:46`), so ordering is load-bearing; do not add a second thing that depends on it. Not recommended.

**C. Keep `baseDeck` as-is, add optional `decks?: Record<osId, string[]>`** — zero compile-time churn; consumers migrate one at a time. Breaks nothing immediately, which is exactly its failure mode: any consumer not migrated silently keeps handing out the old shared deck (the SynthesisLab grant and `deckSuggest` are the likely stragglers), and `baseDecks.test.ts` keeps passing while asserting nothing about the 16 new decks.

**Recommendation:** A, softened with one accessor to absorb the churn:

```ts
// mingmingRegistry.ts (or types.ts)
export function getDeckForOS(definitionId: string, osId?: string): string[] {
    const def = GetMingmingData(definitionId);
    return def.decks[osId ?? def.availableOS[0]] ?? def.decks[def.availableOS[0]] ?? [];
}
```

This mirrors the existing `activeOS || definition.availableOS[0]` default in `initializeBattleEntity` (`src/engine/types.ts:185`), so "no OS chosen" resolves the same way everywhere. Route all 10 consumers through it; the only per-site decision left is *which* osId to pass (see §3 for the sites where that is a design question, not an engineering one).

---

## 2. BATTLE CREATION

All in `src/engine/data/battleFactories.ts` (`createBattleState`) and `src/engine/data/EncounterGenerator.ts` (`generateEncounter`).

### 2.1 Player deck source
- `battleFactories.ts:263-271` — if `save.activeDeck` is non-empty, resolve its instance ids through `save.cardInventory` to dataIds (:264-268). Otherwise fall back to `getArchetypeDeck` (:240-259, :270), a **hardcoded** FENRIR/KRAKEN/RATATOSKR list keyed off `playerParty[0].definitionId` — not `baseDeck`. Per-OS decks do not touch this path unless the fallback is (optionally) rewritten to `getDeckForOS(playerParty[0].definitionId, playerParty[0].activeOS)`.

### 2.2 Enemy deck source — never `baseDeck`
- Gym tier 1 (:150-159) and tier 2 (:160-168), and sector battles (:199-207): `generateEncounter` builds the enemy deck **procedurally from the ProgramRegistry**, not from any species deck — 1 random daemon + 9 random cards of the sector element / `None` (`EncounterGenerator.ts:82-128`).
- Gym tier 3 boss (:170-197): `enemyDeckIds = []` (:197); bosses run on hardcoded `moves`.
- Fixed/fallback encounters (:208-228): hardcoded archetype lists (:220-226), sliced to daemon + 9.

### 2.3 Enemy OS
- `generateEncounter` builds enemy `IMingmingState`s **without** `activeOS` (`EncounterGenerator.ts:65-75`), so `initializeBattleEntity` defaults each to `availableOS[0]` (`types.ts:185`) — i.e. wild enemies would all be v1.
- Then `battleFactories.ts:230-235` **strips** `activeOS` from every enemy (`undefined`) except gym bosses keeping their `boss_relic_*` pseudo-OS (:184-185). Comment: "Disable OS on enemies as they use intents now."
- Net: in real battles, enemies have **no OS** and their firmware never fires.

### 2.4 CARDS enemyMode
- `enemyMode` defaults to `'MOVES'`; `'CARDS'` only via `BattleOptions` (:62-64, :73). In CARDS mode the enemy drawpile is the same `enemyDeckIds` described in §2.2 (:300-310) — the procedural elemental deck or archetype list, **not** `baseDeck`. So no, CARDS enemies do not play `baseDeck` today. The only place enemies fight with species base decks is the debug/balance path (`balanceScenarios.ts:51` → `buildScenarioState.ts:208`).

### 2.5 Would per-OS decks change enemy generation?
Not mandatorily — no shipped enemy path reads `baseDeck`. The **choice point**, if design wants wild CARDS enemies to play their species' per-OS deck instead of the random elemental deck, is `EncounterGenerator.ts:82-128` (replace the pool build with `getDeckForOS(mmId, chosenOS)` and stop stripping/start assigning enemy OS at `battleFactories.ts:230-235`). Secondary choice point: the fixed-encounter list at `battleFactories.ts:214-227`. Both are opt-in design changes, not forced by the migration.

---

## 3. SAVE & RUN STATE

### 3.1 Where the current deck lives
- `IPlayerSave.activeDeck: IActiveDeck | null` (`src/engine/gameTypes.ts:87`, shape :20-24): a **single, party-shared** deck of `cardInventory` *instance ids*. `DECK_SIZE = 40`, `MIN_DECK_SIZE = 10` (:26-27).
- Redux copy: `gameSlice` initial state is the save itself (`src/ui/store/gameSlice.ts:16`); deck mutations are `setActiveDeck`/`addCardToDeck`/`addCardsToDeck`/`clearDeck`/`removeCardFromDeck` (:110-151). Removing a card from inventory also removes it from the deck (:95-107).
- Persistence: `ActiveDeckSchema` (`src/engine/SaveSystem.ts:41-45`) inside `PlayerSaveSchema` (:68-80), `CURRENT_SAVE_VERSION = 2` (:66), `migrateSave` (:88-104). **There is no per-roster-member deck anywhere in the save.**

### 3.2 How drafted/rewarded cards attach
- `rollDropTable` / `rollDraftRounds` (`src/engine/RewardSystem.ts:135-168, 191-242`) mint `IOwnedProgram`s; `applyRewardBundle` (`gameSlice.ts:186-205`) pushes them into **`cardInventory` only** — never into `activeDeck`, never onto a roster member. Attachment is therefore **one global inventory + one shared deck**; the player wires rewards into the deck manually in DeckTerminal (or via `suggestDeckFill`). Nothing in the reward path is species- or OS-aware (pools are element-of-defeated-enemy, `RewardSystem.ts:112`).

### 3.3 OS swap today — exact trace
`src/ui/components/FirmwareTerminal.tsx`:
1. `OS_SWAP_COST = 25` scrap (:13). Flash button disabled unless a target OS is picked and `scrapCount >= 25` (:157).
2. After the flash animation completes: `dispatch(spendScrap(25))` then `dispatch(updateMingmingOS({ id, activeOS }))` (:54-57).
3. `updateMingmingOS` (`gameSlice.ts:266-272`) sets `roster[i].activeOS` and **nothing else**.

Facts for the design decision:
- **The deck is untouched.** So are `cardInventory`, `activeDeck`, and `baseDecksGranted`. OS swap is purely a firmware-behavior change today.
- **Restrictions:** cost = 25 scrap, flat. No location gating beyond reachability: the terminal opens only from RosterTerminal's "BOOT FIRMWARE TERMINAL" button (`src/ui/screens/RosterTerminal.tsx:33-35, 134`), i.e. out of battle, in the hub. No cooldown, no per-run limit. `IMingmingState.blueprintsCollected` is commented "For OS swapping" (`types.ts:95`) but is **checked nowhere** — dead affordance.
- FirmwareTerminal **hardcodes** the OS list as `${definitionId}_v1` / `_v2` (:66-73) instead of reading `availableOS`; this happens to match the registry today.
- The swap takes effect in battle via `initializeBattleEntity` copying `activeOS` (default `availableOS[0]`) onto the battle entity (`types.ts:185`).
- Implication: under per-OS decks, a player who was granted only their chosen OS's deck at synthesis (`gameSlice.ts:27-36` grants once per **species**, keyed by `baseDecksGranted: species ids` — `gameTypes.ts:93`, `SaveSystem.ts:79`) could swap OS for 25 scrap and own zero cards of the new OS's deck. The grant keying (`species` vs `species+OS`) and what swap does to `activeDeck`/inventory is the open design decision; every mechanism it would hook into is listed above.

---

## 4. UI SURFACES

- `src/ui/screens/DeckTerminal.tsx` — displays/mutates the shared `activeDeck` against full inventory (:30, :177-201); per-OS decks change nothing structurally, but "SUGGEST FILL" (:80-83, :187-189) inherits whatever OS-awareness `suggestDeckFill` gains, and the party strip (:242-266) may want to show each member's OS.
- `src/ui/screens/RosterTerminal.tsx` — read-only OS display per member (:117-120) and the sole entry point to FirmwareTerminal (:33-35, :134); no deck contact; unchanged unless design surfaces "deck follows OS" here.
- `src/ui/components/FirmwareTerminal.tsx` — mutates OS (:54-57); per-OS decks make this the critical screen: it must (a) read `availableOS` instead of hardcoding `_v1/_v2` (:66-73), and (b) implement/communicate whatever the swap-vs-deck design decision is (grant, swap, or warn).
- `src/ui/screens/SynthesisLab.tsx` — OS is chosen at compile (:171, :230-241) and the base-deck grant + celebration use the species deck (:233, :250 via `addToRoster`); must switch the celebration `cardIds` and (via gameSlice) the granted kit to the **selected OS's** deck — OS is already in hand at this call site.
- `src/ui/screens/SectorTerminal.tsx` — only validates shared deck size before deploy (:57-60, :242) and never touches OS; unchanged unless `MIN_DECK_SIZE` semantics change.

---

## 5. SCENARIO & BALANCE PLUMBING

### 5.1 Does the debug-toolkit bound still hold?

Yes, with one precision. Verified against `src/debug/scenarios/scenarioSchema.ts`:
- `CURRENT_SCENARIO_VERSION = 1` (:26); the shared deck is `ComposedSetupSchema.player.deck` (:216-218) and the migration note (:204-209) matches the map's claim (`docs/wayfinder/debug-toolkit/map.md:54`).
- `PartyMemberSetupSchema` (:186-197) has **no** `deck` field; `EnemySetupSchema` **does** (`deck: z.array(z.string()).optional()`, :199-202; TS mirror `EnemySetup.deck?` :286-289).
- `migrateScenario` (:348-357) is the version-keyed shell ready to take a `< 2` step; lifting `player.deck` onto each member there is mechanical.
- Consumer signatures genuinely don't change: `buildScenarioState(setup)` (`buildScenarioState.ts:180`), `runBatch(setup, options)` / `runPairedBatch` (`runBatch.ts:338, 389`) all take `ComposedSetup`.
- **Precision:** "no consumer signature change" ≠ "no consumer change". Two internals must move: `buildScenarioState.ts:210` (`instantiateDeck([...setup.player.deck])` → flatten per-member decks, exactly as it already does for enemies at :208) and `composeScenario.ts` — `toComposedSetup` (:361-377, writes `player.deck`), `resolveDeck`/`baseDeckFor` (:271-325), `draftFromSetup` (:396-407, reads `setup.player.deck` into `loadedDeck`), and `seedSaveFromBattle` (:534-559, mints inventory from `setup.player.deck` at :541). The launcher panel's three-way deck control also changes.

### 5.2 What the balance suite needs for per-OS `osVarianceScenario`

Today (`src/debug/balance/balanceScenarios.ts`): both sides of `osVarianceScenario(id)` (:103-115) get the **same** `MingmingRegistry[id].baseDeck` — player via `matchupScenario`'s `deck: [...MingmingRegistry[player].baseDeck]` (:77), enemy via `enemyUnit`'s `deck: [...baseDeck]` (:51). `EnemySetup.deck` already exists; **`PartyMemberSetup` has no deck field** — but the player side doesn't need one, because the player deck is side-level (`player.deck`) and OS variance runs 1-unit parties.

Minimum change set (works on schema **v1**, no version bump required for the balance suite alone):
1. Registry accessor `getDeckForOS(definitionId, osId)` (§1.2).
2. `matchupScenario` (:70-82): `deck: getDeckForOS(player, playerOS ?? availableOS[0])` at :77.
3. `enemyUnit` (:50-52): take the resolved OS and use `getDeckForOS(definitionId, os)` at :51 (today it ignores its caller's `enemyOS` for the deck entirely).
4. `BALANCE_SPECIES` guard (:31): `baseDeck.length > 0` → every `availableOS` id has a non-empty entry in `decks`.
5. `osVarianceScenario` (:103-115): already passes `playerOS: v1, enemyOS: v2`; with 2-3 above, each side automatically gets its own per-OS deck. Seeds (:73, :113) are name-derived and unchanged.
6. No changes needed in `runBatch.ts` or `os-variance.balance.ts` (the test consumes `osVarianceScenario` + `runPairedBatch` opaquely, `os-variance.balance.ts:64-68`). **Semantic caveat to flag:** the §2.3 premise "same deck, different OS" (`os-variance.balance.ts:3-6`, `docs/balance_testing.md`) becomes "each OS with its native deck" — the measured gap becomes firmware+deck jointly, and `mirrorScenario` (:89-95) stays a true mirror only because both sides default to the same OS.

The v2 schema migration (`player.deck` → `PartyMemberSetup.deck`) remains the right long-term move for **multi-unit** parties with per-OS decks, but is separable from and not blocking the balance-suite fix.

---

## 6. TESTS & TOOLING

- `src/engine/data/baseDecks.test.ts` — the direct casualty. Current invariants, per species: registry has exactly 16 species (:8-10, unaffected); `baseDeck` defined and **exactly 10 entries** (:12-17); every id resolves to a real program (:19-28); every card's element == species `primaryElement` or `'None'` (:30-38); no tokens (:40-48). Duplicates are explicitly legal (registry lists repeated ids, e.g. `mingmingRegistry.ts:17`). Under per-OS decks: rewrite to iterate `def.availableOS × def.decks`, asserting all four per-deck invariants on 32 decks, plus a new invariant "`decks` has an entry for every `availableOS` id and no extras".
- `src/engine/gameTypes.ts:26-27, 148-154` — `MIN_DECK_SIZE = 10` and `createStarterSave`'s pad-to-10 loop encode "a starting deck is exactly 10". The loop tolerates other sizes but infinite-loops on an empty deck; the `mingmingRegistry.ts:619` stub's empty deck is only safe because starters are hardcoded ids.
- `src/engine/deckSuggest.ts:97-113` — phase 1 walks `definition.baseDeck`; must become `getDeckForOS(member.definitionId, member.activeOS)`. Target-size math (`MIN_DECK_SIZE * partySize`, :56) unaffected. (No `deckSuggest.test.ts` in the staged snapshot.)
- `src/engine/deckLogic.ts` — no deck-shape assumptions at all (only `HAND_SIZE_LIMIT = 9`, :7); **unaffected**.
- `src/engine/NewArchetypes.test.ts:33-34` and `src/engine/OSGapClosures.test.ts:56-57` — build `IDeckState`s by hand; no `baseDeck` contact; unaffected.
- `src/debug/balance/balanceScenarios.ts:31` — `BALANCE_SPECIES` guard breaks at compile if `baseDeck` is removed (§5.2 item 4).
- `src/debug/balance/powerscale.ts` — no deck references; unaffected.
- Save-shape tooling: `PlayerSaveSchema.baseDecksGranted` (`SaveSystem.ts:79`) validates species-id strings with `.catch([])`; if the grant becomes per-OS-keyed, old saves migrate trivially (a species id can be reinterpreted as "granted for the OS the member currently runs") but that rule must be written in `migrateSave` and mirrored in `scenarioSchema`'s save-adjacent comments.

---

## 7. BLAST-RADIUS SUMMARY

| File | Change type | Size | Notes |
|------|-------------|------|-------|
| `src/engine/types.ts` | type change | S | `baseDeck` → `decks: Record<osId, string[]>` on `IMingmingDefinition` (:80). |
| `src/engine/data/mingmingRegistry.ts` | data + logic | **L** | Author 32 decks (16 exist, 16 new); update stub (:619); add `getDeckForOS`. The design work dominates. |
| `src/engine/data/baseDecks.test.ts` | test update | M | Iterate OS × species; add decks/availableOS key-parity invariant. |
| `src/ui/store/gameSlice.ts` | logic change | M | `addToRoster` grant (:27-36) picks the payload's `activeOS` deck; decide `baseDecksGranted` keying (species vs species+OS) — **design decision**. |
| `src/ui/screens/SynthesisLab.tsx` | UI change | S | Celebration `cardIds` (:250) from selected OS's deck; OS already in scope. |
| `src/ui/components/FirmwareTerminal.tsx` | UI change | S–L | Read `availableOS` instead of hardcoded `_v1/_v2` (:66-73) = S; implementing swap-affects-deck behavior = up to L, **pending design decision** (today swap touches only `roster[i].activeOS`, cost 25 scrap). |
| `src/engine/gameTypes.ts` | logic change | S | `createStarterSave` (:148) picks a deck for a starter with no OS (suggest `availableOS[0]` v1, consistent with `types.ts:185`). |
| `src/engine/deckSuggest.ts` | logic change | S | Phase 1 (:106) uses `getDeckForOS(member.definitionId, member.activeOS)`. |
| `src/debug/balance/balanceScenarios.ts` | logic change | S | :31, :51, :77 → OS-aware lookup; this alone gives `osVarianceScenario` per-side decks. |
| `src/debug/scenarios/composeScenario.ts` | logic change | M | `baseDeckFor` (:272) per-unit-OS; `resolveDeck`/`toComposedSetup`/`draftFromSetup`/`seedSaveFromBattle` follow the schema decision. |
| `src/debug/scenarios/scenarioSchema.ts` | migration | S | Add `deck?` to `PartyMemberSetupSchema` (:186), bump `CURRENT_SCENARIO_VERSION` to 2 (:26), `< 2` step in `migrateScenario` (:348) lifting `player.deck` onto members. Bound from the debug-toolkit map verified (§5.1). |
| `src/debug/scenarios/buildScenarioState.ts` | logic change | S | :210 flattens per-member decks like enemies at :208; signature unchanged. |
| `src/engine/SaveSystem.ts` | migration | S | Only if `baseDecksGranted` keying changes: `migrateSave` step + schema comment. |
| `src/engine/data/battleFactories.ts` | logic change (optional) | S | Fallback deck (:240-271) could use per-OS deck; enemy path untouched unless design opts in (§2.5). |
| `src/engine/data/EncounterGenerator.ts` | logic change (optional) | M | Only if wild CARDS enemies should play species per-OS decks (:82-128) + un-strip OS (`battleFactories.ts:230-235`). |
| `src/debug/balance/os-variance.balance.ts` | doc/comment | S | No code change; premise comment (:3-6) needs rewording ("same deck" no longer true). |
| `src/ui/screens/DeckTerminal.tsx`, `RosterTerminal.tsx`, `SectorTerminal.tsx` | none / cosmetic | S | Shared-deck UX unchanged; optional OS labeling. |

**Recommended implementation order**
1. Registry + types: `decks` field, `getDeckForOS`, stub fix; port the 16 existing decks as each species' v1 deck; temporary v2 = copy of v1 so nothing is blocked on authoring.
2. `baseDecks.test.ts` rewrite (locks the new invariants before consumers move).
3. Mechanical consumer sweep with `getDeckForOS`: `gameTypes.ts:148`, `gameSlice.ts:29`, `SynthesisLab.tsx:250`, `deckSuggest.ts:106`, `composeScenario.ts:273`, `balanceScenarios.ts:31/51/77` — compile-green, behavior identical while v2==v1.
4. Balance suite check: run `os-variance.balance.ts` to confirm no regression, then land real v2 decks species-by-species with the suite as the harness.
5. Scenario schema v2 migration (`PartyMemberSetup.deck`, version bump, `migrateScenario`, `buildScenarioState.ts:210`, launcher deck control) — separable, do once the shared-vs-per-member design decision lands.
6. Design-decision work last: `baseDecksGranted` keying + FirmwareTerminal swap behavior + (optional) enemy generation opt-in.

---

## GAPS (imported/referenced but not in the staged snapshot — not audited, do not assume)

- `src/ui/store/battleSlice.ts` — `startBattle` (dispatched at `SectorTerminal.tsx:74, 95`) and `setBattleState`.
- `src/ui/store/store.ts` — autosave subscription (referenced `SaveSystem.ts:13`).
- `src/engine/SaveSlots.ts`, `src/engine/data/relicRegistry.ts`, `src/engine/core/IntentUtils.ts`, `src/engine/core/PRNG.ts`, `src/engine/core/SeedStream.ts`.
- `src/debug/scenarios/normalizeBattleState.ts`, `src/debug/saveEdit.ts`, `src/debug/panels/ScenarioLauncherPanel.tsx` (the launcher's three-way deck UI).
- `src/debug/balance/balanceReport.ts`, `balanceReporting.ts`, and the mirror/gauntlet balance specs.
- `src/ui/screens/HubScreen.tsx`, `BattleArena.tsx`, `App.tsx` — battle-end reward/sync dispatch sites (referenced in `composeScenario.ts:449-451`).
- Any `deckSuggest.test.ts` / `composeScenario.test.ts` / scenario-schema tests — none staged; if they exist upstream they assert on shapes changed here.
