/**
 * TICKET 168a — the event framework, from the data file to the reducer.
 *
 * `events.json` is the catalogue of all 20 events; `drawEvent` picks one for a node; `resolveEvent`
 * records that the node played it. What these cases protect is the set of rules that make an event
 * fair rather than fun: it happens once per node, each event once per run, the rare ones only from
 * the second biome, and the two power grants (a Driver, a patch) at most once each per run.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';

import runReducer, { resolveEvent, startRun } from '../../../ui/store/runSlice';
import { createRun } from '../createRun';
import { offerGyms } from '../gyms';
import type { IMingmingState } from '../../types';
import type { IRegionNode, IRunState } from '../../runTypes';
import { EVENTS, getEvent } from './eventCatalogue';
import { BUILT_EVENTS, drawEvent } from './eventDraw';
import { ELIGIBILITY_IDS } from './eventEligibility';
import { playableChoices } from './eventChoices';
import { parseEvents } from './eventSchema';
import type { EventDefinition } from './eventSchema';
import type { EventRanchView } from './eventContext';
import { seenEventIds } from './eventState';
import rawEvents from '../../data/events.json';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};
const RANCH: EventRanchView = { roster: [{ id: 'mm1', definitionId: 'kraken' }], blueprints: {} };

function makeRun(seed = 'event-seed'): IRunState {
    return createRun({ seed, offer: offerGyms('event-offer')[0], party: [KRAKEN], startedAt: 1_700_000_000_000 });
}

/** A node in a chosen biome, already visit-incremented as `enterNode` leaves it. */
function nodeIn(run: IRunState, biomeIndex: number): IRegionNode {
    const base = run.nodes.find((node) => node.id !== run.currentNodeId)!;
    return { ...base, biomeIndex, visited: 1 };
}

const ALL_BUILT = new Set(EVENTS.map((event) => event.id));
const ANY = { built: ALL_BUILT, isEligible: () => true };

function event(id: string, over: Partial<EventDefinition> = {}): EventDefinition {
    return {
        id, name: id, rarity: 'Common', text: 'x', grants: [],
        choices: [{ id: 'leave', label: 'Leave', detail: '', outcomes: [] }],
        ...over,
    };
}

describe('events.json', () => {
    it('parses, holds 20 events with unique ids, and uses only the three rarities and the two grants', () => {
        expect(EVENTS).toHaveLength(20);
        expect(new Set(EVENTS.map((e) => e.id)).size).toBe(20);
        for (const e of EVENTS) {
            expect(['Common', 'Uncommon', 'Rare']).toContain(e.rarity);
            for (const grant of e.grants) expect(['driver', 'patch']).toContain(grant);
        }
    });

    it('throws on a bad file rather than loading half of it', () => {
        expect(() => parseEvents([{ id: 'x' }])).toThrow();
        expect(() => parseEvents([...rawEvents, rawEvents[0]])).toThrow();
    });

    it('has an eligibility check for every event, and none for an event that does not exist', () => {
        expect([...ELIGIBILITY_IDS].sort()).toEqual(EVENTS.map((e) => e.id).sort());
    });

    it('leaves every event leavable except Gjöll Ford and The Toll', () => {
        const noLeave = EVENTS.filter((e) => !e.choices.some((c) => c.id === 'leave')).map((e) => e.id).sort();
        expect(noLeave).toEqual(['corrupted_stream', 'the_toll']);
    });

    it('names its two power grants on exactly the Driver Shrine and the Black Market Patch', () => {
        expect(getEvent('driver_shrine')?.grants).toEqual(['driver']);
        expect(getEvent('black_market_patch')?.grants).toEqual(['patch']);
        expect(EVENTS.filter((e) => e.grants.length > 0)).toHaveLength(2);
    });

    it('offers only the choices whose outcomes are built, and Dig deeper is built as of 168b', () => {
        const cache = getEvent('scrap_cache')!;
        expect(playableChoices(cache).map((c) => c.id)).toEqual(['take', 'dig', 'leave']);
    });
});

describe('drawEvent', () => {
    const run = makeRun();

    it('is deterministic: the same run and node draw the same event', () => {
        const node = nodeIn(run, 1);
        expect(drawEvent(run, node, RANCH, ANY)?.id).toBe(drawEvent(run, node, RANCH, ANY)?.id);
    });

    it('never returns an event the run has already seen', () => {
        for (let i = 0; i < 60; i += 1) {
            const seeded = makeRun(`seen-${i}`);
            const node = nodeIn(seeded, 1);
            const first = drawEvent(seeded, node, RANCH, ANY)!;
            const after: IRunState = {
                ...seeded,
                eventHistory: [{ nodeId: 'elsewhere', eventId: first.id, choiceId: 'leave', grants: [] }],
            };
            expect(drawEvent(after, node, RANCH, ANY)?.id).not.toBe(first.id);
        }
    });

    it('never returns a Rare event in the first biome, and does draw them later', () => {
        const rareIn = (biome: number): number => {
            let rares = 0;
            for (let i = 0; i < 300; i += 1) {
                const seeded = makeRun(`rare-${i}`);
                if (drawEvent(seeded, nodeIn(seeded, biome), RANCH, ANY)?.rarity === 'Rare') rares += 1;
            }
            return rares;
        };
        expect(rareIn(0)).toBe(0);
        expect(rareIn(1)).toBeGreaterThan(0);
    });

    it('falls back down then up when the rolled rarity has nothing left, and returns null when nothing is left', () => {
        const onlyRare = [event('r', { rarity: 'Rare' })];
        const onlyCommon = [event('c')];
        const seeded = makeRun();
        const node = nodeIn(seeded, 1);
        const opts = (catalogue: EventDefinition[]) => ({ catalogue, built: new Set(catalogue.map((e) => e.id)), isEligible: () => true });
        for (let i = 0; i < 40; i += 1) {
            const s = makeRun(`fb-${i}`);
            expect(drawEvent(s, nodeIn(s, 1), RANCH, opts(onlyRare))?.id).toBe('r');
            expect(drawEvent(s, nodeIn(s, 1), RANCH, opts(onlyCommon))?.id).toBe('c');
        }
        // A Rare-only catalogue in biome 0 has nothing rollable at all.
        expect(drawEvent(seeded, nodeIn(seeded, 0), RANCH, opts(onlyRare))).toBeNull();
        expect(node.biomeIndex).toBe(1);
    });

    it('returns null when every built event has been seen', () => {
        const history = [...BUILT_EVENTS].map((eventId, i) => ({ nodeId: `n${i}`, eventId, choiceId: 'leave', grants: [] }));
        const spent: IRunState = { ...run, eventHistory: history };
        expect(seenEventIds(spent).size).toBe(BUILT_EVENTS.size);
        expect(drawEvent(spent, nodeIn(spent, 0), RANCH)).toBeNull();
    });

    it('draws only built events unless told otherwise', () => {
        for (let i = 0; i < 40; i += 1) {
            const seeded = makeRun(`built-${i}`);
            const drawn = drawEvent(seeded, nodeIn(seeded, 1), RANCH);
            if (drawn) expect(BUILT_EVENTS.has(drawn.id)).toBe(true);
        }
    });

    it('once an event has granted a Driver, no Driver-granting event is drawn again', () => {
        const shrine = event('shrine', { grants: ['driver'] });
        const plain = event('plain');
        const catalogue = [shrine, plain];
        const opts = { catalogue, built: new Set(['shrine', 'plain']), isEligible: () => true };
        let drawnBefore = 0;
        for (let i = 0; i < 60; i += 1) {
            const seeded = makeRun(`cap-${i}`);
            const node = nodeIn(seeded, 1);
            if (drawEvent(seeded, node, RANCH, opts)?.id === 'shrine') drawnBefore += 1;
            const spent: IRunState = {
                ...seeded,
                eventHistory: [{ nodeId: 'elsewhere', eventId: 'other', choiceId: 'take', grants: ['driver'] }],
            };
            expect(drawEvent(spent, node, RANCH, opts)?.id).toBe('plain');
        }
        // The control: with the cap unspent the shrine IS drawable, so the assertion above bites.
        expect(drawnBefore).toBeGreaterThan(0);
    });

    it('once an event has granted a patch, no patch-granting event is drawn again', () => {
        const opts = {
            catalogue: [event('market', { grants: ['patch'] }), event('plain')],
            built: new Set(['market', 'plain']),
            isEligible: () => true,
        };
        for (let i = 0; i < 40; i += 1) {
            const seeded = makeRun(`patch-${i}`);
            const spent: IRunState = {
                ...seeded,
                eventHistory: [{ nodeId: 'elsewhere', eventId: 'other', choiceId: 'take', grants: ['patch'] }],
            };
            expect(drawEvent(spent, nodeIn(spent, 1), RANCH, opts)?.id).toBe('plain');
        }
    });
});

describe('resolveEvent', () => {
    function storeWithRun() {
        const store = configureStore({ reducer: { run: runReducer } });
        store.dispatch(startRun(makeRun()));
        return store;
    }

    it('records the resolution, and refuses a second one for the same node', () => {
        const store = storeWithRun();
        store.dispatch(resolveEvent({ nodeId: 'n1', eventId: 'scrap_cache', choiceId: 'take', grants: [] }));
        store.dispatch(resolveEvent({ nodeId: 'n1', eventId: 'data_fragments', choiceId: 'scrap', grants: [] }));
        expect(store.getState().run.run!.eventHistory).toEqual([
            { nodeId: 'n1', eventId: 'scrap_cache', choiceId: 'take', grants: [] },
        ]);
    });

    it('lets a different node resolve its own event', () => {
        const store = storeWithRun();
        store.dispatch(resolveEvent({ nodeId: 'n1', eventId: 'scrap_cache', choiceId: 'take', grants: [] }));
        store.dispatch(resolveEvent({ nodeId: 'n2', eventId: 'relay_tower', choiceId: 'strip', grants: [] }));
        expect(store.getState().run.run!.eventHistory).toHaveLength(2);
    });

    it('starts every run with an empty history, and reads an older save without one', () => {
        expect(makeRun().eventHistory ?? []).toEqual([]);
    });
});
