/**
 * TICKET 194k-3 — every light effect brings its own contrast: a dark rim under an opaque body under
 * a hot core. A recording context captures what each effect draws, in order, without a browser.
 */
import { describe, expect, it } from 'vitest';

import type { AttackBuild, AttackInput, Body } from './AttackEffect';
import { fireWall } from './fireWall';
import { flameBeam } from './flameBeam';
import { LIGHT_BLEND } from './glow';
import { glowStops, MIN_BODY_ALPHA, RIM_BRIGHTNESS, rampStops, rimOf } from './layers';
import { tidalWave } from './tidalWave';
import { waterJet } from './waterJet';

const body = (id: string, x: number, y: number): Body => ({ id, x, y, w: 120, h: 120 }) as Body;

function input(over: Partial<AttackInput> = {}): AttackInput {
    return {
        caster: body('c', 100, 300), targets: [body('e1', 700, 300)], direction: 1, s: 0.54, headMs: 260, sustainMs: 600,
        particleScale: 1, rng: () => 0.5, ...over,
    } as AttackInput;
}

interface Op { kind: 'stroke' | 'fill'; width: number; style: string; blend: string; alpha: number; stops: Array<[number, string]> }

/** A context that records every stroke and fill with the state they were drawn in. */
function recorder(): { ctx: CanvasRenderingContext2D; ops: Op[] } {
    const ops: Op[] = [];
    const state: Record<string, unknown> = { globalAlpha: 1, globalCompositeOperation: 'source-over', lineWidth: 1, strokeStyle: '', fillStyle: '' };
    const make = (kind: Op['kind']) => () => {
        const style = String(kind === 'stroke' ? state.strokeStyle : (state.fillStyle as { label?: string }).label ?? state.fillStyle);
        const stops = (kind === 'fill' && typeof state.fillStyle === 'object') ? (state.fillStyle as { stops: Array<[number, string]> }).stops : [];
        ops.push({ kind, width: Number(state.lineWidth), style, blend: String(state.globalCompositeOperation), alpha: Number(state.globalAlpha), stops });
    };
    const gradient = () => {
        const stops: Array<[number, string]> = [];
        return { stops, label: 'gradient', addColorStop: (o: number, c: string) => { stops.push([o, c]); } };
    };
    const ctx = new Proxy(state, {
        get: (t, name: string) => {
            if (name === 'stroke') return make('stroke');
            if (name === 'fill' || name === 'fillRect') return make('fill');
            if (name === 'createLinearGradient' || name === 'createRadialGradient') return gradient;
            if (name in t) return t[name];
            return () => undefined;
        },
        set: (t, name: string, v) => { t[name] = v; return true; },
    });
    return { ctx: ctx as unknown as CanvasRenderingContext2D, ops };
}

const alphaOf = (colour: string): number => Number(/rgba\([^)]*,([\d.]+)\)$/.exec(colour)?.[1] ?? 1);
const brightness = (colour: string): number => {
    const [r, g, b] = /rgba?\((\d+),(\d+),(\d+)/.exec(colour)!.slice(1).map(Number);
    return Math.max(r, g, b);
};

function drawn(build: AttackBuild, age: number): Op[] {
    const { ctx, ops } = recorder();
    build.effect.draw(ctx, age);
    return ops;
}

describe('194k-3 — the rim colour', () => {
    it('is the element colour at 30% brightness', () => {
        expect(RIM_BRIGHTNESS).toBe(0.3);
        expect(rimOf([200, 100, 50], 0.5)).toBe('rgba(60,30,15,0.5)');
    });

    it('the glow sprite has a white centre, an element body and a dark rim that fades to nothing', () => {
        const stops = glowStops([224, 93, 67]);
        expect(stops[0]).toEqual([0, 'rgba(255,255,255,1)']);
        expect(stops[1][1]).toBe('rgba(224,93,67,1)');
        const rim = stops[stops.length - 2][1];
        expect(brightness(rim)).toBeLessThanOrEqual(Math.round(224 * RIM_BRIGHTNESS));
        expect(alphaOf(stops[stops.length - 1][1])).toBe(0);
    });

    it('the particle ramp sprite has a white centre and a dark outer ring too', () => {
        const stops = rampStops([255, 200, 110]);
        expect(stops[0]).toEqual([0, 'rgba(255,255,255,1)']);
        expect(stops[1][0]).toBeLessThan(0.34);
        expect(brightness(stops[stops.length - 2][1])).toBeLessThanOrEqual(Math.round(255 * RIM_BRIGHTNESS));
        expect(alphaOf(stops[stops.length - 1][1])).toBe(0);
        expect(stops.map((s) => s[0])).toEqual([...stops.map((s) => s[0])].sort((a, b) => a - b));
    });
});

describe('194k-3 — the flame beam', () => {
    const strokes = (age: number): Op[] => drawn(flameBeam(input()), age).filter((o) => o.kind === 'stroke');

    it('draws four layers, widest first: rim, body, mid, core', () => {
        const s = strokes(500);
        expect(s).toHaveLength(4);
        const widths = s.map((o) => o.width);
        expect(widths).toEqual([...widths].sort((a, b) => b - a));
    });

    it('the widest stroke is the dark rim, in ordinary blending, at 50% opacity or more', () => {
        const [rim] = strokes(500);
        expect(rim.blend).toBe('source-over');
        expect(alphaOf(rim.style)).toBeGreaterThanOrEqual(MIN_BODY_ALPHA);
        expect(brightness(rim.style)).toBeLessThan(120);
    });

    it('the outer body is no longer the lab\'s 20%: it is at least 50% opaque and brighter than the rim', () => {
        const [rim, outer] = strokes(500);
        expect(alphaOf(outer.style)).toBeGreaterThanOrEqual(MIN_BODY_ALPHA);
        expect(brightness(outer.style)).toBeGreaterThan(brightness(rim.style));
        expect(outer.blend).toBe(LIGHT_BLEND);
    });

    it('the core is the hottest layer and the narrowest', () => {
        const s = strokes(500);
        const core = s[s.length - 1];
        expect(brightness(core.style)).toBeGreaterThanOrEqual(240);
        expect(core.width).toBe(Math.min(...s.map((o) => o.width)));
    });
});

describe('194k-3 — the water jet', () => {
    const strokes = drawn(waterJet(input()), 500).filter((o) => o.kind === 'stroke');

    it('has a dark rim as its widest stroke, in ordinary blending', () => {
        const widest = strokes.reduce((a, b) => (b.width > a.width ? b : a));
        expect(widest).toBe(strokes[0]);
        expect(widest.blend).toBe('source-over');
        expect(brightness(widest.style)).toBeLessThan(80);
        expect(alphaOf(widest.style)).toBeGreaterThanOrEqual(MIN_BODY_ALPHA);
    });

    it('keeps an opaque body over the rim and a near-white core on top', () => {
        expect(strokes.length).toBeGreaterThanOrEqual(4);
        expect(alphaOf(strokes[1].style)).toBeGreaterThanOrEqual(MIN_BODY_ALPHA);
        expect(brightness(strokes[strokes.length - 1].style)).toBeGreaterThanOrEqual(230);
    });
});

describe('194k-3 — the tidal wave', () => {
    const ops = drawn(tidalWave(input()), 500);

    it('strokes a dark rim along the crest under the white foam line', () => {
        const strokes = ops.filter((o) => o.kind === 'stroke');
        expect(strokes.length).toBeGreaterThanOrEqual(2);
        expect(strokes[0].width).toBeGreaterThan(strokes[strokes.length - 1].width);
        expect(brightness(strokes[0].style)).toBeLessThan(80);
        expect(brightness(strokes[strokes.length - 1].style)).toBeGreaterThanOrEqual(235);
    });

    it('fills a body whose crest end is at least 50% opaque', () => {
        const fill = ops.find((o) => o.kind === 'fill')!;
        expect(Math.max(...fill.stops.map(([, c]) => alphaOf(c)))).toBeGreaterThanOrEqual(MIN_BODY_ALPHA);
    });
});

describe('194k-3 — the fire wall', () => {
    const ops = drawn(fireWall(input({ targets: [body('e1', 700, 200), body('e2', 700, 400)] })), 700).filter((o) => o.kind === 'fill');

    it('lays a dark base column, then an opaque body, then a hot core column', () => {
        expect(ops.length).toBeGreaterThanOrEqual(3);
        const peak = (op: Op): number => Math.max(...op.stops.map(([, c]) => alphaOf(c)));
        const bright = (op: Op): number => Math.max(...op.stops.map(([, c]) => brightness(c)));
        expect(ops[0].blend).toBe('source-over');
        expect(bright(ops[0])).toBeLessThan(100);
        expect(peak(ops[1])).toBeGreaterThanOrEqual(MIN_BODY_ALPHA);
        expect(bright(ops[ops.length - 1])).toBeGreaterThanOrEqual(240);
    });
});
