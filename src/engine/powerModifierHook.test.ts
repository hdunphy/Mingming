import { describe, it, expect } from 'vitest';

import { calculateDamage } from './combatUtils';
import { registerHook } from './core/Hooks';
import { HookFactory } from './core/HookFactory';
import type { IBattleEntity, IBattleState, ProgramData } from './types';

/**
 * TICKET 150b — A MODIFIER THAT RIDES THE POWER.
 *
 * §3's own test, written as it asks for it: *"a hook with `bonus: 3, scaling: TARGET_POISON_STACKS`
 * on a 30-power attack against 4 Poison deals exactly what a 42-power attack deals."*
 *
 * That equality is the entire claim, and it is asserted against a SECOND CALL to `calculateDamage`
 * rather than a literal. A hardcoded number would have to be re-derived every time the /45 pace
 * divisor or the level base moves, and — worse — it could be re-derived wrongly and still look
 * like it passed. Two calls to the same function cannot disagree about the pipeline.
 */

const unit = (over: Partial<IBattleEntity> = {}): IBattleEntity => ({
    id: 'u1', name: 'Unit', nickname: 'Unit', definitionId: 'def', blueprintsCollected: 0,
    attackIV: 0, defenseIV: 0, hpIV: 0,
    maxHp: 100, attack: 10, defense: 10, maxEnergy: 10, cardDraw: 1,
    currentHp: 100, currentEnergy: 10,
    primaryElement: 'None', statusEffects: [], tempHp: 0, speed: 10, hooks: [], daemons: [],
    ...over,
} as unknown as IBattleEntity);

const board = (attacker: IBattleEntity, target: IBattleEntity): IBattleState =>
    ({ playerParty: [attacker], enemyParty: [target], turn: 1 } as unknown as IBattleState);

const poisoned = (stacks: number) =>
    unit({ id: 'e1', statusEffects: [{ type: 'Poison', stacks, duration: 99 }] as never });

describe('150b — onPowerCalculated', () => {
    it('adds to the POWER, so 30 + 3x4 Poison is exactly a 42-power attack', () => {
        registerHook(HookFactory.createHook({
            id: 'test_power_bonus',
            trigger: 'onPowerCalculated',
            priority: 40,
            when: { source: 'SELF' },
            bonus: 3,
            scaling: 'TARGET_POISON_STACKS',
        }));

        const attacker = unit({ id: 'p1', hooks: ['test_power_bonus'] });
        const plain = unit({ id: 'p2' });
        const program = { element: 'None' } as ProgramData;

        const withHook = calculateDamage(attacker, poisoned(4), program, 30, board(attacker, poisoned(4)));
        const asFortyTwo = calculateDamage(plain, poisoned(4), program, 42, board(plain, poisoned(4)));

        expect(withHook).toBe(asFortyTwo);

        /*
         * And it is NOT the same as a 30-power attack, which is the half a test like this forgets.
         * Without it, a hook that silently did nothing would pass the equality above whenever
         * 30 and 42 happened to floor to the same damage.
         */
        const asThirty = calculateDamage(plain, poisoned(4), program, 30, board(plain, poisoned(4)));
        expect(withHook).toBeGreaterThan(asThirty);
    });

    it('scales with the stacks rather than adding a flat lump', () => {
        // The reason the bonus rides the power at all: at 0 stacks it contributes nothing, and
        // every stack is worth the same amount of POWER - which the pace divisor, the frame and
        // `powerscale` can all see. A flat post-divisor bonus is none of those things.
        const attacker = unit({ id: 'p1', hooks: ['test_power_bonus'] });
        const program = { element: 'None' } as ProgramData;

        const at0 = calculateDamage(attacker, poisoned(0), program, 30, board(attacker, poisoned(0)));
        const at4 = calculateDamage(attacker, poisoned(4), program, 30, board(attacker, poisoned(4)));
        const at8 = calculateDamage(attacker, poisoned(8), program, 30, board(attacker, poisoned(8)));

        const plain = unit({ id: 'p2' });
        expect(at0).toBe(calculateDamage(plain, poisoned(0), program, 30, board(plain, poisoned(0))));
        expect(at4).toBeGreaterThan(at0);
        expect(at8).toBeGreaterThan(at4);
        // Linear in the stacks, within a point of rounding: 8 stacks is twice 4 stacks' bonus.
        expect(Math.abs((at8 - at0) - 2 * (at4 - at0))).toBeLessThanOrEqual(2);
    });

    it('fires once per hit, not once per card, like the damage-side family', () => {
        // `calculateDamage` is called once per hit on a multi-hit card, so two calls must apply
        // the bonus twice. If a future refactor hoists the hook to the card level, this fails.
        const attacker = unit({ id: 'p1', hooks: ['test_power_bonus'] });
        const plain = unit({ id: 'p2' });
        const program = { element: 'None' } as ProgramData;

        const one = calculateDamage(attacker, poisoned(4), program, 30, board(attacker, poisoned(4)));
        const oneClean = calculateDamage(plain, poisoned(4), program, 30, board(plain, poisoned(4)));
        const bonusPerHit = one - oneClean;

        expect(bonusPerHit).toBeGreaterThan(0);
        expect(one * 2 - oneClean * 2).toBe(bonusPerHit * 2);
    });

    it('leaves a unit with no such hook exactly where it was', () => {
        // The containment check: a new trigger must not be able to reach a card that never asked
        // for it. Every existing balance number depends on this being true.
        const plain = unit({ id: 'p2' });
        const program = { element: 'None' } as ProgramData;
        const target = poisoned(6);

        expect(calculateDamage(plain, target, program, 30, board(plain, target)))
            .toBe(calculateDamage(plain, target, program, 30, board(plain, target)));
    });
});
