import { describe, it, expect } from 'vitest';
import battleReducer, { startBattle } from './battleSlice';
import type { IPlayerSave } from '../../engine/gameTypes';
import type { IMingmingState } from '../../engine/types';

const MEMBER: IMingmingState = {
    id: 'mm_slice_1',
    definitionId: 'fenrir',
    nickname: 'Iggy',
    level: 5,
    experience: 100,
    blueprintsCollected: 0,
    attackIV: 12,
    defenseIV: 13,
    hpIV: 14
};

const SAVE: IPlayerSave = {
    version: 2,
    roster: [MEMBER],
    activeParty: [MEMBER.id],
    cardInventory: [],
    activeDeck: null,
    scrapCount: 0,
    blueprints: [],
    relics: [],
    gauntlet: null,
    unlockedSectors: ['Fire'],
    baseDecksGranted: []
};

const initial = battleReducer(undefined, { type: '@@INIT' } as any);

describe('battleSlice.startBattle forwards BattleOptions', () => {
    it('defaults to MOVES when no options are given', () => {
        const state = battleReducer(initial, startBattle({ save: SAVE, enemyIds: [], sectorElement: 'Fire' }));
        expect(state.battle!.enemyMode).toBe('MOVES');
    });

    it('enemyMode CARDS survives the dispatch (was dropped before ticket 09)', () => {
        const state = battleReducer(initial, startBattle({
            save: SAVE,
            enemyIds: [],
            sectorElement: 'Fire',
            options: { enemyMode: 'CARDS' }
        }));
        expect(state.battle!.enemyMode).toBe('CARDS');
        expect(state.battle!.enemyDeck.hand.length).toBeGreaterThan(0);
    });

    it('a seed passed through the slice reproduces the same battle', () => {
        const run = () => battleReducer(initial, startBattle({
            save: SAVE,
            enemyIds: [],
            sectorElement: 'Fire',
            options: { seed: 'slice-seed' }
        })).battle;

        expect(run()).toEqual(run());
    });
});
