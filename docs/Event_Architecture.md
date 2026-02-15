# Event-Driven Architecture & Resolution Logic

This document defines the systemic rules for the **Mingming** Event Bus, ensuring modular card logic while maintaining deterministic order of operations.

---

## **1. The Resolution Stack (Priority Layers)**

To prevent "Race Conditions" and logic conflicts, events are processed in synchronous priority layers. Each hook must be assigned a `Priority` integer.

| Layer | Priority | Example Hooks |
| :--- | :--- | :--- |
| **System** | 100 | Check for `Asleep`, `Stunned`, or `Fainted` status (Action Cancellation). |
| **Global** | 75 | Weather effects, Field modifiers (e.g., "Rain" type-shifting). |
| **Attacker** | 50 | Offensive buffs (`Strengthened`), Item/Passive damage boosts. |
| **Program** | 40 | The core logic of the card itself (Power calculation). |
| **Defender** | 25 | Defensive buffs (`Sharp`), Retaliation passives, Shields. |
| **Logging** | 0 | UI feedback, Stat tracking, Combat logs. |

---

## **2. The Mutation Lifecycle (Snapshot Pattern)**

To ensure absolute determinism and prevent "Mid-Event Mutation" bugs:

1. **Snapshot:** At the start of an event (e.g., `onDamageTaken`), the engine captures a read-only snapshot of the relevant MingMings.
2. **Evaluation:** All hooks in the priority stack are executed. They do **not** change the state directly. Instead, they return a `MutationRequest` object.
3. **Commit Phase:** The Reducer aggregates all `MutationRequests` and applies them to the state in a single, atomic operation.

---

## **3. Standard Event Hooks**

The following hooks must be implemented in the **Headless Kernel**:

### **Combat Lifecycle Hooks**
- `onActionStart`: Triggered when a program is selected. Use for status checks.
- `onModifierPhase`: The window for buffs/debuffs to multiply the base damage.
- `onPostDamage`: Triggered after HP is deducted. Use for lifesteal or retaliation.
- `onUnitFainted`: Triggered when HP hits 0. Clears the board and stops pending actions for that unit.
- `onActionEnd`: Clean-up phase.

### **State Mutation Hooks**
- `onStatusApplied(status, target)`
- `onStatusRemoved(status, target)`
- `onEnergyChanged(amount, target)`
- `onCardDrawn(card)`
- `onDeckShuffled()`

---

## **4. Safety Protocols**

### **4.1. Infinite Loop Prevention**
The engine implements a **`Max_Trigger_Depth = 5`**. 
- If an event (Action A) triggers a response (Action B) which then triggers Action C, etc., the chain is capped at 5 levels. 
- If Level 6 is reached, the engine logs a `CRITICAL_EVENT_OVERFLOW` warning and forcibly terminates the chain to prevent a crash.

### **4.2. Action Validation**
Every hook has access to an `isCancelled` flag. If a Priority 100 hook (e.g., `AsleepStatusCheck`) sets `isCancelled = true`, the engine skips all lower-priority hooks and moves straight to the clean-up phase.
