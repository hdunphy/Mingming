import { describe, it, expect } from 'vitest';
import { rollDropTable, getDropTable, getScrapYield } from './RewardSystem';
import type { IBattleEntity } from './types';

function makeDeadEntity(id: string, defId: string, name: string): IBattleEntity {
    return {
        id, name, level: 10, experience: 0,
        hpIV: 0, attackIV: 0, defenseIV: 0,
        maxHp: 100, attack: 15, defense: 5,
        maxEnergy: 10, cardDraw: 1,
        currentHp: 0, // DEAD
        currentEnergy: 0,
        primaryElement: 'Fire',
        statusEffects: [],
        definitionId: defId,
        tempHp: 0, speed: 10
    };
}

function makeAliveEntity(id: string, defId: string, name: string): IBattleEntity {
    return { ...makeDeadEntity(id, defId, name), currentHp: 50 };
}

describe('RewardSystem', () => {
    describe('rollDropTable', () => {
        it('returns deterministic results for the same seed', () => {
            const defeated = [makeDeadEntity('e1', 'def_fire', 'Fire Mon')];
            const r1 = rollDropTable(defeated, 42);
            const r2 = rollDropTable(defeated, 42);

            expect(r1.scraps).toBe(r2.scraps);
            expect(r1.blueprints.length).toBe(r2.blueprints.length);
            expect(r1.cards.length).toBe(r2.cards.length);
            // Card dataIds should match (instanceIds will differ due to UUID)
            for (let i = 0; i < r1.cards.length; i++) {
                expect(r1.cards[i].dataId).toBe(r2.cards[i].dataId);
            }
        });

        it('different seeds produce different results', () => {
            const defeated = [makeDeadEntity('e1', 'def_fire', 'Fire Mon')];
            const r1 = rollDropTable(defeated, 100);
            const r2 = rollDropTable(defeated, 200);

            // Very likely to differ (not guaranteed, but extremely improbable for LCG)
            const sameEverything = r1.scraps === r2.scraps
                && r1.cards.every((c, i) => c.dataId === r2.cards[i]?.dataId);
            expect(sameEverything).toBe(false);
        });

        it('skips alive entities', () => {
            const party = [
                makeDeadEntity('e1', 'def_fire', 'Dead'),
                makeAliveEntity('e2', 'def_fire', 'Alive')
            ];
            const result = rollDropTable(party, 42);

            // Should only get loot from 1 entity
            expect(result.cards.length).toBe(3); // 3 cards from the dead entity only
        });

        it('accumulates rewards from multiple defeated entities', () => {
            const party = [
                makeDeadEntity('e1', 'def_fire', 'Dead 1'),
                makeDeadEntity('e2', 'def_water', 'Dead 2'),
                makeDeadEntity('e3', 'def_fire', 'Dead 3')
            ];
            const result = rollDropTable(party, 42);

            expect(result.scraps).toBeGreaterThan(0);
            expect(result.cards.length).toBe(9); // 3 cards per defeated entity = 9
        });

        it('returns empty rewards when no entities are defeated', () => {
            const party = [makeAliveEntity('e1', 'def_fire', 'Alive')];
            const result = rollDropTable(party, 42);

            expect(result.scraps).toBe(0);
            expect(result.blueprints).toHaveLength(0);
            expect(result.cards).toHaveLength(0);
        });

        it('scrap value falls within drop table range', () => {
            const defeated = [makeDeadEntity('e1', 'def_fire', 'Fire Mon')];
            // Run many seeds to check range
            for (let seed = 1; seed <= 50; seed++) {
                const result = rollDropTable(defeated, seed);
                expect(result.scraps).toBeGreaterThanOrEqual(5);
                expect(result.scraps).toBeLessThanOrEqual(15);
            }
        });

        it('cards come from the correct element pool', () => {
            const defeated = [makeDeadEntity('e1', 'def_fire', 'Fire Mon')];
            const table = getDropTable('def_fire');
            const result = rollDropTable(defeated, 42);

            for (const card of result.cards) {
                expect(table.cardPool).toContain(card.dataId);
            }
        });
    });

    describe('getDropTable', () => {
        it('returns known table for def_fire', () => {
            const table = getDropTable('def_fire');
            expect(table.architectureId).toBe('def_fire');
            expect(table.cardPool.length).toBeGreaterThan(0);
        });

        it('returns fallback for unknown definition', () => {
            const table = getDropTable('unknown_arch');
            expect(table.architectureId).toBe('unknown_arch');
            expect(table.cardPool.length).toBeGreaterThan(0);
        });
    });

    describe('getScrapYield', () => {
        it('returns 10 for Common', () => {
            expect(getScrapYield('Common')).toBe(10);
        });
        it('returns 50 for Rare', () => {
            expect(getScrapYield('Rare')).toBe(50);
        });
        it('defaults to 10 for unknown rarity', () => {
            expect(getScrapYield('Mythical')).toBe(10);
        });
    });
});
