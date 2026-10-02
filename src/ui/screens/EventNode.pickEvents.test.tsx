// @vitest-environment jsdom
/**
 * TICKET 168d — the six pick-a-reward events, mounted and clicked, against a real run AND ranch.
 *
 * Each case forces one event (every other built event is marked seen, as `EventNode.test.tsx` does),
 * plays it through the buttons, and reads the result off the stores: the deck, the scrap, the
 * blueprint counts, the roster. The two things a player could be robbed of are checked directly:
 * nothing is spent until a pick is made, and Data Broker charges exactly its price.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { configureStore } from '@reduxjs/toolkit';
import { Provider, useSelector } from 'react-redux';

import EventNode from './EventNode';
import gameReducer, { addBlueprint, addToRoster } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { SeedStream } from '../../engine/core/SeedStream';
import { createRanchMember } from '../../engine/gameTypes';
import { createRun } from '../../engine/run/createRun';
import { BUILT_EVENTS } from '../../engine/run/events/eventDraw';
import { offerGyms } from '../../engine/run/gyms';
import { bankedBlueprintsFrom } from '../../engine/run/runSummary';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import type { IMingmingState } from '../../engine/types';
import type { IRanchState, IRunState } from '../../engine/runTypes';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

function runWith(seen: string[], over: Partial<IRunState> = {}): IRunState {
    const run = createRun({ seed: 'pick-screen', offer: offerGyms('pick-offer')[0], party: [KRAKEN], startedAt: 1 });
    const target = run.nodes.find((node) => node.id !== run.currentNodeId)!;
    return {
        ...run,
        currentNodeId: target.id,
        nodes: run.nodes.map((node) => (node.id === target.id ? { ...node, visited: 1 } : node)),
        eventHistory: [...BUILT_EVENTS].filter((id) => id !== seen[0]).map((eventId, i) => (
            { nodeId: `other${i}`, eventId, choiceId: 'leave', grants: [] }
        )),
        ...over,
    };
}

function makeStore(run: IRunState, blueprints: Record<string, number> = {}) {
    const store = configureStore({
        reducer: { run: runReducer, game: gameReducer },
        preloadedState: { run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    store.dispatch(addToRoster({ ...createRanchMember('kraken', 'kraken_v1', new SeedStream('mm1-roll')), id: 'mm1' }));
    for (const [species, count] of Object.entries(blueprints)) {
        for (let i = 0; i < count; i += 1) store.dispatch(addBlueprint(species));
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
const runOf = (store: Store): IRunState => store.getState().run.run!;

describe('Abandoned Terminal', () => {
    it('upgrades one card free, needs it done, then goes dark', async () => {
        const store = makeStore(runWith(['abandoned_terminal']));
        await mount(store);
        const before = runOf(store);

        await click(byText('Upgrade a card'));
        expect(byText('DONE')!.disabled).toBe(true);
        await click(host.querySelector('.mk-upgrade .rs-row'));
        expect(runOf(store).deck.filter((c) => c.upgraded === true)).toHaveLength(1);
        expect(runOf(store).scrap).toBe(before.scrap);
        expect(byText('DONE')!.disabled).toBe(false);
        // One upgrade only: the bench does not offer a second.
        await click(byText('DONE'));
        expect(runOf(store).eventHistory).toHaveLength(BUILT_EVENTS.size);
        expect(host.textContent).toContain('The relay is dark');
    });

    it('leaves with nothing changed', async () => {
        const store = makeStore(runWith(['abandoned_terminal']));
        await mount(store);
        const before = runOf(store);
        await click(byText('Leave'));
        expect(runOf(store).deck).toEqual(before.deck);
    });
});

describe('Wild Tracks', () => {
    it('offers three species, banks the picked one to the ranch and notes it on the run', async () => {
        const store = makeStore(runWith(['wild_tracks']));
        await mount(store);

        await click(byText('Pick 1 of 3 traces'));
        const options = [...host.querySelectorAll('.ev-choice')];
        expect(options).toHaveLength(3);
        expect(byText('TAKE TRACE')!.disabled).toBe(true);
        // Nothing is banked until TAKE.
        expect(store.getState().game.blueprints).toEqual({});

        await click(options[0]);
        await click(byText('TAKE TRACE'));
        const held = Object.entries(store.getState().game.blueprints);
        expect(held).toHaveLength(1);
        expect(held[0][1]).toBe(1);
        expect(bankedBlueprintsFrom(runOf(store).modifiers)).toEqual([held[0][0]]);
        expect(host.textContent).toContain('trace banked to the ranch');
        expect(host.textContent).toContain('The relay is dark');
    });

    it('can be backed out of for free', async () => {
        const store = makeStore(runWith(['wild_tracks']));
        await mount(store);
        await click(byText('Pick 1 of 3 traces'));
        await click(byText('BACK'));
        expect(store.getState().game.blueprints).toEqual({});
        expect(byText('Pick 1 of 3 traces')).toBeDefined();
    });
});

describe('Rare Vault', () => {
    it('offers three Rare cards and puts the picked one in the deck', async () => {
        const store = makeStore(runWith(['rare_vault']));
        await mount(store);
        const deckBefore = runOf(store).deck.length;

        await click(byText('Pick 1 of 3 Rare cards'));
        expect(host.querySelectorAll('.rs-card')).toHaveLength(3);
        await click(host.querySelector('.rs-card'));
        await click(byText('TAKE CARD'));

        const after = runOf(store);
        expect(after.deck).toHaveLength(deckBefore + 1);
        expect(ProgramRegistry[after.deck.at(-1)!.dataId]?.rarity).toBe('Rare');
    });
});

describe('Draught Crate', () => {
    it('offers three macros and puts the picked one on the rack', async () => {
        const store = makeStore(runWith(['macro_crate']));
        await mount(store);

        await click(byText('Pick 1 of 3 draughts'));
        expect(byText('TAKE DRAUGHT')!.disabled).toBe(true);
        const options = buttons().filter((b) => b.getAttribute('aria-pressed') !== null);
        expect(options).toHaveLength(3);
        await click(options[0]);
        await click(byText('TAKE DRAUGHT'));

        expect(runOf(store).macros.filter((m) => m !== null)).toHaveLength(1);
        expect(host.textContent).toContain('added to your rack');
    });

    it('on a full rack, needs a slot to drop before it will take', async () => {
        const full = runWith(['macro_crate'], { macros: ['surge', 'surge', 'surge'] });
        const store = makeStore(full);
        await mount(store);

        await click(byText('Pick 1 of 3 draughts'));
        const options = buttons().filter((b) => b.getAttribute('aria-pressed') !== null);
        await click(options[0]);
        expect(byText('TAKE DRAUGHT')!.disabled).toBe(true);
        expect(host.textContent).toContain('Your rack is full');

        const drops = buttons().filter((b) => b.getAttribute('aria-pressed') !== null).slice(3);
        await click(drops[1]);
        expect(byText('TAKE DRAUGHT')!.disabled).toBe(false);
        await click(byText('TAKE DRAUGHT'));
        expect(runOf(store).macros[1]).not.toBe('surge');
        expect(runOf(store).macros[0]).toBe('surge');
    });
});

describe('Data Broker', () => {
    it('charges 40 for a Rare pick and puts the card in the deck in one step', async () => {
        const store = makeStore(runWith(['data_broker'], { scrap: 100 }));
        await mount(store);
        const deckBefore = runOf(store).deck.length;

        await click(byText('Pay 40'));
        // Nothing is charged until the pick is made.
        expect(runOf(store).scrap).toBe(100);
        await click(host.querySelector('.rs-card'));
        await click(byText('TAKE CARD'));

        const after = runOf(store);
        expect(after.scrap).toBe(60);
        expect(after.deck).toHaveLength(deckBefore + 1);
        expect(ProgramRegistry[after.deck.at(-1)!.dataId]?.rarity).toBe('Rare');
    });

    it('charges 15 for an Uncommon pick, also when the card is stored in the collection', async () => {
        const store = makeStore(runWith(['data_broker'], { scrap: 100 }));
        await mount(store);
        const before = runOf(store);

        await click(byText('Pay 15'));
        await click(host.querySelector('.rs-card'));
        await click(byText('Store in collection'));
        await click(byText('TAKE CARD'));

        const after = runOf(store);
        expect(after.scrap).toBe(85);
        expect(after.deck).toHaveLength(before.deck.length);
        expect((after.collection ?? []).length).toBe((before.collection ?? []).length + 1);
        expect(ProgramRegistry[(after.collection ?? []).at(-1)!.dataId]?.rarity).toBe('Uncommon');
    });

    it('greys a price the run cannot pay, and charges nothing for leaving or backing out', async () => {
        const store = makeStore(runWith(['data_broker'], { scrap: 20 }));
        await mount(store);
        expect(byText('Pay 40')!.disabled).toBe(true);
        expect(byText('Pay 40')!.textContent).toContain('Not enough amber');
        expect(byText('Pay 15')!.disabled).toBe(false);

        await click(byText('Pay 15'));
        await click(byText('BACK'));
        expect(runOf(store).scrap).toBe(20);
        await click(byText('Leave'));
        expect(runOf(store).scrap).toBe(20);
    });
});

describe('Stray Mingming', () => {
    it('builds a held blueprint into the party for free', async () => {
        const store = makeStore(runWith(['stray_mingming']), { fenrir: 1 });
        await mount(store);
        const before = runOf(store);

        await click(byText('Recruit'));
        expect(byText('RECRUIT')!.disabled).toBe(true);
        const options = [...host.querySelectorAll('.ev-choice')];
        expect(options.length).toBeGreaterThanOrEqual(1);
        await click(options[0]);
        await click(byText('RECRUIT'));

        const after = runOf(store);
        expect(after.partyIds).toHaveLength(before.partyIds.length + 1);
        expect(after.scrap).toBe(before.scrap);
        expect(after.deck.length).toBeGreaterThan(before.deck.length);
        expect(store.getState().game.blueprints.fenrir).toBeUndefined();
        expect(store.getState().game.roster).toHaveLength(2);
        expect(host.textContent).toContain('joined your party');
    });

    it('leaves the blueprint and the party alone when the player leaves', async () => {
        const store = makeStore(runWith(['stray_mingming']), { fenrir: 1 });
        await mount(store);
        await click(byText('Leave'));
        expect(store.getState().game.blueprints.fenrir).toBe(1);
        expect(runOf(store).partyIds).toEqual(['mm1']);
    });
});
