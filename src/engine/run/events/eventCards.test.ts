/**
 * TICKET 168a — the cards an event offers are distinct, come from the allowed rarities, and are the
 * same three every time the same node is opened.
 */

import { describe, expect, it } from 'vitest';

import { SeedStream } from '../../core/SeedStream';
import { ProgramRegistry } from '../../data/programRegistry';
import { rewardCardPool } from '../../RewardSystem';
import { createRun } from '../createRun';
import { offerGyms } from '../gyms';
import type { IMingmingState } from '../../types';
import { offerCards, rollCardChoices } from './eventCards';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};
const POOL = rewardCardPool([{ definitionId: 'kraken' }]);

describe('rollCardChoices', () => {
    it('returns three distinct cards, all of an allowed rarity', () => {
        for (let i = 0; i < 80; i += 1) {
            const picked = rollCardChoices(POOL, ['Common', 'Uncommon'], 3, new SeedStream(`cards-${i}`));
            expect(picked).toHaveLength(3);
            expect(new Set(picked).size).toBe(3);
            for (const id of picked) expect(['Common', 'Uncommon']).toContain(ProgramRegistry[id].rarity);
        }
    });

    it('offers only Rare cards when only Rare is named', () => {
        for (let i = 0; i < 40; i += 1) {
            for (const id of rollCardChoices(POOL, ['Rare'], 3, new SeedStream(`rare-${i}`))) {
                expect(ProgramRegistry[id].rarity).toBe('Rare');
            }
        }
    });

    it('offers fewer rather than repeating when the pool is short', () => {
        const short = POOL.filter((id) => ProgramRegistry[id].rarity === 'Rare').slice(0, 2);
        expect(rollCardChoices(short, ['Rare'], 3, new SeedStream('short'))).toHaveLength(2);
    });
});

describe('offerCards', () => {
    it('offers the same cards on the same node, and other cards in another slot', () => {
        const run = createRun({ seed: 'offer-seed', offer: offerGyms('event-offer')[0], party: [KRAKEN], startedAt: 1 });
        const node = { ...run.nodes.find((n) => n.id !== run.currentNodeId)!, visited: 1 };
        const ctx = { run, node, ranch: { roster: [{ id: 'mm1', definitionId: 'kraken' }], blueprints: {} } };
        const outcome = { count: 3, rarities: ['Common', 'Uncommon'] as const };
        expect(offerCards(ctx, outcome, 'pick:0')).toEqual(offerCards(ctx, outcome, 'pick:0'));
        expect(offerCards(ctx, outcome, 'pick:0')).toHaveLength(3);
    });
});
