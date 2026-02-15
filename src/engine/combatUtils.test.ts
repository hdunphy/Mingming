
import { describe, it, expect } from 'vitest';
import { calculateDamage, calculateModifier, calculateHeal, ElementalMatrix } from './combatUtils';
import type { IBattleEntity, ProgramData, Element } from './types';

// Mock Factory Helper
function createMockEntity(id: string, primary: Element, secondary?: Element, level = 50, attack = 100, defense = 100): IBattleEntity {
    return {
        id,
        definitionId: 'def_' + id,
        name: id,
        level,
        experience: 0,
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
    } as IBattleEntity; // Cast to satisfy readonly requirements if needed, or just match interface
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
        artReference: ''
    };
}

describe('Combat Utils - Elemental Logic', () => {
    it('should return 1.0 for neutral match-up', () => {
        // Matchup: Attacker=Energy(None), Card=Fire, Def=Fire.
        // STAB? No. Matrix? 1.0. Result 1.0.
        expect(calculateModifier('None', 'Fire', undefined, 'Fire')).toBe(1.0);
    });

    it('should apply STAB (1.5x)', () => {
        // Attacker=Fire, Card=Fire, Def=None (Neutral)
        expect(calculateModifier('Fire', 'None', undefined, 'Fire')).toBe(1.5);
    });

    it('should apply Super Effective (2.0x)', () => {
        // Water vs Fire -> 2.0
        // Attacker=None (No STAB), Card=Water, Def=Fire
        expect(calculateModifier('None', 'Fire', undefined, 'Water')).toBe(2.0);
    });

    it('should apply Ineffective (0.5x)', () => {
        // Fire vs Water -> 0.5
        expect(calculateModifier('None', 'Water', undefined, 'Fire')).toBe(0.5);
    });

    it('should combine STAB and Super Effective (3.0x)', () => {
        // Attacker=Water, Card=Water vs Def=Fire
        // STAB (1.5) * Super Effective (2.0) = 3.0
        expect(calculateModifier('Water', 'Fire', undefined, 'Water')).toBe(3.0);
    });

    it('should apply Secondary Resistance mitigation (0.75x)', () => {
        // Card=Fire vs Def=Light/Water
        // Fire vs Light = 1.0 (Neutral)
        // Fire vs Water = 0.5 (Ineffective) -> This triggers the secondary mitigation logic?
        // Rules.cs line 146: modifier *= hasSecondaryAdvantage ? secondaryValue * SECONDARY_TYPE_ADVANTAGE : 1;
        // secondaryValue here is 0.5. SECONDARY_TYPE_ADVANTAGE is 0.75.
        // So modifier *= 0.5 * 0.75 = 0.375

        expect(calculateModifier('None', 'Light', 'Water', 'Fire')).toBe(0.375);
    });
});

describe('Combat Utils - Damage Formula', () => {
    it('should match manual calculation for Level 50 standard case (No STAB)', () => {
        const attacker = createMockEntity('att', 'Water', undefined, 50, 100, 100); // Water != None
        const target = createMockEntity('def', 'None', undefined, 50, 100, 100);
        const program = createMockProgram('None'); // Neutral element

        const damage = calculateDamage(attacker, target, program, 40);
        expect(damage).toBe(19);
    });

    it('should match manual calculation for Level 100 (No STAB)', () => {
        const attacker = createMockEntity('att', 'Water', undefined, 100, 100, 100);
        const target = createMockEntity('def', 'None', undefined, 100, 100, 100);
        const program = createMockProgram('None');

        const damage = calculateDamage(attacker, target, program, 40);
        expect(damage).toBe(35);
    });

    it('should match STAB calculation', () => {
        const attacker = createMockEntity('att', 'Fire', undefined, 50, 100, 100);
        const target = createMockEntity('def', 'None', undefined, 50, 100, 100); // Neutral target
        const program = createMockProgram('Fire');

        const damage = calculateDamage(attacker, target, program, 40);
        expect(damage).toBe(29);
    });
});

describe('Combat Utils - Heal Formula', () => {
    it('should calculate clamped heal', () => {
        const attacker = createMockEntity('att', 'Water', undefined, 50, 10, 10);
        // Level 50 -> LevelMod 22.
        // Attack 10. Power 5.
        // Raw = 22 * 5 * 10 / 2 = 550.

        const target = createMockEntity('def', 'Water', undefined, 50, 10, 10);
        const damagedTarget = { ...target, currentHp: 50 }; // 50 missing.

        const heal = calculateHeal(attacker, damagedTarget, 5);
        expect(heal).toBe(50);
    });

    it('should calculate raw heal correctly when not capped', () => {
        const attacker = createMockEntity('att', 'Water', undefined, 10, 5, 5);
        // Level 10 -> LevelMod = ((20)/5)+2 = 6.
        // Attack 5. Power 5.
        // Raw = 6 * 5 * 5 / 2 = 75.

        const target = createMockEntity('def', 'Water', undefined, 50, 100, 100);
        const injuredTarget = { ...target, maxHp: 200, currentHp: 100 }; // 100 missing.

        const heal = calculateHeal(attacker, injuredTarget, 5);
        expect(heal).toBe(75);
    });
});
