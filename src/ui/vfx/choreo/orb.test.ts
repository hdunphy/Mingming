/**
 * TICKET 190c / 198b-3 — the orb a status-only card lobs, as the lab's `orbFx` draws it: a 16 px glow
 * that leaves from over the caster's head, arcs over a point 110 px above the bodies and lands on
 * the target's centre, shedding 200 glow motes a second on the way (a buff on yourself rises 90 px
 * and drops back).
 */
import { describe, expect, it } from 'vitest';

import type { ParticleSeed } from '../particles';
import { APEX_MARGIN_PX, ORB_MOTES_PER_MS, orbEffect, orbPath } from './orb';

const from = { x: 100, y: 300, w: 190, h: 190 };
const to = { x: 900, y: 300, w: 190, h: 190 };
const COLOR = { r: 176, g: 96, b: 232 };
const counter = (): (() => number) => {
    let i = 0;
    return () => { i += 1; return ((i * 7919) % 1000) / 1000; };
};

describe('198b-3 — orbPath', () => {
    it('leaves from just over the top of the caster and arrives at the middle of the target', () => {
        const path = orbPath(from, to, false);
        expect(path.at(0)).toEqual({ x: 195, y: 310 });
        const end = path.at(1);
        expect(end.x).toBeCloseTo(995);
        expect(end.y).toBeCloseTo(395);
    });

    it('lobs well above the straight line in the middle of the flight', () => {
        const mid = orbPath(from, to, false).at(0.5);
        expect(mid.y).toBeLessThan((310 + 395) / 2 - 40);
        expect(mid.x).toBeCloseTo(595);
    });

    it('lowers the arc when it would crest above the stage, so a top-row lob stays on the canvas', () => {
        const top = orbPath({ x: 100, y: 10, w: 190, h: 190 }, { x: 900, y: 10, w: 190, h: 190 }, false);
        expect(top.at(0.5).y).toBeGreaterThanOrEqual(APEX_MARGIN_PX - 1e-9);
        expect(top.at(0.5).y).toBeLessThan((top.at(0).y + top.at(1).y) / 2);
    });

    it('eases in and out: slow off the mark, slow to land', () => {
        const path = orbPath(from, to, false);
        const early = path.at(0.1).x - path.at(0).x;
        const middle = path.at(0.55).x - path.at(0.45).x;
        expect(middle).toBeGreaterThan(early);
    });

    it('rises 90 px and drops back when the card is on its caster', () => {
        const path = orbPath(from, from, true);
        expect(path.at(0)).toEqual({ x: 195, y: 310 });
        expect(path.at(1).y).toBeCloseTo(310);
        expect(path.at(0.5).y).toBeCloseTo(310 - 90);
        expect(path.at(0.5).x).toBeCloseTo(195);
    });
});

describe('198b-3 — orbEffect', () => {
    const run = (ms = 320): ParticleSeed[] => {
        const effect = orbEffect(from, to, COLOR, ms, false, counter());
        const seeds: ParticleSeed[] = [];
        for (let age = 16; age <= ms; age += 16) effect.step(age, 16, (batch) => seeds.push(...batch));
        return seeds;
    };

    it('lives exactly as long as the orb is in the air', () => {
        expect(orbEffect(from, to, COLOR, 320, false).durationMs).toBe(320);
    });

    it('sheds 200 motes a second along the arc, each a 6 px glow thinning to 1 in the status colour', () => {
        const motes = run();
        expect(motes.length).toBeGreaterThanOrEqual(Math.floor(304 * ORB_MOTES_PER_MS));
        expect(motes.length).toBeLessThanOrEqual(Math.ceil(320 * ORB_MOTES_PER_MS));
        for (const mote of motes) {
            expect(mote.shape).toBe('glow');
            expect([mote.size, mote.size2, mote.life]).toEqual([6, 1, 300]);
            expect([mote.r, mote.g, mote.b]).toEqual([COLOR.r, COLOR.g, COLOR.b]);
            expect(Math.abs(mote.vx)).toBeLessThanOrEqual(20);
            expect(Math.abs(mote.vy)).toBeLessThanOrEqual(20);
        }
        // Born along the way, not all at the start.
        expect(Math.max(...motes.map((m) => m.x)) - Math.min(...motes.map((m) => m.x))).toBeGreaterThan(600);
    });

    it('draws the head as a glow without error', () => {
        const calls: string[] = [];
        const ctx = new Proxy({} as Record<string, unknown>, {
            get: (target, name: string) => (name in target ? target[name] : (...args: unknown[]) => { calls.push(`${name}:${args.length}`); }),
            set: (target, name: string, value) => { target[name] = value; return true; },
        });
        expect(() => orbEffect(from, to, COLOR, 320, false).draw(ctx as unknown as CanvasRenderingContext2D, 160)).not.toThrow();
    });
});
