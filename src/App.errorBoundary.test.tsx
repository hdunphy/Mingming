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
 *
 * This file was the original jsdom + `createRoot` + `act` harness; ticket 58 lifted it into
 * `testing/interaction`. It is the one user that OPTS OUT of the harness's `console.error` trap,
 * because throwing is the subject.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('./ui/components/BattleArena', () => ({
    default: () => {
        throw new Error('battle screen exploded');
    },
}));

import App from './App';
import ErrorBoundary from './ui/components/ErrorBoundary';
import { setBattleState } from './ui/store/battleSlice';
import { createSparseBattleState } from './debug/scenarios/scenarioTestSupport';
import { clickText, makeStore, mount } from './testing/interaction';
import type { TestStore } from './testing/interaction';

const SAVE_KEY = 'mingming_save';
const LAST_GOOD = JSON.stringify({ version: 3, scrapCount: 1234 });

/** A store mid-battle, with a last-good save on disk, mounted through the boundary as `main.tsx` does. */
async function mountCrashing(store: TestStore, copy?: (text: string) => Promise<boolean>): Promise<HTMLElement> {
    localStorage.clear();
    localStorage.setItem(SAVE_KEY, LAST_GOOD);
    store.dispatch(setBattleState(createSparseBattleState()));
    return mount(
        store,
        <ErrorBoundary
            copy={copy}
            onReturnToRanch={() => store.dispatch(setBattleState(null))}
            snapshotState={() => store.getState()}
        >
            <App />
        </ErrorBoundary>,
        // The throw is deliberate: React reports it through console.error and the root's error
        // hooks, and both are silenced here so the test reads the boundary rather than the noise.
        { allowConsoleError: true, keepStorage: true, rootOptions: { onUncaughtError() {}, onCaughtError() {} } },
    );
}

describe('App + ErrorBoundary (main.tsx wiring)', () => {
    it('a throw from the battle screen shows the boundary instead of a white screen, and the stored save is untouched', async () => {
        const host = await mountCrashing(makeStore());

        expect(host.textContent).toContain('SOMETHING BROKE');
        expect(host.textContent).toContain('Your save is safe');
        // The last good save is exactly as it was — the crash path writes nothing.
        expect(localStorage.getItem(SAVE_KEY)).toBe(LAST_GOOD);
    });

    it('RETURN TO RANCH clears the battle and gets the player back onto a rendering screen', async () => {
        const store = makeStore();
        const host = await mountCrashing(store);
        expect(host.textContent).toContain('SOMETHING BROKE');

        await clickText(host, 'RETURN TO RANCH');

        expect(store.getState().battle.battle).toBeNull();
        expect(host.textContent).not.toContain('SOMETHING BROKE');
        // Something rendered — App's roster-0 early return, in a store with no roster.
        expect(host.textContent?.length).toBeGreaterThan(0);
        expect(localStorage.getItem(SAVE_KEY)).toBe(LAST_GOOD);
    });

    it('the crash report carries the live redux state, not a copy someone remembered to pass', async () => {
        const copy = vi.fn<(text: string) => Promise<boolean>>(async () => true);
        const host = await mountCrashing(makeStore(), copy);

        await clickText(host, 'COPY CRASH REPORT');

        const payload = JSON.parse(copy.mock.calls[0][0]);
        expect(payload.error.message).toBe('battle screen exploded');
        expect(payload.state.battle).toBeTruthy();
        expect(payload.state.game).toBeTruthy();
    });
});
