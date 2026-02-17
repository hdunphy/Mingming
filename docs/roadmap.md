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

## **Epic 6: The Augmentation Protocol**
*Focus: Long-term strategic depth and synergies.*
- **Milestone 6.1: Hardware Module System:** Implement physical "Relic" slots (max 3 per MingMing) with passive logic hooks.
- **Milestone 6.2: Persistent Daemon Logic:** Create a new card class that installs background processes for battle-long buffs.
- **Milestone 6.3: Modularity Balance:** Ensure AI accounts for installed Modules and active Daemons in its Min-Max scoring.

## **Epic 3.5: The Terminal Gauntlet (Roguelike Loop)**
*Focus: Creating a self-sustaining loop of Battle -> Rewards -> Management -> Battle using the current menu screens as the Hub.*
- [ ] **Milestone 3.5.1: Small Start:** Update `createStarterSave` for 1 MingMing and 12-card decks.
- [ ] **Milestone 3.5.2: Reward System:** Implement `RewardSystem.ts` for Scraps, Cards, and XP.
- [ ] **Milestone 3.5.3: Post-Battle UI:** Create the report screen with XP bars and loot reveal.
- [ ] **Milestone 3.5.4: Save/Load:** Implement `localStorage` persistence and auto-save.
- [ ] **Milestone 3.5.5: Permadeath:** Implement save-wiping on defeat.
- [ ] **Milestone 3.5.6: Main Menu:** Add title screen and starter selection (Fire/Water/Earth).

## **Epic 8: The LAN Protocol (Positioning & Adjacency)**
*Focus: Spatial strategy and team networking.*
- [ ] **Milestone 8.1: Grid-Aware State:** Add `slotIndex` to `IBattleEntity` and update the Reducer to track 3v3 positioning.
- [ ] **Milestone 8.2: Adjacency Logic:** Implement the "Networking" hook system where MingMings gain buffs based on neighbors (e.g., LAN Synergies).
- [ ] **Milestone 8.3: Positional Programs:** Create cards that manipulate positioning (e.g., `Re-Route.dm` to swap slots).
- [ ] **Milestone 8.4: Splash Damage Engine:** Update the Damage Processor to handle adjacency-based splash damage.

## **Epic 9: The Developer Toolkit (Modding & Creation)**
*Focus: Community longevity and rapid iteration.*
- [ ] **Milestone 9.1: The Blueprint Forge:** Visual UI for creating MingMings and adjusting IV scaling.
- [ ] **Milestone 9.2: The Program Compiler:** Visual UI for stacking `actions` and `constraints` for new cards.

---

## **Current Priority: Epic 2 (The Interface Layer)**
**Next Task:** Deconstruct Milestone 2.1 implementation requirements.
