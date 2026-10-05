/**
 * TICKET 190c — the orb a status-only card lobs: a soft ball in the status colour that goes from the
 * caster to the target in an arc (a buff on yourself rises and drops back).
 */
import { describe, expect, it } from 'vitest';

import { orbSeed } from './orb';

const from = { x: 100, y: 300, w: 190, h: 190 };
const to = { x: 900, y: 300, w: 190, h: 190 };
const COLOR = { r: 224, g: 93, b: 67 };

describe('190c — orbSeed', () => {
    it('lives exactly as long as the orb is in the air', () => {
        expect(orbSeed(from, to, COLOR, 320, false).life).toBe(320);
    });

    it('is a soft ball (a puff) that follows a path', () => {
        const seed = orbSeed(from, to, COLOR, 320, false);
        expect(seed.shape).toBe('puff');
        expect(typeof seed.path).toBe('function');
    });

    it('leaves the middle of the caster and arrives at the middle of the target', () => {
        const path = orbSeed(from, to, COLOR, 320, false).path!;
        expect(path(0)).toEqual({ x: 195, y: 395 });
        const end = path(1);
        expect(end.x).toBeCloseTo(995);
        expect(end.y).toBeCloseTo(395);
    });

    it('lobs: above the straight line in the middle of the flight', () => {
        const mid = orbSeed(from, to, COLOR, 320, false).path!(0.5);
        expect(mid.y).toBeLessThan(395 - 20);
        expect(mid.x).toBeCloseTo(595);
    });

    it('rises and drops back when the card is on its caster', () => {
        const path = orbSeed(from, from, COLOR, 320, true).path!;
        expect(path(0)).toEqual({ x: 195, y: 395 });
        expect(path(1).y).toBeCloseTo(395);
        expect(path(0.5).y).toBeLessThan(395 - 30);
        expect(path(0.5).x).toBeCloseTo(195);
    });

    it('carries the status colour', () => {
        const seed = orbSeed(from, to, COLOR, 320, false);
        expect(seed.r2).toBe(224);
        expect(seed.g2).toBe(93);
    });
});
