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

import { calculatePowerscale } from './powerscale';
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
