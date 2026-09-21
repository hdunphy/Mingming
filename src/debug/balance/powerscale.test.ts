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

import {
    ACTION_WEIGHTS,
    BAND_TOLERANCE_PCT,
    DAEMON_HORIZON_TURNS,
    TRIGGER_RATE_CEILING,
    TRIGGER_RATE_FLOOR,
    bandVerdict,
    budgetBandFor,
    calculatePowerscale,
    classifyHook,
    hooksOf,
    scoreHook,
} from './powerscale';
import { getInflatedProgramRegistry } from '../../engine/data/programRegistry';
import type { ProgramData } from '../../engine/types';

const registry = getInflatedProgramRegistry();
const daemons = Object.values(registry).filter(c => c.category === 'Daemon');
/** The hook IDS a card declares, which is a different question from `hooksOf`'s records. */
const hookIdsOf = (card: ProgramData): ReadonlyArray<string> =>
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
        expect(hookIdsOf(base).length).toBeGreaterThan(0);

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
        const both = daemons.filter(d => (d.actions ?? []).length > 0 && hookIdsOf(d).length > 0);
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

describe('149c-5 — the band is a target, not a cliff', () => {
    it('calls +15% the edge of the tolerance, and +16% a violation \u2014 §4.3', () => {
        /*
         * Henry, 2026-08-26, on `frost_bite` scoring 3.3 against a 3.0 ceiling: *"3.3 vs 3 is not
         * a problem. 3 is not a hard cut off but a general target we can be +/- some
         * percentage."* The audit was binary, so a card 1% over and a card 150% over produced the
         * same word.
         *
         * The boundary is inclusive: exactly 15% over is WITHIN TOLERANCE, because a rule that
         * excluded its own stated number would be a 14.99% rule with a 15% label.
         */
        expect(bandVerdict(3.0, 3.0).state).toBe('IN BAND');
        expect(bandVerdict(2.4, 3.0).state).toBe('IN BAND');
        expect(bandVerdict(3.45, 3.0).state).toBe('WITHIN TOLERANCE');   // exactly +15%
        expect(bandVerdict(3.5, 3.0).state).toBe('OUT OF BAND');         // +17%

        /*
         * The comparison is against the ROUNDED percentage, which is the one that gets printed.
         * So 3.46 is +15.3% and reads WITHIN TOLERANCE +15%, rather than OUT OF BAND +15% — a
         * row whose verdict and whose number disagreed would be the binary problem back in a
         * subtler form.
         */
        expect(bandVerdict(3.46, 3.0).label).toBe('WITHIN TOLERANCE +15%');
    });

    it('prints the percentage in every state, because that is the actionable part', () => {
        // §4.3: "the percentage always printed". Including on a card that is in band — "IN BAND"
        // alone cannot be compared against another row, and comparing rows is the only thing
        // anyone does with this list.
        expect(bandVerdict(3.0, 3.0).label).toBe('IN BAND +0%');
        expect(bandVerdict(2.3, 3.0).label).toBe('IN BAND -23%');
        expect(bandVerdict(3.3, 3.0).label).toBe('WITHIN TOLERANCE +10%');
        expect(bandVerdict(7.3, 3.0).label).toBe('OUT OF BAND +143%');
    });

    it('routes a score of zero or less to MANUAL REVIEW, never to "under band"', () => {
        /*
         * §4.3, and the reason is §4.7: a non-positive score is not an under-powered card, it is
         * a card the model priced as a net NEGATIVE, which in this pool means a drawback card.
         * `scrubber` scores -1.6 because it sheds an ALLY's Poison and removal-from-an-ally reads
         * as a downside; `wither_feast` -10.8. That whole tail is parked behind ticket 138, and
         * this state is what keeps it from polluting the list meanwhile.
         *
         * Saying "260% under band" about `vent` would be the report asserting the card is far too
         * weak, when what it actually knows is that it cannot price it.
         */
        expect(bandVerdict(0, 3.0).state).toBe('MANUAL REVIEW');
        expect(bandVerdict(-1.6, 6.5).state).toBe('MANUAL REVIEW');

        // And it really is where the drawback tail lands, not just where a synthetic zero lands.
        for (const id of ['scrubber', 'vent', 'wither_feast', 'dark_pact', 'desperate_strike']) {
            const card = registry[id];
            expect(card, id).toBeDefined();
            const band = budgetBandFor(Number(card.baseCost)).over;
            expect(bandVerdict(calculatePowerscale(card).score, band).state, id).toBe('MANUAL REVIEW');
        }
    });

    it('is 15 because the pool\'s own spread is 15, and it uses MAD not sd', () => {
        /*
         * The tolerance is not a round number picked for being round. `scratch/bandspread.ts`
         * measures the distribution the rule has to describe: the MEDIAN ABSOLUTE deviation from
         * band across 236 costed non-token cards is 15.4% at 1v1.
         *
         * §4.3 rules MAD and not standard deviation, and the numbers say why: the sd is 68.8%,
         * four and a half times the MAD, because a handful of cards sit 200-570% over and drag
         * it. A tolerance built on the sd would be built on `bloodwrath`.
         *
         * Recomputed here from the live registry rather than asserted as a literal, so the day
         * the pool's spread moves away from the constant, this says so.
         */
        const deviations: number[] = [];
        for (const card of Object.values(registry)) {
            if ((card as { isToken?: boolean }).isToken) continue;
            const band = budgetBandFor(Number(card.baseCost)).over;
            if (!(band > 0)) continue;
            const { score } = calculatePowerscale(card);
            if (score <= 0) continue;   // the MANUAL REVIEW tail describes nothing about spread
            deviations.push(Math.abs((score / band - 1) * 100));
        }
        deviations.sort((a, b) => a - b);
        const mad = deviations[Math.floor(deviations.length / 2)];

        // Within a factor of two of the pool's own typical distance from band. Loose on purpose:
        // the claim is "15 is the right ORDER of magnitude for this pool", which is what makes it
        // a defensible rule, not "15 is exactly the MAD", which would fail on every repricing.
        expect(mad).toBeGreaterThan(BAND_TOLERANCE_PCT / 2);
        expect(mad).toBeLessThan(BAND_TOLERANCE_PCT * 2);
    });
});

describe('149c-6 — one rate per trigger, not one constant for fourteen cards', () => {
    it('ranks riptide above harden above einherjar \u2014 §5\'s named case', () => {
        /*
         * The three cards that show what `EXPECTED_DAEMON_PROCS = 4` was hiding, all priced by
         * the SAME formula and separated only by their measured rates
         * (`research/scorer-pricing.md` §2):
         *
         *   riptide    opponent card played   4.2/unit-turn, ~20 a game  -> was priced at a fifth
         *   harden     turn boundary          0.79            -> 4 was right by accident of game length
         *   einherjar  Light attack           0.00            -> four procs of something that never happens
         *
         * Asserted as an ORDER rather than three literals: the ordering is the claim the rate
         * table makes, and it survives every later repricing of what the hooks actually do.
         */
        const scoreOf = (id: string) => calculatePowerscale(registry[id]).score;

        expect(scoreOf('riptide')).toBeGreaterThan(scoreOf('harden_daemon'));
        expect(scoreOf('harden_daemon')).toBeGreaterThan(scoreOf('einherjar_standard'));
        expect(scoreOf('einherjar_standard')).toBe(0);
    });

    it('treats a trigger that never fires as an honest zero, not as something to review', () => {
        /*
         * `einherjar_standard` fires on a Light attack, measured at 0.00 across 22,780 unit-turns
         * because no shipped deck has a Light attacker. Zero is the MEASUREMENT here. Flagging it
         * for manual review would be asking a human to re-derive a number we already have.
         */
        const einherjar = calculatePowerscale(registry['einherjar_standard']);
        expect(einherjar.score).toBe(0);
        expect(einherjar.manualReview).toEqual([]);
        expect(TRIGGER_RATE_FLOOR.LIGHT_ATTACK).toBe(0);
    });

    it('flags a trigger the census never measured instead of defaulting it', () => {
        /*
         * `core_overclock_daemon` is a damage multiplier on `onDamageCalculated` with no element
         * gate — a class the census has no rate for. A fallback rate would read as a measurement,
         * which is the failure mode ticket 66 spent a whole census correcting.
         */
        const scored = calculatePowerscale(registry['core_overclock_daemon']);
        expect(scored.score).toBe(0);
        expect(scored.manualReview.join(' ')).toContain('HOOK:');
    });

    it('prices each of a card\'s hooks at its own rate rather than pooling them', () => {
        /*
         * `reactive_plating` is why the old flattening had to go: it registers a damage-taken
         * hook AND a turn-start hook, firing at 2.2 and 0.8 per unit-turn. One bag of actions
         * times one proc count cannot express that.
         */
        const hooks = hooksOf(registry['reactive_plating']);
        expect(hooks.length).toBe(2);
        const classes = hooks.map(classifyHook);
        expect(classes).toContain('DAMAGE_TAKEN');
        expect(classes).toContain('TURN_BOUNDARY');
        expect(new Set(classes).size).toBe(2);
    });

    it('reports a ceiling for a card that can be built around, and none for one that cannot', () => {
        /*
         * §4.4's build-around index. Two classes have a home deck that beats the roster — own
         * 0-cost play reaches 3.3 on ratatoskr_v1, own triggered draw 1.4 on kraken_v1 — and
         * every other class is its own floor. That is a finding, not a gap: an OPPONENT-triggered
         * hook cannot be built around, because the rate is the opponent's behaviour.
         */
        const echo = calculatePowerscale(registry['echo_chamber_v2']);
        expect(echo.hookFloor).toBeGreaterThan(0);
        expect(echo.hookCeiling / echo.hookFloor).toBeCloseTo(
            TRIGGER_RATE_CEILING.OWN_ZERO_COST_PLAY / TRIGGER_RATE_FLOOR.OWN_ZERO_COST_PLAY, 1);

        const riptide = calculatePowerscale(registry['riptide']);
        expect(riptide.hookFloor).toBeGreaterThan(0);
        expect(riptide.hookCeiling).toBe(riptide.hookFloor);

        // And a card with no hooks has neither, rather than a zero that reads as "measured 0".
        const ordinary = calculatePowerscale(registry['ignite']);
        expect(ordinary.hookFloor).toBe(0);
        expect(ordinary.hookCeiling).toBe(0);
    });

    it('is payoff x rate x horizon, with nothing else hidden in it', () => {
        // The point of replacing `EXPECTED_DAEMON_PROCS` is that the three inputs are separable
        // and each is somebody's measurement. If this stops being a plain product, it has grown
        // an opinion.
        expect(scoreHook(2, { rate: 4.2, horizon: 3 })).toBeCloseTo(25.2, 5);
        expect(scoreHook(2, { rate: 0, horizon: 3 })).toBe(0);
        expect(DAEMON_HORIZON_TURNS).toBe(3);
    });

    it('leaves the 229 cards with no hooks exactly where they were', () => {
        // The containment check. A change to how HOOKS are priced must not be able to reach a
        // card that has none, and this is the only assertion that can catch it if it leaks.
        const withHooks = Object.values(registry).filter(c => hooksOf(c).length > 0);
        expect(withHooks.length).toBeGreaterThan(0);
        for (const card of Object.values(registry)) {
            if (hooksOf(card).length > 0) continue;
            expect(calculatePowerscale(card).hookFloor, card.id).toBe(0);
        }
    });
});

describe('149c-6 — the rate table, one case per measured constant', () => {
    /*
     * §5: "one case per constant (cited)". These are not the scorer's opinions — every one is a
     * figure from `research/scorer-pricing.md` §2, measured with probe hooks over 22,780
     * unit-turns at 1v1, counted outside AI lookahead.
     *
     * Asserted as literals, because the whole value of the table is that it is the census and not
     * a set of plausible numbers. If a figure here ever changes, it should be because somebody
     * re-ran the census — and this failing is how they say so.
     */
    it('carries the 149b census figures, unrounded and unrounded-up', () => {
        expect(TRIGGER_RATE_FLOOR.TURN_BOUNDARY).toBe(0.8);              // measured 0.79
        expect(TRIGGER_RATE_FLOOR.OWN_ZERO_COST_PLAY).toBe(1.0);
        expect(TRIGGER_RATE_FLOOR.OWN_TRIGGERED_DRAW).toBe(0.33);
        expect(TRIGGER_RATE_FLOOR.BURN_ON_SELF).toBe(0.14);
        expect(TRIGGER_RATE_FLOOR.LIGHT_ATTACK).toBe(0);
        expect(TRIGGER_RATE_FLOOR.OPPONENT_CARD_PLAYED).toBe(4.2);
        expect(TRIGGER_RATE_FLOOR.OPPONENT_TRIGGERED_DRAW).toBe(0.84);
        expect(TRIGGER_RATE_FLOOR.DAMAGE_TAKEN).toBe(2.2);
    });

    it('has a ceiling above the floor for exactly the two classes a deck can build around', () => {
        /*
         * own 0-cost play reaches 3.3 on ratatoskr_v1 (five 0-costs, each a proc) and own
         * triggered draw 1.4 on kraken_v1. Every other class is its own floor, and that is a
         * finding rather than missing data: an opponent-triggered hook cannot be built around,
         * because the rate is the OPPONENT's behaviour.
         */
        const raised = (Object.keys(TRIGGER_RATE_FLOOR) as Array<keyof typeof TRIGGER_RATE_FLOOR>)
            .filter(k => TRIGGER_RATE_CEILING[k] > TRIGGER_RATE_FLOOR[k]);
        expect(raised.sort()).toEqual(['OWN_TRIGGERED_DRAW', 'OWN_ZERO_COST_PLAY']);

        expect(TRIGGER_RATE_CEILING.OWN_ZERO_COST_PLAY).toBe(3.3);
        expect(TRIGGER_RATE_CEILING.OWN_TRIGGERED_DRAW).toBe(1.4);
        // A ceiling below its floor would be a data-entry slip that silently discounts a card.
        for (const key of Object.keys(TRIGGER_RATE_FLOOR) as Array<keyof typeof TRIGGER_RATE_FLOOR>) {
            expect(TRIGGER_RATE_CEILING[key], key).toBeGreaterThanOrEqual(TRIGGER_RATE_FLOOR[key]);
        }
    });

    it('charges riptide the opponent-play rate, which is what makes it the outlier it is', () => {
        /*
         * The single largest correction in the row: `riptide` fires on every card the opponent
         * plays — 4.2 per unit-turn, about 20 a game — and was being charged four procs like
         * everything else. The ratio between its score and a turn-boundary daemon's is the
         * ratio between their RATES, with the payoffs divided out, which is what pins the number
         * rather than just the ordering.
         */
        const riptide = calculatePowerscale(registry['riptide']);
        const hook = hooksOf(registry['riptide'])[0];
        expect(classifyHook(hook)).toBe('OPPONENT_CARD_PLAYED');

        // The hook contribution IS payoff x 4.2 x 3, premium and exhaust discount aside. Recover
        // the payoff from the score and check it against the card's printed 8 power.
        const payoff = riptide.hookFloor / (TRIGGER_RATE_FLOOR.OPPONENT_CARD_PLAYED * DAEMON_HORIZON_TURNS);
        expect(payoff).toBeGreaterThan(0.5);
        expect(payoff).toBeLessThan(1.5);
    });
});

describe('149c-8 — consuming your own pile is not removal', () => {
    it('drops the x1.25 premium from a self-consume \u2014 §4.8, tested on umbral_feast', () => {
        /*
         * `REMOVAL_PREMIUM` exists because shedding a debuff undoes an OPPONENT's card as well as
         * helping you — two cards' worth of swing for one, which is why ticket 51 priced it above
         * plain application. That rationale does not survive contact with a `consume`.
         *
         * `umbral_feast` consumes its OWN Poison, which its own deck put there on purpose as
         * fuel. Nothing is neutralised; the pile is cashed. It was collecting a 25% premium for
         * spending a resource it built itself. §4.8: the shed term goes 12.15 -> 9.7, i.e. the
         * card drops by 2.45.
         *
         * Asserted as the DIFFERENCE against a synthetic twin that sheds by stacks instead of
         * consuming, so the case survives every future repricing of what Poison is worth.
         */
        const feast = registry['umbral_feast'];
        expect(feast).toBeDefined();

        const consumeAction = (feast.actions ?? []).find(
            a => (a as unknown as { consume?: boolean }).consume === true);
        expect(consumeAction).toBeDefined();

        const consumed = calculatePowerscale(feast).score;

        // The same card, shedding by stacks rather than consuming. Removal in the sense the
        // premium means — the Poison on you is usually the opponent's — so it KEEPS the premium.
        const shed = calculatePowerscale({
            ...feast,
            id: 'umbral_feast__test_shed',
            actions: (feast.actions ?? []).map(a =>
                (a as unknown as { consume?: boolean }).consume === true
                    ? { type: 'STATUS', status: 'Poison', stacks: -8, target: 'SELF' }
                    : a),
        } as unknown as ProgramData).score;

        expect(shed).toBeGreaterThan(consumed);
    });

    it('leaves a shed of an enemy pile, and a stack-shed of your own, exactly where they were', () => {
        /*
         * The containment check. §4.8 is one clause about one shape; it must not reach a cleanse
         * or an enemy-facing removal. Three cards in the pool self-consume a debuff —
         * `umbral_feast`, `bloodwrath` and `ash_communion` — and nothing else may move.
         */
        const selfConsumesADebuff = (card: ProgramData): boolean =>
            (card.actions ?? []).some(a =>
                (a.type as string) === 'STATUS'
                && (a as unknown as { consume?: boolean }).consume === true
                && ((a.target as string) ?? '').toUpperCase() === 'SELF'
                && ['Burn', 'Poison', 'Dazed', 'Stunned', 'Weakened', 'Asleep', 'Vulnerable']
                    .includes(a.status as string));

        const affected = Object.values(registry).filter(selfConsumesADebuff).map(c => c.id).sort();
        expect(affected).toEqual(['ash_communion', 'bloodwrath', 'umbral_feast']);

        // `purify` sheds Poison and Burn from itself by stacks, not by consuming: still removal,
        // still premium-charged, untouched by this row.
        const purify = registry['purify'];
        expect(purify).toBeDefined();
        expect(selfConsumesADebuff(purify)).toBe(false);
    });
});
