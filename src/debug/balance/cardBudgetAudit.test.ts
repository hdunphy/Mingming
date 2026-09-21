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

import { auditCardBudget } from './balanceReport';
import { budgetBandFor, calculatePowerscale } from './powerscale';
import { getInflatedProgramRegistry } from '../../engine/data/programRegistry';
import { numericBaseCost } from '../../engine/types';

const registry = getInflatedProgramRegistry();
const { entries, cardsAudited } = auditCardBudget();
const bySubject = new Map(entries.map(e => [e.id, e]));

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
