# Roadmap: Agile Initiative "Rewrite" (Unity to React/TS)

## **Goal**
A complete architectural migration of **Mingming** from Unity/C# to a high-performance React/TypeScript/Vite stack, optimized for a future Steam release via Electron.

---

## **Epic 1: The Headless Kernel (Logic Core)**
*Focus: 100% UI-independent combat engine.*
- **Milestone 1.1: State Definitions:** Define Typescript interfaces for `MingMing`, `Program`, `Deck`, and `GameState`.
- **Milestone 1.2: The Damage Processor:** Implement the deterministic damage formula and elemental matrix.
- **Milestone 1.3: Turn State Machine:** Implement the 3-phase turn logic (Pre-Turn, Attack, Post-Turn).
- **Milestone 1.4: Status Effect Ecosystem:** Reducer logic for the 8 status effects (Burn stages, Sleep-break, etc.).
- **Milestone 1.5: The Middleware Hook System (Event Bus):** Implement a modular event system (e.g., `onDamageTaken`, `onStatusApplied`, `onProgramPlayed`) to allow cards/stats to hook into the engine.
- **Milestone 1.6: The Tactical AI (Min-Max):** Implement the Alpha-Beta Min-Max algorithm to evaluate optimal hand-play order based on board state (HP/Status weighting).
- **Milestone 1.7: The Headless Simulation Runner:** A CLI or script-based runner to execute 1,000+ full battles without a UI to verify balance and stability.

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
- **Milestone 3.3: Persistence:** LocalStorage/IndexedDB save system for current MingMings and Decks.

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

---

## **Current Priority: Epic 1 (The Headless Kernel)**
**Next Task:** Bootstrap the project and implement **Milestone 1.1 & 1.2**.
