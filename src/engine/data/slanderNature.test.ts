/**
 * TICKET 167d — Slander is a Nature card, and Kraken v1 runs a second Crushing Depths.
 *
 * Henry, 2026-09-28: *"Water has two scaling, Crushing Depths and something else. The other one can
 * we just make that nature?"* and, on Kraken v1's copy: *"Replace with crushing depths I think."*
 * A Nature Dazed deck had only the binary "if the target is Dazed" payoffs and no per-stack scaler.
 */
import { describe, it, expect } from 'vitest';

import { ProgramRegistry } from './programRegistry';
import { getDeckForOS } from './mingmingRegistry';
import { rewardCardPool } from '../RewardSystem';

const RATATOSKR_V2_PARTY = [{ definitionId: 'ratatoskr', activeOS: 'ratatoskr_v2' }];
const KRAKEN_V1_PARTY = [{ definitionId: 'kraken', activeOS: 'kraken_v1' }];

describe('167d — Slander is Nature', () => {
    it('slander and slander+ are Nature cards', () => {
        expect(ProgramRegistry.slander.element).toBe('Nature');
        expect(ProgramRegistry['slander+'].element).toBe('Nature');
    });

    it('is offered to a Nature party and no longer to a Water one', () => {
        expect(rewardCardPool(RATATOSKR_V2_PARTY)).toContain('slander');
        expect(rewardCardPool(KRAKEN_V1_PARTY)).not.toContain('slander');
    });
});

describe('167d — Kraken v1 swaps its Slander for a second Crushing Depths', () => {
    it('holds no slander and exactly two crushing_depths', () => {
        const deck = getDeckForOS('kraken', 'kraken_v1');
        expect(deck).not.toContain('slander');
        expect(deck.filter((id) => id === 'crushing_depths')).toHaveLength(2);
    });
});
