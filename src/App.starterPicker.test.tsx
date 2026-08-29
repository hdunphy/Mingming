// @vitest-environment jsdom
/**
 * THE FIRST CLICK A PLAYER EVER MAKES.
 *
 * Reported 2026-08-24: *"I tried to run it and the buttons don't do anything."* They did — the
 * starter cards dispatched `addBlueprint` exactly as written. What did nothing was the screen:
 * `App` chose the picker on `roster.length === 0`, and a blueprint is not a roster member, so the
 * picker re-rendered itself identically and quietly stacked another blueprint on every press.
 *
 * That bug was unreachable from the test suite as it stood. Every other UI test in this repo uses
 * `renderToStaticMarkup`, which runs no effects and cannot click — a soft-lock is *precisely* the
 * class of defect a one-frame static render cannot see, because the frame it renders is correct.
 * `App.errorBoundary.test.tsx` already stands up the real thing (jsdom + `createRoot` + dispatched
 * `MouseEvent`s) for the same reason, so this file borrows its harness rather than inventing one.
 *
 * The assertion is deliberately about the *transition*, not about `state.game.blueprints`. A unit
 * test on the reducer would have passed all along.
 */

import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Provider } from 'react-redux';

import App from './App';
import battleReducer from './ui/store/battleSlice';
import gameReducer, { addBlueprint, addToRoster } from './ui/store/gameSlice';
import runReducer from './ui/store/runSlice';
import uiReducer from './ui/store/uiSlice';
import { createRanchMember } from './engine/gameTypes';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function makeStore() {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
    });
}

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    localStorage.clear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    host.remove();
});

async function mount(store: ReturnType<typeof makeStore>): Promise<void> {
    await act(async () => {
        root.render(
            <Provider store={store}>
                <App />
            </Provider>,
        );
    });
}

/** The starter cards are `motion.div`s, not buttons, so they are found by their copy. */
function starterCard(name: string): HTMLElement {
    const card = [...host.querySelectorAll<HTMLElement>('div')]
        .filter((el) => el.textContent?.includes(`STARTER CARD:`) && el.textContent.includes(name))
        .pop();
    if (!card) throw new Error(`no starter card for ${name}`);
    return card;
}

describe('the starter picker', () => {
    it('is what a brand-new save opens on', async () => {
        await mount(makeStore());
        expect(host.textContent).toContain('CHOOSE YOUR STARTER PROGRAM');
    });

    it('lets go of the screen when a starter is picked, and lands on the Assembly bay', async () => {
        const store = makeStore();
        await mount(store);

        await act(async () => {
            starterCard('KRAKEN').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        // The regression: this used to still say CHOOSE YOUR STARTER PROGRAM.
        expect(host.textContent).not.toContain('CHOOSE YOUR STARTER PROGRAM');
        expect(store.getState().game.blueprints.kraken).toBe(1);
        // And it lands somewhere the blueprint can actually be spent, rather than on Expedition
        // telling the player to go and find it.
        expect(host.textContent).toContain('Assembly bay');
    });

    it('does not come back for a player who holds a blueprint but has assembled nothing', async () => {
        // The exact state the old gate mis-read: this is a player mid-first-session, not a new one.
        const store = makeStore();
        store.dispatch(addBlueprint('fenrir'));
        await mount(store);
        expect(host.textContent).not.toContain('CHOOSE YOUR STARTER PROGRAM');
    });

    it('does not come back for a player with a roster and no blueprints left', async () => {
        const store = makeStore();
        store.dispatch(addToRoster(createRanchMember('ratatoskr')));
        await mount(store);
        expect(host.textContent).not.toContain('CHOOSE YOUR STARTER PROGRAM');
    });

    it('does come back after a wipe — nothing held, nothing built', async () => {
        // `wipeSave` leaves exactly this: the picker is the right thing to show, and the branch
        // reads both halves rather than remembering a "has onboarded" flag that a wipe could miss.
        await mount(makeStore());
        expect(host.textContent).toContain('CHOOSE YOUR STARTER PROGRAM');
    });
});
