// @vitest-environment jsdom
/**
 * TICKET 168a — the event screen, mounted and clicked.
 *
 * The repo has no `@testing-library/react`, so these mount with `createRoot` + `act`, as
 * `ErrorBoundary.test.tsx` does. The store is real (a `run` slice), so a click dispatches the real
 * outcome and `resolveEvent`, and the screen re-renders from the state that comes back.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { configureStore } from '@reduxjs/toolkit';
import { Provider, useSelector } from 'react-redux';

import EventNode from './EventNode';
import runReducer from '../store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { BUILT_EVENTS, drawEvent } from '../../engine/run/events/eventDraw';
import { gambleWins } from '../../engine/run/events/eventGamble';
import { JUNK_CARD_ID } from '../../engine/run/junk';
import type { EventRanchView } from '../../engine/run/events/eventContext';
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
const RANCH: EventRanchView = { roster: [{ id: 'mm1', definitionId: 'kraken' }], blueprints: {} };

type Store = ReturnType<typeof makeStore>;

function baseRun(): IRunState {
    const run = createRun({ seed: 'event-screen', offer: offerGyms('event-offer')[0], party: [KRAKEN], startedAt: 1 });
    const target = run.nodes.find((node) => node.id !== run.currentNodeId)!;
    return {
        ...run,
        currentNodeId: target.id,
        nodes: run.nodes.map((node) => (node.id === target.id ? { ...node, visited: 1 } : node)),
    };
}

/** Every built event except the named one (or all of them), so the draw is forced onto what is left. */
function allBut(keep?: string): string[] {
    return [...BUILT_EVENTS].filter((id) => id !== keep);
}

/** A run that has already seen the named events, so the draw is forced onto what is left. */
function seenRun(seen: string[]): IRunState {
    return {
        ...baseRun(),
        eventHistory: seen.map((eventId, i) => ({ nodeId: `other${i}`, eventId, choiceId: 'leave', grants: [] })),
    };
}

function makeStore(run: IRunState) {
    return configureStore({
        reducer: { run: runReducer },
        preloadedState: { run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
}

function Harness({ onLeave }: { onLeave: () => void }): ReactNode {
    const run = useSelector((s: { run: { run: IRunState } }) => s.run.run);
    const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
    return <EventNode run={run} node={node} ranch={RANCH} biomeName="Test Biome" onLeave={onLeave} />;
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

async function mount(store: Store, onLeave: () => void = () => {}): Promise<void> {
    await act(async () => {
        root.render(<Provider store={store}><Harness onLeave={onLeave} /></Provider>);
    });
}

const buttons = (): HTMLButtonElement[] => [...host.querySelectorAll('button')];
const byText = (text: string): HTMLButtonElement | undefined =>
    buttons().find((button) => button.textContent?.includes(text));

async function click(button: HTMLButtonElement | undefined): Promise<void> {
    expect(button, 'button to click').toBeDefined();
    await act(async () => { button!.click(); });
}

describe('EventNode', () => {
    it('shows the drawn event on the first visit, with one real button per playable choice', async () => {
        const run = baseRun();
        const expected = drawEvent(run, run.nodes.find((n) => n.id === run.currentNodeId)!, RANCH)!;
        await mount(makeStore(run));

        expect(host.textContent).toContain(expected.name.toUpperCase());
        expect(host.textContent).toContain(expected.text);
        const choices = [...host.querySelectorAll('button.ev-choice')];
        expect(choices.length).toBeGreaterThanOrEqual(2);
        // Every event is leavable except Corrupted Stream and The Toll.
        expect(byText('Leave') !== undefined).toBe(expected.choices.some((c) => c.id === 'leave'));
    });

    it('has no close button: the only way out of an unresolved event is one of its choices', async () => {
        await mount(makeStore(baseRun()));
        // The top bar carries no button while the event is unresolved, and nothing is named close.
        expect(host.querySelectorAll('.rs-top button')).toHaveLength(0);
        expect(buttons().some((button) => /close|×|dismiss/i.test(button.textContent ?? ''))).toBe(false);
    });

    it('shows "The relay is dark" once resolved, with a Leave that calls onLeave', async () => {
        let left = 0;
        const store = makeStore(seenRun(allBut('scrap_cache')));
        await mount(store, () => { left += 1; });

        await click(byText('Leave'));
        expect(store.getState().run.run!.eventHistory).toHaveLength(BUILT_EVENTS.size);
        expect(host.textContent).toContain('The relay is dark. Nothing here now.');
        expect(host.querySelectorAll('button.ev-choice')).toHaveLength(0);

        await click(host.querySelector('.rs-top button') as HTMLButtonElement);
        expect(left).toBe(1);
    });

    it('shows the dark relay on a revisit of a node that already resolved its event', async () => {
        const run = baseRun();
        const spent: IRunState = {
            ...run,
            eventHistory: [{ nodeId: run.currentNodeId, eventId: 'scrap_cache', choiceId: 'take', grants: [] }],
        };
        await mount(makeStore(spent));
        expect(host.textContent).toContain('The relay is dark. Nothing here now.');
        expect(byText('Take it')).toBeUndefined();
    });

    it('pays scrap for Scrap Cache’s Take, then goes dark', async () => {
        const store = makeStore(seenRun(allBut('scrap_cache')));
        await mount(store);
        const before = store.getState().run.run!.scrap;
        await click(byText('Take it'));
        expect(store.getState().run.run!.scrap).toBe(before + 25);
        expect(host.textContent).toContain('The relay is dark');
    });

    it('offers Data Fragments’ three cards, needs one picked, and puts it in the deck', async () => {
        const store = makeStore(seenRun(allBut('data_fragments')));
        await mount(store);
        const deckBefore = store.getState().run.run!.deck.length;

        await click(byText('Pick 1 of 3 cards'));
        expect(host.querySelectorAll('.rs-card')).toHaveLength(3);
        const take = byText('TAKE CARD')!;
        expect(take.disabled).toBe(true);
        // Nothing is spent or granted until the pick is made.
        // (The pre-seeded entries are the other built events, already seen.)
        expect(store.getState().run.run!.eventHistory ?? []).toHaveLength(BUILT_EVENTS.size - 1);

        await click(host.querySelector('.rs-card') as HTMLButtonElement);
        expect(byText('TAKE CARD')!.disabled).toBe(false);
        await click(byText('TAKE CARD'));

        expect(store.getState().run.run!.deck).toHaveLength(deckBefore + 1);
        expect(store.getState().run.run!.eventHistory).toHaveLength(BUILT_EVENTS.size);
        expect(host.textContent).toContain('The relay is dark');
    });

    it('can send the picked card to the collection instead, and can back out for free', async () => {
        const store = makeStore(seenRun(allBut('data_fragments')));
        await mount(store);
        const run0 = store.getState().run.run!;

        await click(byText('Pick 1 of 3 cards'));
        await click(byText('BACK'));
        expect(byText('Pick 1 of 3 cards')).toBeDefined();
        expect(store.getState().run.run!.eventHistory).toHaveLength(BUILT_EVENTS.size - 1);

        await click(byText('Pick 1 of 3 cards'));
        await click(host.querySelector('.rs-card') as HTMLButtonElement);
        await click(byText('Store in collection'));
        await click(byText('TAKE CARD'));
        const run1 = store.getState().run.run!;
        expect(run1.deck).toHaveLength(run0.deck.length);
        expect((run1.collection ?? []).length).toBe((run0.collection ?? []).length + 1);
    });

    it('surveys the biome for Relay Tower, and greys Survey when it is already surveyed', async () => {
        const store = makeStore(seenRun(allBut('relay_tower')));
        await mount(store);
        const before = store.getState().run.run!.modifiers.length;
        await click(byText('Survey'));
        expect(store.getState().run.run!.modifiers.length).toBe(before + 1);
    });

    it('plays the Empty Relay when nothing is left: +15 scrap, remembered as no event', async () => {
        const store = makeStore(seenRun(allBut()));
        await mount(store);
        expect(host.textContent).toContain('The relay is empty. You salvage 15 scrap.');

        const before = store.getState().run.run!.scrap;
        await click(byText('Salvage'));
        const run = store.getState().run.run!;
        expect(run.scrap).toBe(before + 15);
        expect(run.eventHistory!.at(-1)).toMatchObject({ eventId: 'empty_relay', choiceId: 'salvage' });
        expect(host.textContent).toContain('The relay is dark');
    });
    it('offers Dig deeper on Scrap Cache: +50 scrap and Static Haze for the next fight', async () => {
        const store = makeStore(seenRun(allBut('scrap_cache')));
        await mount(store);
        const before = store.getState().run.run!.scrap;
        await click(byText('Dig deeper'));
        const run = store.getState().run.run!;
        expect(run.scrap).toBe(before + 50);
        expect(run.tempDrivers).toEqual([{ driverId: 'driver_static_haze', fightsLeft: 1 }]);
        expect(run.drivers).not.toContain('driver_static_haze');
    });

    it('plays Corrupted Stream with no way to leave: Push through gives Frayed Signal', async () => {
        const store = makeStore({ ...seenRun(allBut('corrupted_stream')), scrap: 10 });
        await mount(store);
        expect(host.textContent).toContain('CORRUPTED STREAM');
        expect(byText('Leave')).toBeUndefined();
        // Under 25 scrap, the reroute is greyed and says why.
        const reroute = byText('Pay to reroute')!;
        expect(reroute.disabled).toBe(true);
        expect(reroute.textContent).toContain('Not enough amber');

        await click(byText('Push through'));
        expect(store.getState().run.run!.tempDrivers).toEqual([{ driverId: 'driver_frayed_signal', fightsLeft: 1 }]);
        expect(store.getState().run.run!.scrap).toBe(10);
        expect(host.textContent).toContain('The relay is dark');
    });

    it('lets Corrupted Stream be paid off with 25 scrap, and then gives no Driver', async () => {
        const store = makeStore({ ...seenRun(allBut('corrupted_stream')), scrap: 40 });
        await mount(store);
        await click(byText('Pay to reroute'));
        expect(store.getState().run.run!.scrap).toBe(15);
        expect(store.getState().run.run!.tempDrivers ?? []).toEqual([]);
    });
});

describe('EventNode — junk and gambles (168c)', () => {
    /** A run whose Corrupted Cache gamble lands on the wanted side, found by varying the run seed. */
    function cacheRun(win: boolean): IRunState {
        for (let i = 0; i < 200; i += 1) {
            // A Rare event cannot be drawn in the first biome (rule 4), so the node stands in the second.
            const seen = seenRun(allBut('corrupted_cache'));
            const run = {
                ...seen,
                seed: `cache-${i}`,
                nodes: seen.nodes.map((n) => (n.id === seen.currentNodeId ? { ...n, biomeIndex: 1 } : n)),
            };
            const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
            if (gambleWins({ run, node }, 0, 50) === win) return run;
        }
        throw new Error('no seed found for the wanted side');
    }

    it('upgrades two cards free at Overclock Rig, then adds one Corrupted Data on DONE', async () => {
        const store = makeStore(seenRun(allBut('overclock_rig')));
        await mount(store);
        const before = store.getState().run.run!;
        const scrapBefore = before.scrap;

        await click(byText('Upgrade two cards'));
        expect(byText('DONE')!.disabled).toBe(true);
        for (let i = 0; i < 2; i += 1) await click(host.querySelector('.mk-upgrade .rs-row') as HTMLButtonElement);

        const mid = store.getState().run.run!;
        expect(mid.deck.filter((c) => c.upgraded === true)).toHaveLength(2);
        expect(mid.scrap).toBe(scrapBefore);
        // The junk is not added until the bench is finished, and the event is not spent yet.
        expect(mid.deck.some((c) => c.dataId === JUNK_CARD_ID)).toBe(false);
        expect(byText('BACK')!.disabled).toBe(true);
        expect(byText('DONE')!.disabled).toBe(false);

        await click(byText('DONE'));
        const after = store.getState().run.run!;
        expect(after.deck.filter((c) => c.dataId === JUNK_CARD_ID)).toHaveLength(1);
        expect(after.deck).toHaveLength(before.deck.length + 1);
        expect(after.eventHistory).toHaveLength(BUILT_EVENTS.size);
        expect(host.textContent).toContain('The relay is dark');
    });

    it('lets Overclock Rig be left with nothing changed', async () => {
        const store = makeStore(seenRun(allBut('overclock_rig')));
        await mount(store);
        const before = store.getState().run.run!;
        await click(byText('Leave'));
        const after = store.getState().run.run!;
        expect(after.deck).toEqual(before.deck);
        expect(after.eventHistory).toHaveLength(BUILT_EVENTS.size);
    });

    it('Corrupted Cache, on a win, offers three Rare cards and takes nothing else', async () => {
        const store = makeStore(cacheRun(true));
        await mount(store);
        const before = store.getState().run.run!;
        expect(byText('Open it (50% / 50%)')).toBeDefined();

        await click(byText('Open it'));
        expect(host.querySelectorAll('.rs-card')).toHaveLength(3);
        await click(host.querySelector('.rs-card') as HTMLButtonElement);
        await click(byText('TAKE CARD'));

        const after = store.getState().run.run!;
        expect(after.deck).toHaveLength(before.deck.length + 1);
        expect(after.deck.some((c) => c.dataId === JUNK_CARD_ID)).toBe(false);
        expect(after.scrap).toBe(before.scrap);
    });

    it('Corrupted Cache, on a loss, adds Corrupted Data and takes 15 scrap', async () => {
        const store = makeStore({ ...cacheRun(false), scrap: 40 });
        await mount(store);
        await click(byText('Open it'));

        const after = store.getState().run.run!;
        expect(after.deck.filter((c) => c.dataId === JUNK_CARD_ID)).toHaveLength(1);
        expect(after.scrap).toBe(25);
        expect(host.textContent).toContain('The relay is dark');
    });

    it('Corrupted Cache, on a loss with under 15 scrap, takes what the run holds and no more', async () => {
        const store = makeStore({ ...cacheRun(false), scrap: 5 });
        await mount(store);
        await click(byText('Open it'));
        expect(store.getState().run.run!.scrap).toBe(0);
    });

    it('Corrupted Cache lands on the same side every time for the same node', async () => {
        const run = cacheRun(false);
        const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
        expect([1, 2, 3].map(() => gambleWins({ run, node }, 0, 50))).toEqual([false, false, false]);
    });
});

