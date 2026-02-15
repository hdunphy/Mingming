# Epic 3 Technical Specification: The Data Terminal (Management)

This epic focuses on the systems required to manage the Developer's assets, progress, and roster outside of active combat. It bridges the gap between raw data and player strategy.

---

## **1. The Deck Builder (`DeckTerminal.tsx`)**

### **1.1. Inventory Management**
- **State Store:** A global `cardInventory` array containing all owned `Program` instances.
- **Card Filters:** Sort by Element, Cost, and Rarity.
- **Visuals:** Grid of cards with high-fidelity tooltips on hover (as defined in Epic 2).

### **1.2. Deck Validation Rules**
- **Cardinality Check:** Players cannot add more instances of a `Program` than they currently own in their inventory.
- **Size Constraint:** Decks must be exactly 40 cards (or a defined range). The "Save" button remains disabled until constraints are met.
- **Sync:** Changes must be committed to the `activeDeck` slice of the state.

---

## **2. The Synthesis Lab (`SynthesisLab.tsx`)**

### **2.1. The Scrap Economy**
- **Deconstruction:** Reducer logic to remove a `Program` from inventory and increment a global `CommonScrap` integer.
- **Scrap Yield:** Calculated based on card rarity (e.g., Common = 10, Rare = 50).

### **2.2. MingMing Compilation**
- **Requirements:** 1 `Blueprint` (Architecture) + `X` Common Scraps.
- **Process:**
    1. Select a Blueprint from the `unlockedArchitectures` state.
    2. Check `scrapCount >= architectureCost`.
    3. Dispatch `CREATE_MINGMING` action to generate a Level 1 instance of that unit.
    4. Add to `mingmingRoster`.

---

## **3. Party Management (`RosterTerminal.tsx`)**

- **The Active 3:** UI to drag and drop MingMings from the `roster` (storage) into the `activeParty` (max 3 slots).
- **Prohibition Logic:** This interface is **only** accessible at a Bench/Terminal. The `activeParty` state is locked during overworld traversal.

---

## **4. Persistence Layer (`SaveSystem.ts`)**

### **4.1. Storage Strategy**
- **Primary:** `LocalStorage` for rapid development.
- **Future:** `IndexedDB` for larger data sets or Electron-native file saving.

### **4.2. State Serialization**
- **Deterministic Format:** The save file is a JSON string of the entire root store (Inventory, Roster, Blueprints, Global Seed, and Overworld Coordinates).
- **Auto-Save:** Triggered after Synthesis, Deck saving, or Combat conclusion.

---

## **5. GDD Review & Missing Features**
- **Rarity Integration:** The GDD defines card rarity (1-3). Milestone 1.1 must include `rarity` in the `Program` interface to drive scrap yield.
- **Consumables Check:** The GDD mentions "consumables and restorative items are restricted entirely to the overworld." Milestone 3.4 will need to include a `ConsumableInventory` and `RestorativeLogic`.
