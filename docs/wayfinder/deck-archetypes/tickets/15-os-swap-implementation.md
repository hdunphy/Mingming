# OS-swap implementation: pick-2 grant, blueprint cost, terminal rework

- Type: wayfinder:task
- Status: closed
- Assignee: wayfinder (Claude session, 2026-08-05)
- Blocked by: [03-os-swap-deck-rules](03-os-swap-deck-rules.md) (closed)

## Question

Implement the [OS-swap rules](03-os-swap-deck-rules.md): blueprint + scrap cost, pick-2 first-swap grant, species+OS grant keying with save migration, FirmwareTerminal rework.

## Resolution

Landed 2026-08-05. Gates: **740/740 vitest** (6 new tests in `gameSlice.swapOS.test.ts`), `tsc -b` clean, `vite build` clean, `npm run balance` **byte-identical** (registry hash unchanged — swap logic touches no cards/decks/firmware, as it should).

- **`swapOS` reducer** (`gameSlice.ts`) — validates member/OS, requires and **spends 1 species blueprint** (`state.blueprints`, the earnable drop pool — the per-member `blueprintsCollected` counter was named for this but nothing in the game increments it, so gating on it would have made swapping permanently impossible; the species-blueprint pool is live and farmable today) + `OS_SWAP_SCRAP_COST` (25), sets `activeOS`, and on the **first** swap to an OS grants up to `OS_SWAP_PICK_COUNT` (2) picked cards validated against that OS's kit **with copy counts respected** (two capacitors grantable, two maelstroms not). Silent no-op on any failed validation, matching `spendScrap`'s convention. Debug tools keep the bare `updateMingmingOS`.
- **Grant keying** — `baseDecksGranted` now holds `deckGrantKey(species, os)` (`kraken:kraken_v1`); compile-time grants (`addToRoster`), starter saves, and the SynthesisLab first-synthesis check all keyed. **Save schema v3** with a `migrateSave` step: a legacy species entry becomes "granted for the OS that species' roster member currently runs" (availableOS[0] fallback) — the rule the data-model audit pre-approved. Save factories stamp v3.
- **FirmwareTerminal** — reads `availableOS` from the registry (the `_v1/_v2` hardcode is gone), shows both costs ("25⚙️ + 1 BLUEPRINT"), disables the flash without either, and on a first swap opens the **kit picker**: the target OS's 8 starting cards with names/costs/descriptions, toggle up to 2, confirm dispatches `swapOS` with the picks. Repeat swaps flash straight through with no grant.
- **Tunables** — `OS_SWAP_SCRAP_COST = 25`, `OS_SWAP_PICK_COUNT = 2` in `gameTypes.ts`, ready for playtest adjustment.
- **Tests** — spend/set/grant/key + schema-parse of the resulting state (the dry-run rule, enforced in test), no-blueprint and no-scrap no-ops, pick cap + kit validation + copy counts, **once-ever-per-OS across a swap round-trip**, keyed compile grants, and the v2→v3 migration (roster-OS rewrite, availableOS[0] fallback, already-keyed entries untouched). Stale expectations updated in `SaveSystem.test`, `saveEdit.test`, `gameSlice.test`.

One deviation flagged for Henry: the blueprint spent is the **species blueprint from the earnable drop pool** rather than the dead per-member counter — functionally what "a blueprint" means in the game today. Side effect worth knowing: swapping consumes the blueprint you'd otherwise keep for compiling another copy of that species, and re-swapping means re-farming the drop — a real economy loop.
