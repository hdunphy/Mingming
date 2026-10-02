// @vitest-environment jsdom
/**
 * TICKET 168g — Ambush Bait, mounted inside the run screen and clicked against a real run and ranch.
 *
 * What is protected: Fight it starts a WILD encounter on the event node (real enemies, the node's
 * own seed), the event is recorded as resolved when the choice is made (so a loss or a crash cannot
 * offer it again), Leave starts nothing, and the node is dark once the fight is won.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import RunScreen from './RunScreen';
import battleReducer from '../store/battleSlice';
import gameReducer, { addToRoster } from '../store/gameSlice';
import runReducer, { resolveEncounter } from '../store/runSlice';
import { SeedStream } from '../../engine/core/SeedStream';
import { createRanchMember } from '../../engine/gameTypes';
import { createRun } from '../../engine/run/createRun';
import { rollEncounter } from '../../engine/run/encounter';
import { BUILT_EVENTS } from '../../engine/run/events/eventDraw';
import { offerGyms } from '../../engine/run/gyms';
import type { IMingmingState } from '../../engine/types';
import type { IRunState } from '../../engine/runTypes';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

/** A run standing on an event node in the second biome, with only Ambush Bait left to draw. */
function runOnAmbush(): IRunState {
    const run = createRun({ seed: 'ambush-screen', offer: offerGyms('ambush-offer')[0], party: [KRAKEN], startedAt: 1 });
    const target = run.nodes.find((node) => node.kind === 'event' && node.id !== run.currentNodeId)
        ?? run.nodes.find((node) => node.id !== run.currentNodeId)!;
    return {
        ...run,
        currentNodeId: target.id,
        nodes: run.nodes.map((node) => (node.id === target.id ? { ...node, kind: 'event' as const, visited: 1 } : node)),
        eventHistory: [...BUILT_EVENTS].filter((id) => id !== 'ambush_bait').map((eventId, i) => (
            { nodeId: `other${i}`, eventId, choiceId: 'leave', grants: [] }
        )),
    };
}

function makeStore(run: IRunState) {
    const store = configureStore({
        reducer: { run: runReducer, game: gameReducer, battle: battleReducer },
        preloadedState: { run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    store.dispatch(addToRoster({ ...createRanchMember('kraken', 'kraken_v1', new SeedStream('mm1-roll')), id: 'mm1' }));
    return store;
}
type Store = ReturnType<typeof makeStore>;

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
});

async function mount(store: Store): Promise<void> {
    await act(async () => { root.render(<Provider store={store}><RunScreen /></Provider>); });
}
const byText = (text: string): HTMLButtonElement | undefined =>
    [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
async function click(button: Element | null | undefined): Promise<void> {
    expect(button, 'button to click').toBeTruthy();
    await act(async () => { (button as HTMLButtonElement).click(); });
}
const runOf = (store: Store): IRunState => store.getState().run.run!;

describe('Ambush Bait', () => {
    it('offers Fight it with its promise, and Leave', async () => {
        await mount(makeStore(runOnAmbush()));
        expect(host.textContent?.toLowerCase()).toContain('ambush bait');
        expect(byText('Fight it')).toBeTruthy();
        expect(host.textContent).toContain('A wild fight for double amber.');
        expect(byText('Leave')).toBeTruthy();
    });

    it('Fight it starts a wild encounter on the event node and records the event as resolved at once', async () => {
        const store = makeStore(runOnAmbush());
        await mount(store);
        await click(byText('Fight it'));

        const run = runOf(store);
        expect(run.phase).toBe('encounter');
        expect(run.eventFight).toBe(true);
        expect(run.eventHistory?.at(-1)).toMatchObject({ eventId: 'ambush_bait', choiceId: 'fight' });

        // The battle is up, against the enemies a WILD on this node rolls.
        const battle = store.getState().battle.battle;
        expect(battle).not.toBeNull();
        const node = run.nodes.find((candidate) => candidate.id === run.currentNodeId)!;
        const expected = rollEncounter({ run, node: { ...node, kind: 'wild' }, party: [KRAKEN] });
        expect(battle!.enemyParty.map((enemy) => enemy.definitionId)).toEqual(expected.enemyParty.map((enemy) => enemy.definitionId));
        expect(battle!.enemyParty.length).toBeGreaterThan(0);
    });

    it('Leave starts nothing and pays nothing', async () => {
        const run = runOnAmbush();
        const store = makeStore(run);
        await mount(store);
        await click(byText('Leave'));
        const after = runOf(store);
        expect(after.phase).toBe('map');
        expect(after.eventFight ?? false).toBe(false);
        expect(after.scrap).toBe(run.scrap);
        expect(store.getState().battle.battle).toBeNull();
    });

    it('the node is dark once the fight is over, and the fight is not offered again', async () => {
        const store = makeStore(runOnAmbush());
        await mount(store);
        await click(byText('Fight it'));
        await act(async () => { store.dispatch(resolveEncounter()); });
        const after = runOf(store);
        expect(after.phase).toBe('map');
        expect(after.eventFight ?? false).toBe(false);
        expect(after.eventHistory?.filter((entry) => entry.eventId === 'ambush_bait')).toHaveLength(1);
        expect(host.textContent).toContain('The relay is dark');
        expect(byText('Fight it')).toBeUndefined();
    });
});
