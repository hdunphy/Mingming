import { describe, it, expect, vi } from 'vitest';
import { battleReducer, type BattleAction } from './battleReducer';
import type { IBattleState, IBattleEntity } from './types';
import { globalBattleEventBus } from './events';
import { applyMutations } from './resolutionEngine';

describe('Battle Freeze Repro', () => {
    it('should award XP and level up correctly when an ally is dead', () => {
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
                    id: 'fenrir-player',
                    name: 'Fenrir',
                    currentHp: 82,
                    maxHp: 82,
                    currentEnergy: 2,
                    maxEnergy: 2,
                    statusEffects: [],
                    level: 19,
                    experience: 6300, // Level 20 needs 6400; new pacing awards ~228 for this KO
                    definitionId: 'fenrir',
                    hpIV: 0, attackIV: 0, defenseIV: 0, blueprintsCollected: 0,
                    primaryElement: 'Fire',
                    attack: 10,
                    defense: 10,
                    speed: 10,
                    cardDraw: 3,
                    tempHp: 0,
                    daemons: []
                } as IBattleEntity,
                {
                    id: 'huldra-dead',
                    name: 'Huldra',
                    currentHp: 0,
                    maxHp: 80,
                    currentEnergy: 2,
                    maxEnergy: 2,
                    statusEffects: [],
                    level: 19,
                    experience: 6300,
                    definitionId: 'huldra',
                    hpIV: 0, attackIV: 0, defenseIV: 0, blueprintsCollected: 0,
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
                    id: 'fenrir-enemy',
                    name: 'Fenrir Enemy',
                    currentHp: 20,
                    maxHp: 80,
                    currentEnergy: 2,
                    maxEnergy: 2,
                    statusEffects: [],
                    level: 19,
                    experience: 0,
                    definitionId: 'fenrir',
                    hpIV: 0, attackIV: 0, defenseIV: 0, blueprintsCollected: 0,
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
            levelUpQueue: [],
            activeRelics: []
        };

        // Spy on event bus
        const levelUpSpy = vi.fn();
        const unsubscribe = globalBattleEventBus.subscribe((e) => {
            if (e.type === 'LEVEL_UP') levelUpSpy(e);
        });

        console.log('--- STARTING REPRO ---');
        const newState = applyMutations(initialState, [{
            type: 'HP',
            targetId: 'fenrir-enemy',
            sourceId: 'fenrir-player',
            payload: {
                amount: 30, // Kills the enemy
                isHeal: false,
                element: 'Fire'
            }
        }]);
        console.log('--- REPRO FINISHED ---');

        unsubscribe();

        console.log('Logs:', newState.logs);
        console.log('Level Up Queue:', newState.levelUpQueue.length);

        expect(newState.enemyParty[0].currentHp).toBe(0);
        expect(newState.logs.some(l => l.includes('DEFEATED'))).toBe(true);
        expect(newState.logs.some(l => l.includes('XP split'))).toBe(true);

        const fenrir = newState.playerParty.find(p => p.id === 'fenrir-player');
        expect(fenrir?.level).toBe(20);
        expect(newState.levelUpQueue.length).toBe(1);
        expect(levelUpSpy).toHaveBeenCalled();
    });
});
