/**
 * TICKET 168c — an upgrade bench may allow more than one upgrade per key (the Overclock Rig: two).
 */

import { describe, expect, it } from 'vitest';

import runReducer, { startRun, upgradeDeckCard, type RunSliceState } from './runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { hasUpgrade } from '../../engine/data/plusRegistry';
import type { IMingmingState } from '../../engine/types';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

function start(): RunSliceState {
    const run = createRun({ seed: 'allowance', offer: offerGyms('offer-seed')[0], party: [KRAKEN], startedAt: 1 });
    return runReducer(undefined, startRun(run));
}

const upgradable = (state: RunSliceState) => state.run!.deck.filter((card) => hasUpgrade(card.dataId));

describe('upgradeDeckCard with an allowance', () => {
    it('spends one upgrade per key by default', () => {
        let state = start();
        const [a, b] = upgradable(state);
        state = runReducer(state, upgradeDeckCard({ instanceId: a.instanceId, benchKey: 'bench:1', free: true }));
        state = runReducer(state, upgradeDeckCard({ instanceId: b.instanceId, benchKey: 'bench:1', free: true }));
        expect(state.run!.deck.filter((card) => card.upgraded)).toHaveLength(1);
    });

    it('spends exactly `allowance` upgrades on one key, and no more', () => {
        let state = start();
        const cards = upgradable(state);
        expect(cards.length).toBeGreaterThanOrEqual(3);
        for (const card of cards.slice(0, 3)) {
            state = runReducer(state, upgradeDeckCard({ instanceId: card.instanceId, benchKey: 'event:n1', free: true, allowance: 2 }));
        }
        expect(state.run!.deck.filter((card) => card.upgraded)).toHaveLength(2);
        expect((state.run!.upgradesTaken ?? []).filter((key) => key === 'event:n1')).toHaveLength(2);
    });

    it('keeps one key’s allowance apart from another’s', () => {
        let state = start();
        const cards = upgradable(state);
        state = runReducer(state, upgradeDeckCard({ instanceId: cards[0].instanceId, benchKey: 'event:n1', free: true, allowance: 2 }));
        state = runReducer(state, upgradeDeckCard({ instanceId: cards[1].instanceId, benchKey: 'event:n2', free: true, allowance: 2 }));
        expect(state.run!.deck.filter((card) => card.upgraded)).toHaveLength(2);
    });
});
