/**
 * The Card Budget Heuristic - `docs/balance_testing.md` section 1.
 *
 * ONE IMPLEMENTATION, TWO CONSUMERS
 * ---------------------------------
 * This formula used to live inline in `src/debug/panels/CardStudio.tsx`. The auditor
 * (`balanceReport.ts`) needs exactly the same numbers - section 4's report is "cards over
 * their energy budget *and* anomalous win rates", so if the Studio table and the committed
 * report disagreed about a card's score there would be no way to tell which one was the
 * balance answer. So the formula lives here and both import it; `CardStudio.tsx` renders
 * it, the auditor redlines against it.
 *
 * It stays under `src/debug/` because both consumers are debug-side and the gate invariant
 * only forbids the other direction (nothing outside `src/debug/` may import into it). No
 * shipped code needs a card's budget score - the game plays the card, it does not audit it.
 *
 * WHY THIS IS THE FAST HALF OF THE REPORT
 * ---------------------------------------
 * It is static analysis: a pure function of the card definition, no battle, no seeds, no
 * AI. The whole registry audits in milliseconds, where the section 2 matchup half is
 * minutes of simulation.
 */

import type { ProgramData } from '../../engine/types';

export interface PowerscaleResult {
    /** Section 1.1's `Score`, rounded to one decimal. */
    score: number;
    /** `Score` divided by a super-linear cost factor - "is this efficient for its cost". */
    perEnergy: number;
}

/**
 * Coarse per-action-type value table.
 *
 * Only `ATTACK` and `HEAL` are consumed by `calculatePowerscale` (as the section 1.2
 * "1.0 per 10 Power" / "1.5 per 10 Power" multipliers). `STATUS`, `REMOVE_STATUS`, `DRAW`
 * and `ENERGY` are kept as the historical relative-value ranking they always were: the
 * finer section 1.2 rules supersede them (status weight depends on *which* status, draw
 * has diminishing returns per card, energy is 6.0 per point), so wiring them in would
 * change every score in the registry. Preserved verbatim from the Studio so that lifting
 * the formula out of the panel changed no number anywhere.
 */
export const ACTION_WEIGHTS: Record<string, number> = {
    'ATTACK': 1,
    'HEAL': 1.5,
    'STATUS': 12,
    'REMOVE_STATUS': 8,
    'DRAW': 15,
    'ENERGY': 20,
};

/** Statuses that help whoever holds them - granting one to an enemy is a downside. */
export const BUFFS = ['Strengthened', 'Regen', 'Energized', 'Haste', 'Protected'];

/** Statuses that hurt whoever holds them - taking one yourself is a downside. */
export const DEBUFFS = ['Burn', 'Poison', 'Dazed', 'Stunned', 'Weakened', 'Asleep', 'Vulnerable'];

/**
 * Section 1.3's target-score table, one band per energy cost.
 *
 * `over` is the section 1.3 upper bound *verbatim* (0E 3.5, 1E 7.0, 2E 13.0, 3+E 18.0) and
 * it is the only number that produces a redline: a card scoring above it delivers more than
 * its cost is supposed to buy.
 *
 * `under` is the Studio's long-standing amber threshold and is deliberately *not* section
 * 1.3's lower bound (the doc says 2.0/5.0/10.0; the panel has always used 1.0/4.0/9.0). It
 * is advisory colour in the UI, never a redline, so the divergence changes no verdict -
 * recorded here rather than silently reconciled, because tightening it would repaint the
 * table without anyone having agreed to the new line.
 *
 * The 3+ band has no `under`: section 1.3 states it as "18.0+", an open-ended target rather
 * than a range, so there is nothing to be below. The Studio has always still redlined
 * *above* 18.0 there, and that behaviour is preserved - read it as "a 3-cost card is
 * expected to reach 18, and a 3-cost card far past 18 is the same overbudget problem a
 * 2-cost card past 13 is".
 */
export interface BudgetBand {
    /** Lowest energy cost this band covers. The last band is open-ended (`3+`). */
    cost: number;
    /** Score above this is over budget - a section 1.3 redline. */
    over: number;
    /** Score below this is under budget - advisory only, never a redline. */
    under: number | null;
}

export const BUDGET_BANDS: ReadonlyArray<BudgetBand> = [
    { cost: 0, over: 3.5, under: 1.0 },
    { cost: 1, over: 7.0, under: 4.0 },
    { cost: 2, over: 13.0, under: 9.0 },
    { cost: 3, over: 18.0, under: null },
];

/** The band a card of this cost is budgeted against. Costs above 3 use the 3+ band. */
export function budgetBandFor(cost: number): BudgetBand {
    let band = BUDGET_BANDS[0];
    for (const candidate of BUDGET_BANDS) {
        if (cost >= candidate.cost) band = candidate;
    }
    return band;
}

/**
 * Section 1.1: `Score = (Power / 10) * Multiplier_Bonus + (Status_Weight * Stacks) +
 * Utility_Bonus`, with section 1.2's scope, condition, persistence and scaling modifiers.
 *
 * Pure and synchronous - no registry lookup, no I/O. Scaling actions are evaluated against
 * section 1.2's "Standard Mid-Turn" baselines rather than a real board.
 */
export const calculatePowerscale = (card: ProgramData): PowerscaleResult => {
    let score = 0;

    // Baseline assumptions
    const ASSUMED_CARDS_PLAYED = 2.5;
    const ASSUMED_HP_PERCENT = 0.5;
    const ASSUMED_DISCARD_SIZE = 8;
    const ASSUMED_STATUS_COUNT = 3;

    // Actions
    card.actions.forEach(action => {
        let actionScore = 0;

        if (action.type === 'ATTACK') {
            let power = action.power || 0;
            if (action.scaling === 'CARDS_PLAYED') power *= ASSUMED_CARDS_PLAYED;
            else if (action.scaling === 'MISSING_HP' || action.scaling === 'HP_PERCENT') power *= ASSUMED_HP_PERCENT;
            else if (action.scaling === 'DISCARD_SIZE') power *= ASSUMED_DISCARD_SIZE;
            else if (action.scaling === 'STATUS_COUNT') power *= ASSUMED_STATUS_COUNT;

            actionScore = (power / 10.0) * ACTION_WEIGHTS['ATTACK'];
        } else if (action.type === 'HEAL') {
            const power = action.power || action.healOverride || 0;
            actionScore = (power / 10.0) * ACTION_WEIGHTS['HEAL'];
        } else if (action.type === 'STATUS') {
            const stacks = action.stacks || 1;
            if (['Burn', 'Poison'].includes(action.status)) {
                actionScore = Math.abs(stacks) * 1.5;
            } else if (['Weakened', 'Dazed', 'Vulnerable'].includes(action.status)) {
                actionScore = Math.abs(stacks) * 2.0;
            } else if (['Stunned', 'Asleep'].includes(action.status)) {
                actionScore = 5.0 + Math.max(0, Math.abs(stacks) - 1) * 0.5;
            } else {
                actionScore = Math.abs(stacks) * 2.0;
            }
        } else if (action.type === 'DRAW') {
            const count = action.amount || action.count || 1;
            for (let i = 1; i <= count; i++) {
                if (i === 1) actionScore += 4.0;
                else if (i === 2) actionScore += 2.5;
                else actionScore += 1.0;
            }
        } else if (action.type === 'ENERGY') {
            const amount = action.amount || 0;
            actionScore = Math.abs(amount) * 6.0;
        }

        // Multi-hit scaling
        const hitCount = action.count || 1;
        if (hitCount > 1 && action.type === 'ATTACK') {
            actionScore *= hitCount;
        }

        // Target Scope Multiplier
        const scope = (action.target || card.target || '').toUpperCase();
        if (scope === 'SELF') actionScore *= 0.9;
        else if (scope === 'SIDE') actionScore *= 2.2;
        else if (scope === 'ALL') actionScore *= 4.0;
        else actionScore *= 1.0;

        // Condition Discount
        if (action.conditionals && action.conditionals.length > 0) {
            actionScore *= 0.7;
        }

        // Penalties
        if (action.type === 'ATTACK' && scope === 'SELF') {
            actionScore *= -1;
        } else if (action.type === 'STATUS') {
            const isBuff = BUFFS.includes(action.status);
            const isDebuff = DEBUFFS.includes(action.status);
            if (isDebuff && scope === 'SELF') actionScore *= -1;
            if (isBuff && scope !== 'SELF' && card.actions.some(a => a.type === 'ATTACK')) actionScore *= -1;
        } else if (action.type === 'ENERGY') {
            const amount = action.amount || 0;
            if (amount < 0 && scope === 'SELF') actionScore *= -1;
            if (amount > 0 && scope !== 'SELF' && card.actions.some(a => a.type === 'ATTACK')) actionScore *= -1;
        }

        score += actionScore;
    });

    // Daemon Premium
    if (card.category === 'Daemon') {
        score *= 1.5;
    }

    // Exhaust/Token Discount
    if (card.exhaust || card.isToken) {
        score *= 0.9;
    }

    const costFactor = Math.pow(Math.max(card.baseCost, 0.5), 1.25);
    const perEnergy = score / costFactor;

    return {
        score: Math.round(score * 10) / 10,
        perEnergy: Math.round(perEnergy * 10) / 10
    };
};
