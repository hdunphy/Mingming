// @vitest-environment jsdom
/**
 * TICKET 190e - what a cast does at its impacts: one beat per body, each sized by what THAT body took.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { StageAnchors } from '../../hooks/useStageAnchors';
import { setParticleSink, setStageAnchors } from '../emit';
import type { ParticleSeed } from '../particles';
import { buildCastBeat, emptyCast } from '../presenter/castBeat';
import { activeProfile, resetActiveTier } from '../tiers/activeTier';
import { damageScale } from '../tiers/tierProfiles';
import { impactCount } from './impactCount';

const rect = (x: number) => ({ x, y: 100, w: 190, h: 190 });
const ANCHORS = {
    slots: { a1: rect(100), e1: rect(900), e2: rect(920), e3: rect(940) },
    plaques: { a1: rect(20), e1: rect(1100), e2: rect(1110), e3: rect(1120) },
    reveal: rect(500), hand: rect(500), discard: rect(800), scale: 1,
} as unknown as StageAnchors;

let spawned: ParticleSeed[][];

beforeEach(() => {
    spawned = [];
    setStageAnchors(ANCHORS);
    setParticleSink({ spawn: (seeds) => { spawned.push([...seeds]); }, wake: () => undefined });
    resetActiveTier();
});
afterEach(() => {
    setParticleSink(null);
    setStageAnchors(null);
});

const hitOn = (targetId: string, applied: number, isKill = false) => ({ targetId, applied, maxHp: 100, isKill });

describe('190e - a multi-target card gives every body its own impact', () => {
    it('a three-target card is three impact beats, in three different moments', () => {
        const cast = emptyCast({
            element: 'Fire', sourceId: 'a1', targetIds: ['e1', 'e2', 'e3'], doubled: false, resisted: false, spread: true,
        });
        cast.hits.push(hitOn('e1', 10), hitOn('e2', 10), hitOn('e3', 10));
        const impacts = buildCastBeat(cast).actions.filter((action) => action.label === 'impact');
        expect(impacts).toHaveLength(3);
        expect(new Set(impacts.map((action) => action.at)).size).toBe(3);
    });

    it('each beat is sized by what its own body took', () => {
        const cast = emptyCast({
            element: 'Fire', sourceId: 'a1', targetIds: ['e1', 'e2'], doubled: false, resisted: false,
        });
        cast.hits.push(hitOn('e1', 5), hitOn('e2', 45));
        for (const action of buildCastBeat(cast).actions.filter((a) => a.label === 'impact')) action.run();

        const embers = spawned.map((seeds) => seeds.filter((seed) => seed.shape === 'glow').length);
        const scale = activeProfile().particleScale;
        expect(embers).toEqual([
            impactCount(damageScale(5, 100), 'normal', scale),
            impactCount(damageScale(45, 100), 'normal', scale),
        ]);
        expect(embers[1]).toBeGreaterThan(embers[0]);
    });

    it('a super-effective card gives every body the white ring and the eight stars', () => {
        const cast = emptyCast({
            element: 'Water', sourceId: 'a1', targetIds: ['e1', 'e2'], doubled: true, resisted: false,
        });
        cast.hits.push(hitOn('e1', 20), hitOn('e2', 20));
        for (const action of buildCastBeat(cast).actions.filter((a) => a.label === 'impact')) action.run();
        for (const seeds of spawned) {
            expect(seeds.some((seed) => seed.shape === 'ring' && seed.g >= 250)).toBe(true);
            expect(seeds.filter((seed) => seed.shape === 'star').length).toBe(8);
        }
    });

    it('a kill rings white; the burst goes away from the attacker', () => {
        const cast = emptyCast({
            element: 'Fire', sourceId: 'a1', targetIds: ['e1'], doubled: false, resisted: false,
        });
        cast.hits.push(hitOn('e1', 100, true));
        for (const action of buildCastBeat(cast).actions.filter((a) => a.label === 'impact')) action.run();
        const seeds = spawned[0];
        expect(seeds.some((seed) => seed.shape === 'ring' && seed.g >= 250)).toBe(true);
        // a1 stands at x=100, e1 at x=900: the embers fly to the right.
        expect(seeds.filter((seed) => seed.shape === 'flame').every((seed) => seed.vx > 0)).toBe(true);
    });
});
