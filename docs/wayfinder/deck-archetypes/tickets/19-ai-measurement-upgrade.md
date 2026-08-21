# AI measurement upgrade: mechanics-aware eval, 1-turn lookahead, IV jitter

- Type: wayfinder:task
- Status: closed
- Assignee: wayfinder (Claude session, 2026-08-06)
- Blocked by: [18-tactical-ai-pass](18-tactical-ai-pass.md) (closed — the decisions and all supporting numbers live there)

## Question

Implement ticket 18's two decisions as ONE re-baseline, before any further species deck pass:

1. **Mechanics-aware eval** (`TacticalAI.ts` `getEntityScore`): replace the hand-typed `STATUS_SCORES` constants with values computed from what each mechanic actually does. Poison: expected future damage from the real tick formula (1% maxHp × stacks, decrementing → maxHp/100 × S(S+1)/2, valued at the HP×2 exchange rate). Energized: the energy→power conversion (1e ≈ 40 power on the rev-3 curve). Audit the remaining table entries against their mechanics — Burn/Regen have the same linear-vs-mechanic smell; Strength/Sharp/Weak/Dazed are multiplicative and may deserve state-dependent values. Keep any remaining constants documented with their derivation.
2. **1-turn lookahead**: let the search evaluate sequences one turn past END_TURN — statuses tick, energy refills (Energized cashes), then value the best own reply next turn. **The next-turn hand is a chance node (Henry, 2026-08-06): value it as the expectation over possible draws** — own drawpile contents are fully known in the sim (only order is hidden), and with 8-card decks the outcome set is small, so compute it exactly or over a few seed-derived determinizations (deterministic either way). This is the useful kernel of expectiminimax without the framework; do NOT model the opponent's turn (hidden hand → perfect-info cheating or determinization, ×2+ cost, marginal accuracy in 5–6-turn battles — revisit only if v2-style decks still look mismeasured after this lands). ISMCTS was considered and rejected: stochastic move choice reintroduces exactly the measurement noise the epsilon experiment demonstrated, at 100–1000× the compute. Ramp gets judged by what it enables instead of a constant. Budget: keep total sim cost within ~2–4× (ticket 17's sharding + scoped mode absorb this); prune if needed.
3. **IV jitter 15±5** in `balanceScenarios.ts`: per-seed atk/def/hp IVs drawn deterministically from the battle seed, SAME roll for both sides (fair per game). Applies to mirrors, os-variance, and gauntlet alike.

**Regression benchmark (from 18):** the coil power sweep 10→18 on the jormungandr head-to-head. Pinned+argmax baseline: 7/7/29/29/29/66/66/66/84 (37-point cliff at 14→15). Jitter alone: 9/9/20/35/35/55/69/73/77 (max step 20). After eval+lookahead land, re-run the sweep — one power point should move the needle a few points, and the slope must stay monotone-ish. Prototype epsilon/random-choice AI is a documented negative result in 18 — do not resurrect it.

**Re-baseline duties:** full `npm run balance` commit; re-read every §2.3 gap (jitter alone read jorm at 55/45 — compliant) and the kraken numbers; revisit contagion/capacitor — if v2 still loses with ramp it can actually cash, that's a power-curve verdict and the cards get retuned (numbers move in 5s); update the watch-band guidance in the map if the cliffs are gone. Note: `TacticalAI` also drives `enemyMode: 'CARDS'` enemies in-game (rare — enemies ship on MOVES/intents), so player-facing impact is minimal but real; the eval change is a strict competence upgrade there.

## Resolution

Landed 2026-08-06. Gates: 740/740 vitest, tsc -b, vite build, full `npm run balance` committed (registry unchanged `1:72f1406e` — no card/deck data touched; every NUMBER re-baselined, as planned).

**1. Mechanics-aware eval** (`TacticalAI.ts`): the hand-typed `STATUS_SCORES` table is gone. Every status is valued in one currency (2 points/HP) from its actual mechanic: Poison = exact quadratic future damage (maxHp/100 × S(S+1)/2), Burn = tier-table walk (2/5/12% decaying), Regen = 3%-quadratic capped at missing HP, Energized = energy→throughput conversion, Str/Weak/Sharp/Dazed = the Hooks.ts capped 2%/stack applied to a 20%-maxHp/turn throughput over a 2.5-turn horizon, Stunned/Asleep = full turns of throughput (Stunned was -8, is now ≈ -0.4×maxHp — it was drastically undervalued), BarkShield = decay-discounted face value. Constants documented inline with derivations.

**2. 1-turn lookahead with expectation-over-draws**: the same-turn search now returns its top-3 first-action candidates; each is re-ranked by the board one full turn later — our END_TURN (ticks), opponent modeled as passing (their ticks still run; their real reply would need their hidden hand — rejected per the amendment), our refill (Energized cashes) and a **determinized draw** (own drawpile contents are known, order isn't: mean over 2 seed-derived reshuffles), then a depth-2 best reply. Cost prunings: lethal short-circuit, dominance margin (skip when the top candidate leads by >12 points), and greedy-only past turn 30 (stall mirrors were the wall-clock sink). Determinism verified: PRNG-keyed on battle seed only.

**3. IV jitter 15±5** (`balanceScenarios.BALANCE_STAT_JITTER`, applied by `runBatch.applyStatJitter`): per-seed atk/def/hp rolls, same for both sides, clamped 0–31, schema field `statJitter` (recorded scenario files replay unjittered — only batch runs jitter). Honest caveat measured during the pass: ±5 IVs move a level-15 stat by <1 point (stat formula floors at ±0.75), so the jitter smooths mostly through rounding thresholds; ±10 was swept for comparison (14→15 step: 15 vs 22 points) and the knob is one constant if Henry wants more.

**Benchmark (the ticket's regression gate):** coil sweep 10→18 went from plateaus **7/7/29/29/29/66/66/66/84** (37-pt cliff) to a monotone slope **14/14/34/43/44/66/77/82/86** — the 14→15 benchmark step is 22 points (watch-band scale, no longer a cliff), every step ≤22, no flat-plateau structure. Full-suite cost: **3m36s → 11m15s (3.1×)** on the 2-core sandbox, inside the 2–4× budget; scoped `BALANCE_ONLY` runs remain seconds.

**The measurement corrections the new instrument reports (all pre-existing truths the blind AI hid):**

- **kraken §2.3: 50/50 → 8/92 v2-favored.** v2's SURGE ramp finally functions: capacitor first play turn 1.2, hydro_blast/maelstrom cashed turn ~2.6. The pilot's 50/50 was tuned against an AI that never played capacitor (0 plays in 100 audited battles). Kraken mirror stays clean (50/50, 4.5 turns, 0 draws — the old 400/400 draw stall is gone under the new AI).
- **jormungandr §2.3: 66/34 v1-favored (unchanged headline, different mechanism).** v2 now plays contagion/capacitor with sensible timing (first plays turn ~4) and still loses — with ramp it can actually cash, this is now a genuine power-curve verdict on the VENOM_TRENCH deck, not an AI artifact. Mirror 48/52 healthy.
- Report totals: 31 redlines (19 card budget, 12 matchup) vs 33 before; stall mirrors reduced to the usual untuned suspects (audhumbla/gullinbursti/hel/nidhoggr/huldra).

**Spawned:** [20-water-retune-under-new-ai](20-water-retune-under-new-ai.md) — both Water species need a card-level retune under the corrected instrument (kraken v1 up / v2 down; jorm v2 up), Henry-reviewed, numbers in 5s.
