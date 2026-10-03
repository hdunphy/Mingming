/**
 * TICKET 190d — the six element attacks and the field that holds them.
 *
 * Each effect returns one hit time per target (the moment it reaches that body), throws particles
 * only while it is pouring, draws without error at any point of its life, and is dropped by the
 * field when its time is up.
 */
import { describe, expect, it } from 'vitest';

import type { ParticleSeed } from '../particles';
import { attackFor } from './attackFor';
import type { AttackBuild, AttackInput, Body } from './AttackEffect';
import { EffectField } from './EffectField';
import { fireWall } from './fireWall';
import { flameBeam } from './flameBeam';
import { pollenCloud } from './pollenCloud';
import { tidalWave } from './tidalWave';
import { vine } from './vine';
import { waterJet } from './waterJet';

const body = (id: string, x: number, y = 100): Body => ({ id, x, y, w: 190, h: 190 });
const caster = body('ally', 100, 300);
const row = [body('e1', 900, 120), body('e2', 700, 300), body('e3', 800, 480)];

/** A steady "random" so a test is repeatable. */
const steady = (): number => 0.5;

const input = (over: Partial<AttackInput> = {}): AttackInput => ({
    caster, targets: [row[0]], direction: 1, headMs: 260, sustainMs: 600, s: 1, particleScale: 1.3, rng: steady, ...over,
});

/** Run an effect to the end in 16 ms frames, returning what it threw and what it asked to tremble. */
function run(build: AttackBuild): { seeds: ParticleSeed[]; tremble: string[]; spawnedAfterEnd: number } {
    const seeds: ParticleSeed[] = [];
    let spawnedAfterEnd = 0;
    for (let age = 16; age < build.effect.durationMs + 200; age += 16) {
        const before = seeds.length;
        build.effect.step(age, 16, (batch) => { seeds.push(...batch); });
        if (age > build.effect.durationMs) spawnedAfterEnd += seeds.length - before;
    }
    return { seeds, tremble: [], spawnedAfterEnd };
}

/** A canvas context that records its calls and does not need a browser. */
function fakeContext(): { ctx: CanvasRenderingContext2D; calls: string[] } {
    const calls: string[] = [];
    const gradient = { addColorStop: () => undefined };
    const ctx = new Proxy({} as Record<string, unknown>, {
        get: (target, name: string) => {
            if (name === 'createLinearGradient' || name === 'createRadialGradient') return () => gradient;
            if (name in target) return target[name];
            return (...args: unknown[]) => { calls.push(`${name}(${args.length})`); };
        },
        set: (target, name: string, value) => { target[name] = value; return true; },
    });
    return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const SINGLES = [['flame beam', flameBeam], ['water jet', waterJet], ['vine', vine]] as const;
const SPREADS = [['fire wall', fireWall], ['tidal wave', tidalWave], ['pollen cloud', pollenCloud]] as const;

describe('190d — a single-target attack', () => {
    for (const [name, make] of SINGLES) {
        describe(name, () => {
            it('hits its one target when the head has arrived and the pour is over', () => {
                const build = make(input());
                expect(build.hits).toEqual([{ targetId: 'e1', atMs: 860 }]);
            });

            it('runs longer for a longer pour (a bigger hit)', () => {
                const chip = make(input({ headMs: 180, sustainMs: 120, s: 0 }));
                const big = make(input({ headMs: 260, sustainMs: 600, s: 1 }));
                expect(big.effect.durationMs).toBeGreaterThan(chip.effect.durationMs + 400);
            });

            it('lives a little past the hit, for the tail to pull in', () => {
                const build = make(input());
                expect(build.effect.durationMs).toBeGreaterThan(860);
                expect(build.effect.durationMs).toBeLessThan(860 + 400);
            });

            it('throws particles while it is alive and none once it is over', () => {
                const { seeds, spawnedAfterEnd } = run(make(input()));
                expect(seeds.length).toBeGreaterThanOrEqual(2);
                expect(spawnedAfterEnd).toBe(0);
            });

            it('draws at the start, mid-pour and the end without error', () => {
                const build = make(input());
                for (const age of [1, 130, 400, 860, 940]) {
                    const { ctx, calls } = fakeContext();
                    build.effect.draw(ctx, age);
                    expect(calls.length).toBeGreaterThan(0);
                }
            });

            it('makes the target tremble while it pours, and not before the head arrives', () => {
                const trembles: Array<{ at: number; id: string }> = [];
                let now = 0;
                const build = make(input({ tremble: (id) => { trembles.push({ at: now, id }); } }));
                for (now = 16; now < build.effect.durationMs; now += 16) build.effect.step(now, 16, () => undefined);
                expect(trembles.length).toBeGreaterThan(0);
                expect(trembles.every((t) => t.id === 'e1')).toBe(true);
                expect(Math.min(...trembles.map((t) => t.at))).toBeGreaterThan(260);
            });

            it('throws fewer particles at a lower particle scale', () => {
                const many = run(make(input({ particleScale: 1.5 }))).seeds.length;
                const few = run(make(input({ particleScale: 0.85 }))).seeds.length;
                expect(many).toBeGreaterThanOrEqual(few);
                expect(many).toBeGreaterThan(0);
            });
        });
    }
});

describe('190d — a Side / All attack', () => {
    for (const [name, make] of SPREADS) {
        describe(name, () => {
            const build = make(input({ targets: row }));

            it('returns one hit time per target', () => {
                expect(build.hits.map((hit) => hit.targetId).sort()).toEqual(['e1', 'e2', 'e3']);
            });

            it('hits the bodies in order of distance from the caster', () => {
                const ids = build.hits.map((hit) => hit.targetId);
                expect(ids).toEqual(['e2', 'e3', 'e1']);
                for (let i = 1; i < build.hits.length; i += 1) expect(build.hits[i].atMs).toBeGreaterThanOrEqual(build.hits[i - 1].atMs);
            });

            it('lands every hit inside the effect', () => {
                for (const hit of build.hits) {
                    expect(hit.atMs).toBeGreaterThan(0);
                    expect(hit.atMs).toBeLessThanOrEqual(build.effect.durationMs);
                }
            });

            it('throws particles, stops after, and draws without error', () => {
                const { seeds, spawnedAfterEnd } = run(make(input({ targets: row })));
                expect(seeds.length).toBeGreaterThan(5);
                expect(spawnedAfterEnd).toBe(0);
                const { ctx } = fakeContext();
                for (const age of [1, 200, 500, 900, 1000]) build.effect.draw(ctx, age);
            });
        });
    }

    it('the wall and the wave reach the far body last, at the end of the pour', () => {
        for (const make of [fireWall, tidalWave]) {
            const hits = make(input({ targets: row })).hits;
            expect(hits[hits.length - 1].atMs).toBeLessThanOrEqual(860);
            expect(hits[hits.length - 1].atMs).toBeGreaterThan(hits[0].atMs);
        }
    });

    it('an enemy caster fires the other way: the wave starts on the right and sweeps left', () => {
        const enemy = body('foe', 1000, 300);
        const allies = [body('a1', 100, 120), body('a2', 300, 300), body('a3', 200, 480)];
        const hits = tidalWave(input({ caster: enemy, targets: allies, direction: -1 })).hits;
        expect(hits.map((hit) => hit.targetId)).toEqual(['a2', 'a3', 'a1']);
    });
});

describe('190d — which attack a card gets', () => {
    it('Fire, Water and Nature have a single and a spread attack', () => {
        expect(attackFor('Fire', 'single')).toBe(flameBeam);
        expect(attackFor('Fire', 'spread')).toBe(fireWall);
        expect(attackFor('Water', 'single')).toBe(waterJet);
        expect(attackFor('Water', 'spread')).toBe(tidalWave);
        expect(attackFor('Nature', 'single')).toBe(vine);
        expect(attackFor('Nature', 'spread')).toBe(pollenCloud);
    });

    it('the other elements keep the tinted streak', () => {
        for (const element of ['Earth', 'Ice', 'Air', 'Light', 'Dark', 'None']) {
            expect(attackFor(element, 'single')).toBeNull();
            expect(attackFor(element, 'spread')).toBeNull();
        }
    });
});

describe('190d — the effect field', () => {
    it('steps an effect, draws it, and drops it when its time is up', () => {
        const field = new EffectField();
        const build = flameBeam(input());
        field.add(build.effect);
        expect(field.count).toBe(1);
        const { ctx } = fakeContext();
        field.draw(ctx);
        let guard = 0;
        while (field.step(16, () => undefined) > 0 && guard < 1_000) guard += 1;
        expect(field.count).toBe(0);
        expect(guard).toBeGreaterThan(40);
    });

    it('holds still while the clock is frozen (a hit-stop)', () => {
        const field = new EffectField();
        const seeds: ParticleSeed[] = [];
        field.add(flameBeam(input()).effect);
        field.step(0, (batch) => { seeds.push(...batch); });
        field.step(0, (batch) => { seeds.push(...batch); });
        expect(seeds).toHaveLength(0);
        expect(field.count).toBe(1);
    });

    it('clears everything', () => {
        const field = new EffectField();
        field.add(vine(input()).effect);
        field.clear();
        expect(field.count).toBe(0);
    });
});
