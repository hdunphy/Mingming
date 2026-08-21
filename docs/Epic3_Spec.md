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
- **Size Constraint:** Decks have a minimum of 12 cards and a maximum of 40 cards. The "Save" button remains disabled until constraints are met.
- **Sync:** Changes must be committed to the `activeDeck` slice of the state.

---

## **2. Mid-Battle Progression (The Active XP System)**

To achieve parity with classic monster battlers, XP is awarded dynamically during the battle.

### **2.1. Trigger Conditions**
- **Defeat Reward:** When an enemy MingMing's HP reaches 0, the XP value of that unit is immediately distributed among all *active* player MingMings.
- **Active Participants:** Only units currently on the field (the "Active 3") receive a share of the XP.

### **2.2. Dynamic Level-Ups**
- **Stat Recalculation:** If a MingMing levels up mid-battle, its stats (HP, Attack, Defense) are immediately recalculated based on the new level. 
- **Current HP Buff:** When a unit levels up, its `maxHp` increases. The `currentHp` should increase by the same delta, allowing for "clutch" mid-battle survival.
- **UI Feedback:** Level-up animations and stat-increase popups should trigger immediately over the `MingmingUnit` card.

---

## **3. The Synthesis Lab (`SynthesisLab.tsx`)**

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

## **4. Party Management (`RosterTerminal.tsx`)**

- **The Active 3:** UI to drag and drop MingMings from the `roster` (storage) into the `activeParty` (max 3 slots).
- **Prohibition Logic:** This interface is **only** accessible at a Bench/Terminal. The `activeParty` state is locked during overworld traversal.

---

## **5. The Drop Table Engine (`RewardSystem.ts`)**

To handle the "Synthesis" economy, the engine must support probabilistic loot drops.

### **4.1. Drop Table Schema**
- **Definition:** A mapping of MingMing architectures to their potential drops.
- **Rolls:** Upon victory, the engine executes a roll against the `seededPRNG` for:
    - `Blueprint_Drop_Rate` (e.g., 5% chance for a rare architecture).
    - `Scrap_Yield_Range` (e.g., 5-15 scraps per unit).
    - `Card_Reward_Pool` (3 random cards from the defeated unit's element).

---

## **6. Map Interactions & Resource Nodes**
- **Heal Stations:** Interaction nodes that restore all `activeParty` MingMings to `maxHp` and `maxEnergy`.
- **Blueprints Scavenging:** One-time nodes (treasure chests) that provide specific rare Blueprints or large Scrap piles.

---

## **7. Persistence & Integrity (`SaveSystem.ts`)**

### **6.1. Storage Strategy**
- **Primary:** `LocalStorage` for rapid development.
- **Steam/Native:** `SQLite` integration for single-file, serverless database reliability.

### **6.2. The Zod Validation Guardrail**
To prevent runtime crashes caused by typos in the data JSONs, we implement **Zod Schemas** for all static data:
- **Contract:** If `programs.json` has a cost of "Five" instead of `5`, the `Zod.parse()` will catch it at boot time.
- **Error Mapping:** Provides human-readable error logs identifying exactly which JSON entry is malformed.
