import { describe, it, expect } from 'vitest';
import { fightBonusFor } from './fightBonus';
import type { IGauntletProgress } from '../runTypes';

describe('166d — fightBonusFor', () => {
    const makeGauntlet = (fightIndex: number, totalFights = 3): IGauntletProgress => ({
        fightIndex,
        totalFights,
        persistedHp: {},
        downedMemberIds: [],
    });

    it('pays macro after gauntlet fights 1 and 2, but null after boss (fight 3)', () => {
        expect(fightBonusFor({ nodeKind: 'gym', biomeIndex: 2, biomeCount: 3, gauntlet: makeGauntlet(0, 3) })).toBe('macro');
        expect(fightBonusFor({ nodeKind: 'gym', biomeIndex: 2, biomeCount: 3, gauntlet: makeGauntlet(1, 3) })).toBe('macro');
        expect(fightBonusFor({ nodeKind: 'gym', biomeIndex: 2, biomeCount: 3, gauntlet: makeGauntlet(2, 3) })).toBeNull();
    });

    it('pays null for gym with gauntlet: null', () => {
        expect(fightBonusFor({ nodeKind: 'gym', biomeIndex: 2, biomeCount: 3, gauntlet: null })).toBeNull();
    });

    it('pays patch for elite and ambush before 166e', () => {
        expect(fightBonusFor({ nodeKind: 'elite', biomeIndex: 0, biomeCount: 3, gauntlet: null })).toBe('patch');
        expect(fightBonusFor({ nodeKind: 'ambush', biomeIndex: 0, biomeCount: 3, gauntlet: null })).toBe('patch');
    });

    it('pays null for wild', () => {
        expect(fightBonusFor({ nodeKind: 'wild', biomeIndex: 0, biomeCount: 3, gauntlet: null })).toBeNull();
    });
});
