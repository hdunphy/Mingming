# Balance Testing & Heuristic Evaluation

This document defines the strategy for maintaining competitive integrity and strategic depth in *Mingming* through automated simulations and mathematical modeling.

---

## 1. The Card Budget Heuristic (Static Analysis)

To ensure cards are balanced before they hit the simulation, we use a weighted value formula.

### 1.1. The Formula
`Score = (Power / 10) * Multiplier_Bonus + (Status_Weight * Stacks) + (Utility_Bonus)`

### 1.2. Weighting Constants & Modifiers

#### **Base Weights**
- **Damage:** 1.0 per 10 Power.
- **Burn/Poison:** 1.5 per stack (Dot value).
- **Dazed/Weakened:** 2.0 per stack (Mitigation value).
- **Stun/Sleep:** 5.0 (Turn-skip value).
- **Card Draw:** 4.0 per card.
- **Energy Gain:** 6.0 per Energy.

#### **Status & Utility Weights (Dynamic Adjustments)**
- **Card Draw:** 
    - 1st Card: +4.0
    - 2nd Card (on same program): +2.5
    - 3rd+ Card: +1.0 (Accounts for Hand Limit risk).
- **Crowd Control (Sleep/Stun):**
    - 1st Stack: +5.0 (High value for turn skip).
    - Additional Stacks: +0.5 (Diminishing returns as target is already incapacitated).
- **Exhaust/Token Penalty:** 
    - Apply a **0.9x multiplier** (Discount) to the card's final score if it has the `Exhaust` keyword or is a generated `Token`.

#### **Complexity Modifiers (Setup Discount)**
To account for the "Setup Cost" of conditional effects, we apply multipliers to the bonus value of the effect:
- **Condition (Target Has Status):** 0.7x multiplier to the conditional action's value (e.g., Solar Flare's bonus damage).
- **Condition (Self Has Status):** 0.8x multiplier.
- **Condition (Positioning/Adjacency):** 0.6x multiplier.

#### **Target Scope Modifiers (AOE vs Single)**
The score must reflect how many entities an action affects:
- **Single Target:** 1.0x (Baseline).
- **Self:** 0.9x (Small discount as it doesn't advance board state directly).
- **Side (3 units):** 2.2x multiplier (Reflects that hitting 3 targets is powerful but often hits overkill or lower-value targets).
- **All (6 units):** 4.0x multiplier.

#### **Persistence & Duration Modifiers**
- **Daemon (Persistent Power):** Final card score receives a **1.5x "Longevity" Multiplier**. These cards are slow to play but provide value every turn.
- **Exhaust/Token Penalty:** Apply a **0.9x multiplier** (Discount) to the card's final score if it has the `Exhaust` keyword or is a generated `Token`.

#### **Scaling Logic (Estimated Value)**
For cards that scale, we assume a "Standard Mid-Turn" state for calculation:
- **CARDS_PLAYED Scaling:** Assume **Average = 2.5 cards** for calculation.
- **HP_PERCENT Scaling:** Assume **50% HP** as the calculation baseline.
- **DISCARD_SIZE Scaling:** Assume **Average = 8 cards** in discard.
- **STAT_BASED Scaling:** Assume **Level 10 Stat Baseline** (e.g., Attack = 25).

#### **Status Weights (Budgeting Strategy)**
To maintain balance across costs, use the following "Net Status" targets (where 1 Net Status ≈ 2.0 Score points). 

- **0 Energy:** 0.5 Net Status (e.g., 1 Good + 1 Bad, or 1 weak stack like Dazed).
- **1 Energy:** 2.0 Net Status (e.g., 2 Stacks of Poison, or 1 Stun with a downside).
- **2 Energy:** 4.5 Net Status (e.g., 3 stacks of Burn + 1 Weakened).
- **3 Energy:** 8.0+ Net Status (e.g., AOE Status or 2-turn hard CC).

#### **Hard CC Exceptions (Sleep/Stun)**
Crowd Control affects the "Action Economy" and must be budgeted differently:
- **Stun (1 turn):** Costs **5.0 points**. It should almost never appear on a 0-cost card without a massive penalty (e.g., "Stun target, but Stun self").
- **Sleep:** Costs **4.0 points**. Cheaper than Stun because it can be broken by damage. This allows for "Dream-Eater" archetypes where you sleep a target to set up a non-damaging debuff.

### 1.3. Target Thresholds
| Energy Cost | Target Score |
| :--- | :--- |
| 0 Energy | 2.0 - 3.5 |
| 1 Energy | 5.0 - 7.0 |
| 2 Energy | 10.0 - 13.0 |
| 3+ Energy | 18.0+ |

---

## 2. Automated Simulation Pipeline (Batch Testing)

Using `src/debug/balance/runBatch.ts` in a headless environment, we execute thousands of matches to find statistical outliers. Run them with `npm run balance` (vitest, `vitest.balance.config.ts`, matching `*.balance.ts` only — `npm test` and `npm run build` never see these).

### 2.1. "The Mirror Test"
- **Setup:** Two identical MingMings and Decks fight 100 times with randomized seeds.
- **Goal:** Verify that the Tactical AI is performing consistently for both sides. Win rates should be ~50%.

### 2.2. "The Archetype Gauntlet"
- **Setup:** A "Control" deck (e.g., Kraken Poison) vs. the rest of the Registry.
- **Metrics:**
    - **Win Rate:** If >70%, the archetype is overtuned.
    - **Average Turn Count:** If turns > 30, the archetype is too slow/stalling (unfun).
    - **Dead Card Ratio:** How many cards in the hand were never played? (Identifies "trap" cards).

### 2.3. OS Variance Audit
- **Setup:** Same deck, different OS.
- **Goal:** OS v1 and OS v2 should offer different *playstyles*, not different *power levels*. If one OS consistently outperforms the other by >15%, the weaker one needs one buff or a lower cost.

---

## 3. "Toxic" Combination Detection

The Auditor flags specific combinations of Programs and OS variants that break the game loop.

- **Permanent Stun Lock:** Combinations that prevent the enemy from taking an action for 3+ consecutive turns.
- **Infinite Energy Loops:** Card sequences that result in a net-positive Energy gain (allowing infinite turns).
- **Zero-Interaction Wins:** Strategies that win before the opponent can play their first card (FTK - First Turn Kill).

---

## 4. The Balance Auditor

Runs these tests and generates a `balance_report.json`.

- **Input:** `programRegistry.json`, `mingmingRegistry.json`, `firmwareRegistry.json`.
- **Output:** A list of "Redline" cards that exceed their Energy Budget or have anomalous win rates in simulations.

Implemented in `src/debug/balance/balanceReport.ts`, run by `npm run balance` (as a vitest
`globalSetup` teardown, so it also writes after a red run — which is the run whose report you want).

- `docs/balance/balance_report.json` — **committed and overwritten each run.** The sims are seeded
  and the file records no timestamp, so it is stable: change a card, rerun, and `git diff docs/balance/`
  is the answer to "what did that do".
- `docs/balance/balance_redlines.csv` — one row per redline.
- `docs/balance/balance_matchups.csv` — one row per simulated matchup, every metric, for sorting in a
  spreadsheet.

§1's budget formula lives in `src/debug/balance/powerscale.ts` and is the same code the Card Studio
panel renders, so the panel and the committed report cannot disagree about a card's score.

> `src/engine/sim/Simulator.ts` and the Balance Laboratory panel are **not** part of this pipeline.
> They are a closed-form TTK approximation (zero-IV units, no statuses, hooks, cards or AI), kept
> because they are instant enough to recompute as a slider drags. When they disagree with
> `balance_report.json`, the report is the balance answer.
