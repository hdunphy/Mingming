
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
function createMockEntity(id: string, primary: Element, secondary?: Element, attack = 100, defense = 100): IBattleEntity {
    return {
        id,
        nickname: id,
        definitionId: 'def_' + id,
        name: id,
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

    it('should apply Super Effective (1.5x)', () => {
        // Ticket 35: advantage softened 2.0 -> 1.5.
        const attacker = createMockEntity('att', 'None');
        const target = createMockEntity('def', 'Fire');
        const program = createMockProgram('Water');

        expect(calculateModifier(attacker, target, program)).toBe(1.5);
    });

    it('has NO resistance - a bad matchup is neutral, never halved (ticket 35)', () => {
        // The matrix is asymmetric now: Water resists nothing, it simply does not take the
        // 1.5x. The old 0.5x is gone, which is what removed the 4x two-sided swing.
        const attacker = createMockEntity('att', 'None');
        const target = createMockEntity('def', 'Water');
        const program = createMockProgram('Fire');

        expect(calculateModifier(attacker, target, program)).toBe(1.0);
    });

    it('applies secondary mitigation to an ADVANTAGE (1.125x), ticket 35', () => {
        // Ticket 35: resisted pairs are absent from the matrix, so a resisted secondary is
        // `undefined` and the mitigation branch is skipped entirely - which is exactly why
        // they must not be written as 1.0 (that would become 1.0 * 0.75 = a 25% penalty on a
        // matchup meant to be neutral). Mitigation now only ever scales a real advantage.
        // Nature vs Light = no entry; Nature vs Water = 1.5
        // Total = 1.0 * (1.5 * 0.75) = 1.125
        const attacker = createMockEntity('att', 'None');
        const target = createMockEntity('def', 'Light', 'Water');
        const program = createMockProgram('Nature');

        expect(calculateModifier(attacker, target, program)).toBeCloseTo(1.125, 5);
    });
});

describe('Combat Utils - Modifier Breakdown (UI surfacing)', () => {
    it('decomposes STAB and effectiveness, and modifier matches calculateModifier', () => {
        const attacker = createMockEntity('att', 'Fire');
        const target = createMockEntity('def', 'Nature');
        const program = createMockProgram('Fire');

        const b = getModifierBreakdown(attacker, target, program);
        expect(b.stab).toBe(true);
        expect(b.effectiveness).toBe(1.5); // Fire vs Nature (ticket 35: 2.0 -> 1.5)
        expect(b.modifier).toBe(2.25); // 1.5 STAB × 1.5 advantage
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

    it('folds secondary mitigation into effectiveness (1.125x), ticket 35', () => {
        // Only an ADVANTAGE can reach the mitigation branch now - resisted pairs are absent
        // from the matrix, so they read `undefined` and are skipped.
        const attacker = createMockEntity('att', 'None');
        const target = createMockEntity('def', 'Light', 'Water');
        const program = createMockProgram('Nature');

        const b = getModifierBreakdown(attacker, target, program);
        expect(b.stab).toBe(false);
        expect(b.effectiveness).toBeCloseTo(1.125, 5);
        expect(b.modifier).toBe(calculateModifier(attacker, target, program));
    });
});

describe('Combat Utils - Damage Formula', () => {
    it('matches the manual calculation at the frozen calibration level (No STAB)', () => {
        const attacker = createMockEntity('att', 'Water', undefined, 100, 100); // Water != None
        const target = createMockEntity('def', 'None', undefined, 100, 100);
        const program = createMockProgram('None'); // Neutral element
        const state = { activeSide: 'PLAYER' } as any; // Mock state

        const damage = calculateDamage(attacker, target, program, 40, state);
        // Ticket 21 froze the level term: levelBase is CALIBRATION_LEVEL_DAMAGE_BASE = 8, not
        // floor(2*level/5)+2, so this no longer varies with a level nobody has.
        // scaled = floor(8*40*100/100) = 320; reduced = 320/45 = 7.11
        // (spec rev 3.1 / ticket 23: no +2, /45 not /35);
        // modifier 1.0 (program element 'None' never grants STAB) -> floor(7.11) = 7.
        expect(damage).toBe(7);
    });

    it('is level-independent — the same inputs give the same damage, always', () => {
        const attacker = createMockEntity('att', 'Water', undefined, 100, 100);
        const target = createMockEntity('def', 'None', undefined, 100, 100);
        const program = createMockProgram('None');
        const state = { activeSide: 'PLAYER' } as any;

        const damage = calculateDamage(attacker, target, program, 40, state);
        // This case used to pin level 100 and expect 37. There is no level to raise any more, so
        // it now asserts the thing that replaced it: identical inputs, identical output — the
        // property that makes the balance corpus permanent rather than a snapshot of one level.
        expect(damage).toBe(7);
    });

    it('should match STAB calculation', () => {
        const attacker = createMockEntity('att', 'Fire', undefined, 100, 100);
        const target = createMockEntity('def', 'None', undefined, 100, 100); // Neutral target
        const program = createMockProgram('Fire');
        const state = { activeSide: 'PLAYER' } as any;

        const damage = calculateDamage(attacker, target, program, 40, state);
        // Same base as the case above (7.11 reduced) but modifier is 1.5 for STAB:
        // floor(7.11 * 1.5) = floor(10.67) = 10.
        expect(damage).toBe(10);
    });
});

describe('Combat Utils - Heal Formula', () => {
    it('should calculate clamped heal', () => {
        const attacker = createMockEntity('att', 'Water', undefined, 10, 10);

        const target = createMockEntity('def', 'Water', undefined, 10, 10); // maxHp 100
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
        const attacker = createMockEntity('att', 'Water', undefined, 5, 5);

        const target = createMockEntity('def', 'Water', undefined, 100, 100);
        const injuredTarget = { ...target, maxHp: 200, currentHp: 100 }; // 100 missing.

        // Raw = maxHp * power / 400 = 200 * 5 / 400 = 2.5, floor = 2.
        const heal = calculateHeal(attacker, injuredTarget, 5);
        expect(heal).toBe(2);
    });
});

describe('STAB excludes None element (port-artifact fix)', () => {
    it("None-element cards never get STAB even though species carry secondaryElement 'None'", async () => {
        const { getModifierBreakdown } = await import('./combatUtils');
        const attacker = { primaryElement: 'Fire', secondaryElement: 'None' } as any;
        const target = { primaryElement: 'Water', secondaryElement: undefined } as any;
        const noneCard = { element: 'None' } as any;
        const breakdown = getModifierBreakdown(attacker, target, noneCard);
        expect(breakdown.stab).toBe(false);
        expect(breakdown.modifier).toBe(1);
    });
});
