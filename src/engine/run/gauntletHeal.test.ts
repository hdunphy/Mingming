/**
 * TICKET 173a — the 30% repair between gauntlet fights.
 *
 * Henry, 2026-09-30: *"30% is fine. I've beaten the gym before with a different deck. You have to lose
 * sometimes it just can't feel unfair to lose."*
 */

import { describe, expect, it } from 'vitest';

import { GAUNTLET_HEAL_PERCENT, healBetweenFights } from './gauntletHeal';

describe('healBetweenFights (ticket 173a)', () => {
    it('is 30%', () => {
        expect(GAUNTLET_HEAL_PERCENT).toBe(30);
    });

    it('gives a standing member 30% of max HP', () => {
        expect(healBetweenFights(100, 1000)).toEqual({ hp: 400, healed: 300 });
    });

    it('rounds down, so the number shown is the number given', () => {
        expect(healBetweenFights(1, 1185)).toEqual({ hp: 356, healed: 355 });
    });

    it('never goes over max HP, and says only what it actually gave', () => {
        expect(healBetweenFights(900, 1000)).toEqual({ hp: 1000, healed: 100 });
        expect(healBetweenFights(1000, 1000)).toEqual({ hp: 1000, healed: 0 });
    });

    it('does not touch a downed member: the revive is gauntletRevive.ts\'s (ticket 202b), the repair of nothing is nothing', () => {
        expect(healBetweenFights(0, 1000)).toEqual({ hp: 0, healed: 0 });
    });
});
