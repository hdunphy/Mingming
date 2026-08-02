import { describe, it, expect } from 'vitest';
import { getMatchupMultiplier, CHART_ELEMENTS } from './TypeChart';
import { ElementalMatrix } from '../../engine/combatUtils';
import { ELEMENTS } from '../../engine/types';
import type { Element } from '../../engine/types';

describe('TypeChart matchup derivation', () => {
    it('returns ×2 for Fire → Nature (super effective)', () => {
        expect(getMatchupMultiplier('Fire', 'Nature')).toBe(2);
    });

    it('returns ×0.5 for Fire → Water (not very effective)', () => {
        expect(getMatchupMultiplier('Fire', 'Water')).toBe(0.5);
    });

    it('returns ×1 for neutral / missing matchups', () => {
        expect(getMatchupMultiplier('Light', 'Water')).toBe(1);
        expect(getMatchupMultiplier('None', 'Fire')).toBe(1);
        expect(getMatchupMultiplier('Bogus', 'Fire')).toBe(1);
    });

    it('mirrors the engine ElementalMatrix for every chart cell', () => {
        for (const atk of CHART_ELEMENTS) {
            for (const def of CHART_ELEMENTS) {
                expect(getMatchupMultiplier(atk, def)).toBe(ElementalMatrix[atk]?.[def] ?? 1);
            }
        }
    });

    it('charts the 8 real elements and excludes None', () => {
        expect(CHART_ELEMENTS).toHaveLength(8);
        expect(CHART_ELEMENTS).not.toContain('None');
        expect(CHART_ELEMENTS).toEqual(ELEMENTS.filter((e: Element) => e !== 'None'));
    });
});
