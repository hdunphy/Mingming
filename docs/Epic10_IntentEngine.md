# Epic 10 Technical Specification: The Intent Protocol (Enemy AI & Balance)

This epic defines the transition of enemy behavior from a "Random Card" system to a "Telegraphed Move" system (Slay the Spire style) to prevent stun-locks and improve tactical fairness.

---

## **1. The Move-Set Pattern**

Instead of drawing from a deck, enemies will have a curated list of **Move Blueprints** defined in the `MingmingRegistry`.

### **1.1. Move Structure**
A Move is a named set of Actions and an associated "Intent" category.
- **Intent Types:** `Attack` (deals damage), `Defend` (adds shield/heals), `Debuff` (applies status), `Special` (Daemon/Complex logic).

### **1.2. The Move-Chain (Behavior Logic)**
Enemies follow a logic-based selection process rather than pure randomness:
- **Sequential:** [Move A -> Move B -> Move C].
- **Random-Weighted:** 60% Attack, 40% Buff.
- **Conditional Triggers:** If `HP < 50%`, use `EMERGENCY_REBOOT`.

---

## **2. The Intent System (Telegraphing)**

To prevent "Blind Deaths," the enemy's next move must be telegraphed to the player at the start of the turn.

### **2.1. UI Feedback**
- **Intent Icon:** A small hovering icon above the enemy MingMing (e.g., a Red Sword for an incoming Attack).
- **Damage Preview:** Shows the exact damage value (e.g., "⚔️ 45").
- **Intent Tooltip:** Hovering over the icon explains the effect (e.g., "Preparing to apply 2 stacks of Burn").

---

## **3. Preventing "Stun-Lock" (Action Economy)**

To solve the frustration of permanent CC, the engine will implement "System Resilience."

### **3.1. Diminishing Returns on CC**
- **The "Stability" Buff:** When a unit (Player or Enemy) recovers from **Sleep** or **Stun**, it gains a 1-turn status: **`STABLE_OS`**.
- **Effect:** While `STABLE_OS` is active, the unit is immune to hard CC (Sleep/Stun). 
- **Impact:** This ensures every unit is guaranteed a turn to act after being locked down.

---

## **4. Milestone Roadmap**

- [ ] **Milestone 10.1: Move-Set Registry:** Update the `MingmingRegistry` to support a `moves: IMove[]` array for enemy units.
- [ ] **Milestone 10.2: Intent Engine:** Implement the logic in `battleReducer` to pre-calculate the enemy's move at the start of their Pre-Turn.
- [ ] **Milestone 10.3: Intent UI HUD:** Add the intent icons and damage previews to the `MingmingUnit` card.
- [ ] **Milestone 10.4: CC Resilience:** Implement the `STABLE_OS` immunity logic to prevent infinite locking.
