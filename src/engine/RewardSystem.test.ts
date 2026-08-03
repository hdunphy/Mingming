import { describe, it, expect } from 'vitest';
import { rollDropTable, rollDraftRounds, getScrapYield } from './RewardSystem';
import { ProgramRegistry } from './data/programRegistry';
import type { IBattleEntity } from './types';
import { ELEMENTS } from './types';

function makeDeadEntity(id: string, defId: string, name: string, element: any = 'Fire'): IBattleEntity {
    return {
        id, name, level: 10, experience: 0,
        hpIV: 0, attackIV: 0, defenseIV: 0, blueprintsCollected: 0,
        maxHp: 100, attack: 15, defense: 5,
        maxEnergy: 10, cardDraw: 1,
        currentHp: 0, // DEAD
        currentEnergy: 0,
        primaryElement: element,
        statusEffects: [],
        definitionId: defId,
        tempHp: 0, speed: 10,
        daemons: []
    };
}

function makeAliveEntity(id: string, defId: string, name: string): IBattleEntity {
    return { ...makeDeadEntity(id, defId, name), currentHp: 50 };
}

describe('RewardSystem', () => {
    describe('rollDropTable - Logic', () => {
        it('returns deterministic results for the same seed', () => {
            const defeated = [makeDeadEntity('e1', 'fyrbot', 'Fyrbot')];
            const r1 = rollDropTable(defeated, 1, 'fixed-seed-123');
            const r2 = rollDropTable(defeated, 1, 'fixed-seed-123');

            expect(r1.scraps).toBe(r2.scraps);
            expect(r1.totalXP).toBe(r2.totalXP);
            expect(r1.blueprints.length).toBe(r2.blueprints.length);

            for (let i = 0; i < r1.cardChoices.length; i++) {
                for (let j = 0; j < 3; j++) {
                    expect(r1.cardChoices[i].options[j].dataId).toBe(r2.cardChoices[i].options[j].dataId);
                }
            }
        });

        it('skips alive entities', () => {
            const entities = [
                makeDeadEntity('e1', 'fyrbot', 'Dead'),
                makeAliveEntity('e2', 'fyrbot', 'Alive')
            ];
            const result = rollDropTable(entities, 1, '42');
            expect(result.cardChoices).toHaveLength(1);
        });

        it('grants no XP in the reward bundle (XP comes from the in-battle death-XP system)', () => {
            const e1 = makeDeadEntity('e1', 'fyrbot', 'Lv10');
            e1.level = 10;
            const result = rollDropTable([e1], 1, 'seed');
            expect(result.totalXP).toBe(0);

            const e2 = makeDeadEntity('e2', 'fyrbot', 'Lv5');
            e2.level = 5;
            const result2 = rollDropTable([e1, e2], 1, 'seed');
            expect(result2.totalXP).toBe(0);
        });
    });

    describe('rollDropTable - Pooling & Rarity', () => {
        it('only drops cards matching the enemy element or None', () => {
            const defeated = [makeDeadEntity('e1', 'fyrbot', 'Fire Mon', 'Fire')];
            const result = rollDropTable(defeated, 1, 'some-seed');

            for (const choice of result.cardChoices) {
                for (const option of choice.options) {
                    const data = ProgramRegistry[option.dataId];
                    expect(['Fire', 'None']).toContain(data.element);
                }
            }
        });

        it('never offers token cards (isToken or rarity Token) for any element', () => {
            for (const element of ELEMENTS) {
                for (let i = 0; i < 25; i++) {
                    const defeated = [makeDeadEntity('e1', 'fyrbot', `${element} Mon`, element)];
                    const result = rollDropTable(defeated, 1, `token-seed-${element}-${i}`);

                    for (const choice of result.cardChoices) {
                        for (const option of choice.options) {
                            const data = ProgramRegistry[option.dataId];
                            expect(data, `unknown card ${option.dataId}`).toBeDefined();
                            expect(data.isToken ?? false, `${option.dataId} is a token (element ${element})`).toBe(false);
                            expect(data.rarity as string, `${option.dataId} has Token rarity (element ${element})`).not.toBe('Token');
                        }
                    }
                }
            }
        });

        it('respects rarity weights (statistically)', () => {
            const defeated = [makeDeadEntity('e1', 'fyrbot', 'Fire Mon', 'Fire')];
            const counts: Record<string, number> = { Common: 0, Uncommon: 0, Rare: 0, Epic: 0 };
            const iterations = 100;

            for (let i = 0; i < iterations; i++) {
                const result = rollDropTable(defeated, 1, `seed-${i}`);
                for (const choice of result.cardChoices) {
                    for (const option of choice.options) {
                        const rarity = ProgramRegistry[option.dataId].rarity;
                        counts[rarity]++;
                    }
                }
            }

            // In 300 card options (100 * 3), Common should be the vast majority (~70%)
            expect(counts.Common).toBeGreaterThan(counts.Uncommon);
            expect(counts.Common).toBeGreaterThan(150); // > 50% just to be safe with variance
            // Rare/Epic should be low
            expect(counts.Rare + counts.Epic).toBeLessThan(counts.Common);
        });
    });

    describe('rollDropTable - Blueprint Scaling', () => {
        it('drops blueprints more often with small roster', () => {
            const defeated = [makeDeadEntity('e1', 'fyrbot', 'Fyrbot')];
            let bpCountSmall = 0;
            let bpCountLarge = 0;
            const iterations = 200;

            // Roster size 1 (25% rate)
            for (let i = 0; i < iterations; i++) {
                const res = rollDropTable(defeated, 1, `roster-1-${i}`);
                if (res.blueprints.length > 0) bpCountSmall++;
            }

            // Roster size 5 (5% rate)
            for (let i = 0; i < iterations; i++) {
                const res = rollDropTable(defeated, 5, `roster-5-${i}`);
                if (res.blueprints.length > 0) bpCountLarge++;
            }

            // Statistically, small roster should have significantly more blueprints
            expect(bpCountSmall).toBeGreaterThan(bpCountLarge);
            // Expect roughly 50 (200 * 0.25) vs 10 (200 * 0.05)
            expect(bpCountSmall).toBeGreaterThan(25);
            expect(bpCountLarge).toBeLessThan(40);
        });
    });

    describe('rollDraftRounds (gym-clear mini-draft)', () => {
        it('returns 3 rounds of 3 options by default', () => {
            const rounds = rollDraftRounds('gym-seed', 'Fire');
            expect(rounds).toHaveLength(3);
            for (const round of rounds) {
                expect(round.options).toHaveLength(3);
            }
        });

        it('respects a custom round count', () => {
            expect(rollDraftRounds('gym-seed', 'Water', 5)).toHaveLength(5);
            expect(rollDraftRounds('gym-seed', 'Water', 1)).toHaveLength(1);
        });

        it('offers distinct cards within each round', () => {
            for (let i = 0; i < 50; i++) {
                const rounds = rollDraftRounds(`distinct-${i}`, 'Fire');
                for (const round of rounds) {
                    const ids = round.options.map(o => o.dataId);
                    expect(new Set(ids).size).toBe(ids.length);
                }
            }
        });

        it('is deterministic for the same seed (dataIds match across calls)', () => {
            const a = rollDraftRounds('same-seed-42', 'Nature');
            const b = rollDraftRounds('same-seed-42', 'Nature');
            expect(a.map(r => r.options.map(o => o.dataId)))
                .toEqual(b.map(r => r.options.map(o => o.dataId)));
        });

        it('never offers tokens and only offers gym-element or neutral cards', () => {
            for (const element of ELEMENTS) {
                for (let i = 0; i < 10; i++) {
                    const rounds = rollDraftRounds(`draft-${element}-${i}`, element);
                    for (const round of rounds) {
                        for (const option of round.options) {
                            const data = ProgramRegistry[option.dataId];
                            expect(data, `unknown card ${option.dataId}`).toBeDefined();
                            expect(data.isToken ?? false, `${option.dataId} is a token`).toBe(false);
                            expect(data.rarity as string, `${option.dataId} has Token rarity`).not.toBe('Token');
                            expect([element, 'None']).toContain(data.element);
                        }
                    }
                }
            }
        });

        it('weights choices toward the gym element (statistically)', () => {
            let elementMatches = 0;
            let total = 0;
            for (let i = 0; i < 100; i++) {
                const rounds = rollDraftRounds(`weight-seed-${i}`, 'Fire');
                for (const round of rounds) {
                    for (const option of round.options) {
                        total++;
                        if (ProgramRegistry[option.dataId].element === 'Fire') elementMatches++;
                    }
                }
            }
            // 70% of picks are drawn from the Fire-exclusive pool, and the mixed
            // pool contains Fire cards too — Fire should clearly dominate neutral.
            expect(total).toBe(900);
            expect(elementMatches).toBeGreaterThan(total * 0.55);
        });
    });

    describe('getScrapYield', () => {
        it('returns correct values for known rarities', () => {
            expect(getScrapYield('Common')).toBe(10);
            expect(getScrapYield('Uncommon')).toBe(25);
            expect(getScrapYield('Rare')).toBe(50);
            expect(getScrapYield('Epic')).toBe(100);
        });

        it('defaults to 10 for unknown rarity', () => {
            expect(getScrapYield('Legendary')).toBe(10);
            expect(getScrapYield()).toBe(10);
        });
    });
});
