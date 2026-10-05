/**
 * TICKET 171b — the shelf is frozen at the first visit.
 *
 * Henry, 2026-09-29 playtest: *"The shop changed again after I swapped my loadout and dropped skoll
 * from my team."* The stock's seed was already static (ticket 142 §7), but the pool read the live
 * party, so changing the team drew a different shelf off the same seed. These tests pin both halves:
 * the live party DOES change the shelf (the reason a snapshot is needed at all), and the snapshot
 * holds it still.
 */

import { describe, expect, it } from 'vitest';

import runReducer, { freezeMarketParty, rerollMarketStock } from '../../ui/store/runSlice';
import { createRun } from './createRun';
import { offerGyms } from './gyms';
import { rollMarketStock, rollMacroStock, isMarketNode } from './marketplace';
import { marketPartyFor, snapshotMarketParty } from './marketParty';
import type { IRewardPartyMember } from '../RewardSystem';
import type { IMingmingState } from '../types';
import { RunStateSchema, type IRunState } from '../runTypes';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v2',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

const SOLO: IRewardPartyMember[] = [{ definitionId: 'kraken', activeOS: 'kraken_v2' }];
const WITH_SKOLL: IRewardPartyMember[] = [...SOLO, { definitionId: 'skoll', activeOS: 'skoll_v2' }];

function atMarket(): { run: IRunState; nodeId: string } {
    const base = createRun({
        seed: 'market-party-seed',
        offer: offerGyms('offer-seed')[0],
        party: [KRAKEN],
        startedAt: 1_700_000_000_000,
    });
    const market = base.nodes.find((n) => isMarketNode(n.kind))!;
    const run = {
        ...base,
        scrap: 500,
        currentNodeId: market.id,
        nodes: base.nodes.map((n) => (n.id === market.id ? { ...n, visited: n.visited + 1 } : n)),
    };
    return { run, nodeId: market.id };
}

const shelf = (run: IRunState, nodeId: string, live: ReadonlyArray<IRewardPartyMember>): string[] => {
    const node = run.nodes.find((n) => n.id === nodeId)!;
    const party = marketPartyFor(run, nodeId, live);
    return [
        ...rollMarketStock({ run, node, party }).offers.map((o) => o.card.dataId),
        ...rollMacroStock({ run, node, party }).map((o) => o.macroId),
    ];
};

describe('the shelf is frozen at the first visit (ticket 171b)', () => {
    it('the live team really does move the shelf, which is the bug', () => {
        const { run, nodeId } = atMarket();
        expect(shelf(run, nodeId, WITH_SKOLL)).not.toEqual(shelf(run, nodeId, SOLO));
    });

    it('after the first visit freezes it, a new team sees the same shelf', () => {
        const { run, nodeId } = atMarket();
        const frozen = runReducer({ run }, freezeMarketParty({ nodeId, party: SOLO })).run!;
        expect(shelf(frozen, nodeId, WITH_SKOLL)).toEqual(shelf(run, nodeId, SOLO));
    });

    it('a second freeze does not overwrite the first', () => {
        const { run, nodeId } = atMarket();
        const once = runReducer({ run }, freezeMarketParty({ nodeId, party: SOLO })).run!;
        const twice = runReducer({ run: once }, freezeMarketParty({ nodeId, party: WITH_SKOLL })).run!;
        expect(twice).toEqual(once);
    });

    it('refuses to freeze a node that is not a market', () => {
        const { run } = atMarket();
        const wild = run.nodes.find((n) => n.kind === 'wild')!;
        expect(runReducer({ run }, freezeMarketParty({ nodeId: wild.id, party: SOLO })).run).toEqual(run);
    });

    it('a paid refresh re-freezes the shelf at the team you have now', () => {
        const { run, nodeId } = atMarket();
        const frozen = runReducer({ run }, freezeMarketParty({ nodeId, party: SOLO })).run!;
        const refreshed = runReducer({ run: frozen }, rerollMarketStock({ nodeId, price: 50, party: WITH_SKOLL })).run!;
        expect(refreshed.marketParties?.[nodeId]).toEqual(snapshotMarketParty(WITH_SKOLL));
        // And it holds again from there: dropping Skoll afterwards does not move it.
        expect(shelf(refreshed, nodeId, SOLO)).toEqual(shelf(refreshed, nodeId, WITH_SKOLL));
    });

    it('with no snapshot the live team is used, so the balance walker is unchanged', () => {
        const { run, nodeId } = atMarket();
        expect(run.marketParties).toBeUndefined();
        expect(marketPartyFor(run, nodeId, WITH_SKOLL)).toBe(WITH_SKOLL);
    });

    it('survives a save and load', () => {
        const { run, nodeId } = atMarket();
        const frozen = runReducer({ run }, freezeMarketParty({ nodeId, party: WITH_SKOLL })).run!;
        const loaded = RunStateSchema.parse(JSON.parse(JSON.stringify(frozen)));
        expect(loaded.marketParties).toEqual(frozen.marketParties);
        // And a save without the field loads without inventing one.
        expect(RunStateSchema.parse(JSON.parse(JSON.stringify(run))).marketParties).toBeUndefined();
    });
});
