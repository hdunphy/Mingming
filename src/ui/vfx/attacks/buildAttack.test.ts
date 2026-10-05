/**
 * TICKET 190d — a cast gets the attack of its element and shape, sized by the hit and the tier, or
 * nothing (and the old streak) when it has none.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { setStageAnchors } from '../emit';
import type { StageAnchors } from '../../hooks/useStageAnchors';
import { TIER_PROFILES } from '../tiers/tierProfiles';
import { buildCastAttack, type CastAttackInput } from './buildAttack';

const rect = (x: number, y = 100) => ({ x, y, w: 190, h: 190 });
const ANCHORS = {
    slots: { ally: rect(100, 300), e1: rect(900, 120), e2: rect(700, 300), e3: rect(800, 480) },
    plaques: {}, reveal: rect(500), hand: rect(500), discard: rect(800), scale: 1,
} as unknown as StageAnchors;

const base: CastAttackInput = {
    element: 'Fire', spread: false, sourceId: 'ally', targetIds: ['e1'], direction: 1, profile: TIER_PROFILES.showy, scale: 1,
};

beforeEach(() => setStageAnchors(ANCHORS));
afterEach(() => setStageAnchors(null));

describe('190d — buildCastAttack', () => {
    it('sizes the pour from the tier profile and the hit: Showy at full is 260 + 600', () => {
        expect(buildCastAttack(base)!.hits).toEqual([{ targetId: 'e1', atMs: 860 }]);
    });

    it('is shorter on Snappy (180 + 200) and longer on Slow (1.3 x)', () => {
        expect(buildCastAttack({ ...base, profile: TIER_PROFILES.snappy })!.hits[0].atMs).toBe(380);
        expect(buildCastAttack({ ...base, profile: TIER_PROFILES.slow })!.hits[0].atMs).toBeCloseTo(1.3 * 860);
    });

    it('is shorter for a chip', () => {
        expect(buildCastAttack({ ...base, scale: 0 })!.hits[0].atMs).toBe(300);
    });

    it('picks the spread attack for a Side / All card and hits every body', () => {
        const build = buildCastAttack({ ...base, spread: true, targetIds: ['e1', 'e2', 'e3'] })!;
        expect(build.hits.map((hit) => hit.targetId).sort()).toEqual(['e1', 'e2', 'e3']);
    });

    it('answers null for an element with no attack of its own', () => {
        for (const element of ['None', 'Earth', 'Ice', 'Air', 'Light', 'Dark']) expect(buildCastAttack({ ...base, element })).toBeNull();
    });

    it('answers null when the stage is not mounted or a body is unknown', () => {
        expect(buildCastAttack({ ...base, targetIds: ['nobody'] })).toBeNull();
        setStageAnchors(null);
        expect(buildCastAttack(base)).toBeNull();
    });

    it('answers null with nobody to hit', () => {
        expect(buildCastAttack({ ...base, targetIds: [] })).toBeNull();
    });
});
