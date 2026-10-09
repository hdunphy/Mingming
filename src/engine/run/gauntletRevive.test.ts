/**
 * TICKET 202b — a downed member comes back between gauntlet fights.
 *
 * Henry, 2026-10-07: *"Add a revive between fights."* and, on whether to reshape the gauntlet,
 * *"I think it's good for the first run to be hard."* The gauntlet stays three fights. The floor
 * (D1) is proposed at 30% of max HP, the same as the repair, and it is one constant.
 */

import { describe, expect, it } from 'vitest';

import { GAUNTLET_HEAL_PERCENT } from './gauntletHeal';
import { GAUNTLET_REVIVE_PERCENT, settleBetweenFights } from './gauntletRevive';

describe('settleBetweenFights (ticket 202b)', () => {
    it('revives at 30%, the same number as the repair, and the constant moves in 5s', () => {
        expect(GAUNTLET_REVIVE_PERCENT).toBe(30);
        expect(GAUNTLET_REVIVE_PERCENT).toBe(GAUNTLET_HEAL_PERCENT);
        expect(GAUNTLET_REVIVE_PERCENT % 5).toBe(0);
    });

    it('repairs a standing member exactly as the repair alone does', () => {
        expect(settleBetweenFights(500, 1000)).toEqual({ hp: 800, healed: 300, revived: false });
    });

    it('revives a downed member at 30% of max HP', () => {
        expect(settleBetweenFights(0, 1000)).toEqual({ hp: 300, healed: 0, revived: true });
    });

    it('rounds the revive down, so the number shown is the number given', () => {
        expect(settleBetweenFights(0, 1185)).toEqual({ hp: 355, healed: 0, revived: true });
    });

    it('does not divide by zero for a downed member with no max HP: nothing to revive', () => {
        expect(settleBetweenFights(0, 0)).toEqual({ hp: 0, healed: 0, revived: false });
    });

    it('caps a member near full at max HP and says only what it gave', () => {
        expect(settleBetweenFights(950, 1000)).toEqual({ hp: 1000, healed: 50, revived: false });
        expect(settleBetweenFights(1000, 1000)).toEqual({ hp: 1000, healed: 0, revived: false });
    });

    it('a revived member stands where a member at 0 would stand after a 30% repair', () => {
        // The ruling's point: a revived member stands where a member at 0 would stand after a 30% repair.
        const fromZero = settleBetweenFights(0, 1000).hp;
        const repairedFromZero = 0 + Math.floor((1000 * GAUNTLET_HEAL_PERCENT) / 100);
        expect(fromZero).toBe(repairedFromZero);
    });

    it('a downed member is brought back on at least 1 HP, so a tiny max HP is never "revived" at 0', () => {
        expect(settleBetweenFights(0, 2)).toEqual({ hp: 1, healed: 0, revived: true });
    });
});
