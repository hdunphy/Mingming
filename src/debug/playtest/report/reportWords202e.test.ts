/**
 * TICKET 202e — the morning report's words.
 *
 * The run lines said "scrap left" after 195e-1 renamed the currency to amber, and the first report after
 * 195k was to carry a note that win rates cannot be compared with earlier nights. Pinned here: no old
 * currency word in the report, and the note is always there, under the party table. Nothing else about
 * the report's wording is pinned.
 */
import { describe, expect, it } from 'vitest';

import type { RunFact } from './facts';
import { renderReport } from './render';

const stub = (over: Partial<RunFact> = {}): RunFact => ({
    session: 'r01', header: { seed: 's', starter: 'x', gymIndex: 0, mode: 'run', tier: 0, modifiers: [], moves: [], notes: [] },
    starter: 'Kraken', gym: 'Emberfall', outcome: 'defeat', fights: 1, biome: '1 of 3', deckSize: 8, scrap: 45, decisions: 4,
    partySize: 1, blueprints: 0, endedAt: 'Elite', reachedGym: false,
    findings: [], notes: [], choices: [], shelfOffers: [], ...over,
});

describe('202e — the morning report', () => {
    it('says amber, not scrap, on the run lines', () => {
        const text = renderReport('2026-10-06', [stub(), stub({ session: 'r02', scrap: 0 })]);
        expect(text).not.toMatch(/scrap/i);
        expect(text).toContain('45 amber');
    });

    it('carries the not-comparable note under the party table, on any night', () => {
        const note = 'Not comparable with nights before 2026-10-06 (195k changed the gym matchups; 195h made the gauntlet carry HP).';
        for (const date of ['2026-10-06', '2026-10-09', '2026-11-01']) {
            const text = renderReport(date, [stub()]);
            expect(text).toContain(note);
            expect(text.indexOf('Party at the end')).toBeLessThan(text.indexOf(note));
            expect(text.indexOf(note)).toBeLessThan(text.indexOf('## Invariant failures'));
        }
    });

    it('carries the note on a night with no runs too', () => {
        expect(renderReport('2026-10-06', [])).toContain('Not comparable with nights before 2026-10-06');
    });
});
