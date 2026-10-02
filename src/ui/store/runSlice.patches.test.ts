/**
 * TICKET 163d — PATCHES IN A RUN: who can be given one, what it costs, and what the log says.
 *
 * `patches.test.ts` proves the six transforms are well-formed on all twelve. This proves the run
 * layer, which is where the rules Henry ruled actually live:
 *
 * - **One slot per body, and no replacing** (163 §5 decision 4). A second patch on the same member
 *   is refused, silently — not swapped. Swapping would turn a commitment into an inventory slot,
 *   which is a different decision and not one that has been made.
 * - **The party only.** A benched body is not in the fight, and a rider fitted to someone standing
 *   outside it is a rule nobody could see working.
 * - **The price rides the action.** The gate and the elite are free; the shop takes scrap. One
 *   reducer charges and fits, so an unaffordable click cannot half-happen — `buyMarketCard`'s
 *   standing argument, and the reason `spendRunScrap` is not used for purchases.
 * - **The offer is never a dead row.** `elitePatchOffer` skips a body whose slot is full and gives
 *   each remaining one the rider that changes the most about ITS firmware, because a random patch
 *   is a no-op on most (see `patchTouchCount`) and a prize the winner cannot use teaches the player
 *   to stop reading prizes.
 */
import { describe, expect, it } from 'vitest';

import runReducer, { fitPatch, type RunSliceState } from './runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { elitePatchOffer } from '../../engine/RewardSystem';
import { PATCHES, PATCH_IDS, PATCH_SLOTS } from '../../engine/data/patchRegistry';
import { gatePatchChoices, bestPatchFor, SHOP_STOCK_PATCH } from '../../engine/data/patchRanking';
import type { IMingmingState } from '../../engine/types';
import type { IRunState } from '../../engine/runTypes';

const PARTY: IMingmingState[] = [
    { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
];

function makeRun(scrap = 500): IRunState {
    const run = createRun({
        seed: 'patch-run-seed',
        offer: offerGyms('offer-seed')[0],
        party: PARTY,
        startedAt: 1_700_000_000_000,
    });
    return { ...run, scrap };
}

const stateOf = (run: IRunState): RunSliceState => ({ run });
const patchesOf = (run: IRunState, memberId = 'mm1'): ReadonlyArray<string> => run.patches?.[memberId] ?? [];

describe('163d — fitting a patch', () => {
    it('fits one to a party member and charges nothing by default', () => {
        const run = makeRun();
        const after = runReducer(stateOf(run), fitPatch({ memberId: 'mm1', patchId: 'amplifier' })).run!;
        expect(patchesOf(after)).toEqual(['amplifier']);
        expect(after.scrap).toBe(run.scrap);
    });

    it('charges the shop price when one is named, in the same action', () => {
        const run = makeRun(500);
        const after = runReducer(stateOf(run), fitPatch({ memberId: 'mm1', patchId: 'amplifier', price: 50 })).run!;
        expect(patchesOf(after)).toEqual(['amplifier']);
        expect(after.scrap).toBe(450);
    });

    it('refuses — byte for byte — a second patch, a stranger, an unknown id, or a short purse', () => {
        const run = makeRun(500);
        const refuses = (state: IRunState, payload: Parameters<typeof fitPatch>[0]): void => {
            expect(runReducer(stateOf(state), fitPatch(payload)).run!).toEqual(state);
        };

        // One slot, and it does not swap.
        const filled = runReducer(stateOf(run), fitPatch({ memberId: 'mm1', patchId: 'amplifier' })).run!;
        refuses(filled, { memberId: 'mm1', patchId: 'relay' });
        expect(PATCH_SLOTS).toBe(1);

        refuses(run, { memberId: 'not-in-the-party', patchId: 'amplifier' });
        refuses(run, { memberId: 'mm1', patchId: 'not_a_patch' });
        refuses({ ...run, scrap: 49 }, { memberId: 'mm1', patchId: 'amplifier', price: 50 });
        refuses(run, { memberId: 'mm1', patchId: 'amplifier', price: -1 });
    });

    it('keeps each body\'s slot separate', () => {
        // The interesting cut for a 3v3 game: a party can field two problems and give them
        // different answers. Keyed by member id, so filling one leaves the other open.
        const run = { ...makeRun(), partyIds: ['mm1', 'mm2'] };
        const one = runReducer(stateOf(run), fitPatch({ memberId: 'mm1', patchId: 'amplifier' })).run!;
        const two = runReducer(stateOf(one), fitPatch({ memberId: 'mm2', patchId: 'relay' })).run!;
        expect(patchesOf(two, 'mm1')).toEqual(['amplifier']);
        expect(patchesOf(two, 'mm2')).toEqual(['relay']);
    });
});

describe('163d — what each door offers', () => {
    it('the ELITE offers every body the rider that fits IT, not a random one', () => {
        const offers = elitePatchOffer([{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1' }]);
        expect(offers).toHaveLength(1);
        expect(offers[0].memberId).toBe('mm1');
        expect(offers[0].patchId).toBe(bestPatchFor('kraken_v1').id);
    });

    it('the ELITE skips a body whose slot is already full', () => {
        // Not a greyed-out row: a control that can never become live is ticket 20's complaint.
        const party = [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1' }];
        expect(elitePatchOffer(party, { mm1: ['amplifier'] })).toEqual([]);
    });

    it('the GATE offers two DIFFERENT riders, and never one already fitted', () => {
        const pair = gatePatchChoices('kraken_v1', []);
        expect(pair).toHaveLength(2);
        expect(new Set(pair).size).toBe(2);

        const held = pair[0];
        const second = gatePatchChoices('kraken_v1', [held]);
        expect(second).not.toContain(held);
    });

    it('the GATE leads with the rider that fits, so the choice is a real one', () => {
        // A pair drawn at random would routinely offer two patches that do nothing to this
        // firmware — a choice in form only.
        expect(gatePatchChoices('fenrir_v1', [])[0]).toBe(bestPatchFor('fenrir_v1').id);
    });

    it('the SHOP stocks AMPLIFIER, which §3 calls the one every OS can take', () => {
        expect(SHOP_STOCK_PATCH).toBe('amplifier');
        expect(PATCHES[SHOP_STOCK_PATCH]).toBeDefined();
        expect(PATCH_IDS).toContain(SHOP_STOCK_PATCH);
    });
});

describe('166e — gate benchKey limits fitting to one patch per visit', () => {
    it('two fitPatch calls with the same benchKey on two different bodies: only the first is fitted', () => {
        const run = { ...makeRun(), partyIds: ['mm1', 'mm2'] };
        const key = 'patch:node_gym_rootfall:1';
        const state1 = runReducer(stateOf(run), fitPatch({ memberId: 'mm1', patchId: 'amplifier', benchKey: key }));
        expect(patchesOf(state1.run!, 'mm1')).toEqual(['amplifier']);
        expect(state1.run?.patchBenchesUsed).toContain(key);

        const state2 = runReducer(state1, fitPatch({ memberId: 'mm2', patchId: 'relay', benchKey: key }));
        expect(patchesOf(state2.run!, 'mm2')).toEqual([]);
        expect(state2.run).toEqual(state1.run);
    });

    it('without a benchKey (the elite reward path) multiple bodies can be fitted in succession', () => {
        const run = { ...makeRun(), partyIds: ['mm1', 'mm2'] };
        const state1 = runReducer(stateOf(run), fitPatch({ memberId: 'mm1', patchId: 'amplifier' }));
        const state2 = runReducer(state1, fitPatch({ memberId: 'mm2', patchId: 'relay' }));
        expect(patchesOf(state2.run!, 'mm1')).toEqual(['amplifier']);
        expect(patchesOf(state2.run!, 'mm2')).toEqual(['relay']);
    });
});

