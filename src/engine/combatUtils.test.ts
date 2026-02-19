
import { describe, it, expect, vi } from 'vitest';
import { calculateDamage, calculateModifier, calculateHeal, ElementalMatrix } from './combatUtils';
import type { IBattleEntity, ProgramData, Element } from './types';
import { GetProgramData } from './data/programRegistry';
import { TestProgramRegistry } from './data/testProgramRegistry';

vi.mock('./data/programRegistry', async (importOriginal) => {
    const original = await importOriginal<typeof import('./data/programRegistry')>();
    return {
        ...original,
        GetProgramData: vi.fn((id: string) => TestProgramRegistry[id] || original.GetProgramData(id))
    };
});

// Mock Factory Helper
function createMockEntity(id: string, primary: Element, secondary?: Element, level = 50, attack = 100, defense = 100): IBattleEntity {
    return {
        id,
        nickname: id,
        definitionId: 'def_' + id,
        name: id,
        level,
        experience: 0,
        blueprintsCollected: 0,
        hpIV: 0,
        attackIV: 0,
        defenseIV: 0,
        primaryElement: primary,
        secondaryElement: secondary,
        baseStats: { hp: 100, attack, defense, energy: 10, cardDraw: 1 }, // Dummy
        statusEffects: [],
        currentHp: 100,
        currentEnergy: 10,
        tempHp: 0,
        maxHp: 100,
        maxEnergy: 10,
        attack,
        defense,
        speed: 10,
        cardDraw: 1,
        daemons: []
    } as IBattleEntity;
}

function createMockProgram(element: Element): ProgramData {
    return {
        id: 'prog_test',
        name: 'Test Program',
        description: 'Testing',
        element,
        target: 'Single',
        category: 'Attack',
        baseCost: 1,
        constraints: [],
        actions: [],
        artReference: '',
        rarity: 'Common'
    };
}

describe('Combat Utils - Elemental Logic', () => {
    it('should return 1.0 for neutral match-up', () => {
        const attacker = createMockEntity('att', 'None');
        const target = createMockEntity('def', 'Fire');
        const program = createMockProgram('Fire');

        expect(calculateModifier(attacker, target, program)).toBe(1.0);
    });

    it('should apply STAB (1.5x)', () => {
        const attacker = createMockEntity('att', 'Fire');
        const target = createMockEntity('def', 'None');
        const program = createMockProgram('Fire');

        expect(calculateModifier(attacker, target, program)).toBe(1.5);
    });

    it('should apply Super Effective (2.0x)', () => {
        const attacker = createMockEntity('att', 'None');
        const target = createMockEntity('def', 'Fire');
        const program = createMockProgram('Water');

        expect(calculateModifier(attacker, target, program)).toBe(2.0);
    });

    it('should apply Ineffective (0.5x)', () => {
        const attacker = createMockEntity('att', 'None');
        const target = createMockEntity('def', 'Water');
        const program = createMockProgram('Fire');

        expect(calculateModifier(attacker, target, program)).toBe(0.5);
    });

    it('should apply Secondary Resistance mitigation (0.375x)', () => {
        // Fire vs Light = 1.0
        // Fire vs Water = 0.5
        // Total = 1.0 * (0.5 * 0.75) = 0.375
        const attacker = createMockEntity('att', 'None');
        const target = createMockEntity('def', 'Light', 'Water');
        const program = createMockProgram('Fire');

        expect(calculateModifier(attacker, target, program)).toBe(0.375);
    });
});

describe('Combat Utils - Damage Formula', () => {
    it('should match manual calculation for Level 50 standard case (No STAB)', () => {
        const attacker = createMockEntity('att', 'Water', undefined, 50, 100, 100); // Water != None
        const target = createMockEntity('def', 'None', undefined, 50, 100, 100);
        const program = createMockProgram('None'); // Neutral element
        const state = { activeSide: 'PLAYER' } as any; // Mock state

        const damage = calculateDamage(attacker, target, program, 40, state);
        expect(damage).toBe(19);
    });

    it('should match manual calculation for Level 100 (No STAB)', () => {
        const attacker = createMockEntity('att', 'Water', undefined, 100, 100, 100);
        const target = createMockEntity('def', 'None', undefined, 100, 100, 100);
        const program = createMockProgram('None');
        const state = { activeSide: 'PLAYER' } as any;

        const damage = calculateDamage(attacker, target, program, 40, state);
        expect(damage).toBe(35);
    });

    it('should match STAB calculation', () => {
        const attacker = createMockEntity('att', 'Fire', undefined, 50, 100, 100);
        const target = createMockEntity('def', 'None', undefined, 50, 100, 100); // Neutral target
        const program = createMockProgram('Fire');
        const state = { activeSide: 'PLAYER' } as any;

        const damage = calculateDamage(attacker, target, program, 40, state);
        expect(damage).toBe(29);
    });
});

describe('Combat Utils - Heal Formula', () => {
    it('should calculate clamped heal', () => {
        const attacker = createMockEntity('att', 'Water', undefined, 50, 10, 10);
        // Level 50 -> levelBase 22.
        // Atk 10. Power 5.
        // Raw = ((22 * 5 * 10) / 50) + 2 = 24.

        const target = createMockEntity('def', 'Water', undefined, 50, 10, 10);
        const damagedTarget = { ...target, currentHp: 50 }; // 50 missing.

        const heal = calculateHeal(attacker, damagedTarget, 5);
        expect(heal).toBe(24);
    });

    it('should calculate raw heal correctly when not capped', () => {
        const attacker = createMockEntity('att', 'Water', undefined, 10, 5, 5);
        // Level 10 -> levelBase 6.
        // Atk 5. Power 5.
        // Raw = ((6 * 5 * 5) / 50) + 2 = 5.

        const target = createMockEntity('def', 'Water', undefined, 50, 100, 100);
        const injuredTarget = { ...target, maxHp: 200, currentHp: 100 }; // 100 missing.

        const heal = calculateHeal(attacker, injuredTarget, 5);
        expect(heal).toBe(5);
    });
});
