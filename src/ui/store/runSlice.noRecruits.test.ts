/**
 * TICKET 169h — No Recruits, at the two run reducers that would grow the party.
 *
 * `planRecruit` already returns nothing, so no dispatch should arrive; these are the belt and
 * braces the ticket asks for: a recruit action that DOES arrive changes nothing. And what the
 * modifier must NOT block: a banked blueprint, and benching a member you already have.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';

import gameReducer, { addBlueprint, createEmptyRanch } from './gameSlice';
import runReducer, { benchPartyMember, recordBankedBlueprint, recruitIntoParty, recruitToBench } from './runSlice';
import type { RunSliceState } from './runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { blueprintBankedModifier } from '../../engine/run/runSummary';
import { planRecruit } from '../../engine/run/workshop';
import type { IMingmingState } from '../../engine/types';
import type { IRanchMember, IRunState } from '../../engine/runTypes';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};
const ROSTER: IRanchMember[] = [
    { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 },
];

const makeRun = (modifiers: string[]): IRunState =>
    createRun({ seed: 'no-recruits-store', offer: offerGyms('offer-seed')[0], party: [KRAKEN], startedAt: 0, modifiers });

/** A plan built against a run WITHOUT the modifier, so there is a real recruit to try to apply. */
function aPlan() {
    const run = makeRun([]);
    const node = { ...run.nodes.find((n) => n.kind === 'workshop')!, visited: 1 };
    const ranch = { ...createEmptyRanch(), roster: ROSTER, blueprints: { fenrir: 1 } };
    return planRecruit({ ranch, run, node, speciesId: 'fenrir' })!;
}

function makeStore(run: IRunState) {
    return configureStore({
        reducer: { game: gameReducer, run: runReducer },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
        preloadedState: {
            game: { ...createEmptyRanch(), roster: ROSTER, blueprints: { fenrir: 1 } },
            run: { run: { ...run, scrap: 200 } } as RunSliceState,
        },
    });
}

describe('No Recruits — the recruit reducers', () => {
    const plan = aPlan();
    const payload = { memberId: plan.member.id, cards: plan.cards, price: 0 };

    it('recruitIntoParty leaves the run unchanged', () => {
        const store = makeStore(makeRun(['no_recruits']));
        const before = store.getState().run.run;
        store.dispatch(recruitIntoParty(payload));
        expect(store.getState().run.run).toEqual(before);
    });

    it('recruitToBench leaves the run unchanged', () => {
        const store = makeStore(makeRun(['no_recruits']));
        const before = store.getState().run.run;
        store.dispatch(recruitToBench(payload));
        expect(store.getState().run.run).toEqual(before);
    });

    it('both still recruit without the modifier (so the two tests above can fail)', () => {
        const party = makeStore(makeRun([]));
        party.dispatch(recruitIntoParty(payload));
        expect(party.getState().run.run!.partyIds).toContain(plan.member.id);

        const bench = makeStore(makeRun([]));
        bench.dispatch(recruitToBench(payload));
        expect(bench.getState().run.run!.bench).toContain(plan.member.id);
    });
});

describe('No Recruits — what it does not block', () => {
    it('a blueprint drop still banks to the ranch and the run ledger', () => {
        const store = makeStore(makeRun(['no_recruits']));
        store.dispatch(addBlueprint('ymir'));
        store.dispatch(recordBankedBlueprint('ymir'));
        expect(store.getState().game.blueprints.ymir).toBe(1);
        expect(store.getState().run.run!.modifiers).toContain(blueprintBankedModifier('ymir'));
    });

    it('benching a member you already have still works', () => {
        const run = { ...makeRun(['no_recruits']), partyIds: ['mm1', 'mm2'] };
        const store = makeStore(run);
        store.dispatch(benchPartyMember('mm2'));
        expect(store.getState().run.run!.partyIds).toEqual(['mm1']);
        expect(store.getState().run.run!.bench).toContain('mm2');
    });
});
