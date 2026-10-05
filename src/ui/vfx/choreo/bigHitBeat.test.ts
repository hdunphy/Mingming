// @vitest-environment jsdom
/**
 * TICKET 190g - what a cast does for a big hit: charge the caster up, and dim the stage. Neither on a
 * small hit, neither on Snappy or Fast, no dim with the Flashes setting off, nothing for a status card.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { StageAnchors } from '../../hooks/useStageAnchors';
import { DEFAULT_SETTINGS, saveSettings } from '../../settings/settings';
import { battleClock, resetBattleClock } from '../clock/battleClockRuntime';
import type { BattleSpeedTier } from '../clock/battleSpeedTiers';
import { setParticleSink, setStageAnchors } from '../emit';
import { resetImpactFx, stageDim } from '../impact/impactRuntime';
import type { ParticleSeed } from '../particles';
import { buildCastBeat, emptyCast } from '../presenter/castBeat';
import { resetActiveTier, setActiveTier } from '../tiers/activeTier';
import { planAttack } from '../tiers/attackPlan';
import { profileFor } from '../tiers/tierProfiles';
import { DIM_PEAK } from './bigHit';

const rect = (x: number) => ({ x, y: 100, w: 190, h: 190 });
const ANCHORS = {
    slots: { a1: rect(100), e1: rect(900) },
    plaques: { a1: rect(20), e1: rect(1100) },
    reveal: rect(500), hand: rect(500), discard: rect(800), scale: 1,
} as unknown as StageAnchors;

let spawned: ParticleSeed[][];

beforeEach(() => {
    spawned = [];
    localStorage.clear();
    saveSettings(DEFAULT_SETTINGS);
    setStageAnchors(ANCHORS);
    setParticleSink({ spawn: (seeds) => { spawned.push([...seeds]); }, wake: () => undefined });
    resetActiveTier();
});
afterEach(() => {
    setParticleSink(null);
    setStageAnchors(null);
    resetImpactFx();
    resetBattleClock();
    resetActiveTier();
    localStorage.clear();
});

const hitFor = (percent: number, over: { attack?: boolean } = {}) => {
    const cast = emptyCast({ element: 'Fire', sourceId: 'a1', targetIds: ['e1'], doubled: false, resisted: false, ...over });
    cast.hits.push({ targetId: 'e1', applied: percent, maxHp: 100, isKill: false });
    return cast;
};
const labels = (cast: ReturnType<typeof hitFor>) => buildCastBeat(cast).actions.map((action) => action.label);

describe('190g - which hits charge and dim', () => {
    it('Showy: a 50% hit charges, a 60% hit also dims, a 30% hit does neither', () => {
        expect(labels(hitFor(30))).not.toContain('charge');
        expect(labels(hitFor(30))).not.toContain('dim');
        expect(labels(hitFor(55))).toContain('charge');
        expect(labels(hitFor(55))).not.toContain('dim');
        expect(labels(hitFor(70))).toContain('charge');
        expect(labels(hitFor(70))).toContain('dim');
    });

    it('Slow starts earlier: a 40% hit charges and dims', () => {
        setActiveTier('slow');
        expect(labels(hitFor(40))).toContain('charge');
        expect(labels(hitFor(40))).toContain('dim');
    });

    it('no charge and no dim on Snappy or Fast, however big the hit', () => {
        for (const tier of ['snappy', 'fast'] as BattleSpeedTier[]) {
            setActiveTier(tier);
            expect(labels(hitFor(100)), tier).not.toContain('charge');
            expect(labels(hitFor(100)), tier).not.toContain('dim');
        }
    });

    it('no dim with Flashes off, but the charge-up stays', () => {
        saveSettings({ ...DEFAULT_SETTINGS, flashes: false });
        expect(labels(hitFor(80))).not.toContain('dim');
        expect(labels(hitFor(80))).toContain('charge');
    });

    it('a card that deals no damage does neither', () => {
        const status = emptyCast({ element: 'None', sourceId: 'a1', targetIds: ['e1'], doubled: false, resisted: false, attack: false });
        expect(labels(status)).not.toContain('charge');
        expect(labels(status)).not.toContain('dim');
    });

    it('both start with the pose', () => {
        const beat = buildCastBeat(hitFor(80));
        const pose = beat.actions.find((action) => action.label === 'pose')!;
        for (const label of ['charge', 'dim']) expect(beat.actions.find((action) => action.label === label)!.at).toBe(pose.at);
    });
});

describe('190g - the dim and the charge, played', () => {
    it('the dim reaches 0.4 x s by the end of the wind-up and is gone after the knock-back', () => {
        const cast = hitFor(80);
        const plan = planAttack(profileFor('showy'), { damage: 80, maxHp: 100, isKill: false, contact: false });
        buildCastBeat(cast).actions.find((action) => action.label === 'dim')!.run();
        expect(stageDim.active).toBe(true);
        stageDim.step({ gameDt: plan.game.windupEndMs, frozen: false });
        expect(stageDim.opacity).toBeCloseTo(DIM_PEAK * plan.scale, 3);
        stageDim.step({ gameDt: plan.game.knockbackEndMs, frozen: false });
        expect(stageDim.opacity).toBe(0);
        expect(stageDim.active).toBe(false);
    });

    it('the charge throws sparks that end in the caster\'s mouth', () => {
        buildCastBeat(hitFor(80)).actions.find((action) => action.label === 'charge')!.run();
        const sparks = spawned.flat().filter((seed) => seed.shape === 'spark');
        expect(sparks.length).toBeGreaterThan(5);
        // a1 stands at x=100 (w 190), facing right: the mouth is in front of it.
        const ends = sparks.map((seed) => seed.path!(1));
        expect(new Set(ends.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)).size).toBe(1);
        expect(ends[0].x).toBeGreaterThan(100 + 95);
    });

    it('the sparks arrive as the wind-up ends', () => {
        buildCastBeat(hitFor(80)).actions.find((action) => action.label === 'charge')!.run();
        const plan = planAttack(profileFor('showy'), { damage: 80, maxHp: 100, isKill: false, contact: false });
        expect(spawned.flat()[0].life).toBe(Math.max(120, Math.round(plan.game.windupEndMs)));
    });

    it('the clock is untouched until the action runs', () => {
        buildCastBeat(hitFor(80));
        expect(stageDim.active).toBe(false);
        expect(battleClock.now).toBe(0);
    });
});
