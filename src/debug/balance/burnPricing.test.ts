import { describe, it, expect } from 'vitest';
import { burnPower, BURN_TIER_POWER, BURN_DETONATION_POWER, calculatePowerscale, BURN_PERMANENT_HORIZON_TURNS } from './powerscale';
import { getStatusBehavior, BURN_CONFIG } from '../../engine/StatusBehaviors';
import { DEFAULT_GAME_CONFIG } from '../../engine/data/gameConfig';
import type { IBattleEntity, StatusEffectInstance, ProgramData } from '../../engine/types';
import { GetProgramData } from '../../engine/data/programRegistry';

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
    // Ticket 93: a PERMANENT pile never expires, so "until it wears off" is not a bound - this
    // loop used to hang the whole suite. Permanence is priced over BURN_PERMANENT_HORIZON_TURNS
    // instead, and the engine reading has to use the same horizon or the two cannot agree.
    let ticks = 0;
    const maxTicks = BURN_CONFIG.decayPerTurn === 0 ? BURN_PERMANENT_HORIZON_TURNS : Infinity;
    while (instance && ticks < maxTicks) {
        const ticked = behavior.endTurn(instance, frame());
        total += ticked.damage;
        instance = ticked.updatedInstance ?? undefined;
        ticks++;
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
        // Ticket 93: permanence re-derives the table on a fixed horizon rather than a decay sum.
        expect(BURN_TIER_POWER).toEqual([9, 18, 30, 48]);
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

    it('is monotonic again under permanence — 5 stacks price ABOVE 4 (ticket 93)', () => {
        // A detonation still SPENDS the pile, but what survives no longer decays, so crossing
        // the cap is now worth more than sitting on it - the opposite of the decaying model.
        expect(burnPower(5)).toBeGreaterThan(burnPower(4));
        expect(burnPower(9)).toBeGreaterThan(burnPower(8));
        // and the engine says the same thing, which is the point
        expect(enginePower(5)).toBeGreaterThan(enginePower(4));
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
    // burnPower(N) / 10, ticket 93's permanent table: 3.0 at 3 stacks, 4.8 at 4, 5.1 at 5.
    it('a 3-stack Burn card scores 3.0 under permanence (ticket 93)', () => {
        expect(calculatePowerscale(card(3)).score).toBe(3);
    });

    it('a 4-stack Burn card reaches the cap and scores 4.8', () => {
        expect(calculatePowerscale(card(4)).score).toBe(4.8);
    });

    it('a 5-stack Burn card scores ABOVE a 4-stack one — 5.1 against 4.8', () => {
        expect(calculatePowerscale(card(5)).score).toBe(5.1);
        expect(calculatePowerscale(card(5)).score).toBeGreaterThan(calculatePowerscale(card(4)).score);
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

    it('1.5 stacks price at the midpoint of 1 and 2 (9 and 18 under permanence)', () => {
        expect(burnPower(1.5)).toBeCloseTo((burnPower(1) + burnPower(2)) / 2, 6);
        expect(burnPower(1.5)).toBe(13.5);
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

describe('the 1.5 consumed-stack assumption is BURN-ONLY', () => {
    const consumeCard = (status: string, cost: number): ProgramData => ({
        id: `t_${status}`, name: `T ${status}`, description: '', element: 'Fire',
        category: 'Heal', rarity: 'Common', baseCost: cost, actions: [
            { type: 'STATUS', status, consume: true, target: 'SELF' },
            { type: 'HEAL', power: 30, scaling: 'STATUS_CONSUMED', target: 'SELF' },
        ], constraints: [],
    } as unknown as ProgramData);

    it('a Poison-consume card still prices against 3 stacks, not 1.5', () => {
        // Same card shape, different status: the heal half must follow the status its consume
        // action names. ash_communion (Burn) and umbral_feast (Poison) must not share a number.
        const burn = calculatePowerscale(consumeCard('Burn', 2)).score;
        const poison = calculatePowerscale(consumeCard('Poison', 2)).score;
        expect(poison).toBeGreaterThan(burn);
    });

    it('the roster cards land where the census says they should', () => {
        // Regression pins for the two real cards, so a future edit to either assumption shows up.
        //
        // Ticket 66 moved `umbral_feast` 3.0 -> 14.9: it consumes POISON, and the census set that
        // assumption from 3 to 8 (measured 11.47, priced conservatively). This pin asserted the
        // OLD constant and is updated, not deleted - it is doing its job by failing here.
        // `ash_communion` consumes BURN at 1.5 and is unmoved, which is the point of the block.
        const ash = GetProgramData('ash_communion');
        const umbral = GetProgramData('umbral_feast');
        // Ticket 93: ash_communion consumes Burn, so permanence re-prices what it eats.
        if (ash) expect(calculatePowerscale(ash).score).toBe(4.6);
        if (umbral) expect(calculatePowerscale(umbral).score).toBe(14.9);
    });
});
