# Epic 7 Technical Specification: The Daemon Protocol (Power Cards & Expansion)

This epic focuses on expanding the card pool to support the archetypes defined in the Norse Expansion and introducing the "Daemon" (Power Card) system.

---

## **1. The Daemon System (Persistent Overlays)**

Daemons are a new class of Program that "install" themselves into a MingMing's memory for the remainder of the battle.

### **1.1. Card Mechanics**
- **Installation:** When played, the card is removed from the hand and moved to a `daemons` array on the `IBattleEntity`. It does NOT go to the discard pile.
- **Persistence:** The effect remains active as long as the MingMing is on the field. If the MingMing faints, the Daemon is uninstalled (discarded).
- **Execution:** Daemons use the **System Daemon** pattern (same as OS behaviors) to hook into battle events.

### **1.2. Example Daemons**
- **`RECURSION_DAEMON` (Water):** Whenever you play a 1-cost Water program, gain a 1-turn "Strengthened" stack.
- **`THERMAL_OVERLOAD` (Fire):** Increases the damage of Burn status by 50% but the host takes 5 damage per turn.

---

## **2. Content Expansion: Archetype Completion**

We will implement the remaining cards required to make the Norse archetypes viable.

### **2.1. Key Archetypes to Support**
- **Fire (Burn/Aggro):** Cards that "Consume" Burn stacks for massive burst.
- **Water (Stun/Control):** Cards that deal bonus damage to "Dazed" or "Stunned" targets.
- **Earth (Sharp/Reflect):** Cards that scale damage based on current "Sharp" stacks.
- **Nature (Ramp/Heal):** 0-cost programs that trigger utility effects.

---

## **3. The Encounter Engine v2**

Update the random encounter logic to prepare for the "Gauntlet" flow.

### **3.1. Encounter Scaling**
- **Tier 1 (Grants):** 1-2 MingMings, basic cards.
- **Tier 2 (Elites):** 3 MingMings, specialized OS behaviors enabled.
- **The "Breach" (Boss):** Curated decks with high-synergy Daemons.

---

## **4. Milestone Roadmap**

- [ ] **Milestone 7.1: Daemon Logic:** Update `IBattleEntity` and the `battleReducer` to support the "Persistent Overlay" card type.
- [ ] **Milestone 7.2: Card Registry Expansion:** Add the 50+ cards required to fill out the Norse archetypes.
- [ ] **Milestone 7.3: Dynamic Encounters:** Implement the Tiered encounter generator (Grunt -> Elite -> Boss).
