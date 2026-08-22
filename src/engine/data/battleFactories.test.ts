import { describe, it, expect } from 'vitest';
import { createBattleState } from './battleFactories';
import type { IBattleSetup } from './battleFactories';
import { GetMingmingData } from './mingmingRegistry';
import { createMingmingInstance } from '../gameTypes';
import type { Element } from '../types';

/**
 * Ticket 11: `createBattleState` takes an `IBattleSetup`, not a save. The gauntlet's element is the
 * gym's — `IGauntletProgress` carries no element of its own — and `buildBattleSetup` is what reads
 * it out of `GYM_REGISTRY`. This fixture states it directly, which is what the parameter is for.
 */
const makeGymSetup = (element: Element, fightIndex: number = 2): IBattleSetup => ({
    party: [createMingmingInstance('fenrir')],
    deck: [],
    drivers: [],
    persistedHp: {},
    gauntlet: { element, fightIndex },
});

describe('createBattleState — tier-3 breach wardens match the sector element', () => {
    it('a Light gym gauntlet at battleIndex 2 spawns Light-species wardens', () => {
        const state = createBattleState(makeGymSetup('Light'), []);

        expect(state.enemyParty).toHaveLength(3);
        const [guard1, boss, guard2] = state.enemyParty;

        // Boss keeps its hand-crafted identity (name, HP boost, relic OS, moves)
        expect(boss.nickname).toBe('Light Sector Warden');
        expect(boss.activeOS?.startsWith('boss_relic_')).toBe(true);
        expect(boss.moves?.length).toBeGreaterThan(0);

        // ...but its SPECIES comes from the Light sector pool now.
        expect(['valkyrie', 'audhumbla']).toContain(boss.definitionId);
        expect(GetMingmingData(boss.definitionId).primaryElement).toBe('Light');

        for (const guard of [guard1, guard2]) {
            expect(guard.nickname).toBe('Firewall Sentinel');
            expect(GetMingmingData(guard.definitionId).primaryElement).toBe('Light');
        }
    });

    it('a Fire breach still yields Fire species wardens', () => {
        const state = createBattleState(makeGymSetup('Fire'), []);
        const boss = state.enemyParty[1];

        expect(boss.nickname).toBe('Fire Sector Warden');
        expect(GetMingmingData(boss.definitionId).primaryElement).toBe('Fire');
        for (const guard of [state.enemyParty[0], state.enemyParty[2]]) {
            expect(GetMingmingData(guard.definitionId).primaryElement).toBe('Fire');
        }
    });
});
