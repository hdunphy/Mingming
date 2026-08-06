# AI measurement upgrade: mechanics-aware eval, 1-turn lookahead, IV jitter

- Type: wayfinder:task
- Status: open
- Assignee: —
- Blocked by: [18-tactical-ai-pass](18-tactical-ai-pass.md) (closed — the decisions and all supporting numbers live there)

## Question

Implement ticket 18's two decisions as ONE re-baseline, before any further species deck pass:

1. **Mechanics-aware eval** (`TacticalAI.ts` `getEntityScore`): replace the hand-typed `STATUS_SCORES` constants with values computed from what each mechanic actually does. Poison: expected future damage from the real tick formula (1% maxHp × stacks, decrementing → maxHp/100 × S(S+1)/2, valued at the HP×2 exchange rate). Energized: the energy→power conversion (1e ≈ 40 power on the rev-3 curve). Audit the remaining table entries against their mechanics — Burn/Regen have the same linear-vs-mechanic smell; Strength/Sharp/Weak/Dazed are multiplicative and may deserve state-dependent values. Keep any remaining constants documented with their derivation.
2. **1-turn lookahead**: let the search evaluate sequences one turn past END_TURN — statuses tick, energy refills (Energized cashes), then value the best own reply next turn. **The next-turn hand is a chance node (Henry, 2026-08-06): value it as the expectation over possible draws** — own drawpile contents are fully known in the sim (only order is hidden), and with 8-card decks the outcome set is small, so compute it exactly or over a few seed-derived determinizations (deterministic either way). This is the useful kernel of expectiminimax without the framework; do NOT model the opponent's turn (hidden hand → perfect-info cheating or determinization, ×2+ cost, marginal accuracy in 5–6-turn battles — revisit only if v2-style decks still look mismeasured after this lands). ISMCTS was considered and rejected: stochastic move choice reintroduces exactly the measurement noise the epsilon experiment demonstrated, at 100–1000× the compute. Ramp gets judged by what it enables instead of a constant. Budget: keep total sim cost within ~2–4× (ticket 17's sharding + scoped mode absorb this); prune if needed.
3. **IV jitter 15±5** in `balanceScenarios.ts`: per-seed atk/def/hp IVs drawn deterministically from the battle seed, SAME roll for both sides (fair per game). Applies to mirrors, os-variance, and gauntlet alike.

**Regression benchmark (from 18):** the coil power sweep 10→18 on the jormungandr head-to-head. Pinned+argmax baseline: 7/7/29/29/29/66/66/66/84 (37-point cliff at 14→15). Jitter alone: 9/9/20/35/35/55/69/73/77 (max step 20). After eval+lookahead land, re-run the sweep — one power point should move the needle a few points, and the slope must stay monotone-ish. Prototype epsilon/random-choice AI is a documented negative result in 18 — do not resurrect it.

**Re-baseline duties:** full `npm run balance` commit; re-read every §2.3 gap (jitter alone read jorm at 55/45 — compliant) and the kraken numbers; revisit contagion/capacitor — if v2 still loses with ramp it can actually cash, that's a power-curve verdict and the cards get retuned (numbers move in 5s); update the watch-band guidance in the map if the cliffs are gone. Note: `TacticalAI` also drives `enemyMode: 'CARDS'` enemies in-game (rare — enemies ship on MOVES/intents), so player-facing impact is minimal but real; the eval change is a strict competence upgrade there.
