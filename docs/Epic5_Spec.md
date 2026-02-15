# Epic 5 Technical Specification: The Neural Link (AI & Polish)

The final phase focuses on porting advanced AI logic, ensuring deterministic stability, and preparing for professional distribution.

---

## **1. Advanced Tactical AI (`AlphaBetaController.ts`)**

### **1.1. Hand Sequence Optimization**
- **Min-Max Logic:** Implement a depth-limited search for the current hand.
- **Scoring Heuristic:**
    - `Total_Enemy_HP_Percentage_Lost`
    - `Total_Allied_HP_Percentage_Saved`
    - `Strategic_Status_Weight` (e.g., Applying 'Asleep' to a high-energy enemy has high weight).
- **Asynchronicity:** The AI should simulate "thinking" time by dispatching actions with a 500ms delay between programs for visual clarity.

---

## **2. Determinism & Replays (`ReplaySystem.ts`)**

### **2.1. The Seed Log**
- Every battle state must include the initial `seed`.
- Every player action must be logged with a timestamp/turn number.
- **Replay Tool:** A utility that re-runs the `battleReducer` using the stored seed and action log to verify that the outcome is identical every time.

---

## **3. Steam & Native Deployment (`ElectronWrapper`)**

### **3.1. Electron Integration**
- Package the React build into an Electron container.
- **File System Access:** Redirect `LocalStorage` to a local `save.json` file for native Steam Cloud compatibility.

### **3.2. Polish & Particles**
- Post-processing effects (Bloom for Fire programs, Distortion for Water).
- Screen shake logic hooked into the `onDamageTaken` event.

---

## **4. GDD Review & Missing Features**
- **Cubic XP Curve:** Milestone 5.4 must implement the `calculateExp` formula: `Exp = (6/5) * L^3 - 15 * L^2 + 100 * L - 140`. 
- **STAB Validation:** Ensure the AI accounts for the 1.25x Same-Type Attack Bonus when evaluating its "Best Move."
- **Dual-Typing Mitigation:** The AI heuristic must account for the 0.75x modifier for dual-type resistance.
