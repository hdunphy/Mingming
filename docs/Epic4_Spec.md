# Epic 4 Technical Specification: The Overworld (Grid Engine)

This epic implements the spatial navigation and exploration layer of **Mingming**, transitioning the game from a menu-driven experience to a cohesive world.

---

## **1. Grid-Based Movement (`OverworldEngine.tsx`)**

### **1.1. Coordinate System**
- **State:** `playerPos: { x: number, y: number, facing: 'N'|'S'|'E'|'W' }`.
- **Movement:** 4-directional grid movement with a strict "one tile per move" logic.
- **Collision Matrix:** A 2D array of `TileTypes` (0: Floor, 1: Wall, 2: Grass, 3: Interactive).

### **1.2. Input Handling**
- Keyboard listeners for WASD/Arrows.
- Staggered movement logic (preventing players from phasing through tiles by spamming keys).

---

## **2. Encounter Engine (`EncounterLogic.ts`)**

### **2.1. Seeded Probability**
- **The Roll:** Upon entering a "Tall Grass" tile (Type 2), the engine rolls against the global `seededPRNG`.
- **Encounter Rate:** Defined constant (e.g., 10% per step).
- **Trigger:** If `roll < encounterRate`, dispatch `INITIATE_COMBAT` with a random enemy team generated from the local area's pool.

### **2.2. Deterministic NPC Encounters**
- Interaction logic for stationary **Developers**.
- Adjacency check: If player is facing a Developer tile and presses `Interact`, trigger dialogue and combat.

---

## **3. World Node Interaction**

- **Benches & Terminals:** Special tiles that, when interacted with, mount the **Epic 3** UI (Management) and freeze player movement.
- **Freeze State:** When in Combat or Management menus, the overworld state is "Stacked" (saved in memory) but not updated.

---

## **4. Visual Presentation (`WorldRenderer.tsx`)**

- **Viewport:** A "Camera" component that centers on the player coordinates.
- **Tile Sprites:** A modular mapping system to render sprites based on the Grid Matrix.
- **NPC Sprites:** Directional sprites for stationary Developers.

---

## **5. GDD Review & Missing Features**
- **Planetary Tests:** The GDD mentions "twelve rigorous preliminary tests." This requires a `GlobalProgress` state to track which of the 12 "Boss" Developers have been defeated.
- **FTL Narrative Context:** The overworld should reflect the "Twelve Exoplanets" setting, suggesting a need for a "Planet Map" or "Level Selector" UI between major zones.
