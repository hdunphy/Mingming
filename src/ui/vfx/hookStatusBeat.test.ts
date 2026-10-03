/**
 * TICKET 171f — the words and the clock of a hook's own status beat.
 */
import { describe, expect, it } from 'vitest';

import { HOOK_BEAT_DELAY_MS, hookBeatLabel, hookFloatText, isHookStatus } from './hookStatusBeat';
import { FLIGHT_MS } from './useCastSequence';
import { TRAIL_MS } from './trails';

describe('the hook status beat (ticket 171f)', () => {
    it('names the firmware that added the status', () => {
        expect(hookBeatLabel('skoll_v2', undefined)).toBe('Ember Fuse');
        expect(hookFloatText('Burn', 1, 'EMBER_FUSE')).toBe('+1 Burn · EMBER_FUSE');
        expect(hookFloatText('Burn', 3, 'EMBER_FUSE')).toBe('+3 Burn · EMBER_FUSE');
        expect(hookFloatText('DarkStance', 1, undefined)).toBe('+1 Dark Stance');
    });

    it('only claims statuses a hook applied', () => {
        expect(isHookStatus({ kind: 'os', id: 'skoll_v2', ownerId: 'p1', hookId: 'skoll_v2_ember_fuse' })).toBe(true);
        expect(isHookStatus({ kind: 'card', id: 'ember_jab', ownerId: 'p1' })).toBe(false);
        expect(isHookStatus(undefined)).toBe(false);
    });

    it('lands after the card has hit, so it reads as a second beat', () => {
        expect(HOOK_BEAT_DELAY_MS).toBeGreaterThan(FLIGHT_MS + TRAIL_MS);
    });
});
