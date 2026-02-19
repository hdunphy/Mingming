# Epic 9 Technical Specification: The Developer Toolkit (Card Editor & Balancing)

This epic defines the creation of a local "Developer Studio" utility to manage the game's data-driven content, focusing on rapid card creation and mathematical balance verification.

---

## **1. The Card Editor (`CardStudio.tsx`)**

A dedicated UI for reading and writing to the `programRegistry.json`.

### **1.1. Data Persistence (Local File Access)**
- **Mode:** Since this is a dev tool, it will use the **File System Access API** (in Chrome/Edge) or a local Node-based bridge to save directly back to the project source.
- **Version Control:** Support for "Version Snapshots" (e.g., `programs_v1.json`, `programs_test_rebalance.json`).

### **1.2. The Creation Interface**
- **Action Builder:** A form-based interface to add actions (DAMAGE, HEAL, STATUS) and constraints (BASE, HAS_STATUS).
- **Keyword Autocomplete:** Dropdowns for Elements, Status Types, and Targets to prevent typos in the JSON.
- **Visual Preview:** A real-time rendering of the card using the `Tactical HUD` CSS so the dev can see exactly how the text and icons will look in-game.

---

## **2. The Balance Auditor (`Auditor.ts`)**

An automated mathematical engine that assigns a "Budget Score" to every card in the registry based on its properties.

### **2.1. The Value Heuristic (The Spreadsheet Math)**
The Auditor calculates a **Budget Score** using a weighted formula:
- **Base Power:** 1.0 per 10 Damage.
- **Status Stacks:** (e.g., 2.0 per Dazed, 5.0 per Stun).
- **Utility:** (e.g., 4.0 per Card Draw, 6.0 per Energy Gain).
- **Multipliers:** 0.8x for Single Target, 1.5x for Side/All Targets.

### **2.2. The "Redline" Detector**
- **Target Budget:** Each Energy Cost has a "Safe Range" (e.g., 1-Energy = 5.0 to 7.0 score).
- **Alerts:** The UI highlights cards in **RED** if they exceed their cost's budget and **YELLOW** if they are under-budgeted (too weak).

---

## **3. Simulation Integration (Battle Stress-Test)**

The tool allows you to instantly launch a **Headless Battle** between a test deck and a standard archetype.

- **Mirror Test:** Simulates 100 battles of the current card against itself to find statistical anomalies.
- **Archetype Check:** Pits the new card against the "Gold Standard" decks (e.g., Kraken Control) to see if it breaks established counters.

---

## **4. Milestone Roadmap**

- [ ] **Milestone 9.1: JSON Registry Migration:** Refactor `programRegistry.ts` to load from a raw `programs.json` file for easier external editing.
- [ ] **Milestone 9.2: The Editor UI:** Build the React-based form for adding/editing cards with real-time HUD preview.
- [ ] **Milestone 9.3: The Heuristic Engine:** Implement the mathematical Auditor and add the "Budget vs. Cost" visualization.
- [ ] **Milestone 9.4: File IO Bridge:** Implement the save-to-disk logic for the local development environment.
