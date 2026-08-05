# Firmware truth & enabler audit

- Type: wayfinder:research
- Status: open
- Assignee: —
- Blocked by: —

## Question

For each of the 32 firmware variants (16 species × v1/v2), what does the code **actually** do, what deck conditions does it need to fire, and what exists today to feed it? Deck design cannot start until this matrix exists — the charting pass already caught four dead-hook cases by hand (kraken_v2's 3e-Water condition, hraesvelgr_v1's nonexistent discard outlets, skoll's doubly-dead pair, draugr_v1's absent sleep sources), and a systematic pass will find the rest.

Specifically:

1. **Hook truth.** `src/engine/data/lib/hooks.json` is only half the story — five variants have empty `hooks: []` arrays (fafnir_v1 HOARD_PROTOCOL, hraesvelgr_v2 UPDRAFT_KERNEL, huldra_v2 BARK_SHIELD_OS, valkyrie_v1 VALHALLA_UPLINK, ymir_v2 GLACIAL_PACE beyond its `maxCardsPerTurn`) and `firmwareRegistry.ts` merges in `src/engine/core/CustomFirmware.ts` at boot. For every variant: what is the real, implemented behavior (hooks.json + CustomFirmware + engine special-casing), and does it match the player-facing description? Flag any variant that is described but not implemented.
2. **Enabler matrix.** Per variant: the exact trigger condition (element, cost band, category, status, battle shape), how many cards in the current 111-card pool can feed it, and how many are in the species' current `baseDeck`. The output is the table deck design works from.
3. **1v1-testability.** Confirm the full list of variants whose trigger cannot occur in a 1v1 sim regardless of deck (charting found skoll_v1 ally-damage, valkyrie_v2 per-ally scaling, nidhoggr_v2 on-faint; check audhumbla_v2 overheal, huldra_v1 ally-buff mirror, and anything else) — this list feeds [ticket 05](05-team-battle-os-variance-design.md).
4. **NorseExpansion portability.** For each `docs/NorseExpansion_Full.md` archetype idea worth keeping as a shape: does it map onto the existing `ActionType`/`StatusType` vocabulary (`src/engine/types.ts`), or does it need new engine work? Produce a keep/adapt/reject list so deck design doesn't re-litigate the stale doc.
5. **Prior art.** `src/engine/OSGapClosures.test.ts` and `src/engine/NewArchetypes.test.ts` were modified 2026-08-05 — record what work has already been done toward OS gaps or new archetypes so this map doesn't redo or contradict it (Henry commits himself; check `git log` assumptions at the next device session if needed).

Findings land in [`../research/01-firmware-truth.md`](../research/01-firmware-truth.md).
