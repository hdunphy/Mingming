# Object-Oriented Action System Refactor

Currently, card effects are driven by raw JSON objects combined with a switch statement/mapping in [battleReducer.ts](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/battleReducer.ts) and [effectHandlers.ts](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/effectHandlers.ts). You requested to move towards an Object-Oriented component system with abstract methods and inheritance, and to combine "Add Status" and "Remove Status" into a generic "Status" action using negative stacks.

## Goal
Implement a polymorphic `GameAction` base class with specific subclasses for `AttackAction`, `StatusAction`, `HealAction`, `DrawAction`, and `EnergyAction`. Refactor the main program execution loop to invoke `action.execute()` directly.

## User Review Required
> [!IMPORTANT]
> - By instantiating class models (`GameAction`) rather than pure data objects in `ProgramRegistry`, Redux strictly speaking might complain about "non-serializable values in state" if [ProgramData](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/types.ts#199-215) is kept in the Redux store. However, [ProgramData](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/types.ts#199-215) is usually static registry data (referenced by `dataId`), so as long as [IBattleState](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/types.ts#242-262) only contains pure data (like [ProgramEntity](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/types.ts#216-222) with `dataId`), it's completely safe.
> - Please review the proposal for `StatusAction` using negative stacks for removal.

## Proposed Changes

### 1. New Action Classes
**`src/engine/actions/GameAction.ts`**
- Create an abstract `GameAction` class:
  ```typescript
  export abstract class GameAction {
      type: ActionType;
      conditionals?: ReadonlyArray<ProgramConstraint>;
      target: string;
      
      constructor(data: any) { ... }
      
      abstract execute(state: IBattleState, sourceId: string, targetId: string, program: ProgramData, context: HookContext): IBattleState;
  }
  ```
- Create derived classes: `AttackAction`, `HealAction`, `DrawAction`, `EnergyAction`, and `StatusAction`.
- Move specific log and calculation behaviors out of [effectHandlers.ts](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/effectHandlers.ts) and into the overridden [execute](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/resolutionEngine.ts#247-278) methods.

### 2. Status Action Consolidation
- **`StatusAction.ts`**: Uses `stacks > 0` to apply, and `stacks < 0` to reduce/remove.
- **[src/engine/types.ts](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/types.ts)**:
  - Update [ActionType](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/types.ts#186-187) to just `'ATTACK' | 'STATUS' | 'HEAL' | 'DRAW' | 'ENERGY'`.
- **[src/engine/data/lib/actions.json](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/data/lib/actions.json)**:
  - Migrate all `"type": "APPLY_STATUS"` and `"REMOVE_STATUS"` to `"type": "STATUS"`.
  - For removals, set `stacks` to negative (e.g., `-999` to fully remove, or a specific negative number to decrement).

### 3. Action Factory
**`src/engine/actions/ActionFactory.ts`**
- Create an `ActionFactory.createAction(data: any)` method that looks at the `data.type` and instantiates the correct `GameAction` implementation (e.g. `new AttackAction(data)`).

### 4. Updating the Registry
**[src/engine/data/programRegistry.ts](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/data/programRegistry.ts)**
- Modify [inflateAction](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/data/programRegistry.ts#40-54) to return `ActionFactory.createAction(inflatedAction)`. This ensures when a card is fetched via [GetProgramData](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/data/programRegistry.ts#70-105), its `.actions` array is populated with actual class instances that have an `.execute()` method.

### 5. Execution Logic Refactor
**[src/engine/battleReducer.ts](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/battleReducer.ts)**
- In [handlePlayProgram](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/battleReducer.ts#174-349), replace the custom branching logic:
  ```typescript
  // Old
  if (action.type === 'DRAW') { ... } 
  else if (action.type === 'STATUS') { ... }
  else { const handler = effectHandlers[action.type]; finalState = handler(...) }

  // New
  finalState = action.execute(finalState, sourceId, tId, programData, hitContext);
  ```

### 6. Clean Up
**[src/engine/effectHandlers.ts](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/effectHandlers.ts)**
- Remove functions that have been migrated to Action classes (e.g., [handleAttack](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/effectHandlers.ts#116-210), [handleHealEffect](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/effectHandlers.ts#245-282), [handleApplyStatus](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/effectHandlers.ts#295-397), [handleDraw](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/effectHandlers.ts#401-417), [handleRemoveStatus](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/effectHandlers.ts#418-439)).

## Verification Plan
### Automated Tests
- Run `npm run test` to make sure [battleReducer.test.ts](file:///c:/Users/hdunp/Documents/GameDev/Unity/GitHub/Mingming/src/engine/battleReducer.test.ts) passes with the new Action instances.
- Fix broken tests.

### Manual Verification
- Will verify via Simulator tests that cards like "Strike", "Defend", and Daemon effects behave exactly as they did before, but now using the polymorphic `action.execute()` architecture.
