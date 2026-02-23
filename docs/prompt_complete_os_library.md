### **PROMPT: Complete Norse OS Library (Epic 6/11 Completion)**

**Objective:** Finalize the implementation of all 32 OS behaviors in `src/engine/data/lib/hooks.json` by adding the missing logic for the remaining 8 MingMings.

**1. Implement Missing Core Logic:**
Update the following OS behaviors in `hooks.json` using our existing Hook/Action component model:

- **Fafnir:**
    - `HOARD_PROTOCOL` (v1): Hook: `onTurnEnd`. If Energy > 0, store it. Hook: `onTurnStart`. Restore stored energy but take -1% Max HP damage per energy point.
    - `CORRUPTED_GOLD_OS` (v2): Hook: `onStatusApplied`. If target is SELF and status is a DEBUFF, gain +1 Energy.
- **Gullinbursti:**
    - `UNSTOPPABLE_MASS` (v1): Hook: `onActionStart`. If category is STATUS, the next ATTACK card this turn costs -1.
    - `KINETIC_RAM_OS` (v2): Hook: `onDamageCalculated`. If element is EARTH, add bonus damage equal to current SHARP stacks.
- **Hræsvelgr:**
    - `GALE_FORCE_OS` (v1): Hook: `onDiscarded`. Deal 10 Air damage to a random enemy.
    - `UPDRAFT_KERNEL` (v2): Hook: `onDeckShuffled`. Permanently gain +1 Max Energy (Battle-long).
- **Draugr:**
    - `PERMAFROST_WAKE` (v1): Hook: `onStatusRemoved`. If status was ASLEEP, gain 3 Strength.
    - `GRAVE_CHILL_OS` (v2): Hook: `onModifierPhase`. If target (Attacker) has 2+ debuffs, increase their program cost by 1.
- **Valkyrie:**
    - `VALHALLA_UPLINK` (v1): Hook: `onStatusApplied`. If target is ALLY and status is a BUFF, heal that ally for 5% Max HP.
    - `EINHERJAR_RALLY` (v2): Hook: `onDamageCalculated`. Increase damage by +10% for every other conscious ally on the field.
- **Audhumbla:**
    - `GENESIS_FIRMWARE` (v1): Hook: `onActionStart`. Every 3rd HEAL/SKILL card played by owner adds +1 Max Energy.
    - `NOURISH_ROUTINE` (v2): Hook: `onHeal`. Convert overheal amount into a Light damage hit against a random enemy.
- **Hel:**
    - `EQUINOX_TOGGLE` (v1): Hook: `onActionStart`. If HEAL, enter Light Stance (+10 Heal Power). If ATTACK, enter Dark Stance (+10 Atk Power).
    - `UNDERWORLD_GATEWAY` (v2): Hook: `onActionStart`. Dark spells cost 0 Energy but deal damage to host equal to 2x the base cost.
- **Níðhöggr:**
    - `ROOT_CORRUPTION` (v1): Hook: `onTurnEnd`. Poison stacks on enemies do not decrement.
    - `FALLEN_FEAST_OS` (v2): Hook: `onUnitFainted`. Gain 3 Strength and 3 Sharp.

**2. Script Integration:**
- Ensure all new hooks are correctly registered in the `ActionExecutorRegistry` or `HookFactory`.
- Update `src/engine/data/mingmingRegistry.ts` to ensure these OS IDs are correctly mapped to their respective units.

**Constraints:**
- Maintain 100% determinism.
- Use the **Stateless Executor** pattern (no battle data stored in classes).
- Use **Zod schemas** to validate the updated `hooks.json` on boot.

***
