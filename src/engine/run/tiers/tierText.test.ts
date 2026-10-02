/** TICKET 169c — the offer screen's extra Driver line appears at tier 3 and only there. */

import { describe, expect, it } from 'vitest';

import { leaderDriverTierLine } from './tierText';

describe('leaderDriverTierLine', () => {
    it('is silent below tier 3', () => {
        for (const tier of [0, 1, 2]) expect(leaderDriverTierLine(tier)).toBeNull();
    });

    it('prints the ticket’s line at tier 3', () => {
        expect(leaderDriverTierLine(3)).toBe('Tier 3: active in all three gauntlet fights.');
    });
});
