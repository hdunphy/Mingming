/**
 * TICKET 169f — Junk Start: two Corrupted Data in the starting deck.
 *
 * The junk is minted AFTER the normal deck from the same stream, so every other card keeps the
 * instance id it always had, and it belongs to no member (`ownerId: null`), as an event's junk does.
 */

import { describe, expect, it } from 'vitest';

import { GetMingmingData } from '../../data/mingmingRegistry';
import type { IBiome } from '../../runTypes';
import type { IMingmingState } from '../../types';
import { createRun } from '../createRun';
import { GYM_REGISTRY, type IGymOffer } from '../gyms';
import { JUNK_CARD_ID } from '../junk';

const member = (id: string, definitionId: string): IMingmingState => ({
    id,
    definitionId,
    activeOS: GetMingmingData(definitionId).availableOS[0],
    blueprintsCollected: 0,
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
});

const biome = (element: string, index: number): IBiome => ({
    id: `biome_${element.toLowerCase()}_${index}`,
    name: `${element} ${index}`,
    elements: [element],
});

const OFFER: IGymOffer = {
    gym: GYM_REGISTRY.gym_emberfall,
    biomes: [biome('Water', 0), biome('Nature', 1), biome('Fire', 2)],
};

const PARTIES = [
    [member('mm1', 'kraken')],
    [member('mm1', 'kraken'), member('mm2', 'fenrir')],
    [member('mm1', 'kraken'), member('mm2', 'fenrir'), member('mm3', 'ratatoskr')],
];

describe('Junk Start', () => {
    for (const party of PARTIES) {
        it(`adds exactly two Corrupted Data to a ${party.length}-member party's deck, and nothing else`, () => {
            const plain = createRun({ seed: 'junk', offer: OFFER, party, startedAt: 0 });
            const junky = createRun({ seed: 'junk', offer: OFFER, party, startedAt: 0, modifiers: ['junk_start'] });

            expect(junky.deck).toHaveLength(plain.deck.length + 2);
            // Every other card is byte-identical: same id, same card, same owner, same place.
            expect(junky.deck.slice(0, plain.deck.length)).toEqual(plain.deck);
            const added = junky.deck.slice(plain.deck.length);
            expect(added.map((c) => c.dataId)).toEqual([JUNK_CARD_ID, JUNK_CARD_ID]);
            expect(added.every((c) => c.ownerId === null)).toBe(true);
            expect(new Set(added.map((c) => c.instanceId)).size).toBe(2);
            const ids = junky.deck.map((c) => c.instanceId);
            expect(new Set(ids).size).toBe(ids.length);
        });
    }

    it('is deterministic in the seed', () => {
        const a = createRun({ seed: 'junk', offer: OFFER, party: PARTIES[1], startedAt: 0, modifiers: ['junk_start'] });
        const b = createRun({ seed: 'junk', offer: OFFER, party: PARTIES[1], startedAt: 0, modifiers: ['junk_start'] });
        expect(a.deck).toEqual(b.deck);
    });

    it('without the modifier there is no junk', () => {
        for (const party of PARTIES) {
            const run = createRun({ seed: 'junk', offer: OFFER, party, startedAt: 0 });
            expect(run.deck.some((c) => c.dataId === JUNK_CARD_ID)).toBe(false);
        }
    });

    it('changes nothing else about the run', () => {
        const plain = createRun({ seed: 'junk', offer: OFFER, party: PARTIES[0], startedAt: 0 });
        const junky = createRun({ seed: 'junk', offer: OFFER, party: PARTIES[0], startedAt: 0, modifiers: ['junk_start'] });
        expect({ ...junky, deck: [], modifiers: [] }).toEqual({ ...plain, deck: [], modifiers: [] });
    });
});
