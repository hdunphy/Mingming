/**
 * The one place in the codebase that names `localStorage` — ticket 23 (steam-release map), from
 * [ticket 26](../../../docs/wayfinder/steam-release/research/26-wrapper.md)'s findings.
 *
 * WHY THIS EXISTS. Steam Cloud syncs **files**. `localStorage` is not a file, so the desktop build
 * has to write JSON under `app.getPath('userData')` while the web build keeps using
 * `localStorage`. Ticket 26 measured the port: production code touched `localStorage` at six call
 * sites in three files, and two of them were already a `Storage | null` accessor — so the seam is
 * small if it is cut before the save layer is rewritten, and a second rewrite if it is cut after.
 * That is the whole reason it lands here in ticket 23 rather than in ticket 42.
 *
 * [Ticket 42](../../../docs/wayfinder/steam-release/tickets/42-desktop-packaging.md) implements
 * `FileSaveStorage` behind this interface. Nothing else needs to change when it does — which is
 * the test: `grep -rn "localStorage" src` outside this file should find only comments.
 *
 * The interface is deliberately **synchronous and tiny**, mirroring the `Storage` subset the game
 * actually uses. Node's `fs` has synchronous calls, and Electron's main process can expose a sync
 * bridge, so nothing here forces the save layer to go async — an async save API would leak into
 * every reducer that touches persistence.
 */

/** The subset of `Storage` the game uses. Deliberately not the whole DOM interface. */
export interface ISaveStorage {
    read(key: string): string | null;
    /** Throws on failure — quota and availability are classified by the caller (`SaveSystem`). */
    write(key: string, value: string): void;
    remove(key: string): void;
    /** Every key currently present. Used by `SaveSlots` to enumerate slots. */
    keys(): string[];
}

/**
 * Browser backend. Every method that *reads* swallows its own errors and reports absence, because
 * a read failure and a missing key are the same thing to a caller deciding "is there a save?".
 * `write` deliberately does NOT swallow: `SaveSystem` needs the throw to tell a full quota from an
 * unavailable store, and ticket 04's failure banner depends on that distinction.
 */
export class LocalSaveStorage implements ISaveStorage {
    private store(): Storage | null {
        try {
            // Touching `localStorage` can itself throw — privacy modes, embedded webviews with
            // storage disabled, and node (where it is simply absent).
            if (typeof localStorage !== 'undefined') return localStorage;
        } catch {
            // fall through
        }
        return null;
    }

    read(key: string): string | null {
        const s = this.store();
        if (!s) return null;
        try {
            return s.getItem(key);
        } catch {
            return null;
        }
    }

    write(key: string, value: string): void {
        const s = this.store();
        if (!s) throw new Error('Storage is unavailable');
        s.setItem(key, value);
    }

    remove(key: string): void {
        const s = this.store();
        if (!s) return;
        try {
            s.removeItem(key);
        } catch {
            // Nothing to remove either way.
        }
    }

    keys(): string[] {
        const s = this.store();
        if (!s) return [];
        try {
            const out: string[] = [];
            for (let i = 0; i < s.length; i++) {
                const k = s.key(i);
                if (k !== null) out.push(k);
            }
            return out;
        } catch {
            return [];
        }
    }
}

/**
 * The active backend. A module-level singleton rather than a parameter threaded through every save
 * function, for the same reason `SaveSlots` keeps its own: one of the callers is the autosave
 * subscription in `ui/store/store.ts`, and threading a backend through it would mean every
 * reducer's signature carrying persistence plumbing.
 */
let active: ISaveStorage = new LocalSaveStorage();

export function getSaveStorage(): ISaveStorage {
    return active;
}

/**
 * Swap the backend. Ticket 42 calls this once at Electron boot with a file-backed implementation;
 * tests call it to inject a fake. Returns the previous backend so a test can restore it.
 */
export function setSaveStorage(next: ISaveStorage): ISaveStorage {
    const previous = active;
    active = next;
    return previous;
}

/** Restore the default browser backend. Test seam. */
export function resetSaveStorage(): void {
    active = new LocalSaveStorage();
}
