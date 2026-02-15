# Epic 2 Technical Specification: The Interface Layer (Battle UI)

This document outlines the UI/UX requirements for the **Mingming** combat interface. The focus is on clarity for 3v3 engagements and "Juicy" feedback using **Framer Motion**.

---

## **1. Layout Architecture (`BattleArena.tsx`)**

The arena must handle up to 6 MingMings (3 Player, 3 Enemy) and a 9-card hand without feeling cluttered.

### **1.1. The "Perspective" Grid**
- **Enemy Side (Top):** 3 units arranged in a slight arc.
- **Player Side (Bottom):** 3 units arranged in a slight arc.
- **Z-Index Logic:** Units in the "Back" have lower scale (0.8x) and opacity (0.9x) until they move forward.

### **1.2. The "Step Forward" Lunge (Framer Motion)**
- **Trigger:** When a `Program` is selected (active card state).
- **Animation:** The source MingMing lunges toward the center (Y-offset: -50px).
- **Secondary Effect:** Non-targetable units are slightly dimmed; valid targets pulse with a white outline.

---

## **2. Program Hand & Interaction (`CardHand.tsx`)**

### **2.1. Hand Layout**
- **Dynamic Fan:** Cards should fan out at the bottom of the screen.
- **Hover State:** Selected cards pop up, showing a detailed **Tooltip** with:
    - Elemental Type Icon.
    - Energy Cost (matches the color of the unit's energy bar).
    - Raw Power and Status Effect details.

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
