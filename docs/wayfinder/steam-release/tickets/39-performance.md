# Performance pass: AI turn time, motion cost, bundle size on Deck-class hardware (ticket 39)

> **2026-09-24 — NOTE. The beam is a ladder rung (deck-archetypes 144): wild 8, elite 8, gym 0 (beamless). The gym boss's unbeamed 3v3 turn is the p95 case to measure; "confirm AI_BEAM=8" is no longer the question.**

- Type: wayfinder:task
- Status: open
- Assignee: 
- Blocked by: [22](22-3v3-game-side.md), [33](33-species-art.md)
- Phase: Content Complete

## Deliverable

`TacticalAI.ts` (alpha-beta lookahead) is the per-turn cost and 3v3 widens it (deck-archetypes 3v3-optimisation got sims 52 s → 13 s with self-card dedup and `AI_BEAM=8` — confirm the GAME uses the same settings). Measure enemy-turn latency at 3v3 on a 2-core/low-end profile (Chrome CPU throttling 4×) — target < 1.0 s p95, and move the AI to a Web Worker if it exceeds it. framer-motion is imported in 16 of 24 components: profile a full fight for dropped frames. Bundle: report `dist/` size after ticket 02/33.

## Done when

Numbers recorded before/after; enemy turn p95 and frame-time p95 at 3v3 under the targets.

## Resolution

**AI half measured 2026-09-25 — and the number invalidates this ticket's own remedy. The motion and bundle halves are still open.**

### The p95 case, on the 28b trios

`scratch/t39_aicost.ts` builds the REAL gym boss fight (`rollGauntletFight` — `BOSS_IVS`, the gym's Driver, the deck the gauntlet fields) and times `getBestAction` call by call. **One DECISION is the unit, not one turn**, because that is what the UI blocks on: `BattleArena` calls the search once per action and it is synchronous on the main thread, so the freeze a player feels is one decision long.

Enemy-side decisions, Emberfall, 3v3:

| aiBeam | n | mean | p50 | **p95** | max |
|---|---|---|---|---|---|
| **0 (beamless — the gym's rung)** | 11 | 12,117 ms | 3,488 ms | **56,591 ms** | 56,591 ms |
| 8 (the wild/elite rung) | 11 | 1,928 ms | 2,588 ms | **3,252 ms** | 3,252 ms |

Against a target of **p95 < 1,000 ms**.

- **The beamless gym boss misses by 56×.** Summing its decisions, one enemy turn at the boss is over **two minutes**.
- **Beam 8 misses by 3.25×** — so it is not only the gym: every wild and elite is over target too, on this hardware.
- **The beam is worth 17× at p95.** That is the lever, and it is the one thing measured here that moves the number.

**Caveat, and it bounds every figure above:** a 2-core sandbox under `vite-node`, not Deck-class Chrome, and not the 4× CPU throttling this ticket names — so the absolute numbers are an upper bound. The RATIO between the two arms is the trustworthy part, and the gap to target is wide enough that a machine ten times faster still leaves beamless at ~5.7 s p95.

### A Web Worker does not fix this, and that is the finding

The deliverable says *"move the AI to a Web Worker if it exceeds it."* It exceeds. **But a Worker changes where the search runs, not how long it takes.** It would stop the main thread freezing — a real improvement, and `BattleArena` already carries two comments asking for it — and it would leave the player watching a **responsive UI for a two-minute enemy turn**, which is arguably worse than a freeze because a freeze at least ends.

So the Worker is a fix for the FREEZE and not for the LATENCY, and this ticket's target is a latency target. Nothing was implemented on that basis.

### What actually moves it is a ruling, not an engineering choice

The beam is a ladder rung — deck-archetypes 144 §2, *"the boss is the one fight worth the full search, and it is the one fight a player meets once"* — so the three options are Henry's:

1. **Give the gym a beam.** Directly attacks the 17×. Retires 144 §2's beamless rung.
2. **Keep beamless, add the Worker and a progress UI.** Honest about the wait instead of hiding it; does not meet the target.
3. **Bound the search by TIME rather than by width** — iterative deepening to a deadline. Keeps the full search wherever it is cheap and caps only the worst case, which is a CONDITION rather than an arbitrary number.

Raw output: `results/t39/gym-boss-beamless.txt`, `results/t39/gym-boss-beam8.txt`.

### Still open

- **framer-motion / dropped frames** in a full fight — not measured.
- **Bundle size** — `release-check` (ticket 40) now reports it on demand: **69 files, 1,990 KB**; `.js` 1,016 KB (51%), `.mp3` 675 KB (34%), `.png` 205 KB (10%), `.css` 87 KB (4%).

