/**
 * TICKET 190c — the speed lines behind a contact card's dash: a few pale streaks that fly back the
 * way the attacker came from.
 */
import { describe, expect, it } from 'vitest';

import { speedLineSeeds } from './speedLines';

const at = { x: 100, y: 300, w: 190, h: 190 };
const steady = (): number => 0.5;

describe('190c — speedLineSeeds', () => {
    it('makes as many streaks as asked', () => {
        expect(speedLineSeeds(at, 1, 4, steady)).toHaveLength(4);
        expect(speedLineSeeds(at, 1, 0, steady)).toHaveLength(0);
    });

    it('flies back against a rightward dash, and forward against a leftward one', () => {
        for (const seed of speedLineSeeds(at, 1, 3, steady)) expect(seed.vx).toBeLessThan(0);
        for (const seed of speedLineSeeds(at, -1, 3, steady)) expect(seed.vx).toBeGreaterThan(0);
    });

    it('are short-lived pale streaks', () => {
        for (const seed of speedLineSeeds(at, 1, 3, steady)) {
            expect(seed.shape).toBe('streak');
            expect(seed.life).toBeLessThanOrEqual(200);
            expect(seed.r).toBeGreaterThan(200);
        }
    });

    it('starts them behind the attacker, within its height', () => {
        for (const seed of speedLineSeeds(at, 1, 6, Math.random)) {
            expect(seed.x).toBeLessThan(at.x + at.w / 2);
            expect(seed.y).toBeGreaterThanOrEqual(at.y);
            expect(seed.y).toBeLessThanOrEqual(at.y + at.h);
        }
    });
});
