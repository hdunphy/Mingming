import { describe, it, expect, beforeEach } from 'vitest';
import { calculateDamage } from './combatUtils';
import type { IBattleEntity, IBattleState } from './types';
import { StatusType } from './types';

describe('Damage Calculation with Status Modifiers', () => {
    let attacker: IBattleEntity;
    let defender: IBattleEntity;
    let mockState: IBattleState;

    beforeEach(() => {
        attacker = {
            id: 'attacker',
            name: 'Attacker',
            level: 5,
            maxHp: 100,
            currentHp: 100,
            attack: 50,
            defense: 50,
            maxEnergy: 5,
            currentEnergy: 5,
            primaryElement: 'None',
            secondaryElement: 'None',
            statusEffects: [],
            hooks: [],
            speed: 10,
            cardDraw: 3,
            tempHp: 0,
            daemons: [],
            definitionId: 'none',
            experience: 0,
            blueprintsCollected: 0,
            attackIV: 0,
            defenseIV: 0,
            hpIV: 0
        };

        defender = {
            id: 'defender',
            name: 'Defender',
            level: 5,
            maxHp: 100,
            currentHp: 100,
            attack: 50,
            defense: 50,
            maxEnergy: 5,
            currentEnergy: 5,
            primaryElement: 'None',
            secondaryElement: 'None',
            statusEffects: [],
            hooks: [],
            speed: 10,
            cardDraw: 3,
            tempHp: 0,
            daemons: [],
            definitionId: 'none',
            experience: 0,
            blueprintsCollected: 0,
            attackIV: 0,
            defenseIV: 0,
            hpIV: 0
        };

        mockState = {
            sessionId: 'test',
            turn: 1,
            activeSide: 'PLAYER',
            activeRelics: [],
            phase: 'ACTION',
            playerParty: [attacker],
            enemyParty: [defender],
            playerDeck: { ownerId: 'p', deck: [], hand: [], drawpile: [], discard: [], exhaust: [] },
            enemyDeck: { ownerId: 'e', deck: [], hand: [], drawpile: [], discard: [], exhaust: [] },
            logs: [],
            osLogs: [],
            procs: [],
            seed: 'test-seed',
            cardsPlayedThisTurn: 0,
            levelUpQueue: [],
            cardsDrawnThisTurn: 0,
            lastProgramPlayed: null
        };
    });

    const mockProgram = {
        id: 'test_punch',
        name: 'Test Punch',
        description: '',
        element: 'None',
        target: 'Single',
        category: 'Attack',
        rarity: 'Common',
        baseCost: 1,
        constraints: [],
        actions: []
    };

    it('should calculate base damage correctly', () => {
        const damage = calculateDamage(attacker, defender, mockProgram as any, 20, mockState);
        // Level 5 -> levelBase = 4
        // scaled = 4 * 20 * 50 / 50 = 80
        // reduced = (80 / 50) + 2 = 1.6 + 2 = 3.6
        // modifier = 1.5 (STAB)
        // damage = floor(3.6 * 1.5) = floor(5.4) = 5
        expect(damage).toBe(5);
    });

    it('should increase damage with Strengthened status', () => {
        (attacker as any).statusEffects = [{ id: 's1', type: StatusType.Strengthened, stacks: 1 }];
        const damage = calculateDamage(attacker, defender, mockProgram as any, 20, mockState);
        // Base 5 * 1.2 = 6
        expect(damage).toBe(6);
    });

    it('should decrease damage with Weakened status', () => {
        (attacker as any).statusEffects = [{ id: 'w1', type: StatusType.Weakened, stacks: 1 }];
        const damage = calculateDamage(attacker, defender, mockProgram as any, 20, mockState);
        // Base 5 * 0.8 = 4
        expect(damage).toBe(4);
    });

    it('should reduce damage to a Sharp target', () => {
        (defender as any).statusEffects = [{ id: 'sh1', type: StatusType.Sharp, stacks: 1 }];
        const damage = calculateDamage(attacker, defender, mockProgram as any, 20, mockState);
        // Base 5 * 0.8 = 4
        expect(damage).toBe(4);
    });

    it('should deal more damage to a Dazed target', () => {
        (defender as any).statusEffects = [{ id: 'd1', type: StatusType.Dazed, stacks: 1 }];
        const damage = calculateDamage(attacker, defender, mockProgram as any, 20, mockState);
        // Base 5 * 1.2 = 6
        expect(damage).toBe(6);
    });
});
