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

#### **Conditional Modifiers (Complexity Discount)**
To account for the "Setup Cost" of conditional effects, we apply multipliers to the bonus value of the effect:
- **Condition (Target Has Status):** 0.7x multiplier to the conditional action's value (e.g., Solar Flare's bonus damage).
- **Condition (Self Has Status):** 0.8x multiplier.
- **Condition (Positioning/Adjacency):** 0.6x multiplier.

#### **Scaling Logic (Estimated Value)**
For cards that scale, we assume a "Standard Mid-Turn" state for calculation:
- **CARDS_PLAYED Scaling:**
    - Assume **Average = 2.5 cards** for calculation.
    - **Single-Unit Constraint:** If scaling is based on *global* cards played, apply a **1.5x "Risk" Multiplier** to the score (flagging it for high variability).
    - **Local-Unit Constraint:** If scaling is restricted to the *specific MingMing's* card plays, apply a **1.0x** multiplier (preferred for balance).
- **HP_PERCENT Scaling:** Assume **50% HP** as the calculation baseline.

### 1.3. Target Thresholds
| Energy Cost | Target Score |
| :--- | :--- |
| 0 Energy | 2.0 - 3.5 |
| 1 Energy | 5.0 - 7.0 |
| 2 Energy | 10.0 - 13.0 |
| 3+ Energy | 18.0+ |

---

## 2. Automated Simulation Pipeline (Batch Testing)

Using the `SimRunner.ts` in a headless environment, we execute thousands of matches to find statistical outliers.

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

## 4. Proposed Tool: The Balance Auditor (`Auditor.ts`)

A CLI utility that runs these tests and generates a `balance_report.json`.

- **Input:** `programRegistry.json`, `mingmingRegistry.json`, `firmwareRegistry.json`.
- **Output:** A list of "Redline" cards that exceed their Energy Budget or have anomalous win rates in simulations.
