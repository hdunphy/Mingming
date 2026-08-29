// @vitest-environment jsdom
/**
 * THE DESKTOP SAVE BACKEND — ticket 42.
 *
 * # WHAT THESE TESTS ARE ACTUALLY GUARDING
 *
 * Not "does the adapter forward a call". The two things that can lose a player's save:
 *
 *  1. **The error contract.** `SaveSystem` is written against `LocalSaveStorage`'s exact behaviour
 *     — reads swallow and report absence, writes THROW. The bridge cannot throw across IPC, so it
 *     returns `{ ok }` and this adapter has to turn a failure back into a throw. If it does not,
 *     `saveRanch` reports success on a full disk and ticket 04's banner never appears.
 *  2. **The one-time import guard.** It runs on every boot, so the test that matters is that it
 *     REFUSES to run when the file store already has something in it — a second run would restore
 *     a stale `localStorage` snapshot over a played save.
 *
 * The bridge is a plain object here rather than a mock of Electron. That is the point of
 * `desktopStorage.ts` importing nothing from `electron`: the whole backend is testable in jsdom.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    DesktopSaveStorage,
    SAVE_KEY_PREFIX,
    desktopBridge,
    importLegacyLocalStorage,
    installDesktopSaveStorage,
    usingDesktopSaves,
    type IDesktopBridge,
} from './desktopStorage';
import { getSaveStorage, resetSaveStorage, type ISaveStorage } from './storage';

/** An in-memory stand-in for `desktop/main.cjs`, with the same `{ ok }` return shapes. */
function fakeBridge(options: { failWrites?: string; throwOn?: Set<string> } = {}): IDesktopBridge & {
    files: Map<string, string>;
    logs: Map<string, string>;
} {
    const files = new Map<string, string>();
    const logs = new Map<string, string>();
    const boom = (method: string) => {
        if (options.throwOn?.has(method)) throw new Error(`bridge exploded in ${method}`);
    };
    return {
        files,
        logs,
        isDesktop: true,
        read(key) {
            boom('read');
            return files.get(key) ?? null;
        },
        write(key, value) {
            boom('write');
            if (options.failWrites) return { ok: false, error: options.failWrites };
            files.set(key, value);
            return { ok: true };
        },
        remove(key) {
            boom('remove');
            files.delete(key);
            return { ok: true };
        },
        keys() {
            boom('keys');
            return [...files.keys()];
        },
        writeRunLog(fileName, contents) {
            logs.set(fileName, contents);
            return { ok: true, path: `/userData/run-logs/${fileName}` };
        },
        paths: () => ({ userData: '/userData', saves: '/userData/saves', runLogs: '/userData/run-logs' }),
        revealRunLogs: () => ({ ok: true }),
    };
}

function installFakeWindowBridge(bridge: unknown): void {
    (window as unknown as Record<string, unknown>).mingmingDesktop = bridge;
}

afterEach(() => {
    delete (window as unknown as Record<string, unknown>).mingmingDesktop;
    localStorage.clear();
    resetSaveStorage();
});

describe('desktopBridge', () => {
    it('is undefined in the browser, which is what makes the install a no-op there', () => {
        expect(desktopBridge()).toBeUndefined();
        expect(installDesktopSaveStorage()).toBe(false);
        expect(usingDesktopSaves()).toBe(false);
    });

    it('ignores an object that does not claim to be the desktop build', () => {
        // Anything can write to `window`. `isDesktop` is the one thing the preload sets, and a
        // half-shaped object reaching the save layer would be worse than no bridge at all.
        installFakeWindowBridge({ read: () => null, write: () => ({ ok: true }) });
        expect(desktopBridge()).toBeUndefined();
        expect(installDesktopSaveStorage()).toBe(false);
    });
});

describe('DesktopSaveStorage', () => {
    it('round-trips a value and enumerates keys', () => {
        const bridge = fakeBridge();
        const storage = new DesktopSaveStorage(bridge);

        expect(storage.read('mingming_ranch')).toBeNull();
        storage.write('mingming_ranch', '{"a":1}');
        expect(storage.read('mingming_ranch')).toBe('{"a":1}');
        expect(storage.keys()).toEqual(['mingming_ranch']);

        storage.remove('mingming_ranch');
        expect(storage.read('mingming_ranch')).toBeNull();
        expect(storage.keys()).toEqual([]);
    });

    it('THROWS when the main process reports a failed write, carrying its message', () => {
        // The contract `SaveSystem` classifies on. A silent failure here is a run lost with the
        // game still saying "saved".
        const storage = new DesktopSaveStorage(fakeBridge({ failWrites: 'ENOSPC: no space left' }));
        expect(() => storage.write('mingming_ranch', '{}')).toThrow(/ENOSPC/);
    });

    it('throws on a write even when the bridge call itself explodes', () => {
        const storage = new DesktopSaveStorage(fakeBridge({ throwOn: new Set(['write']) }));
        expect(() => storage.write('mingming_ranch', '{}')).toThrow();
    });

    it('swallows read, remove and keys failures, exactly as the browser backend does', () => {
        const storage = new DesktopSaveStorage(
            fakeBridge({ throwOn: new Set(['read', 'remove', 'keys']) }),
        );
        expect(storage.read('mingming_ranch')).toBeNull();
        expect(storage.keys()).toEqual([]);
        expect(() => storage.remove('mingming_ranch')).not.toThrow();
    });
});

describe('importLegacyLocalStorage', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('moves every mingming_ key into an empty file store, and nothing else', () => {
        localStorage.setItem(`${SAVE_KEY_PREFIX}ranch`, '{"ranch":true}');
        localStorage.setItem(`${SAVE_KEY_PREFIX}run__abc`, '{"run":true}');
        localStorage.setItem('some_other_app', 'not ours');

        const bridge = fakeBridge();
        const storage = new DesktopSaveStorage(bridge);
        expect(importLegacyLocalStorage(storage)).toBe(2);

        expect(bridge.files.get(`${SAVE_KEY_PREFIX}ranch`)).toBe('{"ranch":true}');
        expect(bridge.files.get(`${SAVE_KEY_PREFIX}run__abc`)).toBe('{"run":true}');
        expect(bridge.files.has('some_other_app')).toBe(false);
    });

    it('REFUSES to run when the file store already holds anything', () => {
        // The guard that stops a stale browser snapshot overwriting a played desktop save. It is
        // the destination's state rather than a flag on purpose: a flag can be lost with the
        // storage it lives in, and then it is gone exactly when it is needed.
        localStorage.setItem(`${SAVE_KEY_PREFIX}ranch`, '{"stale":true}');

        const bridge = fakeBridge();
        bridge.files.set(`${SAVE_KEY_PREFIX}ranch`, '{"played":true}');

        expect(importLegacyLocalStorage(new DesktopSaveStorage(bridge))).toBe(0);
        expect(bridge.files.get(`${SAVE_KEY_PREFIX}ranch`)).toBe('{"played":true}');
    });

    it('keeps whatever it managed to copy when a write fails part-way', () => {
        localStorage.setItem(`${SAVE_KEY_PREFIX}a`, '1');
        localStorage.setItem(`${SAVE_KEY_PREFIX}b`, '2');

        const written = new Map<string, string>();
        let calls = 0;
        const flaky: ISaveStorage = {
            read: () => null,
            write(key, value) {
                calls += 1;
                if (calls > 1) throw new Error('disk full');
                written.set(key, value);
            },
            remove: () => {},
            keys: () => [],
        };

        // Does not throw — a failed migration must never take the whole game down — and reports
        // only what actually landed.
        expect(importLegacyLocalStorage(flaky)).toBe(1);
        expect(written.size).toBe(1);
    });
});

describe('installDesktopSaveStorage', () => {
    it('swaps the active backend and migrates in one call', () => {
        localStorage.setItem(`${SAVE_KEY_PREFIX}ranch`, '{"carried":true}');
        const bridge = fakeBridge();
        installFakeWindowBridge(bridge);

        expect(installDesktopSaveStorage()).toBe(true);
        expect(usingDesktopSaves()).toBe(true);
        expect(getSaveStorage().read(`${SAVE_KEY_PREFIX}ranch`)).toBe('{"carried":true}');
        expect(bridge.files.get(`${SAVE_KEY_PREFIX}ranch`)).toBe('{"carried":true}');
    });

    it('is idempotent across a second boot — the second install migrates nothing', () => {
        localStorage.setItem(`${SAVE_KEY_PREFIX}ranch`, '{"v":1}');
        const bridge = fakeBridge();
        installFakeWindowBridge(bridge);

        installDesktopSaveStorage();
        // The player then plays, and the file store moves on.
        getSaveStorage().write(`${SAVE_KEY_PREFIX}ranch`, '{"v":2}');
        installDesktopSaveStorage();

        expect(bridge.files.get(`${SAVE_KEY_PREFIX}ranch`)).toBe('{"v":2}');
    });
});
