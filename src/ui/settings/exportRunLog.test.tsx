// @vitest-environment jsdom
/**
 * "…AND CAN BE EXPORTED TO A FILE IN ONE CLICK" — ticket 59's Done-when, taken literally.
 *
 * A unit test on `exportRunLogs()` would prove the function builds a Blob. It would not prove the
 * button exists, is enabled when there is something to save, is disabled when there is not, or
 * calls the thing at all — and every one of those is a way for a playtester to end up describing
 * their run from memory, which is the entire problem the ticket exists to solve. So this clicks it,
 * with the jsdom + `createRoot` harness ticket 58 is standardising.
 *
 * `URL.createObjectURL` does not exist in jsdom, so it is stubbed rather than the download being
 * mocked out: stubbing the one missing browser API leaves the real anchor-and-click path under
 * test, which is where the interesting mistakes live.
 */

import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Provider } from 'react-redux';

import SettingsScreen from '../screens/SettingsScreen';
import { exportRunLogs, storedRunLogCount } from './exportRunLog';
import battleReducer from '../store/battleSlice';
import gameReducer from '../store/gameSlice';
import runReducer from '../store/runSlice';
import uiReducer from '../store/uiSlice';
import { DEFAULT_SETTINGS, saveSettings } from './settings';
import { emptyRunLog, writeRunLog } from '../../engine/run/runLog';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from '../../engine/save/storage';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

class MemoryStorage implements ISaveStorage {
    readonly data = new Map<string, string>();
    read(key: string) { return this.data.get(key) ?? null; }
    write(key: string, value: string) { this.data.set(key, value); }
    remove(key: string) { this.data.delete(key); }
    keys() { return [...this.data.keys()]; }
}

let host: HTMLDivElement;
let root: Root;
let created: string[];

beforeEach(() => {
    setSaveStorage(new MemoryStorage());
    created = [];
    // jsdom has no object URLs. Stub the two halves; everything else stays real.
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => {
        const url = `blob:test/${created.length}`;
        created.push(url);
        return url;
    };
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
    resetSaveStorage();
});

function makeStore() {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
}

async function mount(): Promise<void> {
    await act(async () => {
        root.render(<Provider store={makeStore()}><SettingsScreen /></Provider>);
    });
}

const exportButton = (): HTMLButtonElement | undefined =>
    [...host.querySelectorAll('button')].find(b => /Save \d+ run|No runs recorded/.test(b.textContent ?? ''));

describe('exporting the run log', () => {
    it('says so and stays disabled when there is nothing to hand over', async () => {
        await mount();
        const button = exportButton();
        expect(button).toBeTruthy();
        expect(button!.disabled).toBe(true);
        expect(button!.textContent).toContain('No runs recorded yet');
    });

    it('writes a file on one click, and says what it was called', async () => {
        writeRunLog(emptyRunLog('seed-a', 1000));
        writeRunLog(emptyRunLog('seed-b', 2000));
        await mount();

        const button = exportButton()!;
        expect(button.disabled).toBe(false);
        expect(button.textContent).toContain('Save 2 runs');

        const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        await act(async () => {
            button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(clicked).toHaveBeenCalledTimes(1);
        expect(created).toHaveLength(1);
        // The screen must name the file. "Saved!" with no name is a playtester hunting their
        // downloads folder for something they cannot identify.
        expect(host.textContent).toMatch(/Saved as mingming-run-log-\d{4}-\d{2}-\d{2}T\d{4}\.json/);
        clicked.mockRestore();
    });

    it('returns null rather than claiming a save that did not happen', () => {
        expect(storedRunLogCount()).toBe(0);
        expect(exportRunLogs()).toBeNull();
    });
});

/**
 * TICKET 42: the same click, in the packaged build, must go to a PATH and not to a download.
 *
 * This is the half of ticket 59 the wrapper exists to finish — Henry asked for *"send me the files
 * from {file location}"* — and it is worth a test because the failure is invisible: a build that
 * silently kept downloading would still say "Saved as …", and the tester would look in a folder
 * that never fills up.
 */
describe('the desktop route', () => {
    const logs = new Map<string, string>();
    let failWrites = false;

    beforeEach(() => {
        logs.clear();
        failWrites = false;
        (window as unknown as Record<string, unknown>).mingmingDesktop = {
            isDesktop: true,
            read: () => null,
            write: () => ({ ok: true }),
            remove: () => ({ ok: true }),
            keys: () => [],
            writeRunLog: (fileName: string, contents: string) => {
                if (failWrites) return { ok: false, error: 'disk full' };
                logs.set(fileName, contents);
                return { ok: true, path: `C:\\Users\\test\\AppData\\Roaming\\Mingming\\run-logs\\${fileName}` };
            },
            paths: () => ({
                userData: 'C:\\Users\\test\\AppData\\Roaming\\Mingming',
                saves: 'C:\\Users\\test\\AppData\\Roaming\\Mingming\\saves',
                runLogs: 'C:\\Users\\test\\AppData\\Roaming\\Mingming\\run-logs',
            }),
            revealRunLogs: () => ({ ok: true }),
        };
    });

    afterEach(() => {
        delete (window as unknown as Record<string, unknown>).mingmingDesktop;
    });

    it('writes through the bridge instead of downloading', async () => {
        writeRunLog(emptyRunLog('seed-a', 1000));
        await mount();

        const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        await act(async () => {
            exportButton()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(logs.size).toBe(1);
        // No anchor, no object URL — the download path was not taken at all.
        expect(clicked).not.toHaveBeenCalled();
        expect(created).toHaveLength(0);
        clicked.mockRestore();
    });

    it('falls back to a download when the main process cannot write', async () => {
        // A transcript that reaches the player's Downloads folder is worth more than one that is
        // lost because `userData` was read-only.
        failWrites = true;
        writeRunLog(emptyRunLog('seed-a', 1000));
        await mount();

        const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        await act(async () => {
            exportButton()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(logs.size).toBe(0);
        expect(clicked).toHaveBeenCalledTimes(1);
        clicked.mockRestore();
    });

    it('names the real folder in the settings copy rather than "your downloads folder"', async () => {
        saveSettings({ ...DEFAULT_SETTINGS, autoSaveRunLog: true });
        await mount();

        expect(host.textContent).toContain('AppData\\Roaming\\Mingming\\run-logs');
        expect(host.textContent).not.toContain('downloads folder');
        expect([...host.querySelectorAll('button')].some(b => b.textContent === 'Open the folder')).toBe(true);
    });
});
