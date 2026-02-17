# Epic 3.5: The Terminal Gauntlet (Roguelike Loop)
*Goal: Create a self-sustaining loop of Battle -> Rewards -> Management -> Battle using the current menu screens as the Hub.*

## **Milestone 1: Dynamic Starting Roster & Minimalist Decks**
*   **Small Start:** Modify `createStarterSave` to provide only **one** level 1 MingMing and a **12-card** starter deck.
*   **Roster Logic:** Ensure the engine and UI handle single-unit parties (1v1) correctly without crashing.

## **Milestone 2: The Reward System (`RewardSystem.ts`)**
*   **Loot Calculation:** Implement a function that generates a reward bundle after victory:
    *   **Scraps:** Fixed amount + random variance.
    *   **Cards:** 3 random Program choices (player picks one or takes all for now).
    *   **Blueprints:** Low-percentage roll to unlock a new MingMing architecture.
*   **XP Distribution:** A `distributeXp` function that awards XP to all MingMings on the winning side.

## **Milestone 3: The Post-Battle Report Screen**
*   **Visual Summary:** A new screen that appears after `WinLossOverlay`.
*   **Progression Display:** 
    *   Animated XP bars filling up.
    *   List of looted Scraps and Programs.
*   **Commit Logic:** A "Continue" button that dispatches rewards to the global state and returns the player to the Hub.

## **Milestone 4: Persistence (Save/Load System)**
*   **Storage Interface:** Implement a `SaveSystem.ts` using `localStorage` for now.
*   **Auto-Save:** Trigger a save after every battle and every management change (Deck/Synthesis).
*   **Load on Boot:** Logic to check for existing save data on app launch; if none exists, trigger the Starting Roster selection.

## **Milestone 5: Permadeath & Run Logic**
*   **Defeat Consequence:** If the player loses a battle, the save file is wiped (or flagged as "Inert"), forcing a restart.
*   **Hardcore Mode:** Option to toggle permadeath in the future, but enabled by default for the "Gauntlet" feel.

## **Milestone 6: The Main Menu & Starter Selection**
*   **The First Choice:** A clean title screen with "New Game" and "Continue" (if save exists).
*   **Architect Selection:** A sub-menu for "Choose your starting MingMing" (Fire, Water, or Earth starter).
*   **Initialization:** Clicking a starter generates the 12-card deck and the Level 1 instance, then saves and enters the Hub.
