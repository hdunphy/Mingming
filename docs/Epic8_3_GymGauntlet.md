# Epic 8.3 Technical Specification: Gym Gauntlet System

The Gym Gauntlet is a progression-based "Endurance Mode" where players face a sequence of three battles with persisting resources.

---

## **1. Gauntlet Structure**

A Gym consists of three discrete battle tiers:
1.  **Tier 1: Junior Developer (Grunt)** - Basic party size (1-2), standard element cards.
2.  **Tier 2: Senior Developer (Elite)** - Full party (3), synergistic decks, OS v1 enabled.
3.  **Tier 3: System Admin (Gym Leader)** - Hand-crafted boss deck, Boss OS, and installed Daemons.

---

## **2. Endurance Mechanics (State Persistence)**

Unlike standard encounters, HP and Energy do **not** reset between Gym battles.

### **2.1. The Persistence Rules**
- **HP Carry-over:** A unit starts Battle 2 with exactly the HP it had at the end of Battle 1.
- **Energy Carry-over:** Current energy levels are preserved between fights.
- **Fainted Units:** If a unit faints in Battle 1, it remains fainted for the rest of the Gym (unless revived mid-combat by a card effect).
- **The Pit Stop:** Between battles, the player is returned to a limited **Management Screen** where they can swap the active deck or use inventory items, but they **cannot** heal for free.

---

## **3. Multi-Element "Diversity" Gyms**

To ensure the game doesn't become a "one-strategy" experience, Gyms utilize a **Multi-Type Challenge** approach.

### **3.1. Gym Composition**
Instead of a single type, each Gym is themed around a **Type Synergy Pair**.
- **The Fire/Earth Gym:** Combines Burn damage with Sharp reflect.
- **The Water/Nature Gym:** Combines Stun-lock with constant team healing.
- **The Ice/Dark Gym:** Combines Energy taxation with permanent Poison.

### **3.2. Strategic Incentive**
By mixing elements, the player cannot bring a single "Super Effective" counter (e.g., a Water deck) to win easily. They must build a diverse, high-utility deck that can handle multiple elemental threats in a single run.

---

## **4. Rewards & Unlocks**

### **4.1. The System Breach (Unlock)**
Upon defeating the Gym Leader:
- **Sector Unlock:** A new elemental Training Sector is permanently unlocked in the `SectorTerminal`.
- **Relic Drop:** The player chooses 1 of 3 rare **Relics** provided by the Leader.

---

## **5. Milestone Roadmap**

- [ ] **Milestone 8.3.1: Gauntlet State Store:** Update the `IPlayerSave` to track `currentGymProgress` and `persistedEntityStats`.
- [ ] **Milestone 8.3.2: Multi-Type Encounter logic:** Update the generator to allow "Hybrid Element" enemy parties.
- [ ] **Milestone 8.3.3: The Gym Leader Registry:** Define hand-crafted boss encounters for the 4 primary Gyms.
- [ ] **Milestone 8.3.4: Endurance Transition:** Implement the logic in `battleSlice` to initialize new battles using persisted stats instead of max stats.
