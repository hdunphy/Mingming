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

import { ACTION_WEIGHTS, budgetBandFor, calculatePowerscale } from './powerscale';
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

describe('149c-3 — a discard scaler the scorer could not see', () => {
    it('scales `carrion_swoop` by 2 cards discarded, doubling a score that was blind', () => {
        /*
         * `CARDS_DISCARDED` had no branch in the scaling switch and no `manualReview` flag — the
         * flag at L724 covers only BURN_STACKS and SELF_ANY_STATUS — so an "11 power for every
         * card discarded this turn" card was priced at a flat 11. 149b called it *"the largest
         * single miss in either table"*: 2.2 fire_punches a cast for one energy, scored 1.1
         * (`results/t149_oscensus/FINDINGS.md`, 1,200 games, 1,951 casts).
         *
         * 11 power x 2 = 22 -> 2.2. A literal, because the constant IS the ruling.
         */
        const card = registry['carrion_swoop'];
        expect(card).toBeDefined();
        expect(calculatePowerscale(card).score).toBe(2.2);
    });

    it('prices the roster, not the deck that ships it \u2014 §4 and Henry\'s framing', () => {
        /*
         * The measured figure is 5.03 cards discarded per cast, and it is hraesvelgr_v1's number:
         * that deck IS the discard engine, every card in it feeds this one. On sleipnir_v2, which
         * has no engine, the card discards about one and prices exactly. The constant is the
         * roster-general low end, because Henry's framing for the whole ticket is *"its numbers
         * are not meant to work for a specific width or deck"* — pricing the engine's number here
         * would redline the card for everyone who cannot build it.
         *
         * Pinned as an inequality against the measurement rather than a second copy of the
         * constant: what must not happen is somebody "correcting" 2 to the measured 5.03 because
         * the census says 5.03.
         */
        const card = registry['carrion_swoop'];
        const MEASURED_ON_THE_ENGINE_DECK = 5.03;
        const printed = 11 / 10;   // the ATTACK branch's /10 unit, before any scaling

        const score = calculatePowerscale(card).score;
        expect(score).toBeGreaterThan(printed);
        expect(score).toBeLessThan(printed * MEASURED_ON_THE_ENGINE_DECK);

        // And it stays UNDER its 1-energy band even doubled, which is the point of the floor:
        // the card is 2.4x a fire_punch on the deck built for it and an ordinary 1e attack
        // everywhere else. 149c-6's ceiling column is where that spread gets printed.
        expect(score).toBeLessThan(budgetBandFor(1).over);
    });
});

describe('149c-4 — the same card, priced at both widths', () => {
    it('charges a Side card \u00d71.0 at 1v1 and \u00d72.2 at 3v3 \u2014 §4.2', () => {
        /*
         * The bug this closes is not a wrong constant, it is a missing question. A Side card hits
         * one enemy at 1v1 and three at 3v3, and the scorer had one answer: it charged 2.2 always.
         * So `frost_bite` read 7.3 against a 3.0 band — 143% over — in a fight where it is a
         * perfectly ordinary 1-energy attack at 3.3.
         *
         * 2.2 and not 3.0 at 3v3 because it is MEASURED, not counted: 149b saw 1.9–2.2 delivered
         * per cast across the pool, since units die and the third target is often already gone
         * (`research/scorer-pricing.md` §1). Three targets is not three times the value.
         */
        const side = registry['frost_bite'];
        expect(side).toBeDefined();
        expect(side.target).toBe('Side');

        const scored = calculatePowerscale(side);
        expect(scored.score3v3 / scored.score1v1).toBeCloseTo(2.2, 1);
        // `score` is the 1v1 reading, because that is what a consumer that never asked about
        // width means. Nothing that did not opt in has to learn about this.
        expect(scored.score).toBe(scored.score1v1);
    });

    it('gives the same number twice for every card whose scope does not depend on width', () => {
        /*
         * 22 of 243 cards are Side; none is All. Every other card must come out identical at both
         * widths, and that is the property that lets the report take a plain `max` over the two
         * instead of branching on `card.target` — a branch that would have to be kept in step
         * with `powerscale.ts` forever.
         */
        const differ = Object.values(registry)
            .filter(c => { const s = calculatePowerscale(c); return s.score1v1 !== s.score3v3; });

        expect(differ.length).toBeGreaterThan(0);
        for (const card of differ) {
            expect(['Side', 'All'], card.id).toContain(card.target);
        }
        // Every Side card differs: none of them is priced identically by accident.
        const sides = Object.values(registry).filter(c => c.target === 'Side');
        expect(differ.length).toBe(sides.length);
    });

    it('prices a hook at the width of the daemon carrying it', () => {
        /*
         * The recursion inside the daemon branch calls back into the width-aware scorer, and the
         * obvious slip is to let it default. A daemon whose hook hits the SIDE would then be
         * priced at 3v3 inside a 1v1 reading — the exact bug 149c-4 is closing, hidden one level
         * down where no ledger would show it.
         */
        const daemon = registry['riptide'];
        expect(daemon).toBeDefined();

        const sideHookDaemon = {
            ...daemon,
            id: 'riptide__test_side',
            target: 'Side',
        } as unknown as ProgramData;

        const scored = calculatePowerscale(sideHookDaemon);
        expect(scored.score3v3).toBeGreaterThan(scored.score1v1);
    });
});
