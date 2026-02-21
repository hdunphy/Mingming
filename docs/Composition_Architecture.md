# Composition-Based Logic Architecture (Hooks, Constraints, & Actions)

This document defines the unified composition pattern for the **Mingming** engine, allowing complex card logic, OS behaviors, and Relic effects to be built from reusable, data-driven components.

---

## **1. The Unified Component Model**

All game logic (Cards, OS, Daemons, Relics) is composed of three core blocks: **Triggers**, **Conditions**, and **Actions**.

| Component | Purpose | Examples |
| :--- | :--- | :--- |
| **Trigger** | *When* does the logic run? | `onActionStart`, `onTurnEnd`, `onCardDraw`. |
| **Condition** | *Under what rules* does it run? | `TargetHasStatus(Burn)`, `CostIs(0)`, `IsAlly`. |
| **Action** | *What* does it actually do? | `ApplyStatus`, `DealDamage`, `GenerateToken`. |

---

## **2. The "Blueprint" Registry Pattern**

To avoid redundancy and simplify the JSON data layer, we use a **Shared Library** approach. Instead of typing out logic, we reference component IDs.

### **2.1. Shared Libraries**
- **`constraints.json`**: Library of reusable conditions (e.g., `"not_stunned"`, `"target_burned"`).
- **`actions.json`**: Library of reusable effect blocks (e.g., `"basic_attack"`, `"heal_self"`).
- **`hooks.json`**: Library of reusable passive triggers (e.g., `"thorns_passive"`, `"energy_ramp"`).

### **2.2. Composition in Programs/OS**
A card or OS simply lists the IDs of the components it wants to "compose."

```json
{
  "id": "solar_flare",
  "name": "Solar Flare",
  "constraints": ["not_stunned", "energy_base"],
  "actions": [
    "basic_fire_strike",
    { "id": "bonus_damage", "when": "target_burned" } 
  ]
}
```

---

## **3. The Factory Implementation (Runtime Inflation)**

To maintain Redux compatibility while allowing OO-style logic, the engine uses a **Polymorphic Factory** during the "Inflation" step.

### **3.1. HookFactory (`HookFactory.ts`)**
- **Input:** A raw JSON definition from the library.
- **Output:** A functional `HookDefinition` that the `resolutionEngine` can execute.
- **Benefits:** Centralizes logic like "Target Resolution" and "Interpolation" so it isn't repeated in every hook.

### **3.2. ActionFactory (`ActionFactory.ts`)**
- **Input:** An action ID from `actions.json`.
- **Output:** A stateless `GameAction` instance (e.g., `AttackAction`, `StatusAction`).
- **Polymorphism:** The `battleReducer` simply calls `action.execute(state, context)`, allowing each action class to handle its own specific math (like scaling or multipliers).

---

## **4. Strategic Benefits**

1.  **DRY (Don't Repeat Yourself):** You define "What a Stun is" exactly once in `constraints.json`. 
2.  **Designer-Friendly Studio:** In the **Developer Toolkit (Epic 9)**, you don't write code; you pick "Actions" and "Constraints" from a list of blueprints.
3.  **Cross-System Synergy:** The exact same "Heal" action used by a Card can be used by an OS (like Ratatoskr's `GOSSIP_NODE`) or a Relic.
4.  **Mathematical Validation:** Because the logic is data-driven, the **Balance Auditor** can easily scan the "Action List" to calculate the card's power score without needing to parse complex TypeScript.

---

## **5. Next Steps for Implementation**

- [ ] **Step 1:** Consolidate `ProgramAction` and `DataHookDefinition` into a unified `EngineComponent` type.
- [ ] **Step 2:** Refactor `battleReducer.ts` to use `ActionFactory.create(id).execute()`.
- [ ] **Step 3:** Update the `CardStudio` UI to support "Blueprint Selection" for building new cards.
