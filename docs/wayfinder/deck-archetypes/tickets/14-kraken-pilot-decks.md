# Kraken pilot: two per-OS decks end-to-end

- Type: wayfinder:task
- Status: closed
- Assignee: wayfinder (Claude session, 2026-08-05)
- Blocked by: [13-per-os-deck-data-model](13-per-os-deck-data-model.md) (closed)

## Question

Run the first species end-to-end through the [template](04-archetype-identity-template.md): design → rev-3 pricing → `npm run balance` → registry, proving the pipeline before the per-element passes fan out. Kraken: a kept deck, a fresh build, an authored card, and two real redlines to move (~100% OS gap; the 354-draw mirror).

## Resolution

Landed 2026-08-05 after a three-round sim-and-tune loop with Henry (voice-mode). **Kraken is now completely redline-free** — the first species where §2.3 measured two real per-OS decks, and the pilot's numbers:

| metric | before pilot | after |
|---|---|---|
| OS gap (v1 deck vs v2 deck) | ~100% (dead-hook artifact) | **50.0/50.0 — dead even, redline cleared** |
| kraken mirror | 354/400 draws, TURN_COUNT redline | **400/400 decided, 52/48 — redline cleared** |
| gauntlet vs registry | 36.3% (stall deck) | 60.5% (healthy, under the 70% cap) |
| capacitor budget | +2.3 over — redline | cleared (2e) |
| hydro_blast budget | +1.0 over — redline | cleared (140 power) |

**Final decks (Henry-approved):**

- `kraken_v1` ABYSSAL_INK (8): whirlpool_v2 ×2, pressure_point ×2, ink_stream ×2, ink_cloud, water_slap — 4 draw cards (50%) feed the ink; ink_stream is the clock.
- `kraken_v2` TIDAL_CRUSH (8): **maelstrom** (new) ×1, hydro_blast ×1, capacitor ×2, surge_protection ×2, water_slap ×2 — ramp into boosted 3e payoffs, 50% OS-specific.

**Card work:** new `maelstrom` (3e Water, 120 power + 1 Dazed — exactly on the 140-power/14.0-score 3e budgets); `capacitor` 1e→2e (clears its redline; also touches jormungandr's deck — his gap ticked 22%→21%); `hydro_blast` 150→140 (on curve); `ink_stream` 20→**12 per card drawn** (see below).

**The tuning loop — what the sims taught:**

1. First run: v1 won 72.2% of the whole gauntlet (over the 70% overtune cap) and beat v2 85/15. Root cause: ink_stream at 20/draw paid 100–120 power on a 1e card in a deck drawing 5–6/turn — the static formula's ~2.5-draw assumption broke. **Lesson for every deck pass: a scaling card must be priced against ITS deck's realistic trigger count, not the formula's average.**
2. ink_stream → 12/draw: overtune cleared (60.5%), gap 35%→18%.
3. Consistency probe (scavenge_data ×2 replacing water_slap in v2): **backfired to 100/0** — tutoring made v2 slower and speed was what it was dying to. Reverted.
4. Max-tempo v2 (water_slap ×2, scavenge_data cut): **50/50.** Lesson: in this engine's fight lengths, ramp decks buy their setup turns with cheap pressure, not consistency tools; and 8-card decks self-consist (whole deck seen by turn ~2–3).

**Template validated** — 8-card size, three tiers, 30–50% OS-specific, one 3e payoff, and the sim-tune loop all worked as designed. The pattern for the remaining 15 species: draft to template → price → sim → tune the one number the sims indict → Henry signs off. Registry now `1:8ca9c55b`, 734/734 tests, tsc + build clean.
