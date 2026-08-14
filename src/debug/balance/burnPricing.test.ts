import { describe, it, expect } from 'vitest';
import { burnPower, BURN_TIER_POWER, BURN_DETONATION_POWER, calculatePowerscale } from './powerscale';
import { getStatusBehavior, BURN_CONFIG } from '../../engine/StatusBehaviors';
import { DEFAULT_GAME_CONFIG } from '../../engine/data/gameConfig';
import type { IBattleEntity, StatusEffectInstance, ProgramData } from '../../engine/types';

/**
 * Ticket 62 repricing — the scorer must agree with the ENGINE about what Burn does.
 *
 * This file exists because it didn't. Ticket 62 shipped a four-tier table and a detonating
 * overflow while `powerscale.ts` still priced three tiers and a per-excess-stack burst from the
 * era when overflow floored to zero damage (HANDOFF 0-BURN-PRICE-LAG). Nothing caught it: the
 * scorer's numbers were internally consistent and the engine's were correct, and no test
 * compared the two.
 *
 * So these assertions do NOT transcribe expected values. They run `BurnBehavior` on a frame
 * large enough that nothing floors, measure the damage it actually delivers as a share of max
 * HP, and require the scorer's price to be that share at the spec's 3-power-per-1% rate. A
 * future tier or cap edit that moves one and not the other fails here.
 */

const HUGE_HP = 10_000;
const POWER_PER_PERCENT_MAXHP = 3;

const frame = (): IBattleEntity =>
    ({ id: 't1', name: 'Target', maxHp: HUGE_HP, currentHp: HUGE_HP, defense: 0 } as IBattleEntity);

/** Total HP the engine actually delivers for N stacks applied to a fresh target: burst + full decay. */
function engineTotalDamage(stacks: number): number {
    const behavior = getStatusBehavior('Burn');
    const applied = behavior.onApply([], stacks, frame());
    let total = applied.immediateDamage;
    let instance = applied.updatedEffects.find(e => e.type === 'Burn') as StatusEffectInstance | undefined;
    while (instance) {
        const ticked = behavior.endTurn(instance, frame());
        total += ticked.damage;
        instance = ticked.updatedInstance ?? undefined;
    }
    return total;
}

const enginePower = (stacks: number) => (engineTotalDamage(stacks) / HUGE_HP) * 100 * POWER_PER_PERCENT_MAXHP;

describe('burnPower agrees with the engine', () => {
    it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 12])('%i stacks price exactly what the engine delivers', stacks => {
        expect(burnPower(stacks)).toBeCloseTo(enginePower(stacks), 6);
    });

    it('is derived from the live tier table, not transcribed from it', () => {
        expect(BURN_TIER_POWER).toHaveLength(DEFAULT_GAME_CONFIG.status.burnStacks.length);
        expect(BURN_TIER_POWER).toEqual([4.5, 13.5, 28.5, 52.5]);
        expect(BURN_DETONATION_POWER).toBe(42);
    });

    it('prices a detonation as ONE event per cap-crossing, not per excess stack', () => {
        const cap = BURN_CONFIG.maxStacks;
        // cap+1 through cap*2 all cause exactly one detonation; the old per-stack model
        // charged 1, 2, 3, 4 excess stacks across that same range.
        for (let s = cap + 1; s <= cap * 2; s++) {
            const detonationShare = burnPower(s) - BURN_TIER_POWER[s - cap - 1];
            expect(detonationShare).toBeCloseTo(BURN_DETONATION_POWER, 6);
        }
    });

    it('is NOT monotonic — 5 stacks price below 4, because the detonation spends the pile', () => {
        expect(burnPower(5)).toBeLessThan(burnPower(4));
        expect(burnPower(9)).toBeLessThan(burnPower(8));
        // and the engine says the same thing, which is the point
        expect(enginePower(5)).toBeLessThan(enginePower(4));
    });

    it('scores zero and negative stack counts as nothing', () => {
        expect(burnPower(0)).toBe(0);
        expect(burnPower(-3)).toBe(0);
    });
});

describe('a Burn card is scored at the new rate', () => {
    const card = (stacks: number): ProgramData => ({
        id: 'test_burn', name: 'Test Burn', description: '', element: 'Fire',
        category: 'Skill', rarity: 'Common', baseCost: 1, actions: [
            { type: 'STATUS', status: 'Burn', stacks, target: 'Single' },
        ], constraints: [],
    } as unknown as ProgramData);

    // Card scores are reported to 1 decimal, so these are the rounded form of
    // burnPower(N) / 10 - 2.85 -> 2.9, 5.25 -> 5.3, 4.65 -> 4.7.
    it('a 3-stack Burn card now scores 2.9, where the old three-tier table said 4.0', () => {
        expect(calculatePowerscale(card(3)).score).toBe(2.9);
    });

    it('a 4-stack Burn card reaches the cap and scores 5.3', () => {
        expect(calculatePowerscale(card(4)).score).toBe(5.3);
    });

    it('a 5-stack Burn card scores BELOW a 4-stack one — 4.7 against 5.3', () => {
        expect(calculatePowerscale(card(5)).score).toBe(4.7);
        expect(calculatePowerscale(card(5)).score).toBeLessThan(calculatePowerscale(card(4)).score);
    });
});

describe('fractional stack counts (ASSUMED_STATUS_COUNT is 1.5)', () => {
    it('interpolates between rungs instead of returning NaN', () => {
        // The previous form indexed BURN_TIER_POWER[n - 1], so 1.5 read index 0.5 and returned
        // undefined - a silent NaN into the card score. This is the regression guard.
        for (const stacks of [0.5, 1.5, 2.5, 3.5, 4.5]) {
            expect(Number.isNaN(burnPower(stacks))).toBe(false);
            expect(burnPower(stacks)).toBeGreaterThan(0);
        }
    });

    it('1.5 stacks price at the midpoint of 1 and 2', () => {
        expect(burnPower(1.5)).toBeCloseTo((burnPower(1) + burnPower(2)) / 2, 6);
        expect(burnPower(1.5)).toBe(9);
    });

    it('stays monotonic BELOW the cap, where interpolation applies', () => {
        let previous = 0;
        for (let s = 0.5; s <= BURN_CONFIG.maxStacks; s += 0.5) {
            expect(burnPower(s)).toBeGreaterThan(previous);
            previous = burnPower(s);
        }
    });

    it('a consume-Burn card no longer scores against 3 phantom stacks', () => {
        // ash_communion: charged for consuming 3 stacks, measured consuming ~1.5 (ticket 58).
        const card: ProgramData = {
            id: 'test_consume', name: 'Test Consume', description: '', element: 'Fire',
            category: 'Heal', rarity: 'Common', baseCost: 2, actions: [
                { type: 'STATUS', status: 'Burn', consume: true, target: 'SELF' },
                { type: 'HEAL', power: 30, scaling: 'STATUS_CONSUMED', target: 'SELF' },
            ], constraints: [],
        } as unknown as ProgramData;
        expect(Number.isNaN(calculatePowerscale(card).score)).toBe(false);
        expect(calculatePowerscale(card).score).toBeLessThan(6.5);
    });
});
