/**
 * THE INTERACTION HARNESS (steam-release ticket 58).
 *
 * Every other UI test in this repo renders one frame with `renderToStaticMarkup`: no effects, no
 * event loop, no clicks. Two shipped blockers (2026-08-24 — the starter-picker soft-lock and the
 * codex recorder throwing inside the reducer) were invisible to that by construction, because the
 * one frame it renders was correct in both cases. This module is the thing that can say *"the player
 * did a thing, and then the game was different"*: jsdom + `createRoot` + `act` + dispatched events,
 * wired the way `main.tsx` wires it. `@testing-library/react` is not needed and stays forbidden.
 *
 * It fails a test on any `console.error` (both blockers surfaced first as one) unless the test says
 * `mount(..., { allowConsoleError: true })`. Unhandled rejections already fail the vitest run.
 *
 * Deliberately small. A harness that grows features needs its own tests; this one is three verbs.
 * Test files that use it must carry `// @vitest-environment jsdom` on their first line.
 */
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, expect, vi } from 'vitest';
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type RootOptions } from 'react-dom/client';
import { Provider } from 'react-redux';

import App from '../App';
import battleReducer from '../ui/store/battleSlice';
import gameReducer from '../ui/store/gameSlice';
import runReducer from '../ui/store/runSlice';
import uiReducer from '../ui/store/uiSlice';
import { installCanvasStub } from './canvasStub';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** The production reducer map without the autosave subscriber — `store.ts` writes localStorage. */
export function makeStore() {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
    });
}
export type TestStore = ReturnType<typeof makeStore>;

export interface MountOptions {
    /** Opt out of the console.error trap — only for a test that throws on purpose. */
    allowConsoleError?: boolean;
    rootOptions?: RootOptions;
    /** Leave `localStorage` as the test set it, instead of clearing it before the first render. */
    keepStorage?: boolean;
}

/*
 * jsdom has no canvas, and its `getContext` stub writes to `console.error` — which the trap below
 * turns into a failure. Installed once, at module load, because `BattleStage` mounts its particle
 * canvas inside an effect that no test can reach. See `canvasStub.ts` for why this is a stub and
 * not the `canvas` package.
 */
installCanvasStub();

const cleanups: Array<() => Promise<void>> = [];
let consoleError: ReturnType<typeof vi.spyOn> | null = null;
let trapArmed = false;

afterEach(async () => {
    for (const cleanup of cleanups.splice(0)) await cleanup();
    const calls = consoleError?.mock.calls ?? [];
    consoleError?.mockRestore();
    consoleError = null;
    if (trapArmed && calls.length > 0) {
        expect.fail(`console.error was called ${calls.length}x during the test:\n${calls.map((c) => String(c[0])).join('\n')}`);
    }
});

/** Mount any tree inside a Provider for `store`; returns the host element it rendered into. */
export async function mount(store: TestStore, tree: ReactNode, options: MountOptions = {}): Promise<HTMLElement> {
    if (!consoleError) consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    trapArmed = !options.allowConsoleError;
    // `App` reads the save at boot; a test that stores one first says `keepStorage`.
    if (!options.keepStorage) localStorage.clear();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host, options.rootOptions);
    cleanups.push(async () => {
        await act(async () => root.unmount());
        host.remove();
    });
    await act(async () => root.render(<Provider store={store}>{tree}</Provider>));
    return host;
}

/** `<App />` exactly as the player gets it. */
export function mountApp(store: TestStore, options?: MountOptions): Promise<HTMLElement> {
    return mount(store, <App />, options);
}

/** Let effects, microtasks and React commits settle. */
export async function flush(): Promise<void> {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

/** Fire one DOM event through React's delegation, then settle. */
export async function fire(target: Element, type: string, init: EventInit = {}): Promise<void> {
    await act(async () => {
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...init }));
    });
}

export function click(target: Element): Promise<void> {
    return fire(target, 'click');
}

/** The button (or `selector`) whose text contains `text`; throws with what WAS on screen if none. */
export function findText(host: ParentNode, text: string, selector = 'button'): HTMLElement {
    const found = [...host.querySelectorAll<HTMLElement>(selector)].find((el) => el.textContent?.includes(text));
    if (!found) {
        const seen = [...host.querySelectorAll<HTMLElement>(selector)].map((el) => el.textContent?.trim()).filter(Boolean);
        throw new Error(`no <${selector}> containing "${text}"; saw: ${JSON.stringify(seen.slice(0, 20))}`);
    }
    return found;
}

export function clickText(host: ParentNode, text: string, selector = 'button'): Promise<void> {
    return click(findText(host, text, selector));
}
