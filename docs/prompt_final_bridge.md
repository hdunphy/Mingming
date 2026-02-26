### **PROMPT: Final Archetype Bridge - Discard & Target Logic**

**Objective:** Implement the final interaction layers required for the Wind/Discard archetypes, including passive hand triggers and advanced target redirection.

**1. Implement Passive Hand Triggers (Discard Effects):**
- Update the `DiscardExecutor` in `src/engine/actions/ActionExecutors.ts`:
    - Before moving a card to the discard pile, check if its `ProgramData` has a `discardEffect` property (an array of `ProgramAction`).
    - If it exists, execute those actions immediately using the `ActionExecutorRegistry`.
    - **Enablement:** Allows cards that "Draw 2 if discarded" or "Gain 1 Energy if discarded."

**2. Implement Target Redirection:**
- Add a new action type **`REDIRECT_TARGET`** to `ActionExecutors.ts`.
    - **Logic:** Overwrites the `forcedTargetId` of the target entity with a specific `newTargetId` or a `RANDOM` ally ID.
    - **Enablement:** Allows cards to force an enemy to hit a specific tank or switch to a random target.

**3. Implement Element-Specific Scaling:**
- Update the `AttackExecutor` to support a new scaling type: **`ELEMENT_PLAYED`**.
    - **Logic:** `damage = basePower * (Count of cards played this turn matching [element])`.
    - **Requirement:** Update `IBattleState` to track `elementPlays: Record<Element, number>`.

**4. Forced Discard Hook (Daemon Support):**
- Create a new shared action: **`FORCE_DISCARD`**.
- Update the `onActionStart` hook logic to support "Cost Modification."
    - **Enablement:** Allows the Daemon "Attack cards must discard" by adding a forced discard action to every attack played by the host.

**Constraints:**
- Ensure all logic remains deterministic and stateless.
- Do not store card effects in the Redux state; only trigger them during resolution.
- Verify that these new types are added to the Zod schemas for the registry.

***
