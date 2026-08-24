// @vitest-environment jsdom
/**
 * THE CODEX RECORDER MUST NOT BREAK THE FIGHT IT IS WATCHING.
 *
 * Reported 2026-08-24: *"I release my drag and drop and then the animations and damage numbers
 * play, but the card doesn't get discarded and the damage doesn't stay."* The console said why:
 *
 *     Uncaught Error: You may not call store.getState() while the reducer is executing.
 *         at useCodexRecorder.ts:76
 *         at BattleEventBus.emit (events.ts:141)
 *         at applyMutations (resolutionEngine.ts:99)
 *
 * `PROGRAM_PLAYED` is emitted from inside the engine reducer, which runs inside
 * `battleSlice.playProgram`, which is a Redux reducer — so the recorder's `dispatch` threw, the
 * throw unwound back through the engine, and `state.battle` was never reassigned. `useBattleVfx`
 * subscribes to the same bus and is called first, so the hit animation had already played against
 * a state that was about to be thrown away.
 *
 * The test is therefore about the *battle*, not about the codex: a card played with the recorder
 * mounted must leave the hand and take HP off the target. The codex assertions are second, and they
 * are what stops the fix from degrading into "deleted the listener".
 */

import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Provider } from 'react-redux';

import battleReducer, { playProgram, startBattle } from '../store/battleSlice';
import gameReducer from '../store/gameSlice';
import runReducer from '../store/runSlice';
import uiReducer from '../store/uiSlice';
import { useCodexRecorder } from './useCodexRecorder';
import type { IBattleSetup } from '../../engine/data/battleFactories';
import type { IMingmingState } from '../../engine/types';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const MEMBER: IMingmingState = {
    id: 'mm_codex_1',
    definitionId: 'fenrir',
    blueprintsCollected: 0,
    attackIV: 20,
    defenseIV: 20,
    hpIV: 20,
};

/** `water_slap` is the None-element neutral, so any caster can play it at any target. */
const SETUP: IBattleSetup = {
    party: [MEMBER],
    deck: ['water_slap', 'water_slap', 'water_slap', 'water_slap', 'water_slap'],
    drivers: [],
    persistedHp: {},
};

function makeStore() {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
    });
}

/** The hook under test needs a host component and a Provider; it renders nothing. */
function Recorder(): null {
    useCodexRecorder();
    return null;
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

async function mountedStore() {
    const store = makeStore();
    store.dispatch(startBattle({ setup: SETUP, enemyIds: ['kraken'], sectorElement: 'Water', options: { seed: 'codex-recorder-seed' } }));
    await act(async () => {
        root.render(
            <Provider store={store}>
                <Recorder />
            </Provider>,
        );
    });
    return store;
}

describe('useCodexRecorder, mounted over a live fight', () => {
    it('lets a played card actually resolve — it leaves the hand and the target loses HP', async () => {
        const store = await mountedStore();

        const before = store.getState().battle.battle!;
        const card = before.playerDeck.hand[0];
        const target = before.enemyParty[0];
        expect(card).toBeDefined();
        expect(target.currentHp).toBe(target.maxHp);

        await act(async () => {
            store.dispatch(playProgram({
                sourceId: MEMBER.id,
                targetId: target.id,
                programId: card.id,
            }));
        });

        const after = store.getState().battle.battle!;
        // The regression, both halves of what Henry saw.
        expect(after.playerDeck.hand.some((c) => c.id === card.id)).toBe(false);
        expect(after.enemyParty[0].currentHp).toBeLessThan(target.maxHp);
    });

    it('still records the play — the fix defers the write, it does not drop it', async () => {
        const store = await mountedStore();
        const before = store.getState().battle.battle!;

        await act(async () => {
            store.dispatch(playProgram({
                sourceId: MEMBER.id,
                targetId: before.enemyParty[0].id,
                programId: before.playerDeck.hand[0].id,
            }));
        });

        const codex = store.getState().game.codex;
        expect(codex.seen).toContain('water_slap');
        // The caster was one of the player's, so it counts as played BY the player, not merely seen.
        expect(codex.played).toContain('water_slap');
    });

    it('records both sides\' species when the battle starts', async () => {
        const store = await mountedStore();
        const codex = store.getState().game.codex;
        expect(codex.species).toContain('fenrir');
        expect(codex.species).toContain('kraken');
    });
});
