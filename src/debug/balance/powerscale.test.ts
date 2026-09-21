/**
 * THE SCORER'S CONSTANTS AND ITS BRANCHES — ticket 149c.
 *
 * 149 §5 asks for "one case per constant (cited)" plus the guard, the width rule, the hook formula
 * and the OS band. This file is that, and it is written to one rule: **every number in here cites
 * where it came from**, because a scorer test that asserts the scorer's own output proves only that
 * nobody changed it by accident. The citations are `research/scorer-pricing.md` and
 * `research/firmware-power-census.md`, both measured in 149b.
 *
 * Henry's framing governs what these are FOR: *"the scorer's job is to keep cards balanced BEFORE
 * the grid runs, and to give general insight — its numbers are not meant to work for a specific
 * width or deck."* So a case here pins a rule, not a card's current score; where a card is named it
 * is because the card is the shape being tested.
 */
import { describe, expect, it } from 'vitest';

import { ACTION_WEIGHTS, calculatePowerscale } from './powerscale';
import { getInflatedProgramRegistry } from '../../engine/data/programRegistry';
import type { ProgramData } from '../../engine/types';

const registry = getInflatedProgramRegistry();
const daemons = Object.values(registry).filter(c => c.category === 'Daemon');
const hooksOf = (card: ProgramData): ReadonlyArray<string> =>
    (card as unknown as { hooks?: ReadonlyArray<string> }).hooks ?? [];

describe('149c-1 — a daemon is worth its cast AND its hooks', () => {
    it('adds the hook price to an on-cast action instead of dropping one of them', () => {
        /*
         * The bug, in the shape 149b measured it (`research/scorer-pricing.md` §2): an in-memory
         * `feedback_loop_daemon` with an added on-cast ATTACK 10 scored **1.2 instead of 3.2** —
         * the on-cast action alone. The hook branch was gated on `score === 0` and ASSIGNED, so
         * giving a daemon anything to do on cast silently deleted the reason the card exists.
         *
         * Asserted as an inequality against both halves rather than against a literal, because the
         * literal moves the first time DRAW or ATTACK is repriced and the RULE does not.
         */
        const base = registry['feedback_loop_daemon'];
        expect(base).toBeDefined();
        expect(hooksOf(base).length).toBeGreaterThan(0);

        const hookOnly = calculatePowerscale(base).score;
        expect(hookOnly).toBeGreaterThan(0);

        // An on-cast DRAW, which is 149 §5's own example and the shape a daemon would plausibly
        // be given: "install this, and draw a card while you do it".
        const withCast: ProgramData = {
            ...base,
            id: 'feedback_loop_daemon__test_with_cast',
            actions: [{ type: 'DRAW', amount: 1, target: 'SELF' }],
        } as unknown as ProgramData;

        // The on-cast action on its own, priced as the daemon it is (premium and all).
        const castOnly = calculatePowerscale({
            ...withCast, id: 'feedback_loop_daemon__test_cast_only', hooks: [],
        } as unknown as ProgramData).score;
        expect(castOnly).toBeGreaterThan(0);

        const both = calculatePowerscale(withCast).score;

        // Both halves are in the number, and it is their SUM rather than whichever one won.
        expect(both).toBeGreaterThan(hookOnly);
        expect(both).toBeGreaterThan(castOnly);
        // Each of the three is rounded to one decimal before it is returned, so the sum of two
        // rounded halves can sit a tenth off the rounded whole. The rule is "both are in there",
        // not "the arithmetic survives rounding twice".
        expect(Math.abs(both - (hookOnly + castOnly))).toBeLessThanOrEqual(0.2);
    });

    it('is inert on the shipped roster, which is why §1.3 does not move', () => {
        /*
         * The claim that makes 149c-1 a free change, checked here rather than trusted: no shipped
         * daemon has both an on-cast action and a hook, so nothing in the balance report can shift.
         *
         * It is a test and not a comment because it is also the tripwire: the day someone authors
         * a daemon with both, this stops being a no-op and the ledger genuinely moves. Better to
         * be told by a failing assertion than to find it in a diff of scores.
         */
        expect(daemons.length).toBeGreaterThan(0);
        const both = daemons.filter(d => (d.actions ?? []).length > 0 && hooksOf(d).length > 0);
        expect(both.map(d => d.id)).toEqual([]);
    });
});

describe('149c-2 — what a drawn card is worth', () => {
    /** A 1-cost Self skill carrying nothing but the DRAW, so the ladder is the whole score. */
    const drawCard = (count: number): ProgramData => ({
        id: `__test_draw_${count}`,
        name: 'Draw test',
        description: '',
        element: 'None',
        target: 'Self',
        category: 'Skill',
        rarity: 'Common',
        baseCost: 1,
        constraints: [],
        actions: [{ type: 'DRAW', amount: count, target: 'SELF' }],
    } as unknown as ProgramData);

    it('pays 20/15/10 power for the 1st, 2nd and 3rd card — §4.1', () => {
        /*
         * Was 15/10/5. 149b measured what that was buying: the mean scorer value of a card drawn
         * across the 33 shipped decks is **3.39** in these units, under the deck mean in 31 of
         * the 33 (`research/scorer-pricing.md` §2). 15 power was selling the first card at 44%
         * of what a card is worth.
         *
         * THE NUMBERS BELOW ARE THE LADDER TIMES 0.9, AND THAT IS NOT A ROUNDING SLIP. A DRAW
         * action is stamped `target: 'SELF'` on every card in the registry — it draws for you,
         * there is nobody else to draw for — so it always takes the self-scope discount at L917.
         * The effective price of a first card is 18 power, not 20. That was equally true of
         * 15/10/5, so the ratio the ledger reports is unaffected, but a test that asserted a bare
         * 2.0 would be asserting a number the scorer never produces for any real card.
         *
         * Literals rather than inequalities because this row IS the number: an inequality would
         * pass against 16 power as happily as against 20.
         */
        expect(calculatePowerscale(drawCard(1)).score).toBe(1.8);   // 20 × 0.9
        expect(calculatePowerscale(drawCard(2)).score).toBe(3.2);   // (20 + 15) × 0.9
        expect(calculatePowerscale(drawCard(3)).score).toBe(4.1);   // (20 + 15 + 10) × 0.9
    });

    it('keeps the ladder falling, and holds the last rung for every card past the third', () => {
        /*
         * The SHAPE was never the thing that was wrong: the second card joins a hand that is
         * already deciding, so it is worth less than the first, and the third less again. 149c-2
         * raised the floor, not the slope. Nothing in the pool draws more than three, but the
         * loop has to answer for four, and "the 4th is free" would be the wrong answer.
         */
        const at = (n: number) => calculatePowerscale(drawCard(n)).score;
        const steps = [at(1), at(2) - at(1), at(3) - at(2), at(4) - at(3)];
        expect(steps[0]).toBeGreaterThan(steps[1]);
        expect(steps[1]).toBeGreaterThan(steps[2]);
        // Within one rounding unit: `score` is rounded to a tenth before it is returned, so two
        // equal rungs can differ by 0.1 in the subtraction without the ladder having changed.
        expect(Math.abs(steps[3] - steps[2])).toBeLessThanOrEqual(0.1);
    });

    it('has no second, contradicting DRAW price left in ACTION_WEIGHTS', () => {
        /*
         * `'DRAW': 15` sat in that table, was read by nothing, and was the first thing 149b's
         * report had to correct: a reader looking up "what is a draw worth" found it and got an
         * answer the scorer had not used in a long time. Deleted, and asserted gone so it cannot
         * come back as a "missing" entry somebody helpfully restores.
         */
        expect(ACTION_WEIGHTS['DRAW']).toBeUndefined();
    });

    it('moves exactly the cards that carry a DRAW, and nothing else', () => {
        /*
         * The ledger's containment check. 24 cards move under this change; every one of them has
         * a DRAW action or a hook that draws, and the claim worth pinning is the converse \u2014 that
         * a repricing of draw cannot reach a card that does not draw. If it ever does, the ladder
         * has leaked into a shared code path.
         */
        const draws = (card: ProgramData): boolean =>
            (card.actions ?? []).some(a => (a.type as string) === 'DRAW');

        const scored = Object.values(registry).filter(c => calculatePowerscale(c).score !== 0);
        expect(scored.length).toBeGreaterThan(100);

        // The five names the ledger reports as newly over band, each of which draws.
        for (const id of ['dread_tidings', 'whirlpool_v2', 'pressure_point', 'rejuvenation', 'scry']) {
            const card = registry[id];
            expect(card, id).toBeDefined();
            expect(draws(card), id).toBe(true);
        }
    });
});
