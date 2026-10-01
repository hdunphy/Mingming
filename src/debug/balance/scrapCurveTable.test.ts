/**
 * The scrap curve's text table — ticket 174a. Only the shape: the numbers are `scrapCurve.test.ts`'s.
 */

import { describe, expect, it } from 'vitest';

import { appendRunEvent, emptyRunLog } from '../../engine/run/runLog';
import { formatByReason, formatScrapCurves } from './scrapCurveTable';

describe('scrapCurveTable', () => {
    it('lists reasons biggest first, and prints a dash for none', () => {
        expect(formatByReason({ sellRunCard: 5, addRunScrap: 80 })).toBe('addRunScrap 80, sellRunCard 5');
        expect(formatByReason({})).toBe('-');
    });

    it('skips a run with no fight and says so when nothing is left', () => {
        const log = appendRunEvent(emptyRunLog('s', 1), { kind: 'NODE_ENTERED', nodeKind: 'wild', biome: 0, layer: 1 },
            { seq: 1, fightIndex: 0, deckSize: 8, scrap: 45 });
        expect(formatScrapCurves([log])).toBe('No run in this file has a fight in it.');
    });
});
