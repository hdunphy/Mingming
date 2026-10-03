/**
 * TICKET 190g - the pieces of the big-hit extras: a value that follows keys over GAME time (so a freeze
 * holds it), the stage dim, the camera punch, and the sparks that charge into the caster's mouth.
 */
import { describe, expect, it } from 'vitest';

import { CameraPunch } from './CameraPunch';
import { StageDim } from './StageDim';
import { Track } from './Track';
import { dimKeys } from '../choreo/bigHit';

const run = <T>(step: (dt: number) => T, ms: number, every = 8): T[] => {
    const out: T[] = [];
    for (let left = ms; left > 0; left -= every) out.push(step(Math.min(every, left)));
    return out;
};

describe('190g - a track follows keys over game time', () => {
    it('goes through its keys and ends exactly on the last one', () => {
        const track = new Track();
        track.start([{ atMs: 0, value: 0 }, { atMs: 100, value: 1 }, { atMs: 200, value: 0 }]);
        expect(track.step(50)).toBeCloseTo(0.5, 5);
        expect(track.step(50)).toBeCloseTo(1, 5);
        expect(track.step(50)).toBeCloseTo(0.5, 5);
        expect(track.step(50)).toBe(0);
        expect(track.active).toBe(false);
        expect(track.step(50)).toBe(0);
    });

    it('does not move without time passing', () => {
        const track = new Track();
        track.start([{ atMs: 0, value: 0 }, { atMs: 100, value: 1 }]);
        track.step(40);
        const held = track.value;
        expect(track.step(0)).toBe(held);
    });

    it('an ease-out segment arrives quickly and settles slowly', () => {
        const track = new Track();
        track.start([{ atMs: 0, value: 0 }, { atMs: 100, value: 1, ease: 'easeOut' }]);
        expect(track.step(50)).toBeGreaterThan(0.5);
    });
});

describe('190g - the camera punch', () => {
    it('zooms in fast and eases back over 260 ms, ending on exactly 1', () => {
        const punch = new CameraPunch();
        expect(punch.scale).toBe(1);
        punch.punch(0.03);
        const scales = run((dt) => punch.step({ gameDt: dt, frozen: false }), 400);
        const peak = Math.max(...scales);
        expect(peak).toBeGreaterThan(1.0295);
        expect(peak).toBeLessThanOrEqual(1.03);
        expect(scales[scales.length - 1]).toBe(1);
        expect(punch.active).toBe(false);
    });

    it('is back to 1 within 260 ms of the peak', () => {
        const punch = new CameraPunch();
        punch.punch(0.045);
        const scales = run((dt) => punch.step({ gameDt: dt, frozen: false }), 1000, 4);
        const at = scales.findIndex((scale) => scale === Math.max(...scales));
        const back = scales.findIndex((scale, i) => i > at && scale === 1);
        expect((back - at) * 4).toBeLessThanOrEqual(272);
    });

    it('holds the zoom through a freeze and resumes after it', () => {
        const punch = new CameraPunch();
        punch.punch(0.03);
        punch.step({ gameDt: 60, frozen: false });
        const held = punch.scale;
        expect(held).toBeGreaterThan(1);
        expect(punch.step({ gameDt: 0, frozen: true })).toBe(held);
        expect(punch.step({ gameDt: 0, frozen: true })).toBe(held);
        expect(punch.step({ gameDt: 100, frozen: false })).toBeLessThan(held);
    });

    it('ignores a punch of nothing, and a smaller punch does not shrink a bigger one', () => {
        const punch = new CameraPunch();
        punch.punch(0);
        expect(punch.active).toBe(false);
        punch.punch(0.04);
        punch.step({ gameDt: 50, frozen: false });
        const before = punch.scale;
        punch.punch(0.01);
        expect(punch.scale).toBe(before);
    });

    it('reset puts the picture back at once', () => {
        const punch = new CameraPunch();
        punch.punch(0.03);
        punch.step({ gameDt: 50, frozen: false });
        punch.reset();
        expect(punch.scale).toBe(1);
        expect(punch.active).toBe(false);
    });
});

describe('190g - the stage dim', () => {
    const game = { windupEndMs: 220, lungeEndMs: 370, impactMs: 700, knockbackEndMs: 870, endMs: 1070 };

    it('dims up to 0.4 x s across the wind-up, holds to the impact, and releases on the knock-back', () => {
        const dim = new StageDim();
        dim.run(dimKeys(game, 0.9));
        const at = (ms: number) => { const before = dim.opacity; run((dt) => dim.step({ gameDt: dt, frozen: false }), ms); return [before, dim.opacity]; };
        at(220);
        expect(dim.opacity).toBeCloseTo(0.36, 2);
        at(480);   // 700: the impact
        expect(dim.opacity).toBeCloseTo(0.36, 2);
        at(170);   // 870: the knock-back is over
        expect(dim.opacity).toBe(0);
        expect(dim.active).toBe(false);
    });

    it('never goes past 0.4', () => {
        const dim = new StageDim();
        dim.run(dimKeys(game, 1));
        const seen = run((dt) => dim.step({ gameDt: dt, frozen: false }), 1000);
        expect(Math.max(...seen)).toBeLessThanOrEqual(0.4 + 1e-9);
    });

    it('holds through a freeze', () => {
        const dim = new StageDim();
        dim.run(dimKeys(game, 1));
        dim.step({ gameDt: 300, frozen: false });
        const held = dim.opacity;
        expect(dim.step({ gameDt: 0, frozen: true })).toBe(held);
    });
});
