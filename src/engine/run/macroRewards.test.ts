import { describe, it, expect } from 'vitest';
import { rollMacroChoices, MACRO_REWARD_CHOICES } from './macroRewards';
import { BATTLE_MACRO_IDS } from '../data/macroRegistry';

describe('166d — rollMacroChoices', () => {
    it('returns three distinct ids, all in BATTLE_MACRO_IDS, never ping_sweep', () => {
        const choices = rollMacroChoices('seed-1');
        expect(choices).toHaveLength(MACRO_REWARD_CHOICES);
        expect(new Set(choices).size).toBe(MACRO_REWARD_CHOICES);
        for (const id of choices) {
            expect(BATTLE_MACRO_IDS).toContain(id);
            expect(id).not.toBe('ping_sweep');
        }
    });

    it('returns the same three choices for the same seed', () => {
        const first = rollMacroChoices('same-seed');
        const second = rollMacroChoices('same-seed');
        expect(first).toEqual(second);
    });

    it('covers at least 8 different macros across 50 seeds', () => {
        const seen = new Set<string>();
        for (let i = 0; i < 50; i++) {
            for (const id of rollMacroChoices(`sweep-seed-${i}`)) {
                seen.add(id);
            }
        }
        expect(seen.size).toBeGreaterThanOrEqual(8);
    });
});
