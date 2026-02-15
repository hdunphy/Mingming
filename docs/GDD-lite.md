# **Game Design Document: Mingming**

## **Executive Overview**
A synthesis of Monster Catcher RPG and Roguelike Deck-builder (Pokémon + Slay the Spire). The core pivot is replacing menu-based combat with a dynamic, card-driven resource management system.

## **Narrative Architecture**
- **Setting:** Post-ecological collapse Earth.
- **MingMings:** AI terraforming robots weaponized during a civil war.
- **The Loop:** Players act as **Developers** compiling "Program" cards to govern **MingMings**.
- **Objective:** Pass twelve planetary tests and depose the reigning champion.

## **Core Mechanics**
### **Overworld & Exploration**
- Top-down 4-directional grid.
- Tall grass random encounters with rogue MingMings.
- Stationary Developer encounters (skill checks).
- **Benches/Terminals:** The only locations where roster and deck management are permitted.

### **Combat Engine**
- **Structure:** 1v1 up to 3v3 engagements.
- **Turn Phases:** 
    1. **Pre-Turn:** Individual Energy reset, status ticks, draw global hand to 9.
    2. **Attack Turn:** Active phase for playing Programs.
    3. **Post-Turn:** Resolution of DoTs (Poison/Burn) and hand purge.
- **Action Economy:** 
    - **Individual Energy:** Each MingMing has its own pool.
    - **Energy Transfer:** Sacrifice 2 Energy from one MingMing to give 1 Energy to another.
- **UI Focus:** Dynamic targeting where units "step forward" when selected to manage the 3v3 screen space.

### **Acquisition & Synthesis (No Capture)**
The "Capture" mechanic is removed in favor of a **Blueprint & Synthesis** system:
- **Victory:** Defeating rogue MingMings drops **Blueprints** (Architectures).
- **Scrap:** Redundant cards are broken down into **Scraps**.
- **Synthesis:** New MingMings are built at Benches using Blueprints + Scraps.

### **Naming Standardization**
- **MingMing:** The units (NEVER "monsters").
- **Developer:** The player (NEVER "trainer").
- **Programs:** The cards/actions.
- **Bench/Terminal:** Roster management nodes.

## **Mathematical Resolution**
### **Damage Formula**
`Damage = Floor((((((2L/5)+2) * P * A/D) / 50) + 2) * M)`
- **L:** Level | **P:** Power | **A:** Attack | **D:** Defense
- **M:** Modifiers (STAB 1.25x, Type Advantage 2.0x/0.5x)

### **Typological Matrix**
8 Elements: Fire, Water, Earth, Air, Nature, Ice, Light, Dark.

### **Status Effects**
- **Asleep:** 0 Energy, breaks on damage.
- **Poisoned:** Stacking DoT + 5% damage reduction.
- **Burn:** 3 Stages of increasing HP/Defense loss.
- **Weakened/Strengthened:** +/- 1% Attack.
- **Dazed/Sharp:** +/- 1% Defense.
- **Stunned:** Skip 1 turn.

## **Technical Strategy**
- **Stack:** React + Vite + TypeScript + Framer Motion (Juicy UI).
- **State:** Redux/Zustand for absolute immutability.
- **Headless Engine:** Core logic decoupled from the UI for 100% test coverage.
- **Seeded RNG:** For deterministic replays and sync.
