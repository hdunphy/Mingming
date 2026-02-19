# Roadmap: Agile Initiative "Rewrite" (Unity to React/TS)

## **Goal**
A complete architectural migration of **Mingming** from Unity/C# to a high-performance React/TypeScript/Vite stack, optimized for a future Steam release via Electron.

---

## **Epic 1: The Headless Kernel (Logic Core)**
*Focus: 100% UI-independent combat engine.*
- [x] **Milestone 1.1: State Definitions:** Define Typescript interfaces for `MingMing`, `Program`, `Deck`, and `GameState`.
- [x] **Milestone 1.2: The Damage Processor:** Implement the deterministic damage formula and elemental matrix.
- [x] **Milestone 1.3: Turn State Machine:** Implement the 3-phase turn logic (Pre-Turn, Attack, Post-Turn).
- [x] **Milestone 1.4: Status Effect Ecosystem:** Reducer logic for the 8 status effects (Burn stages, Sleep-break, etc.).
- [x] **Milestone 1.5: The Middleware Hook System (Event Bus):** Implement a modular event system (e.g., `onDamageTaken`, `onStatusApplied`, `onProgramPlayed`).
- [x] **Milestone 1.6: The Tactical AI (Min-Max):** Implement the Alpha-Beta Min-Max algorithm for optimal hand-play.
- [x] **Milestone 1.7: The Headless Simulation Runner:** CLI/Script runner to execute full battles for balance verification.

## **Epic 2: The Interface Layer (Battle UI)**
*Focus: High-fidelity, reactive combat presentation.*
- **Milestone 2.1: The 3v3 Arena:** Flexbox/Grid layout for the battlefield with "Active Unit" focus logic.
- **Milestone 2.2: The Program Hand:** Draggable card interface with tooltip metadata.
- **Milestone 2.3: Visual Feedback:** Framer Motion animations for "Step Forward" attacks and health bar depletion.
- **Milestone 2.4: Targeting System:** Multi-target logic (Single, Side, Self) with hover-highlights.

## **Epic 3: The Data Terminal (Management)**
*Focus: Roster and Deck building systems.*
- **Milestone 3.1: The Deck Builder:** Paginated card inventory and deck validation (max quantity checks).
- **Milestone 3.2: Synthesis Lab:** UI for "Breaking Scraps" and "Synthesizing Blueprints."
- **Milestone 3.3: Persistence:** LocalStorage/SQLite save system for current MingMings and Decks.

## **Epic 4: The Overworld (Grid Engine)**
*Focus: Tile-based exploration and encounter logic.*
- **Milestone 4.1: Grid Matrix:** 2D coordinate-based movement system with collision detection.
- **Milestone 4.2: Encounter Engine:** Seeded PRNG for "Tall Grass" rogue MingMing triggers.
- **Milestone 4.3: Terminal Interactions:** Interaction logic for Benches and NPC Developers.

## **Epic 5: The Neural Link (AI & Polish)**
*Focus: Enemy behavior and Steam preparation.*
- **Milestone 5.1: Opponent AI:** Asynchronous decision-tree for enemy card play.
- **Milestone 5.2: Seeded Replays:** Replay system to verify 100% determinism.
- **Milestone 5.3: Steam/Electron Wrap:** Packaging the web app as a native executable.

## **Epic 6: The Augmentation Protocol (OS & Firmware)**
*Focus: Long-term strategic depth and synergies via passive OS behaviors.*
- [ ] **Milestone 6.1: Firmware Registry:** Define the 32 OS variants (16 MingMings x 2) in the data layer.
- [ ] **Milestone 6.2: Synthesis Selection:** Update the Lab to allow OS choice upon creation.
- [ ] **Milestone 6.3: Flashing Terminal:** Implement OS swapping at Terminals by consuming a MingMing Blueprint.
- [ ] **Milestone 6.4: System Daemon Engine:** Integrate OS triggers (hooks) into the `battleReducer`.

## **Epic 3.5: The Terminal Gauntlet (Roguelike Loop)**
*Focus: Creating a self-sustaining loop of Battle -> Rewards -> Management -> Battle using the current menu screens as the Hub.*
- [ ] **Milestone 3.5.1: Small Start:** Update `createStarterSave` for 1 MingMing and a 12-card starter deck (max limit 40).
- [ ] **Milestone 3.5.2: Mid-Battle Progression:** Implement "Active XP" system where MingMings gain XP and level up *during* combat (Pokemon-style).
- [ ] **Milestone 3.5.3: Reward System:** Implement `RewardSystem.ts` for Scraps, Cards, and post-battle loot.
- [ ] **Milestone 3.5.4: Post-Battle UI:** Create the report screen with loot reveal and total run stats.
- [ ] **Milestone 3.5.5: Save/Load:** Implement `localStorage` persistence and auto-save.
- [ ] **Milestone 3.5.6: Permadeath:** Implement save-wiping on defeat.
- [ ] **Milestone 3.5.7: Main Menu:** Add title screen and selection for 3 starters (Fire/Water/Earth).

## **Epic 7: The Daemon Protocol (Power Cards & Expansion)**
*Focus: Implementing persistent Power Cards (Daemons) and expanding the card pool to support Norse archetypes.*
- [ ] **Milestone 7.1: Daemon Card Logic:** Implement the "Install" mechanic for battle-long persistent buffs.
- [ ] **Milestone 7.2: Archetype Card Dump:** Add the remaining 50+ cards to the registry for Fire, Water, Earth, and Nature.
- [ ] **Milestone 7.3: The Encounter Tier System:** Create randomized Grunt, Elite, and Boss encounters.

---

## **Epic 8: The Gauntlet & The Gym (Game Loop)**
*Focus: Establishing the core loop of elemental farming and tiered boss challenges.*
- [ ] **Milestone 8.1: Elemental Encounter Generator:** Logic to spawn random enemies based on a selected type.
- [ ] **Milestone 8.2: Terminal Hub UI:** Navigation between Training (Encounters) and The Breach (Gyms).
- [ ] **Milestone 8.3: Gym Gauntlet System:** Multi-stage battles with persistent HP/Energy.
- [ ] **Milestone 8.4: Relic Reward System:** Implementing permanent hardware bonuses for the player save.

## **Epic 9: The Developer Toolkit (Card Editor & Balancing)**
*Focus: Creating a data-driven studio for rapid card creation and mathematical balance verification.*
- [ ] **Milestone 9.1: JSON Registry Migration:** Refactor the registry to load from external JSON files.
- [ ] **Milestone 9.2: Card Studio UI:** Build the visual editor with real-time HUD previews.
- [ ] **Milestone 9.3: The Heuristic Auditor:** Implement the mathematical "Budget Score" engine to detect overpowered cards.
- [ ] **Milestone 9.4: Local File IO:** Setup the bridge to save editor changes directly to the project source.

---

## **Current Priority: Epic 8 (The Gauntlet & The Gym)**
**Next Task:** Implement Milestone 8.1 (Elemental Encounter Generator).
