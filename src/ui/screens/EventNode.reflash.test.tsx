// @vitest-environment jsdom
/**
 * TICKET 168f — Well of Urd, mounted and clicked against a real run AND ranch.
 *
 * What is protected: the switch lands on the RUN and never on the roster member, the deck is left
 * exactly as it was, a patched body is greyed with its reason and cannot be chosen, and a body whose
 * other OS the party already runs is refused rather than making a duplicate build.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { configureStore } from '@reduxjs/toolkit';
import { Provider, useSelector } from 'react-redux';

import EventNode from './EventNode';
import gameReducer, { addToRoster } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { SeedStream } from '../../engine/core/SeedStream';
import { createRanchMember } from '../../engine/gameTypes';
import { createRun } from '../../engine/run/createRun';
import { BUILT_EVENTS } from '../../engine/run/events/eventDraw';
import { offerGyms } from '../../engine/run/gyms';
import type { IMingmingState } from '../../engine/types';
import type { IRanchState, IRunState } from '../../engine/runTypes';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const body = (id: string, definitionId: string, activeOS: string): IMingmingState => ({
    id, definitionId, activeOS, blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
});
const KRAKEN = body('mm1', 'kraken', 'kraken_v1');
const FENRIR = body('mm2', 'fenrir', 'fenrir_v1');

/** A run standing on an event node in the second biome (Rare events roll there), with only Well of Urd left to draw. */
function runWith(party: IMingmingState[], over: Partial<IRunState> = {}): IRunState {
    const run = createRun({ seed: 'reflash-screen', offer: offerGyms('reflash-offer')[0], party, startedAt: 1 });
    const target = run.nodes.find((node) => node.id !== run.currentNodeId)!;
    return {
        ...run,
        currentNodeId: target.id,
        nodes: run.nodes.map((node) => (node.id === target.id ? { ...node, visited: 1, biomeIndex: 1 } : node)),
        eventHistory: [...BUILT_EVENTS].filter((id) => id !== 'firmware_reflash').map((eventId, i) => (
            { nodeId: `other${i}`, eventId, choiceId: 'leave', grants: [] }
        )),
        ...over,
    };
}

function makeStore(run: IRunState, party: IMingmingState[]) {
    const store = configureStore({
        reducer: { run: runReducer, game: gameReducer },
        preloadedState: { run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    for (const member of party) {
        store.dispatch(addToRoster({
            ...createRanchMember(member.definitionId, member.activeOS!, new SeedStream(`${member.id}-roll`)),
            id: member.id,
        }));
    }
    return store;
}
type Store = ReturnType<typeof makeStore>;

function Harness(): ReactNode {
    const run = useSelector((s: { run: { run: IRunState } }) => s.run.run);
    const ranch = useSelector((s: { game: IRanchState }) => s.game);
    const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
    return <EventNode run={run} node={node} ranch={ranch} biomeName="Test Biome" onLeave={() => {}} />;
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
});

async function mount(store: Store): Promise<void> {
    await act(async () => { root.render(<Provider store={store}><Harness /></Provider>); });
}
const buttons = (): HTMLButtonElement[] => [...host.querySelectorAll('button')];
const byText = (text: string): HTMLButtonElement | undefined => buttons().find((b) => b.textContent?.includes(text));
async function click(button: Element | null | undefined): Promise<void> {
    expect(button, 'button to click').toBeTruthy();
    await act(async () => { (button as HTMLButtonElement).click(); });
}
const bodyRow = (name: string): HTMLButtonElement | undefined => [...host.querySelectorAll('.ev-choice')]
    .find((row) => row.textContent?.startsWith(name)) as HTMLButtonElement | undefined;
const runOf = (store: Store): IRunState => store.getState().run.run!;
const ranchOf = (store: Store): IRanchState => store.getState().game;

describe('Instinct Retrain', () => {
    it('says on the button that the instinct changes and the cards do not', async () => {
        const store = makeStore(runWith([KRAKEN]), [KRAKEN]);
        await mount(store);
        expect(host.textContent?.toLowerCase()).toContain('well of urd');
        expect(byText('Retrain one body')).toBeTruthy();
        expect(host.textContent).toContain('Its instinct changes; its cards don\'t.');
    });

    it('switches the body for the run, and leaves the ranch member and the deck exactly as they were', async () => {
        const store = makeStore(runWith([KRAKEN, FENRIR]), [KRAKEN, FENRIR]);
        await mount(store);
        const before = runOf(store);
        const ranchBefore = JSON.stringify(ranchOf(store).roster);

        await click(byText('Retrain one body'));
        await click(bodyRow('Kraken'));
        // Nothing has moved until the pick is confirmed.
        expect(runOf(store).osOverrides ?? {}).toEqual({});
        await click(byText('RETRAIN'));

        const after = runOf(store);
        expect(after.osOverrides).toEqual({ mm1: 'kraken_v2' });
        expect(after.deck).toEqual(before.deck);
        expect(after.collection).toEqual(before.collection);
        expect(JSON.stringify(ranchOf(store).roster)).toBe(ranchBefore);
        expect(ranchOf(store).roster.find((m) => m.id === 'mm1')!.activeOS).toBe('kraken_v1');
        expect(host.textContent).toContain('retrained to');
        expect(host.textContent).toContain('The relay is dark');
    });

    it('greys a patched body with the reason and cannot pick it; the unpatched body still can be', async () => {
        const store = makeStore(runWith([KRAKEN, FENRIR], { patches: { mm1: ['amplifier'] } }), [KRAKEN, FENRIR]);
        await mount(store);
        await click(byText('Retrain one body'));

        const patched = bodyRow('Kraken')!;
        expect(patched.disabled).toBe(true);
        expect(patched.textContent).toContain('A rune is fitted to its instinct.');
        expect(bodyRow('Fenrir')!.disabled).toBe(false);

        await click(patched);
        expect(byText('RETRAIN')!.disabled).toBe(true);
        await click(bodyRow('Fenrir'));
        await click(byText('RETRAIN'));
        expect(runOf(store).osOverrides).toEqual({ mm2: 'fenrir_v2' });
    });

    it('greys a body whose other instinct the party already runs, rather than making a duplicate build', async () => {
        const kraken2 = body('mm3', 'kraken', 'kraken_v2');
        const party = [KRAKEN, kraken2, FENRIR];
        const store = makeStore(runWith(party), party);
        await mount(store);
        await click(byText('Retrain one body'));
        for (const name of ['Kraken']) {
            const rows = [...host.querySelectorAll('.ev-choice')].filter((row) => row.textContent?.startsWith(name)) as HTMLButtonElement[];
            expect(rows).toHaveLength(2);
            for (const row of rows) {
                expect(row.disabled).toBe(true);
                expect(row.textContent).toContain('Your party already runs that build.');
            }
        }
        expect(bodyRow('Fenrir')!.disabled).toBe(false);
    });

    it('greys the whole choice, with the reason, when no body can be retrained', async () => {
        const kraken2 = body('mm3', 'kraken', 'kraken_v2');
        const party = [KRAKEN, kraken2];
        const store = makeStore(runWith(party), party);
        await mount(store);
        const choice = byText('Retrain one body')!;
        expect(choice.disabled).toBe(true);
        expect(choice.textContent).toContain('No body can be retrained right now.');
    });

    it('is not drawn when every body has a rune: the Empty Relay stands in', async () => {
        const store = makeStore(runWith([KRAKEN], { patches: { mm1: ['amplifier'] } }), [KRAKEN]);
        await mount(store);
        expect(host.textContent).not.toContain('Instinct Retrain');
        expect(host.textContent).toContain('The relay is empty');
    });

    it('Leave costs nothing and changes nothing', async () => {
        const run = runWith([KRAKEN]);
        const store = makeStore(run, [KRAKEN]);
        await mount(store);
        await click(byText('Leave'));
        const after = runOf(store);
        expect(after.osOverrides ?? {}).toEqual({});
        expect(after.scrap).toBe(run.scrap);
        expect(after.deck).toEqual(run.deck);
    });
});
