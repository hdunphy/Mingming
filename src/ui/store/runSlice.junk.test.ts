/**
 * TICKET 168c — removing junk costs scrap, and the deck floor ignores it.
 *
 * *"Also you have to pay to remove them instead of selling them for scrap at the shop."* (Henry.)
 */

import { describe, expect, it } from 'vitest';

import runReducer, {
    addRunCards,
    addRunCollection,
    moveCardToCollection,
    removeJunkCard,
    sellRunCard,
    startRun,
    type RunSliceState,
} from './runSlice';
import { createRun, minimumActiveDeck } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { JUNK_REMOVAL_PRICE } from '../../engine/run/marketplace';
import { JUNK_CARD_ID } from '../../engine/run/junk';
import type { IMingmingState } from '../../engine/types';
import type { IRunCard } from '../../engine/runTypes';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};
const junk = (id: string): IRunCard => ({ instanceId: id, dataId: JUNK_CARD_ID, ownerId: null });

/** A run holding exactly its floor of real cards, plus `scrap`. */
function start(scrap = 100): RunSliceState {
    const run = createRun({ seed: 'junk-reducer', offer: offerGyms('offer-seed')[0], party: [KRAKEN], startedAt: 1 });
    return runReducer(undefined, startRun({ ...run, scrap }));
}

describe('removal costs scrap (JUNK_REMOVAL_PRICE)', () => {
    it('is 25', () => {
        expect(JUNK_REMOVAL_PRICE).toBe(25);
    });

    it('charges 25 and removes the junk from the deck', () => {
        let state = runReducer(start(100), addRunCards([junk('j1')]));
        state = runReducer(state, removeJunkCard({ instanceId: 'j1', price: JUNK_REMOVAL_PRICE }));
        expect(state.run!.scrap).toBe(75);
        expect(state.run!.deck.some((card) => card.instanceId === 'j1')).toBe(false);
    });

    it('removes junk from the collection too', () => {
        let state = runReducer(start(100), addRunCollection([junk('j1')]));
        state = runReducer(state, removeJunkCard({ instanceId: 'j1', price: JUNK_REMOVAL_PRICE }));
        expect(state.run!.scrap).toBe(75);
        expect((state.run!.collection ?? []).length).toBe(0);
    });

    it('refuses a card that is not junk, and takes no scrap', () => {
        const state = start(100);
        const real = state.run!.deck[0];
        const after = runReducer(state, removeJunkCard({ instanceId: real.instanceId, price: JUNK_REMOVAL_PRICE }));
        expect(after.run!.scrap).toBe(100);
        expect(after.run!.deck).toHaveLength(state.run!.deck.length);
    });

    it('refuses when the scrap is short, and for a bad price or an unknown card', () => {
        let state = runReducer(start(24), addRunCards([junk('j1')]));
        state = runReducer(state, removeJunkCard({ instanceId: 'j1', price: JUNK_REMOVAL_PRICE }));
        expect(state.run!.deck.some((card) => card.instanceId === 'j1')).toBe(true);
        expect(state.run!.scrap).toBe(24);

        const rich = runReducer(start(100), addRunCards([junk('j1')]));
        expect(runReducer(rich, removeJunkCard({ instanceId: 'j1', price: -5 })).run!.scrap).toBe(100);
        expect(runReducer(rich, removeJunkCard({ instanceId: 'nope', price: 25 })).run!.scrap).toBe(100);
    });
});

describe('the floor ignores junk', () => {
    it('a deck at its floor plus one junk can still remove the junk', () => {
        const floor = minimumActiveDeck(1);
        let state = runReducer(start(100), addRunCards([junk('j1')]));
        expect(state.run!.deck).toHaveLength(floor + 1);
        state = runReducer(state, removeJunkCard({ instanceId: 'j1', price: JUNK_REMOVAL_PRICE }));
        expect(state.run!.deck).toHaveLength(floor);
    });

    it('a deck at its floor plus a junk card still refuses to shed a REAL card', () => {
        const floor = minimumActiveDeck(1);
        const withJunk = runReducer(start(100), addRunCards([junk('j1')]));
        expect(withJunk.run!.deck.length).toBe(floor + 1);
        const real = withJunk.run!.deck.find((card) => card.instanceId !== 'j1')!;

        expect(runReducer(withJunk, moveCardToCollection(real.instanceId)).run!.deck).toHaveLength(floor + 1);
        expect(runReducer(withJunk, sellRunCard({ instanceId: real.instanceId, price: 5 })).run!.deck).toHaveLength(floor + 1);
    });

    it('sending junk to the collection is never floor-blocked', () => {
        const withJunk = runReducer(start(100), addRunCards([junk('j1')]));
        const after = runReducer(withJunk, moveCardToCollection('j1'));
        expect(after.run!.deck.some((card) => card.instanceId === 'j1')).toBe(false);
        expect((after.run!.collection ?? []).some((card) => card.instanceId === 'j1')).toBe(true);
    });

    it('a real card above the floor can still go, junk or no junk', () => {
        let state = runReducer(start(100), addRunCards([junk('j1'), { instanceId: 'extra', dataId: 'tackle', ownerId: null }]));
        state = runReducer(state, moveCardToCollection('extra'));
        expect((state.run!.collection ?? []).some((card) => card.instanceId === 'extra')).toBe(true);
    });

    it('junk cannot be SOLD for scrap', () => {
        const withJunk = runReducer(start(100), addRunCards([junk('j1')]));
        const after = runReducer(withJunk, sellRunCard({ instanceId: 'j1', price: 5 }));
        expect(after.run!.scrap).toBe(100);
        expect(after.run!.deck.some((card) => card.instanceId === 'j1')).toBe(true);
    });
});
