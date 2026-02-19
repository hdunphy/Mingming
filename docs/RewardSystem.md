# Reward System & Economy Specification

This document defines the logic for post-battle loot, progression scaling, and the "Type-Based" farming economy.

---

## **1. The Strategic Loot Loop**

Loot is tied to the architecture and element of the defeated enemy. This encourages players to hunt specific elements to build their decks.

### **1.1. Card Rewards (The "Pick 1 of 3" Pattern)**
Instead of receiving all cards from a defeated party, the player is presented with a choice for each enemy defeated.
- **Pool Generation:** For each defeated MingMing, the system generates 3 random `Program` IDs from that MingMing's elemental pool (Element + None).
- **Rarity Weights:** Card selection is weighted by rarity:
    - **Common:** 70%
    - **Uncommon:** 20%
    - **Rare:** 8%
    - **Epic:** 2%
- **Player Choice:** The player selects **one** of the three cards to add to their inventory.

### **1.2. Blueprint Drop Scaling**
To ensure the player fills their roster early but faces a challenging grind for upgrades, the drop rate scales based on the current roster size.

| Roster Size | Blueprint Drop Rate | Purpose |
| :--- | :--- | :--- |
| **0-1** | 25% | Rapidly provide the first teammate. |
| **2** | 15% | Complete the "Active 3" party. |
| **3+** | 5% | Blueprints become rare "Firmware Upgrade" materials. |

---

## **2. Drop Table Logic (Dynamic)**

The `RewardSystem` no longer uses static drop tables. It filters the global `ProgramRegistry` on-the-fly.

### **2.1. Generation Logic**
- **Scrap Yield:** Randomized between 5-15 scraps per unit.
- **Card Pool:** Dynamically filtered from `ProgramRegistry` based on the unit's `primaryElement` and the neutral `None` element.
- **Weighted Selection:** Uses a tiered roll (Rarity first, then random card within tier).

### **2.2. Experience (XP) Calculation**
- **Base XP:** Defeated_Unit_Level * 20.
- **Distribution:** Divided equally among all allied MingMings who were **active** at the time of victory.

---

## **3. Scrap Economy & Synthesis**

Scrap is the primary "currency" for permanent progression.

### **3.1. Scrap Sources**
- **Battle Victory:** Direct scrap drops from defeated units.
- **Deconstruction:** Breaking down unwanted Programs in the Synthesis Lab.
    - **Common:** 10 Scraps
    - **Uncommon:** 25 Scraps
    - **Rare:** 50 Scraps
    - **Epic:** 100 Scraps

### **3.2. Synthesis Costs**
- **Compilation:** 1 Blueprint + 100 Scraps = 1 Level 1 MingMing.
- **OS Flashing (Epic 6):** 1 Blueprint of the same architecture = Switch Kernel/OS.

---

## **4. Technical Implementation Flow (Headless)**

1.  **`onBattleVictory`:** The engine passes the `defeatedParty` and the current `IPlayerSave` (for roster size check) to the `RewardSystem`.
2.  **`rollRewards`:** 
    - Executes Blueprint rolls with dynamic rates.
    - Executes Scrap range rolls.
    - Generates 3-card "Pick" arrays for each defeated unit.
3.  **`generateRewardBundle`:** Returns an `IRewardBundle` containing the fixed loot (scraps/blueprints) and the conditional choices (cards).
4.  **`applyRewards`:** Commits the selections to the Redux store.
