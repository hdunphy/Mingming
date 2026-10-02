// @vitest-environment jsdom
/**
 * TICKET 169e — the tier picker on the run-start screen, mounted and clicked.
 *
 * The repo has no `@testing-library/react`, so this mounts with `createRoot` + `act`, as
 * `EventNode.test.tsx` does. The store is real (a `game` and a `run` slice), so launching dispatches
 * the real `startRun` and the test reads the run that came back.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import RunStart from './RunStart';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import type { IRanchState } from '../../engine/runTypes';
import { loadSettings, saveSettings } from '../settings/settings';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const KRAKEN = { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 };

function makeStore(over: Partial<IRanchState> = {}) {
    return configureStore({
        reducer: { game: gameReducer, run: runReducer },
        preloadedState: {
            game: { ...createEmptyRanch(), roster: [KRAKEN], ...over },
            run: { run: null },
        },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
    localStorage.clear();
});

/*
 * TICKET 182b: the tier row is not drawn until a gym has been cleared, so the cases that look at
 * LOCKED tiers on a fresh ranch switch "Show advanced content" on first. (`RunStart.hideEmpty` has
 * the cases for the hidden state itself.)
 */
const showAdvanced = (): void => saveSettings({ ...loadSettings(), showAdvancedContent: true });

async function mount(store: ReturnType<typeof makeStore>): Promise<void> {
    await act(async () => {
        root.render(<Provider store={store}><RunStart /></Provider>);
    });
}

const tierButton = (n: number): HTMLButtonElement => {
    const found = [...host.querySelectorAll<HTMLButtonElement>('.ranch-tier-picker button')].find(
        (button) => button.textContent?.trim() === `Tier ${n}`,
    );
    if (!found) throw new Error(`no Tier ${n} button`);
    return found;
};
const pressedTiers = (): string[] =>
    [...host.querySelectorAll<HTMLButtonElement>('.ranch-tier-picker button[aria-pressed="true"]')].map((b) =>
        (b.textContent ?? '').trim(),
    );

async function click(button: Element | null | undefined): Promise<void> {
    expect(button, 'element to click').toBeTruthy();
    await act(async () => { (button as HTMLElement).click(); });
}

describe('the tier picker', () => {
    it('with an empty ranch only Tier 0 is open, and it is the one selected', async () => {
        showAdvanced();
        await mount(makeStore());
        expect(tierButton(0).disabled).toBe(false);
        for (const n of [1, 2, 3]) expect(tierButton(n).disabled, `Tier ${n}`).toBe(true);
        expect(pressedTiers()).toEqual(['Tier 0']);
    });

    it('tells the player how to unlock a locked tier', async () => {
        showAdvanced();
        await mount(makeStore());
        expect(host.textContent).toContain('Beat any gym on Tier 0 to unlock.');
        expect(host.textContent).toContain('Beat any gym on Tier 2 to unlock.');
    });

    it('after a tier-1 clear, Tiers 0 to 2 are open and Tier 2 is pre-selected', async () => {
        await mount(makeStore({ gymsCleared: ['gym_emberfall'], tierClears: { gym_emberfall: [0, 1] } }));
        for (const n of [0, 1, 2]) expect(tierButton(n).disabled, `Tier ${n}`).toBe(false);
        expect(tierButton(3).disabled).toBe(true);
        expect(pressedTiers()).toEqual(['Tier 2']);
    });

    it('prints the selected tier’s name and description, and follows a click', async () => {
        await mount(makeStore({ tierClears: { gym_emberfall: [0, 1] } }));
        expect(host.textContent).toContain('Elite Territory');
        await click(tierButton(1));
        expect(pressedTiers()).toEqual(['Tier 1']);
        expect(host.textContent).toContain('Armed Wilds');
        expect(host.textContent).toContain('Wild Mingmings run their firmware.');
    });

    it('clicking a locked tier does nothing', async () => {
        showAdvanced();
        await mount(makeStore());
        await click(tierButton(2));
        expect(pressedTiers()).toEqual(['Tier 0']);
    });

    it('shows each gym’s cleared tiers as pips, and nothing for a gym with none', async () => {
        await mount(makeStore({ tierClears: { gym_emberfall: [0, 1, 2] } }));
        const cards = [...host.querySelectorAll('.ranch-offer')];
        const emberfall = cards.find((c) => c.textContent?.includes('Emberfall'))!;
        const tidewrack = cards.find((c) => c.textContent?.includes('Tidewrack'))!;
        expect(emberfall.textContent).toContain('Cleared: 0 1 2');
        expect(tidewrack.textContent).not.toContain('Cleared');
    });

    it('no longer prints the old "tier 1" label on an offer card', async () => {
        await mount(makeStore());
        for (const card of host.querySelectorAll('.ranch-offer')) {
            expect(card.textContent).not.toMatch(/gym · tier/i);
        }
    });

    it('at Tier 3 each offer prints the leader-Driver line; below it does not', async () => {
        await mount(makeStore({ tierClears: { gym_emberfall: [0, 1, 2] } }));
        expect(pressedTiers()).toEqual(['Tier 3']);
        // TICKET 182a: the leader-Driver line moved from the card face to the card's hover.
        const hovers = () => [...host.querySelectorAll('.ranch-offer')].map((c) => c.getAttribute('title') ?? '');
        expect(hovers().filter((t) => t.includes('Tier 3: active in all three gauntlet fights.'))).toHaveLength(3);
        expect(host.textContent).not.toContain('Tier 3: active in all three gauntlet fights.');
        await click(tierButton(2));
        expect(hovers().filter((t) => t.includes('Tier 3: active'))).toHaveLength(0);
    });
});

describe('launching', () => {
    it('with Tier 2 selected produces a run at tier 2, and the choice survives the party screen', async () => {
        const store = makeStore({ tierClears: { gym_emberfall: [0, 1] } });
        await mount(store);
        expect(pressedTiers()).toEqual(['Tier 2']);

        await click(host.querySelector('.ranch-offer'));
        // TICKET 182b: one Mingming on the roster is the party - there is no picker to click.
        const begin = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Start run'));
        await click(begin);

        expect(store.getState().run.run?.tier).toBe(2);
    });

    it('with nothing cleared produces a tier-0 run', async () => {
        const store = makeStore();
        await mount(store);
        await click(host.querySelector('.ranch-offer'));
        await click([...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Start run')));
        expect(store.getState().run.run?.tier).toBe(0);
    });
});
