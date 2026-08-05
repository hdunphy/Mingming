
import { describe, it, expect, vi } from 'vitest';
import { calculateDamage, calculateModifier, calculateHeal, getModifierBreakdown, ElementalMatrix } from './combatUtils';
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

describe('Combat Utils - Modifier Breakdown (UI surfacing)', () => {
    it('decomposes STAB and effectiveness, and modifier matches calculateModifier', () => {
        const attacker = createMockEntity('att', 'Fire');
        const target = createMockEntity('def', 'Nature');
        const program = createMockProgram('Fire');

        const b = getModifierBreakdown(attacker, target, program);
        expect(b.stab).toBe(true);
        expect(b.effectiveness).toBe(2.0); // Fire vs Nature
        expect(b.modifier).toBe(3.0); // 1.5 × 2
        expect(b.modifier).toBe(calculateModifier(attacker, target, program));
    });

    it('reports neutral (1.0) effectiveness and no STAB on a plain matchup', () => {
        const attacker = createMockEntity('att', 'Water');
        const target = createMockEntity('def', 'Light');
        const program = createMockProgram('Earth'); // Earth has no Light entry

        const b = getModifierBreakdown(attacker, target, program);
        expect(b.stab).toBe(false);
        expect(b.effectiveness).toBe(1.0);
        expect(b.modifier).toBe(1.0);
    });

    it('folds secondary mitigation into effectiveness (0.375x)', () => {
        const attacker = createMockEntity('att', 'None');
        const target = createMockEntity('def', 'Light', 'Water');
        const program = createMockProgram('Fire');

        const b = getModifierBreakdown(attacker, target, program);
        expect(b.stab).toBe(false);
        expect(b.effectiveness).toBe(0.375);
        expect(b.modifier).toBe(calculateModifier(attacker, target, program));
    });
});

describe('Combat Utils - Damage Formula', () => {
    it('should match manual calculation for Level 50 standard case (No STAB)', () => {
        const attacker = createMockEntity('att', 'Water', undefined, 50, 100, 100); // Water != None
        const target = createMockEntity('def', 'None', undefined, 50, 100, 100);
        const program = createMockProgram('None'); // Neutral element
        const state = { activeSide: 'PLAYER' } as any; // Mock state

        const damage = calculateDamage(attacker, target, program, 40, state);
        // levelBase = floor(2*50/5)+2 = 22; scaled = floor(22*40*100/100) = 880;
        // reduced = 880/35 = 25.14 (docs/power_curve_spec.md rev 3: no +2, /35 not /50);
        // modifier 1.0 (program element 'None' never grants STAB) -> floor(25.14) = 25.
        expect(damage).toBe(25);
    });

    it('should match manual calculation for Level 100 (No STAB)', () => {
        const attacker = createMockEntity('att', 'Water', undefined, 100, 100, 100);
        const target = createMockEntity('def', 'None', undefined, 100, 100, 100);
        const program = createMockProgram('None');
        const state = { activeSide: 'PLAYER' } as any;

        const damage = calculateDamage(attacker, target, program, 40, state);
        // levelBase = floor(2*100/5)+2 = 42; scaled = floor(42*40*100/100) = 1680;
        // reduced = 1680/35 = 48.0; modifier 1.0 -> floor(48.0) = 48.
        expect(damage).toBe(48);
    });

    it('should match STAB calculation', () => {
        const attacker = createMockEntity('att', 'Fire', undefined, 50, 100, 100);
        const target = createMockEntity('def', 'None', undefined, 50, 100, 100); // Neutral target
        const program = createMockProgram('Fire');
        const state = { activeSide: 'PLAYER' } as any;

        const damage = calculateDamage(attacker, target, program, 40, state);
        // Same base as the Level 50 case (25.14 reduced) but modifier is 1.5 for STAB:
        // floor(25.14 * 1.5) = floor(37.71) = 37.
        expect(damage).toBe(37);
    });
});

describe('Combat Utils - Heal Formula', () => {
    it('should calculate clamped heal', () => {
        const attacker = createMockEntity('att', 'Water', undefined, 50, 10, 10);

        const target = createMockEntity('def', 'Water', undefined, 50, 10, 10); // maxHp 100
        const damagedTarget = { ...target, currentHp: 50 }; // 50 missing.

        // docs/power_curve_spec.md rev 3: calculateHeal no longer scales off the healer's
        // level/attack - it's a flat % of the RECEIVING entity's maxHp. Raw = maxHp * power
        // / 400 = 100 * 5 / 400 = 1.25, floor = 1. (calculateHeal itself still doesn't clamp
        // to missing HP - that's applied by the caller - so this doesn't exercise the clamp;
        // see the "not capped" case below for the same reason.)
        const heal = calculateHeal(attacker, damagedTarget, 5);
        expect(heal).toBe(1);
    });

    it('should calculate raw heal correctly when not capped', () => {
        const attacker = createMockEntity('att', 'Water', undefined, 10, 5, 5);

        const target = createMockEntity('def', 'Water', undefined, 50, 100, 100);
        const injuredTarget = { ...target, maxHp: 200, currentHp: 100 }; // 100 missing.

        // Raw = maxHp * power / 400 = 200 * 5 / 400 = 2.5, floor = 2.
        const heal = calculateHeal(attacker, injuredTarget, 5);
        expect(heal).toBe(2);
    });
});

describe('STAB excludes None element (port-artifact fix)', () => {
    it("None-element cards never get STAB even though species carry secondaryElement 'None'", async () => {
        const { getModifierBreakdown } = await import('./combatUtils');
        const attacker = { primaryElement: 'Fire', secondaryElement: 'None', level: 10 } as any;
        const target = { primaryElement: 'Water', secondaryElement: undefined } as any;
        const noneCard = { element: 'None' } as any;
        const breakdown = getModifierBreakdown(attacker, target, noneCard);
        expect(breakdown.stab).toBe(false);
        expect(breakdown.modifier).toBe(1);
    });
});
