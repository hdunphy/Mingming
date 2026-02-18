# Epic 6 Technical Specification: The Augmentation Protocol (OS & Firmware)

This epic defines the implementation of the "Operating System" (OS) system, allowing players to customize the passive behavior and strategic identity of their MingMings.

---

## **1. The OS Architecture**

### **1.1. Data Integration**
- **`IMingmingState` Update:** Add an `activeOS` field (string) to the persistent MingMing state.
- **Creation Logic:** 
    - At the **Synthesis Lab**, players choose between **OS v1** or **OS v2** during the "Compilation" process.
    - **Starter Exception:** The initial starter MingMing (Kraken/Fenrir/Fafnir) is hardcoded to **OS v1** to simplify the early game.
- **The Firmware Registry:** A new static data file (`firmwareRegistry.ts`) mapping OS IDs to their descriptions, icons, and trigger-logic metadata.

---

## **2. The Flashing Terminal**

Players can "Flash" a new OS onto an existing MingMing at any Bench/Terminal.

### **2.1. The Blueprint Requirement**
- **Validation:** Swapping an OS is not free. It requires **one Blueprint** of that specific MingMing's architecture (e.g., to flash a new OS onto Fenrir, you must consume a "Fenrir Blueprint").
- **Cost Logic:** The Blueprint is consumed upon a successful Flash operation. This creates a strategic sink for duplicate Blueprints found during a run.

### **2.2. UI Integration (`FirmwareTerminal.tsx`)**
- A sub-view within the Roster management screen.
- **Comparison View:** Side-by-side display of the current OS vs. the target OS.
- **Confirmation:** A "FLASH FIRMWARE" button that remains disabled if the player lacks the required Blueprint.

---

## **3. The System Daemon (Execution Logic)**

OS behaviors are implemented using the **System Daemon** pattern—passive background processes that intercept battle events.

### **3.1. Trigger Hooks**
The `battleReducer` will be updated to check for `activeOS` during specific lifecycle hooks:
- **`onBattleStart`:** (e.g., Huldra's `BARK_SHIELD_OS` applying an immediate shield).
- **`onProgramPlayed`:** (e.g., Sleipnir's `MOMENTUM_DRIVE` checking for 0-cost cards).
- **`onStatusApplied`:** (e.g., Fafnir's `CORRUPTED_GOLD_OS` generating energy from debuffs).
- **`onTurnEnd`:** (e.g., Jörmungandr's `VENOM_TRENCH_OS` healing based on enemy Poison).

### **3.2. Stateless Mutations**
To maintain determinism, OS triggers must return a `StateMutation` that the `battleReducer` can apply cleanly to the `IBattleState`, ensuring that OS effects are captured in replays.

---

## **4. Milestone Roadmap**

- [ ] **Milestone 6.1: Firmware Registry:** Define the 32 OS variants (16 MingMings x 2) in the static data layer.
- [ ] **Milestone 6.2: Creation Choice:** Update the `SynthesisLab` UI to allow OS selection.
- [ ] **Milestone 6.3: The Flashing Logic:** Implement the Reducer action to consume a Blueprint and swap `activeOS`.
- [ ] **Milestone 6.4: Engine Integration:** Implement the `SystemDaemon` hook check within the `battleReducer`.
