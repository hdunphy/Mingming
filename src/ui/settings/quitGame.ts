/**
 * THE WAY OUT — the 2026-08-30 playtest.
 *
 * Henry: *"Only way to exit is the window X button."* He was right, and it was not an oversight in
 * one screen: the desktop build hides the Electron menu bar (`autoHideMenuBar`, ticket 42 — "it is
 * a game; the Edit/View menu is noise"), so the menu that would have carried File > Quit is not
 * there, and nothing in `src/` could ask the main process for anything but saves and run logs.
 *
 * # WHY THIS IS A MODULE AND NOT THREE LINES IN THE SETTINGS SCREEN
 *
 * Two questions, and the screen must not have to know either answer: *is there anything to quit
 * to?* and *did it work?* The web build has no answer to the first — a page cannot close itself
 * unless a script opened it, so a QUIT button there would be a control that does nothing, which is
 * the specific failure ticket 36 called out as "dead controls" and put a whole section on screen to
 * avoid. `canQuit()` is what lets the button be absent rather than dead.
 *
 * # THERE IS NOTHING TO SAVE ON THE WAY OUT
 *
 * Deliberately no flush, no "saving…" state, no confirm on the engine's behalf. `store.subscribe`
 * in `ui/store/store.ts` writes the ranch and the run on every change, so the bytes on disk are
 * already current at the instant the player reaches for this. The confirm the UI does put in front
 * of it is about a stray click, not about data.
 */

import { desktopBridge } from '../../engine/save/desktopStorage';

/** True when this build can actually exit — the desktop app, with a preload new enough to say so. */
export function canQuit(): boolean {
    return typeof desktopBridge()?.quit === 'function';
}

/**
 * Quit. Returns false if the bridge is not there, so a caller that renders the button on
 * `canQuit()` and then finds nothing (a race no user can produce, but a test can) is not left
 * believing it quit.
 */
export function quitGame(): boolean {
    const quit = desktopBridge()?.quit;
    if (!quit) return false;
    quit();
    return true;
}
