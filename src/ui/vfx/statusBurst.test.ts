import { describe, it, expect } from 'vitest';
import { groupStatusTells, scheduleStatusTells, statusFloatText, absorbedAmount, type StatusEntry } from './statusBurst';

describe('166b — statusBurst grouping and scheduling', () => {
    it('groups 20 entries across Sharp and Weakened into 2 groups with 3 distinct targets each', () => {
        const entries: StatusEntry[] = [];
        const allies = ['a1', 'a2', 'a3'];
        const enemies = ['e1', 'e2', 'e3'];
        // Repeat to make 20 entries total
        for (let i = 0; i < 10; i++) {
            entries.push({ targetId: allies[i % 3], status: 'Sharp' });
            entries.push({ targetId: enemies[i % 3], status: 'Weakened' });
        }
        expect(entries).toHaveLength(20);

        const groups = groupStatusTells(entries);
        expect(groups).toHaveLength(2);
        expect(groups[0].status).toBe('Sharp');
        expect(groups[0].targetIds).toEqual(['a1', 'a2', 'a3']);
        expect(groups[1].status).toBe('Weakened');
        expect(groups[1].targetIds).toEqual(['e1', 'e2', 'e3']);
    });

    it('scheduleStatusTells gives [560, 620] for those entries at base 500 and stagger 60', () => {
        const entries: StatusEntry[] = [];
        const allies = ['a1', 'a2', 'a3'];
        const enemies = ['e1', 'e2', 'e3'];
        for (let i = 0; i < 10; i++) {
            entries.push({ targetId: allies[i % 3], status: 'Sharp' });
            entries.push({ targetId: enemies[i % 3], status: 'Weakened' });
        }
        const scheduled = scheduleStatusTells(500, entries, 60);
        expect(scheduled.map(s => s.at)).toEqual([560, 620]);
    });

    it('three different statuses on one body schedule linearly at [560, 620, 680]', () => {
        const entries: StatusEntry[] = [
            { targetId: 'b1', status: 'Sharp' },
            { targetId: 'b1', status: 'Energized' },
            { targetId: 'b1', status: 'BarkShield' },
        ];
        const scheduled = scheduleStatusTells(500, entries, 60);
        expect(scheduled.map(s => s.at)).toEqual([560, 620, 680]);
    });

    it('formats float text correctly: single, multiple, and camelCase', () => {
        expect(statusFloatText('Sharp', 7)).toBe('Sharp ×7');
        expect(statusFloatText('Burn', 1)).toBe('Burn');
        expect(statusFloatText('DarkStance', 1)).toBe('Dark Stance');
    });

    it('167i: rounds a fractional stack count to a whole number (Bark Shield is a share of max HP)', () => {
        const text = statusFloatText('BarkShield', 1.3248929838928);
        expect(text).not.toContain('.');
        // Rounds to 1, and "x1" is not shown: the same rule as a single stack.
        expect(text).toBe('Bark Shield');
        expect(statusFloatText('BarkShield', 13.7)).toBe('Bark Shield ×14');
        expect(statusFloatText('BarkShield', 2.49)).toBe('Bark Shield ×2');
    });

    it('167i: the absorbed float shows a whole number, and never 0', () => {
        expect(absorbedAmount(13.7)).toBe(14);
        expect(absorbedAmount(1.3248929838928)).toBe(1);
        expect(absorbedAmount(0.2)).toBe(1);
    });
});
