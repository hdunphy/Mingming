// @vitest-environment jsdom
/**
 * Ticket 04's acceptance criterion, end to end: *"a deliberately thrown render error in battle
 * shows the boundary, and the save loaded afterwards is the last good one."*
 *
 * `ErrorBoundary.test.tsx` covers the component in isolation. This one wires it exactly as
 * `main.tsx` does — boundary inside the Provider, `onReturnToRanch` dispatching
 * `setBattleState(null)`, `snapshotState` reading the real store — and throws from the real
 * battle path, so the assertion is about the app's wiring rather than the component's.
 *
 * `BattleArena` is mocked rather than sabotaged for a reason: the point is to prove the boundary
 * catches *whatever* the battle screen does, not to plant a bug in the battle screen.
 */

import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Provider } from 'react-redux';

vi.mock('./ui/components/BattleArena', () => ({
    default: () => {
        throw new Error('battle screen exploded');
    },
}));

import App from './App';
import ErrorBoundary from './ui/components/ErrorBoundary';
import battleReducer, { setBattleState } from './ui/store/battleSlice';
import gameReducer from './ui/store/gameSlice';
import runReducer from './ui/store/runSlice';
import { createSparseBattleState } from './debug/scenarios/scenarioTestSupport';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const SAVE_KEY = 'mingming_save';
const LAST_GOOD = JSON.stringify({ version: 3, scrapCount: 1234 });

function makeStore() {
    return configureStore({
        // Ticket 09 added the `run` slice; `App` reads `state.run.run` to decide whether the
        // player is at the ranch or in a run, so a store without it renders undefined.
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
    });
}

let host: HTMLDivElement;
let root: Root;
let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(SAVE_KEY, LAST_GOOD);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host, { onUncaughtError() {}, onCaughtError() {} });
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    host.remove();
    consoleError.mockRestore();
});

describe('App + ErrorBoundary (main.tsx wiring)', () => {
    it('a throw from the battle screen shows the boundary instead of a white screen, and the stored save is untouched', async () => {
        const store = makeStore();
        store.dispatch(setBattleState(createSparseBattleState()));

        await act(async () => {
            root.render(
                <Provider store={store}>
                    <ErrorBoundary
                        onReturnToRanch={() => store.dispatch(setBattleState(null))}
                        snapshotState={() => store.getState()}
                    >
                        <App />
                    </ErrorBoundary>
                </Provider>,
            );
        });

        expect(host.textContent).toContain('SOMETHING BROKE');
        expect(host.textContent).toContain('Your save is safe');
        // The last good save is exactly as it was — the crash path writes nothing.
        expect(localStorage.getItem(SAVE_KEY)).toBe(LAST_GOOD);
    });

    it('RETURN TO RANCH clears the battle and gets the player back onto a rendering screen', async () => {
        const store = makeStore();
        store.dispatch(setBattleState(createSparseBattleState()));

        await act(async () => {
            root.render(
                <Provider store={store}>
                    <ErrorBoundary
                        onReturnToRanch={() => store.dispatch(setBattleState(null))}
                        snapshotState={() => store.getState()}
                    >
                        <App />
                    </ErrorBoundary>
                </Provider>,
            );
        });
        expect(host.textContent).toContain('SOMETHING BROKE');

        const button = [...host.querySelectorAll('button')].find((b) =>
            b.textContent?.includes('RETURN TO RANCH'),
        );
        await act(async () => {
            button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        expect(store.getState().battle.battle).toBeNull();
        expect(host.textContent).not.toContain('SOMETHING BROKE');
        // Something rendered — App's roster-0 early return, in a store with no roster.
        expect(host.textContent?.length).toBeGreaterThan(0);
        expect(localStorage.getItem(SAVE_KEY)).toBe(LAST_GOOD);
    });

    it('the crash report carries the live redux state, not a copy someone remembered to pass', async () => {
        const store = makeStore();
        store.dispatch(setBattleState(createSparseBattleState()));
        const copy = vi.fn<(text: string) => Promise<boolean>>(async () => true);

        await act(async () => {
            root.render(
                <Provider store={store}>
                    <ErrorBoundary copy={copy} snapshotState={() => store.getState()}>
                        <App />
                    </ErrorBoundary>
                </Provider>,
            );
        });

        const button = [...host.querySelectorAll('button')].find((b) =>
            b.textContent?.includes('COPY CRASH REPORT'),
        );
        await act(async () => {
            button!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        const payload = JSON.parse(copy.mock.calls[0][0]);
        expect(payload.error.message).toBe('battle screen exploded');
        expect(payload.state.battle).toBeTruthy();
        expect(payload.state.game).toBeTruthy();
    });
});
