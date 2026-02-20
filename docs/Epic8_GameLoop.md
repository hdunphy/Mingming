# Epic 8 Technical Specification: The Gauntlet & The Gym (Game Loop)

This epic defines the transition from a battle engine into a full game loop consisting of "Training Grinds" (Random Encounters) and "Progression Checks" (Gym Gauntlets).

---

## **1. The Random Encounter System (Training & Farming)**

The player chooses an elemental "Sector" to farm specific cards and Blueprints. This loop is designed for party leveling and deck construction.

### **1.1. Selection UI**
- **Type Selection:** The player is presented with the 8 Elemental types (only unlocked types are selectable).
- **Sector Preview:** Shows potential rewards (e.g., "Fire Sector: High chance for Fenrir/Skoll Blueprints and Fire-type Programs").

### **1.2. Generation Logic**
- **Type Matching:** All enemies generated in a chosen sector must share that element.
- **Party Size:** A random integer between 1 and the Player's current active party size.
- **Level Scaling:** Enemy level = `Average_Active_Party_Level + variance(-2 to +2)`.
- **Deck Generation:** 
    - The system pulls random cards from the `ProgramRegistry` filtered by the selected Element.
    - Includes 2-3 "Neutral" utility cards for AI consistency.
- **MingMing Selection:** Randomly picks from the MingMings assigned to that element in the `MingmingRegistry`.

---

## **2. The Gym Gauntlet (Progression & Challenge)**

Gyms act as "Gates" to new content and provide permanent Relic rewards. They test the player's endurance and resource management.

### **2.1. The Tiered Structure**
- **Gauntlet Logic:** A Gym is a sequence of 3 battles without automatic healing in between.
- **State Persistence:** HP and Energy levels persist across all 3 battles. The management screen is accessible between fights (to swap cards or use items), but health is not restored.
    - **Battle 1:** Junior Developer (Grunt - basic deck).
    - **Battle 2:** Senior Developer (Elite - synergistic deck + OS v1).
    - **Battle 3:** System Admin (Gym Leader - Curated Deck + Boss OS + Daemons).

### **2.2. Unlock Progression**
- **Initial State:** Only Fire, Water, and Earth sectors are unlocked.
- **The Reward:** Defeating a Gym Leader unlocks a new elemental sector for Training and grants a **Relic**.
    - *Example:* Defeating the Air Gym unlocks the Air Sector and grants the "Gale Core" Relic.

---

## **3. The Relic System (Permanent Upgrades)**

Relics are permanent "Hardware Modules" that provide passive, run-wide bonuses during battle.

### **3.1. Implementation**
- **Storage:** A `relics: string[]` array in the `IPlayerSave`.
- **Execution:** Relics are treated as "Global Daemons." They use the **System Daemon** pattern to hook into battle events via the `resolutionEngine`.
- **Example Relics:**
    - `Expansion Slot`: Start every battle with +1 Max Energy.
    - `Heatsink`: Reduces the recoil damage by 50%.
    - `Buffer Cache`: Draw +1 additional card at the start of every turn.

---

## **4. Milestone Roadmap**

- [ ] **Milestone 8.1: Encounter Generator:** Build the logic to spawn randomized enemy parties (levels, decks, size) based on a selected Element.
- [ ] **Milestone 8.2: Terminal Hub UI:** Create the main navigation interface to choose between elemental Training sectors and The Breach (Gyms).
- [ ] **Milestone 8.3: Gauntlet Persistence:** Implement the state logic to carry over HP/Energy between battles in a Gym sequence.
- [ ] **Milestone 8.4: Relic Integration:** Add the Relic state to the save system and hook the first batch of passive rewards into the resolution engine.
