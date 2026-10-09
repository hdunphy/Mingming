// @vitest-environment jsdom
/**
 * TICKET 181a — the build label.
 *
 * Friends-and-family testers quote the text at the bottom of the main menu in their bug reports, so
 * three things have to be true: the menu and Settings show the label and commit the build was made
 * with, an exported run log carries them as `build`, and a build with no env var reads `dev`.
 */

import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Provider } from 'react-redux';

vi.mock('./buildInfo', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./buildInfo')>()),
    BUILD_INFO: { label: 'PLAYTEST 1', version: '0.4.0', commit: 'abc1234' },
}));

import MainMenuView from './components/MainMenuView';
import SettingsScreen from './screens/SettingsScreen';
import { exportRunLogs } from './settings/exportRunLog';
import { DEFAULT_BUILD_LABEL, DEFAULT_GAME_VERSION, UNKNOWN_BUILD_COMMIT, buildText, resolveBuildInfo } from './buildInfo';
import battleReducer from './store/battleSlice';
import gameReducer from './store/gameSlice';
import runReducer from './store/runSlice';
import uiReducer from './store/uiSlice';
import { emptyRunLog, writeRunLog } from '../engine/run/runLog';
import { resetSaveStorage, setSaveStorage, type ISaveStorage } from '../engine/save/storage';

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

beforeEach(() => {
    setSaveStorage(new MemoryStorage());
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
    resetSaveStorage();
    delete (window as unknown as Record<string, unknown>).mingmingDesktop;
});

function makeStore() {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
}

describe('the build label shows where a tester looks', () => {
    it('the main menu renders the injected label, version and commit (181e), and not the old hard-coded alpha line', async () => {
        await act(async () => {
            root.render(<Provider store={makeStore()}><MainMenuView /></Provider>);
        });
        expect(host.textContent).toContain('PLAYTEST 1 · v0.4.0 · abc1234');
        expect(host.textContent).not.toContain('ALPHA v0.3.5');
    });

    it('Settings shows the same text beside Export run log', async () => {
        await act(async () => {
            root.render(<Provider store={makeStore()}><SettingsScreen /></Provider>);
        });
        const note = host.querySelector('[data-testid="settings-build"]');
        expect(note).toBeTruthy();
        expect(note!.textContent).toContain('PLAYTEST 1 · v0.4.0 · abc1234');
        // Same section as the export button: the label sits where the log it names is exported.
        expect(note!.closest('section')).toBe([...host.querySelectorAll('button')].find(b => /No runs recorded|Save \d+ run/.test(b.textContent ?? ''))!.closest('section'));
    });
});

describe('an exported run log names its build', () => {
    it('writes build: { label, version, commit } at the top of the envelope (181e: build.version)', () => {
        const files = new Map<string, string>();
        (window as unknown as Record<string, unknown>).mingmingDesktop = {
            isDesktop: true,
            read: () => null,
            write: () => ({ ok: true }),
            remove: () => ({ ok: true }),
            keys: () => [],
            writeRunLog: (fileName: string, contents: string) => { files.set(fileName, contents); return { ok: true, path: fileName }; },
            paths: () => ({ userData: 'u', saves: 's', runLogs: 'r' }),
            revealRunLogs: () => ({ ok: true }),
        };
        writeRunLog(emptyRunLog('seed-a', 1000));

        expect(exportRunLogs()).not.toBeNull();

        expect(files.size).toBe(1);
        const envelope = JSON.parse([...files.values()][0]) as { build?: unknown; logs: unknown[] };
        expect(envelope.build).toEqual({ label: 'PLAYTEST 1', version: '0.4.0', commit: 'abc1234' });
        expect(envelope.logs).toHaveLength(1);
    });
});

describe('the defaults', () => {
    it('no env var reads dev, and no git reads unknown', () => {
        expect(resolveBuildInfo(undefined, undefined)).toEqual({ label: DEFAULT_BUILD_LABEL, version: DEFAULT_GAME_VERSION, commit: UNKNOWN_BUILD_COMMIT });
        expect(resolveBuildInfo('', '   ', ' ')).toEqual({ label: 'dev', version: '0.0.0', commit: 'unknown' });
        expect(DEFAULT_BUILD_LABEL).toBe('dev');
        expect(buildText(resolveBuildInfo(undefined, 'abc1234', '0.4.0'))).toBe('dev · v0.4.0 · abc1234');
    });

    it('trims a label that came in with stray whitespace', () => {
        expect(resolveBuildInfo('  PLAYTEST 1  ', ' 5557bbb ', ' 0.4.0 ')).toEqual({ label: 'PLAYTEST 1', version: '0.4.0', commit: '5557bbb' });
    });
});
