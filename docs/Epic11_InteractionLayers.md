# Epic 11 Technical Specification: Advanced Interaction Layers

This epic defines the logic for complex card interactions including discard triggers, target manipulation, and sequential modifiers (buffing the "next" card).

---

## **1. Discard Triggers (Passive Deck Interactions)**

Cards that provide value when discarded by another effect (e.g., `Hurricane Force` or `Tailwind`).

### **1.1. Implementation**
- **Trigger:** Add `onDiscarded` to the `HookDefinition` in `HookTypes.ts`.
- **Logic:** The `DISCARD` executor in `ActionExecutors.ts` must broadcast a discard event for each card removed from the hand.
- **Card Design:** A card can have a `hooks` array containing a discard listener. 
    - *Example:* "Fragmented Code" - Cannot be played (Constraint: `FALSE`). Hook: `onDiscarded` -> `DRAW 1`.

---

## **2. Target Manipulation (Aggro Management)**

Mechanics to force or redirect enemy Intent.

### **2.1. The "Taunt" Mechanism**
- **Logic:** Add a `FORCED_TARGET` field to `IBattleEntity`.
- **Action Type:** `TAUNT` (Sets the source as the forced target for the opponent).
- **AI Integration:** The `IntentEngine` must prioritize the `FORCED_TARGET` when selecting targets for `Attack` intents, overriding the "Lowest HP" default.

---

## **3. Sequential Modifiers (Buffing the "Next" Action)**

Cards that apply a one-time boost to the very next program played by that unit.

### **3.1. Implementation**
- **Action Type:** `BUFF_NEXT_PROGRAM`.
- **State Store:** Add `nextProgramModifier: { multiplier: number, flatBonus: number, costReduction: number } | null` to the `IBattleEntity`.
- **Resolution:** The `battleReducer` checks for this object during `onModifierPhase`. Once the program resolves, the modifier is cleared.
- *Example:* "Focus Power" -> Multiplier x2 for next card. "Tailwind" -> Cost -1 for next card.

---

## **4. Extended Archetype Mechanics (Expansion Ideas)**

1.  **Memory Leak (Dark/Ice):** A status that deals damage every time the player *draws* a card.
2.  **Ping Protocol (Air/Nature):** Deals 1 damage every time any action is executed this turn.
3.  **Recursion (Water):** Return the top card of the discard pile to the top of the draw pile.
4.  **Checksum (Light):** If you played 3 cards of the same element this turn, gain 1 Energy.
5.  **Overclock (Fire):** Increase your Max Energy for this turn only, but take Stun next turn.
6.  **Defragment (Earth):** Heal 2 HP for every "Neutral" card in your discard pile.

---

## **5. Milestone Roadmap**

- [ ] **Milestone 11.1: Discard Hook:** Implement `onDiscarded` trigger and hook it into the `DiscardExecutor`.
- [ ] **Milestone 11.2: Aggro Control:** Implement `FORCED_TARGET` logic in the AI and the `TAUNT` action.
- [ ] **Milestone 11.3: Sequential State:** Add the `nextProgramModifier` logic to `IBattleEntity` and `resolutionEngine`.
