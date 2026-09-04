import { describe, it, expect } from 'vitest';
import { battleReducer, type BattleAction } from './battleReducer';
import type { IBattleState, IBattleEntity } from './types';

describe('Huldra OS V1 Bug Reproduction', () => {
    it('should trigger ALLURE_PROXY when Huldra applies a status to herself', () => {
        const initialState: IBattleState = {
            sessionId: 'test',
            seed: 'repro',
            turn: 1,
            phase: 'ACTION',
            activeSide: 'PLAYER',
            logs: [],
            osLogs: [],
            procs: [],
            cardsDrawnThisTurn: 0,
            lastProgramPlayed: null,
            counters: {},
            playerParty: [
                {
                    id: 'huldra-id',
                    name: 'Huldra',
                    currentHp: 80,
                    maxHp: 80,
                    currentEnergy: 2,
                    maxEnergy: 2,
                    activeOS: 'huldra_v1',
                    statusEffects: [],
                    hpIV: 0, attackIV: 0, defenseIV: 0, blueprintsCollected: 0, 
                    definitionId: 'huldra',
                    primaryElement: 'Nature',
                    attack: 10,
                    defense: 10,
                    speed: 10,
                    cardDraw: 3,
                    tempHp: 0,
                    daemons: []
                } as IBattleEntity
            ],
            enemyParty: [
                {
                    id: 'enemy-id',
                    name: 'Enemy',
                    currentHp: 100,
                    maxHp: 100,
                    currentEnergy: 2,
                    maxEnergy: 2,
                    statusEffects: [],
                    hpIV: 0, attackIV: 0, defenseIV: 0, blueprintsCollected: 0, 
                    definitionId: 'fenrir',
                    primaryElement: 'Fire',
                    attack: 10,
                    defense: 10,
                    speed: 10,
                    cardDraw: 3,
                    tempHp: 0,
                    daemons: []
                } as IBattleEntity
            ],
            playerDeck: { ownerId: 'PLAYER', deck: [], hand: [], drawpile: [], discard: [], exhaust: [] },
            enemyDeck: { ownerId: 'ENEMY', deck: [], hand: [], drawpile: [], discard: [], exhaust: [] },
            cardsPlayedThisTurn: 0,
            activeRelics: []
        };

        const action: BattleAction = {
            type: 'APPLY_STATUS',
            payload: {
                targetId: 'huldra-id',
                sourceId: 'huldra-id', // Huldra applies it to herself
                status: 'Sharp',
                stacks: 1
            }
        };

        const newState = battleReducer(initialState, action);

        console.log('Battle Logs:', newState.logs);
        const huldraAfter = newState.playerParty.find(e => e.id === 'huldra-id');
        console.log('Huldra Statuses:', huldraAfter?.statusEffects.map(s => s.type));

        // Check if Huldra got Sharp
        const huldra = newState.playerParty.find(e => e.id === 'huldra-id');
        expect(huldra?.statusEffects.some(s => s.type === 'Sharp')).toBe(true);

        // Check if Enemy got Weakened (triggered by Huldra's OS V1)
        const enemy = newState.enemyParty.find(e => e.id === 'enemy-id');
        const weakened = enemy?.statusEffects.find(s => s.type === 'Weakened');

        // This is expected to FAIL before the fix
        expect(weakened, 'Huldra OS V1 should have triggered on self-application').toBeDefined();
        expect(weakened?.stacks).toBe(1);
    });
});
