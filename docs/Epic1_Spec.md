# Epic 1 Technical Specification: The Headless Kernel

This document provides the low-level technical requirements for implementing the core logic of **Mingming**. This kernel must be built as a pure TypeScript engine, independent of any UI framework.

---

## **1. Data Schema & Interfaces (`types.ts`)**

### **1.1. Core Enums**
```typescript
export type Element = 'Fire' | 'Water' | 'Earth' | 'Air' | 'Nature' | 'Ice' | 'Light' | 'Dark' | 'None';
export type TargetType = 'Single' | 'Self' | 'Side' | 'All';
export type ProgramCategory = 'Attack' | 'Heal' | 'Status' | 'Special';
export type TurnPhase = 'PRE_TURN' | 'ACTION' | 'POST_TURN';
```

### **1.2. MingMing State**
```typescript
export interface MingMing {
  id: string;
  name: string;
  level: number;
  stats: {
    hp: number;
    maxHp: number;
    tempHp: number; // Shields/Light barriers - purged during POST_TURN
    attack: number;
    defense: number;
    energy: number;
    maxEnergy: number;
  };
  // Tracking for permanent "Wither/Strengthen" battle modifiers
  baseStats: {
    attack: number;
    defense: number;
  };
  primaryElement: Element;
  secondaryElement?: Element;
  statusEffects: StatusEffectInstance[];
}
```

### **1.3. Program Interface Additions**
```typescript
export interface Program {
  // ... existing fields
  hits: number; // Default: 1. Support for multi-hit programs.
  constraints: ProgramConstraint[]; // Requirements to play (e.g., HasStatus, MinEnergy).
  logicOverrides?: string; // Reference to custom logic hooks (e.g., extra damage if target is asleep).
}

export interface ProgramConstraint {
  type: 'HAS_STATUS' | 'HEALTH_THRESHOLD' | 'ENERGY_THRESHOLD';
  target: 'SELF' | 'TARGET';
  value: string | number;
}
```

---

## **2. The Damage Processor (`combatUtils.ts`)**

### **2.1. The Formula**
Implementation must strictly follow the Unity legacy formula:
1. `Base = ((2 * level) / 5) + 2`
2. `Scaled = Base * Power * Attack / Defense`
3. `Total = (Scaled / 50) + 2`
4. `Final = Floor(Total * Modifier)`

### **2.2. Modifier (M) Calculation Logic**
1. **STAB (Same-Type Attack Bonus):** 1.5x if `program.element` matches `attacker.primaryElement`.
2. **Type Advantage:** 
   - 2.0x for Super Effective.
   - 0.5x for Resisted.
   - 0.75x for Partial Resistance (secondary type check).

---

## **3. Progression & Stats**

### **3.1. Stat Formula**
- `StandardStat = Floor(((2 * baseStat) + modifier) * level / 100) + 5`
- `HealthStat = StandardStat + level + 5`

### **3.2. Experience Curve**
- `ExpForLevel = Round(0.8 * level^3)`

---

## **3. The State Machine (`battleReducer.ts`)**

### **3.1. Phase Logic**
- **PRE_TURN:** Reset energy, decrement status, draw to 9.
- **ACTION:** Accept `PLAY_PROGRAM` or `TRANSFER_ENERGY`.
- **POST_TURN:** Resolve DoT, purge hand, toggle control.

### **3.2. Middleware Hook System (The "Event Bus")**
To support modular card effects and stat tracking, the kernel must emit events at every state mutation point. These hooks allow cards to "subscribe" to logic.
- `onProgramPlayed(card, source, target)`
- `onDamageTaken(target, amount, element)`
- `onStatusApplied(target, status)`
- `onStatusRemoved(target, status)`
- `onPhaseStart(phase)`
- `onPhaseEnd(phase)`
- `onDeckShuffled()`
- `onCardDrawn(card)`

---

## **4. The Tactical AI (Min-Max Controller)**
The opponent logic must evaluate the "Board Score" using Alpha-Beta pruning.
- **Score Weighting:** 
    - `Enemy_HP_Loss * 2.0`
    - `Self_HP_Gain * 1.5`
    - `Positive_Status_Applied * 0.5`
    - `Negative_Status_Mitigated * 0.5`
- **Execution:** The AI simulates play permutations for the current hand and selects the sequence that maximizes the Score.

---

## **5. Headless Simulation Runner (`SimRunner.ts`)**
The final validation of Epic 1.
- **Input:** Two Decks + Two Teams of MingMings.
- **Process:** Runs the `battleReducer` in a loop (using the Tactical AI for both sides) until a winner is declared.
- **Output:** JSON log of all events, total turns, and final HP values.

---

## **6. Mandatory Unit Tests (`Kernel.test.ts`)**

| Scenario | Expected Outcome |
| :--- | :--- |
| **Insufficient Energy** | Action `PLAY_PROGRAM` is rejected if cost > energy. |
| **Energy Transfer** | Source -2, Target +1. Fails if Source < 2. |
| **Type Effectiveness** | Fire Program on Nature MingMing deals 2.0x damage. |
| **Status Cancellation** | Applying 'Sharp' to a 'Dazed' unit nullifies both. |
| **Sleep Interaction** | Unit with 'Asleep' has 0 energy; wakes up on hit. |
| **Exponential XP** | `calculateExp(level 50)` returns `125,000`. |

---

## **7. The Data-Driven Program Factory**

To replicate and improve upon the Unity `ScriptableObject` + `CardAction` hierarchy, the engine uses a **Compositional Effect Pattern**.

### **7.1. Program Definition (`programs.json`)**
Instead of monolithic classes, Programs are defined as a list of **Discrete Effects**.
```json
{
  "id": "rage",
  "name": "Rage",
  "actions": [
    { "type": "ATTACK", "power": 20, "element": "Fire" },
    { "type": "APPLY_STATUS", "status": "STRENGTHENED", "target": "SELF", "stacks": 1 }
  ],
  "cost": 1
}
```

### **7.2. Effect Handlers (`effectHandlers.ts`)**
Each effect type maps to a pure function. This mirrors your Unity `CardAction` subclasses.
- `handleAttack(state, payload)`
- `handleHeal(state, payload)`
- `handleApplyStatus(state, payload)`
- `handleDraw(state, payload)`

### **7.3. Benefits of this Port**
- **Hot-Loading:** You can add new Programs to the JSON file and see them in the game instantly without a recompile.
- **Complexity:** You can create a card that "Heals an Ally, Damages an Enemy, and Draws 2 cards" just by adding three objects to the `actions` array in the JSON.
- **Separation of Concerns:** The `battleReducer` doesn't know *what* a card does; it just iterates through the `actions` array and calls the corresponding handlers.
