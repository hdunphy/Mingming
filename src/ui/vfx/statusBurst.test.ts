import { describe, it, expect } from 'vitest';
import { groupStatusTells, scheduleStatusTells, statusFloatText, type StatusEntry } from './statusBurst';

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
});
