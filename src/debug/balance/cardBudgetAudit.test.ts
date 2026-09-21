/**
 * SECTION 1.3's VERDICT RULE — ticket 149c-4.
 *
 * `auditCardBudget` had no test at all, which is how the width bug survived: the function is one
 * comparison, and one comparison is exactly the kind of thing everybody reads and nobody checks.
 *
 * What is checked here is the RULE, not the current contents of the over-budget list. A card's
 * score is §5's business and moves every time a constant is re-measured; which number the verdict
 * is taken against is a decision, and decisions are what tests are for.
 */
import { describe, expect, it } from 'vitest';

import { auditCardBudget, budgetRedline } from './balanceReport';
import { BAND_TOLERANCE_PCT, bandVerdict, budgetBandFor, calculatePowerscale } from './powerscale';
import { getInflatedProgramRegistry } from '../../engine/data/programRegistry';
import { numericBaseCost } from '../../engine/types';

const registry = getInflatedProgramRegistry();
const { redlines: entries, watchlist, cardsAudited } = auditCardBudget();
const bySubject = new Map([...entries, ...watchlist].map(e => [e.id, e] as const));

describe('149c-4 — which width the band verdict is taken against', () => {
    it('audits the whole registry and reports only what is over', () => {
        expect(cardsAudited).toBe(Object.keys(registry).length);
        expect(entries.length).toBeGreaterThan(0);
        expect(entries.length).toBeLessThan(cardsAudited);
        for (const entry of entries) expect(entry.score).toBeGreaterThan(entry.budget);
    });

    it('judges a Side card on the WORSE of its two widths', () => {
        /*
         * §4.2: *"the band verdict is against `score1v1` unless the card is `Side`/`All`, where
         * both are printed and the verdict is the worse of the two."*
         *
         * "Worse" is the HIGHER number, because both widths are judged against the same band —
         * the band is a property of the card's energy cost, not of the fight. So a Side card
         * that is fine at 1v1 and egregious at 3v3 stays on the list, which is the whole reason
         * this is not simply "score everything at 1v1".
         */
        const sides = Object.values(registry).filter(c => c.target === 'Side' || c.target === 'All');
        expect(sides.length).toBeGreaterThan(0);

        let judgedOnTheWideReading = 0;
        for (const card of sides) {
            const scored = calculatePowerscale(card);
            const band = budgetBandFor(numericBaseCost(card.baseCost)).over;
            const worse = Math.max(scored.score1v1, scored.score3v3);
            const entry = bySubject.get(card.id);

            if (worse > band) {
                expect(entry, card.id).toBeDefined();
                expect(entry!.score, card.id).toBe(worse);
                expect(entry!.width, card.id).toBe('both');
                if (scored.score1v1 <= band) judgedOnTheWideReading += 1;
            } else {
                expect(entry, card.id).toBeUndefined();
            }
        }

        // And it is not a rule with nothing behind it: there are real cards on the list that
        // clear their band at 1v1 and only fail at 3v3. If this ever reaches zero, either the
        // pool changed or the width rule stopped doing anything.
        expect(judgedOnTheWideReading).toBeGreaterThan(0);
    });

    it('judges everything else at 1v1, and says so by not claiming a width', () => {
        for (const entry of entries) {
            const card = registry[entry.id];
            if (card.target === 'Side' || card.target === 'All') continue;
            expect(entry.width, entry.id).toBe('1v1');
            expect(entry.score1v1, entry.id).toBe(entry.score3v3);
            expect(entry.score, entry.id).toBe(entry.score1v1);
        }
    });

    it('is sorted worst-first and stably, so a report diff is readable', () => {
        // Equal scores never reorder between runs — the report is committed, and a reshuffled
        // list reads as a change when nothing changed.
        for (let i = 1; i < entries.length; i += 1) {
            const previous = entries[i - 1];
            const current = entries[i];
            expect(previous.overBudgetBy >= current.overBudgetBy).toBe(true);
            if (previous.overBudgetBy === current.overBudgetBy) {
                expect(previous.id < current.id).toBe(true);
            }
        }
    });
});

describe('149c-5 — redlined, watched, or neither', () => {
    it('redlines only what is past the tolerance, and watches what is inside it', () => {
        /*
         * The split section 4.3 asks for. Before it, every card past its band by any amount was
         * a redline: 71 of 243 cards, of which 35 were over by 15% or less. A list where a card
         * 3% over sits beside one 573% over is a list nobody can triage.
         */
        for (const entry of entries) {
            expect(entry.verdict, entry.id).toBe('OUT OF BAND');
            expect(entry.pctVsBand, entry.id).toBeGreaterThan(BAND_TOLERANCE_PCT);
        }
        for (const entry of watchlist) {
            expect(['WITHIN TOLERANCE', 'MANUAL REVIEW'], entry.id).toContain(entry.verdict);
            if (entry.verdict === 'WITHIN TOLERANCE') {
                expect(entry.pctVsBand, entry.id).toBeGreaterThan(0);
                expect(entry.pctVsBand, entry.id).toBeLessThanOrEqual(BAND_TOLERANCE_PCT);
            }
        }
        // Both lists have real cards in them: a tolerance that caught nothing, or caught
        // everything, would pass the two loops above and mean nothing.
        expect(entries.length).toBeGreaterThan(0);
        expect(watchlist.filter(e => e.verdict === 'WITHIN TOLERANCE').length).toBeGreaterThan(0);
        expect(watchlist.filter(e => e.verdict === 'MANUAL REVIEW').length).toBeGreaterThan(0);
    });

    it('leaves an in-band card out of both lists entirely', () => {
        const reported = new Set([...entries, ...watchlist].map(e => e.id));
        let inBand = 0;
        for (const card of Object.values(registry)) {
            const band = budgetBandFor(numericBaseCost(card.baseCost)).over;
            const scored = calculatePowerscale(card);
            const verdict = bandVerdict(Math.max(scored.score1v1, scored.score3v3), band);
            if (verdict.state !== 'IN BAND') continue;
            inBand += 1;
            expect(reported.has(card.id), card.id).toBe(false);
        }
        // Most of the pool is in band, and that is the headline the report should be able to make.
        expect(inBand).toBeGreaterThan(cardsAudited / 2);
    });

    it('carries the percentage into the redline text, where a reader will actually see it', () => {
        // §4.3: "the percentage always printed". The JSON having a field is not the same as the
        // human-readable line saying it, and the line is what lands in the CSV and the console.
        for (const entry of entries.slice(0, 5)) {
            const line = budgetRedline(entry).detail;
            expect(line, entry.id).toContain(`${entry.pctVsBand}%`);
            expect(line, entry.id).toContain('OUT OF BAND');
        }
    });
});
