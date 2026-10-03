/**
 * TICKET 189a — the clock's hit-stop.
 *
 * It replaces the module-level `stoppedUntil` of `hitStop.ts`. A freeze is in REAL milliseconds
 * (it must hold even when game time is running at 4x) and it stops game time completely.
 */
import { describe, expect, it } from 'vitest';

import { HIT_STOP_FLOOR_MS, HitStop, freezeLengthMs } from './HitStop';
import { INSTANT } from './speedPolicy';

describe('189a — freezeLengthMs', () => {
    it('is the requested length at speed 1', () => {
        expect(freezeLengthMs(100, 1)).toBe(100);
    });

    it('shrinks as 1/sqrt(speed) at higher speed', () => {
        expect(freezeLengthMs(100, 4)).toBeCloseTo(50, 5);
        expect(freezeLengthMs(160, 4)).toBeCloseTo(80, 5);
    });

    it('never drops below the 30 ms floor nobody can see', () => {
        expect(freezeLengthMs(40, 4)).toBe(HIT_STOP_FLOOR_MS);
        expect(freezeLengthMs(1, 1)).toBe(HIT_STOP_FLOOR_MS);
        expect(HIT_STOP_FLOOR_MS).toBe(30);
    });

    it('is zero at Instant: skipping animation skips the freeze too', () => {
        expect(freezeLengthMs(170, INSTANT)).toBe(0);
    });

    it('survives garbage instead of returning NaN', () => {
        expect(Number.isFinite(freezeLengthMs(Number.NaN, 1))).toBe(true);
        expect(Number.isFinite(freezeLengthMs(100, 0))).toBe(true);
    });
});

describe('189a — HitStop', () => {
    it('starts running', () => {
        const stop = new HitStop();
        expect(stop.active).toBe(false);
        expect(stop.remainingMs).toBe(0);
        expect(stop.consume(16)).toBe(16);
    });

    it('swallows real time while frozen and hands back only what is left over', () => {
        const stop = new HitStop();
        stop.request(100);
        expect(stop.active).toBe(true);
        expect(stop.consume(60)).toBe(0);
        expect(stop.remainingMs).toBe(40);
        // 40 ms of freeze left, 50 ms of frame: 10 ms of the frame is live.
        expect(stop.consume(50)).toBe(10);
        expect(stop.active).toBe(false);
    });

    it('EXTENDS rather than restacks when freezes overlap', () => {
        // A Side card landing on three targets is one heavier impact, not three stops in a row.
        const stop = new HitStop();
        stop.request(100);
        stop.request(40);
        expect(stop.remainingMs).toBe(100);
        stop.request(150);
        expect(stop.remainingMs).toBe(150);
    });

    it('applies the speed shrink and the floor when asked at a speed', () => {
        const stop = new HitStop();
        stop.request(160, 4);
        expect(stop.remainingMs).toBeCloseTo(80, 5);
    });

    it('ignores a zero or negative request, and an Instant one', () => {
        const stop = new HitStop();
        stop.request(0);
        stop.request(-5);
        stop.request(100, INSTANT);
        expect(stop.active).toBe(false);
    });

    it('reset drops the freeze', () => {
        const stop = new HitStop();
        stop.request(100);
        stop.reset();
        expect(stop.active).toBe(false);
    });
});
