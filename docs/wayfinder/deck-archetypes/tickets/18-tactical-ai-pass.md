# TacticalAI pass: stronger play, smoother measurements

- Type: wayfinder:grilling
- Status: open
- Assignee: —
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
