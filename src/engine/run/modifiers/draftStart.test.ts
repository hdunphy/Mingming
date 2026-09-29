/**
 * TICKET 169i — Draft Start: instead of being dealt its 5 start-kit cards, each body drafts 5, one
 * pick at a time, from 3 offers each. This file is the engine half: the pool, the offers, and what
 * `createRun` does with the finished kits. The screen is `DraftStart.test.tsx`.
 */

import { describe, expect, it } from 'vitest';

import { GENERIC_HIT, GetMingmingData, LAUNCH_SPECIES, getDeckForOS } from '../../data/mingmingRegistry';
import type { IMingmingState } from '../../types';
import { START_KIT_SIZE, STARTER_GENERICS, createRun, startKitIdsFor } from '../createRun';
import { offerGyms } from '../gyms';
import { DRAFT_PICKS, draftOffer, draftPool, takePick } from './draftStart';

const member = (id: string, definitionId: string, activeOS?: string): IMingmingState => ({
    id,
    definitionId,
    activeOS: activeOS ?? GetMingmingData(definitionId).availableOS[0],
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
});

describe('draftPool', () => {
    it('is the member\'s tuned deck for its OS, one entry per copy', () => {
        const fenrir = member('mm1', 'fenrir', 'fenrir_v2');
        expect(draftPool(fenrir)).toEqual(getDeckForOS('fenrir', 'fenrir_v2'));
    });

    it('keeps duplicate copies as separate entries', () => {
        const pool = draftPool(member('mm1', 'fenrir', 'fenrir_v1'));
        expect(new Set(pool).size).toBeLessThan(pool.length);
    });

    it('is a copy, so drafting cannot edit the registry', () => {
        const fenrir = member('mm1', 'fenrir');
        draftPool(fenrir).pop();
        expect(draftPool(fenrir)).toHaveLength(getDeckForOS('fenrir', fenrir.activeOS).length);
    });
});

describe('DRAFT_PICKS', () => {
    it('is the start kit size', () => {
        expect(DRAFT_PICKS).toBe(START_KIT_SIZE);
        expect(DRAFT_PICKS).toBe(5);
    });
});

describe('draftOffer', () => {
    const POOL = ['a', 'a', 'b', 'c', 'c', 'd', 'e', 'f'];

    it('is deterministic for the same seed, member, pick and pool', () => {
        expect(draftOffer('seed-1', 0, 0, POOL)).toEqual(draftOffer('seed-1', 0, 0, POOL));
    });

    it('offers three cards drawn from three distinct positions', () => {
        for (let i = 0; i < 100; i++) {
            const offer = draftOffer(`seed-${i}`, i % 3, i % 5, POOL);
            expect(offer).toHaveLength(3);
            // Three positions of POOL: multiset-contained in it.
            const left = [...POOL];
            for (const id of offer) {
                const at = left.indexOf(id);
                expect(at, `${id} offered more often than the pool holds it`).toBeGreaterThanOrEqual(0);
                left.splice(at, 1);
            }
        }
    });

    it('can offer both copies of a duplicate (positions, not ids, are distinct)', () => {
        let both = false;
        for (let i = 0; i < 200 && !both; i++) {
            both = draftOffer(`dup-${i}`, 0, 0, ['a', 'a', 'b', 'c', 'd']).filter((id) => id === 'a').length === 2;
        }
        expect(both).toBe(true);
    });

    it('does not repeat itself across members or picks', () => {
        const offers = new Set<string>();
        for (let member = 0; member < 3; member++) {
            for (let pick = 0; pick < 5; pick++) offers.add(draftOffer('seed-x', member, pick, POOL).join());
        }
        expect(offers.size).toBeGreaterThan(1);
    });

    it('depends on the seed', () => {
        const offers = new Set<string>();
        for (let i = 0; i < 30; i++) offers.add(draftOffer(`seed-${i}`, 0, 0, POOL).join());
        expect(offers.size).toBeGreaterThan(1);
    });

    it('offers fewer than three only when fewer remain', () => {
        expect(draftOffer('s', 0, 4, ['a', 'b'])).toHaveLength(2);
        expect(draftOffer('s', 0, 4, ['a']).sort()).toEqual(['a']);
        expect(draftOffer('s', 0, 4, [])).toEqual([]);
        expect(draftOffer('s', 0, 4, ['a', 'b', 'c'])).toHaveLength(3);
    });

    it('does not change the pool it is given', () => {
        const pool = [...POOL];
        draftOffer('s', 0, 0, pool);
        expect(pool).toEqual(POOL);
    });
});

describe('takePick', () => {
    it('removes one copy of the picked card and leaves the rest', () => {
        expect(takePick(['a', 'a', 'b'], 'a')).toEqual(['a', 'b']);
        expect(takePick(['a', 'b'], 'b')).toEqual(['a']);
    });

    it('returns the pool unchanged for a card that is not in it', () => {
        expect(takePick(['a', 'b'], 'z')).toEqual(['a', 'b']);
    });
});

describe('a full draft on every launch species', () => {
    for (const species of LAUNCH_SPECIES) {
        for (const os of GetMingmingData(species).availableOS) {
            it(`never runs out of offers: ${os}`, () => {
                const who = member('mm1', species, os);
                let remaining = draftPool(who);
                const picks: string[] = [];
                for (let pick = 0; pick < DRAFT_PICKS; pick++) {
                    const offer = draftOffer('full-draft', 0, pick, remaining);
                    expect(offer.length, `pick ${pick}`).toBe(3);
                    picks.push(offer[0]);
                    remaining = takePick(remaining, offer[0]);
                }
                expect(picks).toHaveLength(DRAFT_PICKS);
                // Every pick was a real card of the deck, and no card was taken more times than it appears.
                const pool = draftPool(who);
                for (const id of new Set(picks)) {
                    expect(picks.filter((p) => p === id).length).toBeLessThanOrEqual(pool.filter((p) => p === id).length);
                }
            });
        }
    }
});

describe('createRun with startKitOverrides', () => {
    const OFFER = offerGyms('offer-seed')[0];
    const KRAKEN = member('mm1', 'kraken', 'kraken_v1');
    const FENRIR = member('mm2', 'fenrir', 'fenrir_v1');

    it('builds exactly the overridden kit, plus the generics on the first member', () => {
        const kit = draftPool(KRAKEN).slice(0, DRAFT_PICKS).reverse();
        const run = createRun({
            seed: 'draft-run', offer: OFFER, party: [KRAKEN], startedAt: 0,
            modifiers: ['draft_start'], startKitOverrides: { mm1: kit },
        });

        expect(run.deck.map((c) => c.dataId)).toEqual([...kit, ...Array(STARTER_GENERICS).fill(GENERIC_HIT)]);
        expect(run.deck.every((c) => c.ownerId === 'mm1')).toBe(true);
        expect(run.modifiers).toContain('mod:draft_start');
    });

    it('overrides each member by id, and only the first member brings generics', () => {
        const kitK = draftPool(KRAKEN).slice(0, DRAFT_PICKS);
        const kitF = draftPool(FENRIR).slice(0, DRAFT_PICKS);
        const run = createRun({
            seed: 'draft-run-2', offer: OFFER, party: [KRAKEN, FENRIR], startedAt: 0,
            modifiers: ['draft_start'], startKitOverrides: { mm1: kitK, mm2: kitF },
        });

        expect(run.deck.filter((c) => c.ownerId === 'mm1').map((c) => c.dataId)).toEqual([...kitK, ...Array(STARTER_GENERICS).fill(GENERIC_HIT)]);
        expect(run.deck.filter((c) => c.ownerId === 'mm2').map((c) => c.dataId)).toEqual(kitF);
    });

    it('is unchanged without overrides: the dealt kit', () => {
        const run = createRun({ seed: 'draft-run', offer: OFFER, party: [KRAKEN], startedAt: 0 });
        expect(run.deck.map((c) => c.dataId).slice(0, DRAFT_PICKS)).toEqual(startKitIdsFor(KRAKEN, START_KIT_SIZE));
    });

    it('throws with the modifier on and no override for a member', () => {
        const kitK = draftPool(KRAKEN).slice(0, DRAFT_PICKS);
        expect(() => createRun({
            seed: 'x', offer: OFFER, party: [KRAKEN, FENRIR], startedAt: 0,
            modifiers: ['draft_start'], startKitOverrides: { mm1: kitK },
        })).toThrow(/mm2/);
        expect(() => createRun({
            seed: 'x', offer: OFFER, party: [KRAKEN], startedAt: 0, modifiers: ['draft_start'],
        })).toThrow(/mm1/);
    });

    it('throws with the modifier on and an override of the wrong length', () => {
        for (const length of [0, DRAFT_PICKS - 1, DRAFT_PICKS + 1]) {
            expect(() => createRun({
                seed: 'x', offer: OFFER, party: [KRAKEN], startedAt: 0,
                modifiers: ['draft_start'],
                startKitOverrides: { mm1: draftPool(KRAKEN).concat(draftPool(KRAKEN)).slice(0, length) },
            }), `length ${length}`).toThrow(/mm1/);
        }
    });

    it('does not require overrides when the modifier is off', () => {
        expect(() => createRun({ seed: 'x', offer: OFFER, party: [KRAKEN], startedAt: 0 })).not.toThrow();
    });
});
