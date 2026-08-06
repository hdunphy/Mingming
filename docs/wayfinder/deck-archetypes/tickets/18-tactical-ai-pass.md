# TacticalAI pass: stronger play, smoother measurements

- Type: wayfinder:grilling
- Status: closed
- Assignee: wayfinder (Claude session, 2026-08-06)
- Blocked by: —

## Question

Henry's second observation from the deck passes: the sims show **wild swings from single power points** — serpent's coil at 14/card produced a 29% win rate, at 15/card 66%, because the deterministic `TacticalAI` plays identically every game, so one damage threshold crossing flips whole families of seeds at once. Two goals, grilled together since they trade off:

1. **Play quality** — does the AI represent competent play? (If it misplays systematically — e.g. never holds a combo, ignores lethal, wastes triggers — the balance numbers measure the wrong game. The jormungandr pass suggested it under-uses contagion's ramp line.) Audit its evaluation against a few hand-analyzed positions; identify the top 2–3 systematic misplays worth fixing.
2. **Measurement smoothness** — options for killing the cliff artifacts, each with trade-offs to put in front of Henry:
   - **Seeded softmax/epsilon choice** (pick among near-best moves with seeded randomness): smooth distributions, kills cliffs, keeps determinism per seed — but the numbers become "average good play" rather than "optimal line", and every historical baseline shifts once.
   - **Seed-jittered stats** (vary IVs/level ±ε per seed): perturbs thresholds without touching the AI — cheaper, but muddies the everything-pinned discipline the suite was built on.
   - **More seeds** (100 → 300+): shrinks sampling error (±5 → ±3) but does nothing for cliffs; costs wall-clock (pairs with [Balance-sim performance](17-sim-performance.md), which should land first).
   - **Accept and document** (the current stance): treat 10–20% gaps as a watch band. Zero cost, but Henry has flagged wanting better.

Resolution: the chosen smoothing approach + the misplay fix-list, with before/after distributions on a known-cliff case (jormungandr v1 coil 14-vs-15 is the regression benchmark: after the fix, one power point should move the needle a few points, not 37). Implementation graduates as its own task. Note: any AI change re-baselines every committed balance number — coordinate with in-flight deck passes so it lands between species, not mid-tune.

## Resolution

Grilled with Henry 2026-08-06, backed by three instrumented experiments on the jormungandr §2.3 head-to-head (50 seeds paired; scratch harnesses, nothing committed). Both decisions land together as ONE re-baseline in [19-ai-measurement-upgrade](19-ai-measurement-upgrade.md), before any further species pass.

**Audit findings (the numbers):**

1. **The AI never plays v2's signature cards: contagion and capacitor were played 0 times in 100 battles (100% dead in hand).** Mechanism, not chance: `Energized` is absent from the eval's status table (worth 0 → a capacitor play never strictly beats passing), and Poison is valued linear −3/stack while the engine's poison is quadratic (1% maxHp/stack, decrementing: 8 stacks ≈ 79 eval points of future damage, the table counts 24) — contagion always loses the energy auction to direct damage. **The committed 66/34 jorm gap was measured with v2 playing 6 of its 8 cards.**
2. **The cliff is in the pinned stats, not the AI's tie-breaking.** Coil power sweep 10→18 under the argmax AI: 7/7/29/29/29/66/66/66/84 — perfectly flat plateaus (100/100 decisive, zero within-config variance), 22/37/18-point jumps. Every game runs identical level-15/IV-15 frames, so each kill threshold sits at the same HP in all 100 games and whole seed families flip at once.
3. **Seeded random-choice AI (epsilon band over near-best moves) is a NEGATIVE result — do not revisit.** Same plateaus, same breakpoints (band=10: 1/1/17/17/17/56/56/56/88), and it distorts the measurement: v1's storm drops 66→56 (band=10) →36 (band=20) because random play specifically punishes sequencing decks. More seeds is equally dead: plateaus are exact, extra seeds reproduce them.
4. **Seed-jittered IVs work.** Same jitter both sides (fair per game), derived from the battle seed (determinism intact), 15±5 on atk/def/hp: the staircase becomes a slope — 9/9/20/35/35/55/69/73/77, max single-point step 20 (was 37 at the coil 14→15 benchmark). Side-finding: at the current power 15 the jitter measurement reads jorm at **55/45 — compliant**; part of the committed 16% gap is pinned-stat artifact.
5. **Eval-fix prototype (quadratic poison + Energized≈25):** capacitor 63 plays, contagion 15 — and v2 *dropped* 34→29. With no lookahead the sim can't distinguish "ramp is tempo-negative on this curve" from "the AI plays ramp but can't cash a payoff it can't see" — the search ends at the turn boundary. That ambiguity is what the lookahead decision resolves.

**Decisions (Henry):**

- **Cliff fix: IV jitter 15±5** in the balance scenarios — same seed-derived roll for both sides, argmax AI untouched. Committed numbers become "win rate over a small stat neighborhood," which is closer to real play anyway.
- **Play quality: mechanics-aware eval + 1-turn lookahead.** Status values computed from what mechanics actually do (poison via its real tick formula, Energized via the energy→power conversion, and audit the rest of the hand-typed table — Burn/Regen have the same linear-vs-mechanic smell), plus the search peeks one turn past END_TURN so ramp is judged by what it enables. If v2 still loses with ramp it can actually cash, that is a true power-curve verdict on contagion/capacitor — retune then, not before.

Implementation graduates to [19-ai-measurement-upgrade](19-ai-measurement-upgrade.md) with the coil sweep as its regression benchmark. Until 19 lands, every committed §2.3 number keeps the 10–20% watch-band caveat.
