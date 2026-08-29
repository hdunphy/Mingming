import { describe, it, expect } from 'vitest';
import battleReducer, { startBattle } from './battleSlice';
import type { IBattleSetup } from '../../engine/data/battleFactories';
import type { IMingmingState } from '../../engine/types';

const MEMBER: IMingmingState = {
    id: 'mm_slice_1',
    definitionId: 'fenrir',
    nickname: 'Iggy',
    blueprintsCollected: 0,
    attackIV: 12,
    defenseIV: 13,
    hpIV: 14
};

/**
 * Ticket 11: the payload carries an `IBattleSetup`. The party is already resolved — the slice never
 * sees a roster or a set of party ids, which is the point: joining the run's party ids against the
 * ranch's roster is `engine/run/battleSetup.ts`'s job, not a reducer's.
 */
const SETUP: IBattleSetup = {
    party: [MEMBER],
    deck: [],
    drivers: [],
    // Ticket 18 removed `IBattleSetup.gauntlet`: a gym's enemies are rolled by
    // `engine/run/gauntlet.ts` and arrive through `encounter`, so the only thing a gauntlet still
    // hands the factory is `persistedHp`.
    persistedHp: {}
};

const initial = battleReducer(undefined, { type: '@@INIT' });

describe('battleSlice.startBattle forwards BattleOptions', () => {
    it('defaults to MOVES when no options are given', () => {
        const state = battleReducer(initial, startBattle({ setup: SETUP, enemyIds: [], sectorElement: 'Fire' }));
        expect(state.battle!.enemyMode).toBe('MOVES');
    });

    it('enemyMode CARDS survives the dispatch (was dropped before ticket 09)', () => {
        const state = battleReducer(initial, startBattle({
            setup: SETUP,
            enemyIds: [],
            sectorElement: 'Fire',
            options: { enemyMode: 'CARDS' }
        }));
        expect(state.battle!.enemyMode).toBe('CARDS');
        expect(state.battle!.enemyDeck.hand.length).toBeGreaterThan(0);
    });

    it('a seed passed through the slice reproduces the same battle', () => {
        const run = () => battleReducer(initial, startBattle({
            setup: SETUP,
            enemyIds: [],
            sectorElement: 'Fire',
            options: { seed: 'slice-seed' }
        })).battle;

        expect(run()).toEqual(run());
    });
});
