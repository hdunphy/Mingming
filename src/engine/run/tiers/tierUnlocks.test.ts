/**
 * TICKET 169d — what a ranch's clears unlock.
 *
 * Henry's rulings (2026-09-29): beating any gym at tier N unlocks tier N+1 for EVERY gym; tier 0 is
 * always open; the top tier is 3. One achievement per gym for clearing it at tiers 1, 2 and 3 (nine
 * clears in all), read through `gymMastered`. Modifiers unlock after the first gym clear (D2).
 */

import { describe, expect, it } from 'vitest';

import { RanchStateSchema, type IRanchState } from '../../runTypes';
import { clearsByGym, gymMastered, modifiersUnlocked, unlockedTiers } from './tierUnlocks';

const ranch = (over: Partial<IRanchState> = {}): IRanchState => ({
    roster: [],
    blueprints: {},
    codex: { seen: [], played: [], species: [], assembled: [], os: [] },
    gymsCleared: [],
    highestTierCleared: 0,
    tierClears: {},
    seenTips: [],
    codexMilestones: [],
    ...over,
});

describe('unlockedTiers', () => {
    it('an empty ranch unlocks tier 0 only', () => {
        expect(unlockedTiers(ranch())).toEqual([0]);
    });

    it('a ranch whose only record is an old-save gymsCleared unlocks tiers 0 and 1', () => {
        expect(unlockedTiers(ranch({ gymsCleared: ['gym_tidewrack'] }))).toEqual([0, 1]);
    });

    it('a tier-1 clear on any gym unlocks tiers 0 to 2, for every gym', () => {
        expect(unlockedTiers(ranch({ gymsCleared: ['gym_rootfall'], tierClears: { gym_rootfall: [0, 1] } }))).toEqual([
            0, 1, 2,
        ]);
    });

    it('a tier-3 clear unlocks 0 to 3 and never 4', () => {
        const unlocked = unlockedTiers(ranch({ tierClears: { gym_emberfall: [0, 1, 2, 3] } }));
        expect(unlocked).toEqual([0, 1, 2, 3]);
        expect(unlocked).not.toContain(4);
    });

    it('uses the highest clear across gyms, not a per-gym one', () => {
        expect(unlockedTiers(ranch({ tierClears: { gym_emberfall: [0], gym_tidewrack: [0, 1, 2] } }))).toEqual([
            0, 1, 2, 3,
        ]);
    });
});

describe('clearsByGym', () => {
    it('counts an old save’s gymsCleared as a tier-0 clear', () => {
        expect(clearsByGym(ranch({ gymsCleared: ['gym_tidewrack'] }))).toEqual({ gym_tidewrack: [0] });
    });

    it('does not invent a tier-0 clear for a gym that already has a record', () => {
        expect(
            clearsByGym(ranch({ gymsCleared: ['gym_tidewrack'], tierClears: { gym_tidewrack: [2] } })),
        ).toEqual({ gym_tidewrack: [2] });
    });

    it('is empty for a fresh ranch', () => {
        expect(clearsByGym(ranch())).toEqual({});
    });
});

describe('gymMastered', () => {
    it('needs tiers 1, 2 and 3 on the SAME gym', () => {
        expect(gymMastered(ranch({ tierClears: { gym_emberfall: [0, 1, 2, 3] } }), 'gym_emberfall')).toBe(true);
        expect(gymMastered(ranch({ tierClears: { gym_emberfall: [1, 2] } }), 'gym_emberfall')).toBe(false);
        expect(
            gymMastered(
                ranch({ tierClears: { gym_emberfall: [1, 2], gym_tidewrack: [3] } }),
                'gym_emberfall',
            ),
        ).toBe(false);
    });

    it('does not need tier 0', () => {
        expect(gymMastered(ranch({ tierClears: { gym_rootfall: [1, 2, 3] } }), 'gym_rootfall')).toBe(true);
    });
});

describe('modifiersUnlocked', () => {
    it('is false on a fresh ranch and true after any gym clear', () => {
        expect(modifiersUnlocked(ranch())).toBe(false);
        expect(modifiersUnlocked(ranch({ gymsCleared: ['gym_rootfall'] }))).toBe(true);
        expect(modifiersUnlocked(ranch({ tierClears: { gym_rootfall: [0] } }))).toBe(true);
    });
});

describe('the save', () => {
    it('an old save without tierClears still loads, with none', () => {
        const parsed = RanchStateSchema.parse({ roster: [], gymsCleared: ['gym_emberfall'] });
        expect(parsed.tierClears).toEqual({});
    });

    it('rejects a malformed tierClears rather than quietly dropping it', () => {
        expect(() => RanchStateSchema.parse({ roster: [], tierClears: { gym_emberfall: [-1] } })).toThrow();
    });
});
