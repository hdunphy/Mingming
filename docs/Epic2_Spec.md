# Epic 2 Technical Specification: The Interface Layer (Battle UI)

This document outlines the UI/UX requirements for the **Mingming** combat interface. The focus is on clarity for 3v3 engagements and "Juicy" feedback using **Framer Motion**.

---

## **1. Layout Architecture (`BattleArena.tsx`)**

The arena utilizes a **Side-on Perspective** (similar to Slay the Spire) to maximize the 3v3 battlefield while ensuring the 9-card hand does not overlap active units.

### **1.1. The "Side-on" Stage (Top 70%)**
- **Player Side (Left):** 3 units arranged in a staggered `>` formation.
- **Enemy Side (Right):** 3 units arranged in a staggered `<` formation.
- **Depth Stagger:** Units in the "Back" (further from center) should have slightly lower scale (0.9x) to simulate perspective.

### **1.2. The "Step Forward" Lunge (Framer Motion)**
- **Trigger:** When a `Program` is selected from the hand.
- **Animation:** The source MingMing lunges horizontally toward the center of the screen (X-offset: 60px for Player, -60px for Enemy).
- **Secondary Effect:** Valid targets pulse with an elemental outline; non-targets are dimmed (opacity 0.4x).

---

## **2. The Console: Hand & Interaction (Bottom 30%)**

### **2.1. Hand Layout (`CardHand.tsx`)**
- **Reserved Space:** The bottom 30% of the screen is a dedicated "Console" area. 
- **Non-Overlap:** The hand must **never** physically overlap the MingMing sprites or their health bars on the stage.
- **Dynamic Fan:** Cards fan out at the bottom. Hovering over a card slides it upward *within the Console area* and shows a high-fidelity tooltip.

### **2.2. Targeting System (Drag-to-Action)**
- **Drag Start:** Program card detaches from hand.
- **Valid Drop Zones:** Hovering over a target MingMing shows a "Preview" of the impact (e.g., "Super Effective!" label above health bar).
- **Multi-Targeting:** For 'Side' target programs, hovering over one enemy highlights the entire opposing side.

---

## **3. Reactive Feedback & Particles**

### **3.1. Health & Energy Bars**
- **Health:** Smooth transition (tweening) during damage. Numbers "Shake" and change color based on severity (Red for Super Effective, Gray for Resisted).
- **Energy:** Segmented pips to represent individual energy units.

### **3.2. Damage Numbers (Splatters)**
- **Formula Impact:** Damage numbers pop out of the target and float upward.
- **Font Scaling:** `fontSize = baseSize * (damage / targetMaxHp)`. Critical/Super-Effective hits are larger.

---

## **4. State-UI Sync (Zustand/Redux)**

The UI must reflect the **Kernel** phases perfectly:
- **PRE_TURN:** Cards fly from deck to hand one by one (staggered animation).
- **ACTION:** UI is interactable.
- **POST_TURN:** Hand "Purges" by sliding off-screen into the discard pile.

---

## **5. Mobile/Steam Considerations**
- **Responsive Scaling:** UI must work at 16:9 (Steam Deck) and 4:3 (Legacy) aspect ratios.
- **Hotkeys:** 
    - `1-9`: Select card.
    - `Space`: End Turn.
    - `Tab`: Toggle detailed unit stats.
