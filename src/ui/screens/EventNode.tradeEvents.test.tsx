// @vitest-environment jsdom
/**
 * TICKET 168e — the trade and cost events, mounted and clicked against a real run AND ranch.
 *
 * Trader, Loki's Mirror, Seiðr Cauldron, The Toll, Driver Shrine and The Runecarver. What is
 * protected: a price is paid once and only for a pick that was made, the deck floor greys the rows
 * it should, the Driver is granted before the offering is taken, and the power cap is recorded.
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
import { PLAYER_DRIVER_IDS } from '../../engine/data/driverRegistry';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import { createRun, minimumActiveDeck } from '../../engine/run/createRun';
import { BUILT_EVENTS } from '../../engine/run/events/eventDraw';
import { offerGyms } from '../../engine/run/gyms';
import { rewardCardPool } from '../../engine/RewardSystem';
import type { IMingmingState } from '../../engine/types';
import type { IRanchState, IRunCard, IRunState } from '../../engine/runTypes';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

const poolOf = (rarity: string): string[] =>
    rewardCardPool([{ definitionId: 'kraken' }]).filter((id) => ProgramRegistry[id]?.rarity === rarity);
const card = (instanceId: string, dataId: string): IRunCard => ({ instanceId, dataId, ownerId: null });

/** A run standing on an event node in the second biome (Rare events roll there), with `only` the one event left to draw. */
function runWith(only: string, over: Partial<IRunState> = {}): IRunState {
    const run = createRun({ seed: 'trade-screen', offer: offerGyms('trade-offer')[0], party: [KRAKEN], startedAt: 1 });
    const target = run.nodes.find((node) => node.id !== run.currentNodeId)!;
    return {
        ...run,
        currentNodeId: target.id,
        nodes: run.nodes.map((node) => (node.id === target.id ? { ...node, visited: 1, biomeIndex: 1 } : node)),
        eventHistory: [...BUILT_EVENTS].filter((id) => id !== only).map((eventId, i) => (
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
const rows = (): HTMLButtonElement[] => [...host.querySelectorAll('.ev-cardrow')] as HTMLButtonElement[];
const rowFor = (name: string): HTMLButtonElement | undefined => rows().find((r) => r.textContent?.includes(name));
const runOf = (store: Store): IRunState => store.getState().run.run!;

/** A run with its deck at the floor (so no deck card can go) and the given cards in the collection. */
function atFloor(only: string, collection: IRunCard[], over: Partial<IRunState> = {}): IRunState {
    const run = runWith(only, over);
    return { ...run, deck: run.deck.slice(0, minimumActiveDeck(1)), collection };
}

describe('Trader', () => {
    it('greys deck cards at the floor with the reason, and trades a collection card up a rarity', async () => {
        const given = poolOf('Common')[0];
        const store = makeStore(atFloor('trader', [card('col1', given)]));
        await mount(store);
        await click(byText('Give up a card'));

        const deckRows = rows().filter((r) => r.textContent?.includes(' deck'));
        expect(deckRows.length).toBeGreaterThan(0);
        for (const row of deckRows) {
            expect(row.disabled).toBe(true);
            expect(row.textContent).toContain('Your deck is at its minimum.');
        }
        await click(rowFor(' collection'));
        await click(byText('CONFIRM'));

        const after = runOf(store);
        expect(after.deck).toHaveLength(minimumActiveDeck(1));
        expect((after.collection ?? []).map((c) => c.instanceId)).not.toContain('col1');
        const gained = (after.collection ?? [])[0];
        expect(ProgramRegistry[gained.dataId].rarity).toBe('Uncommon');
        expect(host.textContent).toContain('became');
        expect(host.textContent).toContain('The relay is dark');
    });

    it('is not drawn when nothing can be given up: the Empty Relay stands in', async () => {
        const store = makeStore(atFloor('trader', []));
        await mount(store);
        // The event would not be drawn at all: the Empty Relay stands in.
        expect(host.textContent).toContain('The relay is empty');
    });
});

describe('Loki\'s Mirror', () => {
    it('charges 25 and copies a deck card into the deck, upgrade and all', async () => {
        const run = runWith('mirror_protocol', { scrap: 100 });
        const target = run.deck[0];
        const store = makeStore({ ...run, deck: [{ ...target, upgraded: true }, ...run.deck.slice(1)] });
        await mount(store);
        const before = runOf(store);

        await click(byText('Pay 25'));
        // Nothing is charged until the card is picked.
        expect(runOf(store).scrap).toBe(100);
        await click(rows()[0]);
        await click(byText('CONFIRM'));

        const after = runOf(store);
        expect(after.scrap).toBe(75);
        expect(after.deck).toHaveLength(before.deck.length + 1);
        expect(after.deck.at(-1)).toMatchObject({ dataId: before.deck[0].dataId, upgraded: true });
    });

    it('copies a collection card into the collection, and charges after', async () => {
        const store = makeStore({ ...runWith('mirror_protocol', { scrap: 40 }), collection: [card('col1', poolOf('Common')[0])] });
        await mount(store);
        await click(byText('Pay 25'));
        await click(rowFor(' collection'));
        await click(byText('CONFIRM'));
        const after = runOf(store);
        expect(after.scrap).toBe(15);
        expect(after.collection).toHaveLength(2);
        expect(after.deck).toHaveLength(runWith('mirror_protocol').deck.length);
    });

    it('greys Pay 25 with under 25 scrap, and Leave costs nothing', async () => {
        const store = makeStore(runWith('mirror_protocol', { scrap: 10 }));
        await mount(store);
        expect(byText('Pay 25')!.disabled).toBe(true);
        await click(byText('Leave'));
        expect(runOf(store).scrap).toBe(10);
    });
});

describe('Seiðr Cauldron', () => {
    it('swaps a collection card for another of the same element and rarity', async () => {
        const given = poolOf('Rare')[0];
        const store = makeStore(atFloor('recompiler', [card('col1', given)]));
        await mount(store);
        await click(byText('Give up a card'));
        await click(rowFor(' collection'));
        await click(byText('CONFIRM'));

        const gained = (runOf(store).collection ?? [])[0];
        expect(gained.dataId).not.toBe(given);
        expect(ProgramRegistry[gained.dataId].rarity).toBe(ProgramRegistry[given].rarity);
        expect(ProgramRegistry[gained.dataId].element).toBe(ProgramRegistry[given].element);
    });
});

describe('The Toll', () => {
    it('has no Leave, and paying takes 30 amber', async () => {
        const store = makeStore(runWith('the_toll', { scrap: 50 }));
        await mount(store);
        expect(host.textContent).toContain('THE TOLL');
        expect(byText('Leave')).toBeUndefined();
        await click(byText('Pay 30 amber'));
        expect(runOf(store).scrap).toBe(20);
        expect(host.textContent).toContain('The relay is dark');
    });

    it('greys the payment under 30 amber and takes a card instead, at no amber', async () => {
        const store = makeStore({ ...atFloor('the_toll', [card('col1', poolOf('Common')[0])]), scrap: 5 });
        await mount(store);
        expect(byText('Pay 30 amber')!.disabled).toBe(true);
        expect(byText('Pay 30 amber')!.textContent).toContain('Not enough amber.');

        await click(byText('Give up a card'));
        await click(rowFor(' collection'));
        await click(byText('CONFIRM'));
        expect(runOf(store).scrap).toBe(5);
        expect(runOf(store).collection).toEqual([]);
        expect(runOf(store).eventHistory).toHaveLength(BUILT_EVENTS.size);
    });
});

describe('Totem Shrine', () => {
    it('takes two cards, grants a Totem first, and records the grant', async () => {
        const store = makeStore(atFloor('driver_shrine', [card('col1', poolOf('Common')[0]), card('col2', poolOf('Common')[1])]));
        await mount(store);
        expect(byText('Offer one trace')!.disabled).toBe(true);
        expect(byText('Offer one trace')!.textContent).toContain('No trace to give.');

        await click(byText('Offer two cards'));
        expect(byText('CONFIRM')!.disabled).toBe(true);
        await click(rowFor(' collection'));
        expect(byText('CONFIRM')!.disabled).toBe(true);
        await click(rows().filter((r) => r.textContent?.includes(' collection'))[1]);
        await click(byText('CONFIRM'));

        // The second question: the Driver.
        expect(byText('TAKE TOTEM')!.disabled).toBe(true);
        const choices = buttons().filter((b) => b.getAttribute('aria-pressed') === 'false');
        expect(choices).toHaveLength(2);
        await click(choices[0]);
        await click(byText('TAKE TOTEM'));

        const after = runOf(store);
        expect(after.drivers.filter((id) => PLAYER_DRIVER_IDS.includes(id))).toHaveLength(1);
        expect(after.collection).toEqual([]);
        expect(after.eventHistory!.at(-1)).toMatchObject({ eventId: 'driver_shrine', grants: ['driver'] });
    });

    it('takes one trace from the ranch for a Totem', async () => {
        const store = makeStore(atFloor('driver_shrine', []), { fenrir: 1 });
        await mount(store);
        expect(byText('Offer two cards')!.disabled).toBe(true);

        await click(byText('Offer one trace'));
        await click(buttons().find((b) => b.textContent?.includes('You hold 1')));
        await click(byText('CONFIRM'));
        await click(buttons().find((b) => b.getAttribute('aria-pressed') === 'false'));
        await click(byText('TAKE TOTEM'));

        expect(store.getState().game.blueprints.fenrir).toBeUndefined();
        expect(runOf(store).drivers.filter((id) => PLAYER_DRIVER_IDS.includes(id))).toHaveLength(1);
    });

    it('takes nothing when the player backs out before choosing the Driver, and grants nothing', async () => {
        const store = makeStore(atFloor('driver_shrine', [card('col1', poolOf('Common')[0]), card('col2', poolOf('Common')[1])]));
        await mount(store);
        await click(byText('Offer two cards'));
        for (const row of rows().slice(-2)) await click(row);
        await click(byText('CONFIRM'));
        await click(byText('BACK'));
        expect(runOf(store).collection).toHaveLength(2);
        expect(runOf(store).drivers.filter((id) => PLAYER_DRIVER_IDS.includes(id))).toHaveLength(0);
    });
});

describe('The Runecarver', () => {
    it('charges 30 and fits the body\'s best rune', async () => {
        const store = makeStore(runWith('black_market_patch', { scrap: 100 }));
        await mount(store);
        await click(byText('Pay 30'));
        expect(runOf(store).scrap).toBe(100);
        await click(buttons().find((b) => b.getAttribute('aria-pressed') === 'false'));
        await click(byText('FIT RUNE'));

        const after = runOf(store);
        expect(after.scrap).toBe(70);
        expect(after.patches!.mm1).toHaveLength(1);
        expect(after.eventHistory!.at(-1)).toMatchObject({ eventId: 'black_market_patch', grants: ['patch'] });
    });

    it('fits a rune for a Rare card instead of amber, and greys that option with no Rare to give', async () => {
        const none = makeStore(atFloor('black_market_patch', [], { scrap: 100 }));
        await mount(none);
        expect(byText('Give up a Rare card')!.disabled).toBe(true);
        expect(byText('Give up a Rare card')!.textContent).toContain('Nothing you can give up.');
        await act(async () => { root.unmount(); });
        root = createRoot(host);

        const store = makeStore(atFloor('black_market_patch', [card('col1', poolOf('Rare')[0])], { scrap: 100 }));
        await mount(store);
        await click(byText('Give up a Rare card'));
        // Only a Rare is listed.
        expect(rows()).toHaveLength(1);
        await click(rows()[0]);
        await click(byText('CONFIRM'));
        await click(buttons().find((b) => b.getAttribute('aria-pressed') === 'false'));
        await click(byText('FIT RUNE'));

        const after = runOf(store);
        expect(after.scrap).toBe(100);
        expect(after.collection).toEqual([]);
        expect(after.patches!.mm1).toHaveLength(1);
    });
});
