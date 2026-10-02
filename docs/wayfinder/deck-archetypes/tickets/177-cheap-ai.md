# Ticket 177: A cheap battle AI, distilled from the full one

> **CLOSED 2026-10-02 (housekeeping, at the move to `first-impressions`).** Every row is built: 177a–177e (`62a6b1f..2f8c2f5`). The status line below is kept as history. The cheap AI was built and **missed its bar** (24.8% wins against the lite AI's 37%; see the Claude project doc "ticket-177-outcome"), so ticket 178 is parked.

**Type:** AI and balance tooling. **Status:** OPEN, **queued behind ticket 170; do not start until Henry says go.** Decisions C1–C3 below have recommended defaults; build those unless Henry rules otherwise.

**Henry (2026-10-01):** *"With some of those longer running balance algorithms, should we look to build a cheap AI for enemies that doesn't use brute force and follows an algorithm or set of rules to play cards? Can we use ML/RL AI here to create that rule set?"*

**The approach: distillation, not reinforcement learning.** Let today's search AI play thousands of positions, record what it chooses, and fit a cheap policy that copies it. Reinforcement learning (self-play) is rejected for now: the action space (card sequences × targets) is huge, draws and hands are hidden, and every balance ticket would make a trained model stale.

---

## Why

- **The full AI is expensive.** `getBestAction` (`src/engine/ai/TacticalAI.ts`) enumerates whole same-turn card sequences (`findBestSequence`, `MAX_DEPTH = 3`, beam `GAME_BEAM_WIDTH = 8`), then re-ranks the best with a one-turn lookahead (`lookaheadValue`). At 3v3 that was measured at about 16,677 reducer simulations per decision, and a boss decision takes up to about 2.5 s (166f).
- **Every long balance job pays that cost:** the walker, the tier ladder (169j, "hours of compute") and the deck search (ticket 178).
- **The cheap policy** looks at single legal actions one at a time: simulate each once, score it with a weighted list of named features, play the best, and repeat until ending the turn is best. That's tens of simulations per action instead of thousands.

## Decisions (recommended defaults first)

- **C1. The cheap policy is a weighted feature list.** The fitted weights print as a readable table ("kills a target: +40 · damage dealt per 10: +2 · …"), and Henry can read and hand-edit it. The alternative is a decision tree: more expressive, harder to read and to fit without a library.
- **C2. It qualifies as the balance-tooling AI when:**
  - its win rate against the full AI is **at least the `lite` tier's** win rate against the full AI, on the same paired matchups
  - it is **at least 10× faster** per decision than `lite`

  If it misses the bar, it is reported, not tuned toward it.
- **C3. Real enemies do not use it in this ticket.** It's an `AiTier` option for simulations and the walker only. Whether wild enemies in the shipped game use it is a later ruling, from 177d's numbers.

---

## How to work this ticket

1. **Read the whole row first.** Search for the quoted names; line numbers drift.
2. **Test first, run it on the parent, see it fail.** Put "fails on parent: yes" in the commit message.
3. **The shipped AI must not change.** Every existing tier (`greedy`, `lite`, `full`) must play byte-identically after this ticket. Row 177a proves it.
4. **Do not change anything a row does not list.** If a row seems to need something it does not name, stop and ask Henry.
5. **Gate:** `npm run gate` green before each commit. **Commits** authored as Henry (`git -c user.name='Henry Dunphy' -c user.email='hdunphy15@gmail.com' commit ...`), no `Co-Authored-By`, last line `HANDOFF: <one sentence>`. **Do not push.**
6. **Small single-purpose modules** under `src/engine/ai/cheap/`: features, policy, weights, fitting. Don't grow `TacticalAI.ts`.
7. **Engine purity:** no React, Redux, `Math.random` or `Date.now()` in `src/engine`. All randomness goes through seeded PRNGs.
8. **Generated datasets are not committed** (they're large). Commit the generator and a small fixture for tests. Write data under `results/cheap-ai/`.
9. **Report** in plain English at the end, with 177d's table.

| Row | What |
|---|---|
| 177a | Extract legal-action enumeration into its own module (no behaviour change) |
| 177b | The feature list, and the cheap policy that plays by weights |
| 177c | Record the full AI's choices, and fit the weights to copy them |
| 177d | Measure: agreement, win rate and speed against `full` and `lite` |
| 177e | Make `cheap` a tier the walker and balance runs can choose |

---

## 177a: Legal actions in their own module

1. **`src/engine/ai/legalActions.ts`** (new): `legalActions(state: IBattleState, side): BattleAction[]`. Every single play available right now: each playable card in hand, by each eligible caster, at each valid target, plus `END_TURN`.
   - Move the enumeration that lives inside `findBestSequence` in `TacticalAI.ts` (the ordered hand, the copy dedupe by `dataId|currentCost|growth`, the target selection) into this function, **keeping its order exactly**.
   - `findBestSequence` then calls it.
2. **Test that nothing changed:**
   - `enumerationOrder.test.ts` and the AI tests pass untouched.
   - Add a determinism test: 20 fixed fights (EA decks against each other and against each gym's boss fight, both sides on `full`) produce the same final state hash on the parent and after this row. Compute the hashes on the parent first and paste them into the test.
3. **Test:** for a hand-built state, `legalActions` lists the expected actions in the expected order, and a stunned caster or an unaffordable card contributes none.

## 177b: Features, and the cheap policy

1. **`src/engine/ai/cheap/features.ts`:** `actionFeatures(before: IBattleState, after: IBattleState, action, side): Record<FeatureName, number>`. `after` is the state after applying the action with the reducer. Start with this fixed list, all computed from the two states, all from the acting side's point of view:
   - `enemyHpRemoved` (total HP taken off enemies, /100) and `allyHpLost` (/100)
   - `enemyKills` and `allyDeaths`
   - `overkill` (damage beyond 0 HP, /100)
   - `shieldGained` (Bark Shield and similar absorbs on allies, /100)
   - `enemyStatusValue` and `allyStatusValue`: change in summed `statusValue(type, stacks, entity)`. It's already exported from `TacticalAI.ts`; reuse it.
   - `energySpent`, `energyLeft` and `cardsDrawn`
   - `lowestEnemyHpFraction`: after the action, the lowest living enemy's HP fraction
   - `isEndTurn` (1 for `END_TURN`, else 0)
   - `evalDelta`: change in the full AI's `evaluateState`. Export `evaluateState` from `TacticalAI.ts` for this; exporting is the only change to that file.
2. **`src/engine/ai/cheap/weights.json`:** one weight per feature. A first hand-set version: `enemyHpRemoved 1`, `enemyKills 3`, `allyDeaths -5`, `evalDelta 0.05`, everything else 0. Validated by a zod schema in `weightsSchema.ts`.
3. **`src/engine/ai/cheap/cheapPolicy.ts`:** `cheapBestAction(state, weights)`.
   - For each action in `legalActions`, apply it with `battleReducer` once (event bus muted, as `getBestAction` does), compute the features, and score `Σ weight × feature`.
   - Return the highest-scoring action. Ties go to the earlier action in `legalActions` order.
   - `END_TURN` is scored like any other action (its `after` is the state after ending the turn).
4. **Tests:** on hand-built states it takes a lethal hit over a non-lethal one when `enemyKills` has a positive weight; it ends the turn when every play scores below `END_TURN`; same state and weights always give the same action.

## 177c: Record the teacher, fit the weights

1. **`src/debug/balance/cheapAi/recordTeacher.ts`:** play fights with **both sides on `full`**. At every decision, record:
   - the state's legal actions and each action's feature vector (177b)
   - which action the full AI chose: the first action of its chosen sequence, i.e. `getBestAction`'s return value

   Write JSONL to `results/cheap-ai/teacher-<n>.jsonl`.
   - **Matchups:** each EA starter deck against each other, plus each against each gym's boss fight (`rollGauntletFight`, fight 3), 3v3 where the setup allows, on fixed seeds.
   - **Size:** a CLI flag. Default 2,000 fights; that's an overnight job. Print progress.
2. **`src/debug/balance/cheapAi/fitWeights.ts`:**
   - Fit the weights so the teacher's choice gets the highest score: a softmax over each decision's legal actions (multinomial logistic regression), plain gradient descent, L2 regularisation 0.01, a fixed seed, no dependencies.
   - Hold out 20% of decisions (split by fight, not by decision) for testing.
   - Write the result to `src/engine/ai/cheap/weights.json`.
   - Print the weights as a readable table sorted by size, plus top-1 agreement on the held-out decisions.
3. **Tests:**
   - on a synthetic dataset where the teacher always picks the action with the highest `enemyKills`, the fit gives `enemyKills` the largest weight and reaches ≥ 95% held-out agreement
   - the fit is deterministic for a fixed seed

## 177d: Measure it

**`src/debug/balance/cheapAi/cheapAi.balance.ts`** (runs under `npm run balance`; it measures and does not assert C2) writes `docs/balance/cheap-ai-177.md` (LF) with:

1. **Agreement:** held-out top-1 agreement with `full`, and the same number for `greedy` and `lite`, so the cheap AI's score has a comparison.
2. **Strength:** paired batches (`runPairedBatch`, both orientations, the same seeds) over the 177c matchups:
   - `cheap` vs `full`
   - `lite` vs `full`
   - `greedy` vs `full`
   - `full` vs `full` (the baseline, should be about 50%)

   Win rate of the first-named AI, with a 95% interval.
3. **Speed:** mean and 95th-percentile milliseconds per decision for each tier, at 1v1 and 3v3.
4. **The verdict line:** whether C2's bar is met, with the two numbers it compares. **Do not tune the features or weights toward the bar.** If it misses, report it, and list which feature you would add next and why.

## 177e: `cheap` as a tier for simulations

1. `AiTier` (`TacticalAI.ts`) becomes `'greedy' | 'lite' | 'full' | 'cheap'`. In `getBestAction`, when the active side's tier is `cheap`, return `cheapBestAction(state, weights)` (after the existing intent and `MOVES` early-returns).
2. **The player side's tier today comes only from the process default** (`AI_TIER`, from environment variables). Add `playerAiTier?: AiTier` to `IBattleState` beside `enemyAiTier` (`types.ts`), read in `tierFor`. Undefined keeps today's behaviour exactly.
3. **`runOne` / `runBatch` and the walker's `WalkInput`** get optional `playerAiTier` and `enemyAiTier` that reach the battle state. Left out, every existing result is byte-identical (the 177a determinism test covers this).
4. **Nothing in `src/ui` or the shipped enemy ladder (`ENEMY_LADDER` in `encounter.ts`) changes** (C3).
5. **Tests:** a fight with `playerAiTier: 'cheap'` calls the cheap policy (spy) and finishes; with it unset, the 177a hashes still match.

---

## Done when

- `cheap` is a selectable tier for simulations and the walker, and the shipped AI is unchanged.
- `docs/balance/cheap-ai-177.md` gives agreement, win rate and speed against `full`, `lite` and `greedy`, and says whether C2's bar is met.
- The fitted weights are committed and print as a readable table.

## Resolution

Closed 2026-10-02: all rows built on `playtest-polish` (`62a6b1f..2f8c2f5`), merged to `main` in PR #13. The cheap AI was built and **missed its bar** (24.8% wins against the lite AI's 37%; see the Claude project doc "ticket-177-outcome"), so ticket 178 is parked.
