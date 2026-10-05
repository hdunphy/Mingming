/**
 * TICKET 185e — a fight's reward leaves out the cards the last two picks showed, and lets them back
 * in (oldest first) only when the pool cannot fill three distinct without them.
 */
import { describe, it, expect } from 'vitest';
import { rewardCardPool, rollDropTable } from '../RewardSystem';
import { createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';
import type { IBattleEntity } from '../types';

const FENRIR = [{ definitionId: 'fenrir', activeOS: 'fenrir_v1' }];
const POOL = rewardCardPool(FENRIR);
const corpse = (): IBattleEntity => createSparseEntity({ id: 'e0', definitionId: 'fyrbot', name: 'Foe', currentHp: 0 });
const offerOf = (seed: string, recentOffers: string[][]): string[] =>
    rollDropTable({ defeated: [corpse()], nodeKind: 'wild', party: FENRIR, seed, recentOffers }).cardChoices[0].options.map((o) => o.dataId);

describe('ticket 185e — a fight reward and the last two picks', () => {
    it('never shows a card either of the last two picks showed', () => {
        const recent = [POOL.slice(0, 12), POOL.slice(12, 24)];
        for (let i = 0; i < 200; i += 1) {
            const offer = offerOf(`recent-${i}`, recent);
            expect(offer).toHaveLength(3);
            expect(new Set(offer).size).toBe(3);
            for (const id of offer) expect(recent.flat(), `${id} was shown recently`).not.toContain(id);
        }
    });

    it('bars cards the offer would not have held without disturbing the three it gives', () => {
        const base = offerOf('stable', []);
        const bar = POOL.filter((id) => !base.includes(id)).slice(0, 3);
        const barred = offerOf('stable', [bar]);
        expect(barred).toHaveLength(3);
        for (const id of bar) expect(barred).not.toContain(id);
    });

    it('lets shown cards back in, oldest first, when the pool is too small to fill three without them', () => {
        // Leave exactly ONE card un-shown. Two must come back: the two shown longest ago.
        const free = POOL[POOL.length - 1];
        const shown = POOL.filter((id) => id !== free);
        const oldest = shown.slice(0, 20);
        const newest = shown.slice(20);
        for (let i = 0; i < 40; i += 1) {
            const offer = offerOf(`starved-${i}`, [oldest, newest]);
            expect(offer).toHaveLength(3);
            expect(new Set(offer).size).toBe(3);
            expect(offer).toContain(free);
            // The only cards let back in are the first two of the oldest pick.
            expect(offer.filter((id) => id !== free).sort()).toEqual([oldest[0], oldest[1]].sort());
        }
    });

    it('is the same offer for the same fight and the same memory', () => {
        expect(offerOf('again', [['x'], ['y']])).toEqual(offerOf('again', [['x'], ['y']]));
    });
});
