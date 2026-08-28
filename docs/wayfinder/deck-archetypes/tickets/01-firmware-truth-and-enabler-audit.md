# Firmware truth & enabler audit

- Type: wayfinder:research
- Status: closed
- Assignee: wayfinder (research subagent)
- Blocked by: —

## Question

For each of the 32 firmware variants (16 species × v1/v2), what does the code **actually** do, what deck conditions does it need to fire, and what exists today to feed it? Deck design cannot start until this matrix exists — the charting pass already caught four dead-hook cases by hand (kraken_v2's 3e-Water condition, hraesvelgr_v1's nonexistent discard outlets, skoll's doubly-dead pair, draugr_v1's absent sleep sources), and a systematic pass will find the rest.

Specifically:

1. **Hook truth.** `src/engine/data/lib/hooks.json` is only half the story — five variants have empty `hooks: []` arrays and `firmwareRegistry.ts` merges in `src/engine/core/CustomFirmware.ts` at boot. For every variant: what is the real, implemented behavior, and does it match the player-facing description? Flag any variant that is described but not implemented.
2. **Enabler matrix.** Per variant: the exact trigger condition, how many cards in the current 111-card pool can feed it, and how many are in the species' current `baseDeck`.
3. **1v1-testability.** Confirm the full list of variants whose trigger cannot occur in a 1v1 sim regardless of deck — this list feeds [ticket 05](05-team-battle-os-variance-design.md).
4. **NorseExpansion portability.** For each `docs/NorseExpansion_Full.md` archetype idea: does it map onto the existing `ActionType`/`StatusType` vocabulary, or does it need new engine work? Keep/adapt/reject list.
5. **Prior art.** `src/engine/OSGapClosures.test.ts` and `src/engine/NewArchetypes.test.ts` were modified 2026-08-05 — record what work has already been done.

## Resolution

Full findings: [../research/01-firmware-truth.md](../research/01-firmware-truth.md). Headlines:

- **All 32 variants are really implemented** (the five empty-`hooks:[]` entries live in `CustomFirmware.ts`) — but the audit found live defects, now ticketed as [Firmware defect fixes](07-firmware-defect-fixes.md): sleipnir_v2's `hoof_strike` token satisfies its own trigger (no `isToken:false` guard) → **infinite 0-cost attacks**, the prime suspect for the sleipnir FTK redline; huldra_v2 **never fires for the player side** (its `turn === 1` guard predates battles starting mid-turn-1) and its shield formula is quadratic in maxHP; jormungandr_v2 heals at the end of **both** sides' turns (no `when` clause) — which is 2× the described rate and plausibly why v2 leads its §2.3 gap; kraken_v1 has no `source` condition and procs on either side's effect-draws; fafnir_v2 avoids double-firing only via a hook-id collision; nidhoggr_v2's `target: "ANY"` passes by validator fall-through.
- **The charting audit's 1v1-dead list was wrong.** `ALLY` includes self (`ConditionValidator.ts:46-48`), so **skoll_v1, huldra_v1 and audhumbla_v2 all work in 1v1**. The definitive dead list is exactly three: **valkyrie_v1** (code explicitly excludes self), **valkyrie_v2** (`ALIVE_ALLIES` = 0 → ×1.0), **nidhoggr_v2** (the only usable faint ends the battle). Conditionally dead: huldra_v2 (player side, every shape), draugr_v2 (vs MOVES enemies — cost hooks only run on card plays).
- **Dead-by-deck confirmed:** kraken_v2 (0 in deck; only 2 *functional* enablers in pool — the other 3e Water cards deal no ATTACK damage), hraesvelgr_v1 (0 in pool; DISCARD executors and the onDiscarded pipeline exist fully wired, no card uses them), skoll_v2, draugr_v1, draugr_v2. Under-fed: kraken_v1, fafnir_v2, huldra_v1, audhumbla_v1 (uplift is category Status, doesn't count!), audhumbla_v2, hel_v1 (only 2 stance cards exist in the pool), hel_v2.
- **NorseExpansion keep/adapt/reject:** KEEP — Ragnarok (HP-for-power, mostly native), Golden Scales (Sharp/thorns), **Hurricane Force (the missing hraesvelgr_v1 enabler — "draw 2, discard 1" is directly expressible today)**, Brittle Point (sleep/stun payoffs — also feeds draugr_v1), Gjallarhorn (team buffs — exactly what valkyrie_v1 starves for), Necrotic Code (drain, largely exists). REJECT — Scrap Hoard, Wind-Chill (Ice-vulnerability status), Grafting (no status transfer), Prismatic Shield (no reflect), Grave-Call (no revive — draugr_v1's "or is revived" clause is likewise unimplemented). ADAPT — World-Burner, both doc-Jormungandr kits (the Dazed control kit fits *kraken* better than jormungandr), Echo-Chamber, Permafrost (hook-only).
- **Prior art:** nine OS-gap closures already landed 2026-08-05 (`OSGapClosures.test.ts`) — overheal plumbing, fafnir_v1 timing, valkyrie_v1 real statuses, audhumbla_v1 exact-3rd counting, per-unit counters, hraesvelgr_v2 cleanup, intent side-buffs, gullinbursti_v1 prime semantics pinned by owner decision, ymir_v2 card cap. Deck-relevant rule: sim decks are 10 cards; `deckSuggest` will never auto-suggest off-element enablers, so cross-element fixes need manual decks or new on-element cards.
