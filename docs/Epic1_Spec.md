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
    attack: number;
    defense: number;
    energy: number;
    maxEnergy: number;
  };
  primaryElement: Element;
  secondaryElement?: Element;
  statusEffects: StatusEffectInstance[];
}
```

---

## **2. The Damage Processor (`combatUtils.ts`)**

### **2.1. The Formula**
Implementation must strictly follow the GDD formula:
`Damage = Floor((((((2L/5)+2) * P * A/D) / 50) + 2) * M)`

### **2.2. Modifier (M) Calculation Logic**
1. **STAB (Same-Type Attack Bonus):** 1.25x if `program.element` matches `attacker.primaryElement`.
2. **Type Advantage:** 
   - 2.0x for Super Effective.
   - 0.5x for Resisted.
   - 0.75x for Partial Resistance (secondary type check).
3. **Stat Buffs/Debuffs:**
   - Attack modifier: `1.0 + (strengthenStacks * 0.01) - (weakenStacks * 0.01)`
   - Defense modifier: `1.0 + (sharpStacks * 0.01) - (dazedStacks * 0.01)`

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

## **5. Global Seeded RNG**
All probabilistic events (shuffling, encounters) must use a seeded PRNG.
`const state = { seed: number, ... }`
`const { value, nextSeed } = PRNG(state.seed);`
