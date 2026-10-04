/**
 * TICKET 185c — Sun Devourer pays half what it did.
 *
 * Henry (2026-10-02), after a Rootfall run where 8 Strength was 1,514 damage on turn one and 27
 * Strength was 4,918 in the last gym fight: *"Halve it now."* 30 → 15 power a stack, and the `+`
 * version 40 → 20. The text follows the numbers.
 *
 * The battle tests do not hard-code a damage figure: they play a plain reference attack whose
 * printed power is exactly `stacks × rate` and require the two to hit for the same damage, so the
 * test says "8 stacks is 120 power" in the engine's own units and survives a retune of the damage
 * formula.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { battleReducer } from './battleReducer';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import { ProgramRegistry } from './data/programRegistry';
import type { IBattleState, ProgramData } from './types';

const FRAME = 100_000;
const refId = (power: number): string => `ref_sun_devourer_power_${power}`;

function hitFor(dataId: string, strength: number): number {
    const caster = createSparseEntity({
        id: 'p1', name: 'Caster', currentHp: FRAME, maxHp: FRAME, currentEnergy: 5, maxEnergy: 5,
        statusEffects: strength > 0 ? [{ id: 's', type: 'Strengthened', stacks: strength }] as never : [],
    });
    const foe = createSparseEntity({ id: 'e1', name: 'Foe', currentHp: FRAME, maxHp: FRAME });
    const before: IBattleState = createSparseBattleState({
        activeSide: 'PLAYER', phase: 'ACTION',
        playerParty: [caster], enemyParty: [foe],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
            hand: [{ id: 'h1', dataId, currentCost: 2, isPlayable: true }],
        },
    });
    const after = battleReducer(before, {
        type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'h1' },
    } as never);
    return FRAME - after.enemyParty[0].currentHp;
}

/**
 * A Fire attack that prints `power` flat, in the same element and cost as Sun Devourer. The id
 * carries the power because the registry's lookups are cached by id: re-registering one id with a
 * new number would keep serving the first.
 */
function registerReference(power: number): string {
    const id = refId(power);
    ProgramRegistry[id] = {
        id, name: 'Reference', description: `${power} power.`,
        element: 'Fire', target: 'Single', category: 'Attack', rarity: 'Rare', baseCost: 2,
        constraints: ProgramRegistry.sun_devourer.constraints,
        actions: [{ type: 'ATTACK', power, target: 'TARGET' }],
    } as unknown as ProgramData;
    return id;
}

afterEach(() => { for (const id of Object.keys(ProgramRegistry)) if (id.startsWith('ref_sun_devourer_power_')) delete ProgramRegistry[id]; });

describe('185c — the printed numbers', () => {
    it('sun_devourer is 15 a stack and sun_devourer+ is 20', () => {
        const power = (id: string) => ProgramRegistry[id].actions.find(a => a.type === 'ATTACK')?.power;
        expect(power('sun_devourer')).toBe(15);
        expect(power('sun_devourer+')).toBe(20);
    });

    it('the text says what the card does', () => {
        expect(ProgramRegistry.sun_devourer.description).toBe('Consume all your Strength: 15 power per stack consumed.');
        expect(ProgramRegistry['sun_devourer+'].description).toBe('Consume all your Strength: 20 power per stack consumed.');
    });
});

describe('185c — what the card is worth in a fight', () => {
    it('8 Strength consumed is 120 power', () => {
        const ref = registerReference(120);
        const devourer = hitFor('sun_devourer', 8);
        expect(devourer).toBeGreaterThan(0);
        expect(devourer).toBe(hitFor(ref, 0));
    });

    it('8 Strength consumed is 160 power on the + version', () => {
        const ref = registerReference(160);
        expect(hitFor('sun_devourer+', 8)).toBe(hitFor(ref, 0));
    });

    it('it eats the whole pile, and with no Strength it does nothing', () => {
        expect(hitFor('sun_devourer', 0)).toBe(0);
    });

    it('27 Strength (the gym fight) is 405 power, half the 810 the old card was worth', () => {
        const ref = registerReference(405);
        expect(hitFor('sun_devourer', 27)).toBe(hitFor(ref, 0));
    });
});
