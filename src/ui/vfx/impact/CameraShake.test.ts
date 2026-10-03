/**
 * TICKET 189d — the camera: trauma, squared, along smooth noise, never during a freeze.
 */
import { describe, expect, it } from 'vitest';

import { CameraShake, MAX_SHAKE_DEGREES, MAX_SHAKE_PX, smoothNoise, TRAUMA_DECAY_PER_SECOND } from './CameraShake';

const run = { gameDt: 16, frozen: false };
const frozen = { gameDt: 0, frozen: true };

describe('189d — the camera shake', () => {
    it('starts still', () => {
        const camera = new CameraShake(() => 0.6);
        expect(camera.step(run)).toEqual({ x: 0, y: 0, degrees: 0 });
        expect(camera.active).toBe(false);
    });

    it('moves by trauma squared x 14 px x the setting, at most', () => {
        const camera = new CameraShake(() => 0.6);
        camera.add(1);
        let peak = 0;
        let peakDeg = 0;
        for (let i = 0; i < 20; i += 1) {
            const offset = camera.step({ gameDt: 1, frozen: false });   // 1 ms frames: trauma barely drains
            peak = Math.max(peak, Math.abs(offset.x), Math.abs(offset.y));
            peakDeg = Math.max(peakDeg, Math.abs(offset.degrees));
        }
        expect(peak).toBeGreaterThan(0);
        expect(peak).toBeLessThanOrEqual(MAX_SHAKE_PX * 0.6 + 1e-9);
        expect(peakDeg).toBeLessThanOrEqual(MAX_SHAKE_DEGREES * 0.6 + 1e-9);
    });

    it('squares the trauma: half the trauma is a quarter of the shake', () => {
        const full = new CameraShake(() => 1);
        const half = new CameraShake(() => 1);
        full.add(1);
        half.add(0.5);
        // The same instant of game time, so the same noise sample.
        const a = full.step({ gameDt: 1, frozen: false });
        const b = half.step({ gameDt: 1, frozen: false });
        expect(Math.abs(b.x)).toBeCloseTo(Math.abs(a.x) * 0.25, 1);
    });

    it('drains at 1.6 per second of game time', () => {
        const camera = new CameraShake();
        camera.add(1);
        camera.step({ gameDt: 500, frozen: false });
        expect(camera.level).toBeCloseTo(1 - TRAUMA_DECAY_PER_SECOND * 0.5, 6);
        camera.step({ gameDt: 500, frozen: false });
        expect(camera.level).toBe(0);
        expect(camera.step(run)).toEqual({ x: 0, y: 0, degrees: 0 });
    });

    it('never plays during a freeze: the offset is zero and the trauma holds', () => {
        const camera = new CameraShake(() => 1);
        camera.add(0.9);
        camera.step({ gameDt: 20, frozen: false });
        const held = camera.level;
        for (let i = 0; i < 10; i += 1) {
            expect(camera.step(frozen)).toEqual({ x: 0, y: 0, degrees: 0 });
        }
        expect(camera.level).toBe(held);
        // …and the shake picks up as soon as the freeze lifts.
        const after = camera.step(run);
        expect(Math.abs(after.x) + Math.abs(after.y)).toBeGreaterThan(0);
    });

    it('trauma is capped at 1 and the noise is smooth, not jitter', () => {
        const camera = new CameraShake();
        camera.add(0.8);
        camera.add(0.8);
        expect(camera.level).toBe(1);
        let biggestJump = 0;
        for (let t = 0; t < 400; t += 16) {
            biggestJump = Math.max(biggestJump, Math.abs(smoothNoise(t + 16, 0) - smoothNoise(t, 0)));
        }
        // Between two 60 fps frames the picture never jumps more than about a quarter of its range.
        expect(biggestJump).toBeLessThan(0.55);
    });

    it('a zero setting is still', () => {
        const camera = new CameraShake(() => 0);
        camera.add(1);
        expect(camera.step({ gameDt: 1, frozen: false })).toEqual({ x: 0, y: 0, degrees: 0 });
    });

    it('survives a non-finite delta and resets', () => {
        const camera = new CameraShake();
        camera.add(1);
        expect(() => camera.step({ gameDt: Number.NaN, frozen: false })).not.toThrow();
        camera.reset();
        expect(camera.active).toBe(false);
    });
});
