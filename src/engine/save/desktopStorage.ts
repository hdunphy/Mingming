/**
 * THE DESKTOP SAVE BACKEND — ticket 42, behind ticket 23's seam.
 *
 * `storage.ts` predicted this file in its header: *"Ticket 42 implements `FileSaveStorage` behind
 * this interface. Nothing else needs to change when it does."* That held — this is the whole of the
 * desktop save port, and no other production file changed to accept it.
 *
 * # WHY SAVES HAD TO STOP BEING `localStorage`
 *
 * **Steam Cloud syncs files.** `localStorage` is not a file, so a player who plays on a desktop and
 * then on a Steam Deck would find an empty ranch. Ticket 26 measured the port and put the seam in
 * ticket 23 precisely so this step would be small.
 *
 * The files land in `userData/saves/`, one per key — which is one per slot, because the slot key IS
 * the storage key. That directory is what Steam **Auto-Cloud** gets pointed at in ticket 43: a path
 * rule, no code, 100 MB per write, which is four orders of magnitude more than this game needs.
 *
 * # THIS FILE IMPORTS NOTHING FROM ELECTRON
 *
 * It reads `window.mingmingDesktop`, which the preload put there. That keeps `src/` buildable for
 * the web with no conditional imports, no bundler externals and no `electron` in the web build's
 * dependency graph — and it means every test here runs in the ordinary jsdom environment with a
 * fake bridge object.
 */

import { getSaveStorage, setSaveStorage, type ISaveStorage } from './storage';

/** The preload's surface (`desktop/preload.cjs`). Structural, because `src/` cannot import it. */
export interface IDesktopBridge {
    readonly isDesktop: true;
    read(key: string): string | null;
    write(key: string, value: string): { ok: boolean; error?: string };
    remove(key: string): { ok: boolean };
    keys(): string[];
    writeRunLog(fileName: string, contents: string): { ok: boolean; path?: string; error?: string };
    paths(): { userData: string; saves: string; runLogs: string };
    revealRunLogs(): { ok: boolean };
}

/** The bridge, or undefined in the browser. The one test for "are we in the desktop build?". */
export function desktopBridge(): IDesktopBridge | undefined {
    if (typeof window === 'undefined') return undefined;
    const candidate = (window as unknown as { mingmingDesktop?: IDesktopBridge }).mingmingDesktop;
    return candidate?.isDesktop ? candidate : undefined;
}

/**
 * File-backed storage, over the sync bridge.
 *
 * The error contract is `LocalSaveStorage`'s, deliberately and to the letter: **reads swallow and
 * report absence** (a read failure and a missing key are the same answer to "is there a save?"),
 * **writes throw** (`SaveSystem` needs the throw to tell a full disk from an unavailable store, and
 * ticket 04's failure banner depends on that distinction). The bridge cannot throw across IPC, so
 * it returns `{ ok }` and this turns it back into the throw the caller is written against.
 */
export class DesktopSaveStorage implements ISaveStorage {
    constructor(private readonly bridge: IDesktopBridge) {}

    read(key: string): string | null {
        try {
            return this.bridge.read(key);
        } catch {
            return null;
        }
    }

    write(key: string, value: string): void {
        const result = this.bridge.write(key, value);
        if (!result?.ok) throw new Error(result?.error ?? 'Storage is unavailable');
    }

    remove(key: string): void {
        try {
            this.bridge.remove(key);
        } catch {
            // Nothing to remove either way.
        }
    }

    keys(): string[] {
        try {
            return this.bridge.keys();
        } catch {
            return [];
        }
    }
}

/**
 * Every storage key the game owns.
 *
 * A prefix rather than a list, because the two run-scoped stores are per-run
 * (`mingming_ranch__<id>`, `mingming_run__<id>`) and a list could not name them. It is used only by
 * the import below — the backends themselves never filter, because in the desktop build the saves
 * directory contains nothing else.
 */
export const SAVE_KEY_PREFIX = 'mingming_';

/**
 * Move a previous `localStorage` save into the file store, ONCE.
 *
 * # WHO THIS IS ACTUALLY FOR
 *
 * Not the web player — a browser origin and a packaged app share no storage, so nothing can be
 * carried across. It is for **anyone who ran an earlier desktop build**: Electron gives `file://` a
 * persistent `localStorage` inside the app's own profile, so a build that shipped before this file
 * existed left a real save sitting in a place the game has stopped reading. Without this, that
 * player's ranch silently becomes an empty one — the worst possible failure, because nothing errors
 * and the fix looks like "start again".
 *
 * # WHY IT IS SAFE TO RUN EVERY BOOT
 *
 * It copies only when the file store has **no keys at all**. A file store with anything in it is a
 * store that has been played, and overwriting that from a stale `localStorage` would be the same
 * data loss pointing the other way. So the guard is the state of the destination, not a flag — a
 * flag can be lost with the storage it lives in, and then the guard is gone exactly when it matters.
 *
 * Returns how many keys moved, for the boot log.
 */
export function importLegacyLocalStorage(next: ISaveStorage): number {
    if (next.keys().length > 0) return 0;
    if (typeof localStorage === 'undefined') return 0;

    let moved = 0;
    try {
        const legacy: Array<[string, string]> = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(SAVE_KEY_PREFIX)) continue;
            const value = localStorage.getItem(key);
            if (value !== null) legacy.push([key, value]);
        }
        for (const [key, value] of legacy) {
            next.write(key, value);
            moved += 1;
        }
    } catch {
        // A partial import is still better than none: whatever was copied before the failure is in
        // the file store, and the next boot will not re-run (the destination is no longer empty).
        // Throwing here would take the whole game down over a store the player may not even have.
    }
    return moved;
}

/**
 * Swap the file backend in, if this is the desktop build. Called once from `main.tsx`, before the
 * first render — the autosave subscription and the slot index both read the active backend, and
 * installing after they had run would mean a boot that loaded from one store and saved to another.
 *
 * A no-op in the browser, which is what lets `main.tsx` call it unconditionally.
 */
export function installDesktopSaveStorage(): boolean {
    const bridge = desktopBridge();
    if (!bridge) return false;

    const backend = new DesktopSaveStorage(bridge);
    const moved = importLegacyLocalStorage(backend);
    setSaveStorage(backend);
    if (moved > 0) console.info(`[saves] migrated ${moved} key(s) from localStorage into the file store.`);
    return true;
}

/** Whether the ACTIVE backend is the desktop one. For UI copy that names a real path. */
export function usingDesktopSaves(): boolean {
    return getSaveStorage() instanceof DesktopSaveStorage;
}
