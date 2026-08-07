/**
 * The Card Budget Heuristic - `docs/balance_testing.md` section 1, tuned to match
 * `docs/power_curve_spec.md` rev 3 (the "1 energy = 40 power" rework).
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
 *
 * REV 3 CHANGES (docs/power_curve_spec.md)
 * -----------------------------------------
 * - Fixed a real scoring bug: every action in the registry carries `action.target: 'TARGET'`
 *   even on Side/All cards, and the old code did `action.target || card.target`, so the
 *   truthy `'TARGET'` always won and the card's actual Side/All scope never got read - every
 *   AOE card (cyclone, tidal_wave_v2, entangle, heat_wave) was silently scored single-target.
 *   Fixed by treating `action.target` as only ever meaning "is this specific action self- or
 *   enemy-facing" and always deferring to `card.target` for the *count* multiplier.
 * - Action types that scored a silent 0 (MULTIPLY_STATUS, CLEANSE, SEARCH, PLAY_LAST_CARD,
 *   TRIGGER_STATUS, and anything else outside the explicit list) now either get a real
 *   heuristic score or an explicit `manualReview` flag - never a silent 0 that reads as
 *   "this card does nothing."
 * - STATUS prices now follow the rev 3 table exactly (Strengthened/Dazed priced higher than
 *   Weakened/Sharp; Burn/Poison/Regen use their tiered/quadratic formulas instead of a flat
 *   per-stack rate; Energized priced per stack).
 * - HEAL is now priced *below* ATTACK per raw power point (0.75x vs 1.0x) because heal/shield
 *   costs 4 power per 1% maxHP against damage's 3 power per 1% - a fixed power budget buys
 *   less %HP from healing than from damage, deliberately, since healing doesn't advance the
 *   win condition the way damage does.
 * - ENERGY (immediate) re-priced to 40 power/point (was 60); BUDGET_BANDS now sit exactly on
 *   the curve (10/40/90/140/190 power, i.e. 1.0/4.0/9.0/14.0 in /10 score units) rather than
 *   the old, looser redlines - this is a deliberate tightening: rev 3's philosophy is a firm
 *   point target per energy, not a range with headroom above it. Expect the auditor to
 *   redline noticeably more cards the first time this runs.
 */

import type { ProgramData, ProgramAction } from '../../engine/types';
import { numericBaseCost } from '../../engine/types';

export interface PowerscaleResult {
    /** Section 1.1's `Score`, rounded to one decimal. */
    score: number;
    /** `Score` divided by a super-linear cost factor - "is this efficient for its cost". */
    perEnergy: number;
    /**
     * Action types this card contains that the static formula can't honestly price
     * (their value depends on board state - what's already applied, what the "last card"
     * was, etc.) - e.g. CLEANSE, SEARCH, PLAY_LAST_CARD, TRIGGER_STATUS. Empty when every
     * action on the card got a real score. A card with entries here should be judged by
     * hand (see docs/power_curve_spec.md's "Exotics — verdicts" section), not by `score`
     * alone - a low score with entries here is "unscored", not "underpowered".
     */
    manualReview: string[];
}

/**
 * Coarse per-action-type value table.
 *
 * Only `ATTACK` and `HEAL` are consumed as flat multipliers on the raw `power` field - the
 * finer section 1.2 rules (below) supersede the rest: status weight depends on *which*
 * status, draw has diminishing returns per card, energy is priced directly in power.
 */
export const ACTION_WEIGHTS: Record<string, number> = {
    'ATTACK': 1,
    // 4 power/1%HP vs damage's 3 power/1%HP => heal's raw `power` field is worth 3/4 as
    // much per point as an attack's (docs/power_curve_spec.md rev 3, "heal costs more than
    // damage").
    'HEAL': 0.75,
    'STATUS': 12,
    'REMOVE_STATUS': 8,
    'DRAW': 15,
    'ENERGY': 20,
};

/** Statuses that help whoever holds them - granting one to an enemy is a downside. */
export const BUFFS = ['Strengthened', 'Sharp', 'Regen', 'Energized', 'Haste', 'Protected', 'BarkShield'];

/** Statuses that hurt whoever holds them - taking one yourself is a downside. */
export const DEBUFFS = ['Burn', 'Poison', 'Dazed', 'Stunned', 'Weakened', 'Asleep', 'Vulnerable'];

/**
 * Section 1.3's target-score table, one band per energy cost.
 *
 * These now sit exactly on the docs/power_curve_spec.md rev 3 damage curve (10/40/90/140
 * power for 0/1/2/3e, divided by 10 to match the ATTACK branch's `power/10` scoring unit).
 * `over` IS the point target now, not a redline above it - rev 3's whole premise is a firm
 * "a 1-energy card should deal 40 power" target, not a range with slack above it. `under`
 * is 80% of `over`, an advisory amber line with no particular derivation beyond "clearly
 * short of the target."
 *
 * The 3+ band has no upper bound of its own - a 4-cost card is expected to reach 19.0
 * (190 power), legitimately above the 3-cost band's 14.0. Read the 3-band's `over` as "a
 * 3-cost card is expected to reach 14, and one far past 14 is the same overbudget problem a
 * 2-cost card past 9 is" - a 4e card is supposed to clear it, that's fine.
 */
export interface BudgetBand {
    /** Lowest energy cost this band covers. The last band is open-ended (`3+`). */
    cost: number;
    /** Score above this is over budget - a section 1.3 redline. */
    over: number;
    /** Score below this is under budget - advisory only, never a redline. */
    under: number | null;
}

// rev 3.2 (ticket 24): the curve moved 10/40/90/140 -> 10/35/75/120, so the bands move
// with it. The POWER UNIT itself is unchanged - a point of power still buys the same
// fraction of a health pool - so the per-status prices below are deliberately NOT rescaled.
// What changed is only how much power a card of a given cost is allowed to carry.
export const BUDGET_BANDS: ReadonlyArray<BudgetBand> = [
    { cost: 0, over: 1.0, under: 0.8 },
    { cost: 1, over: 3.0, under: 2.4 },
    { cost: 2, over: 6.5, under: 5.2 },
    { cost: 3, over: 10.5, under: 8.4 },
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
 * Health pool a flat-HP effect is priced against. Current species sit at 75-79 max HP.
 * Only used for effects denominated in literal HP (`damageOverride`), which have no
 * power value of their own and are meaningless without a pool to be a fraction of.
 */
const ASSUMED_MAX_HP = 75;
/** docs/power_curve_spec.md: damage costs 3 power per 1% of a health pool. */
const POWER_PER_PERCENT_MAXHP = 3;

// --- Status pricing (docs/power_curve_spec.md rev 3, "Status prices" table) ---
// All in POWER, converted to the /10 score unit at the call site (matches ATTACK/HEAL).

/**
 * 2%/stack, 25% cap; offense stream (accelerates a fight, priced higher).
 *
 * Ticket 28: 15 -> 5. The old price was never derived, and it was 3-6x what the status
 * actually delivers. A 2%/stack damage modifier is worth 2% of the damage you have LEFT
 * to deal. A pool is ~263 power, so a stack landed on turn 1 is worth 0.02 x 263 = 5.3
 * power and one landed mid-fight about half that. Measured independently: 1 Strengthened
 * on fenrir_v1 was worth +1.1 HP across a whole game, i.e. 3.7 power. 5 is the generous
 * end of that range - a buff you land early does get the whole fight.
 *
 * The old 15 is why desperate_strike existed at all: it read as 1.35 score of upside for
 * a self-hit the model also under-charged (see ASSUMED_MAX_HP below), so a card that costs
 * 13% of a health pool to gain ~1 HP of damage scored comfortably UNDER its 0-cost cap.
 */
const OFFENSE_STREAM_POWER_PER_STACK = 5;
/**
 * 2%/stack, 25% cap; defense stream (stalls a fight, priced lower - see cap note below).
 * Ticket 28: 10 -> 3.5, holding the 1.5:1 offense:defense ratio the old pair encoded.
 */
const DEFENSE_STREAM_POWER_PER_STACK = 3.5;
/** Burn's cumulative price to reach N stacks (tiers are 1.5/3.5/8% maxHP); tiered, not linear.
 *  Ticket 26: rescaled WITH the tiers at the unchanged 3-power-per-1%-maxHP rate. This is not
 *  the re-pricing ticket 24 declined - that would have moved the price while the tiers stayed
 *  put (double-counting); this moves the tiers and lets the derived price follow. */
const BURN_TIER_POWER = [4.5, 15, 40];
const BURN_OVERFLOW_POWER_PER_STACK = 24;
const ENERGIZED_POWER_PER_STACK = 35;
const STUNNED_POWER = 55;
const ASLEEP_POWER = 45;
/** 4 power/1%maxHP; BarkShield's `stacks` is %maxHP as of the StatusBehaviors.ts rev 3 change. */
const SHIELD_POWER_PER_PERCENT = 4;

function poisonPower(stacks: number): number {
    // 1.5 * S * (S+1): decaying-DoT total lifetime damage at 1%maxHP/stack/turn, priced at
    // damage's 3-power-per-1% rate.
    return 1.5 * stacks * (stacks + 1);
}

function regenPower(stacks: number): number {
    // ~3 * S * (S+1): same decaying-accumulation shape as Poison, at Regen's 3%/stack/turn.
    return 3 * stacks * (stacks + 1);
}

function burnPower(stacks: number): number {
    if (stacks <= 0) return 0;
    if (stacks <= BURN_TIER_POWER.length) return BURN_TIER_POWER[stacks - 1];
    const overflow = stacks - BURN_TIER_POWER.length;
    return BURN_TIER_POWER[BURN_TIER_POWER.length - 1] + overflow * BURN_OVERFLOW_POWER_PER_STACK;
}

/** Action types whose value depends on board state a static pass can't see - flag, don't guess. */
const MANUAL_REVIEW_TYPES = new Set([
    'CLEANSE', 'SEARCH', 'PLAY_LAST_CARD', 'TRIGGER_STATUS',
    'GENERATE_CARD', 'DISCARD', 'EXHAUST', 'RETURN', 'TAUNT',
    'BUFF_NEXT_PROGRAM', 'REDIRECT_TARGET', 'FORCE_DISCARD',
]);

/**
 * Section 1.1: `Score = (Power / 10) * Multiplier_Bonus + (Status_Weight * Stacks) +
 * Utility_Bonus`, with section 1.2's scope, condition, persistence and scaling modifiers.
 *
 * Pure and synchronous - no registry lookup, no I/O. Scaling actions are evaluated against
 * section 1.2's "Standard Mid-Turn" baselines rather than a real board.
 */
export const calculatePowerscale = (card: ProgramData): PowerscaleResult => {
    let score = 0;
    const manualReview: string[] = [];

    // Baseline assumptions
    const ASSUMED_CARDS_PLAYED = 2.5;
    const ASSUMED_HP_PERCENT = 0.5;
    const ASSUMED_DISCARD_SIZE = 8;
    const ASSUMED_STATUS_COUNT = 3;

    // Actions
    // --- Mutually exclusive branches (ticket 28) ---
    // A card like blood_rite ("+15 power above 50% HP, otherwise heal") or battle_rhythm
    // ("2 Strength above 50%, otherwise 2 Sharp") resolves EXACTLY ONE of its two threshold
    // branches, never both. The old code gave each branch the 0.7 condition discount and then
    // SUMMED them, charging 1.4x for something worth 1.0x - so every either/or card in the
    // registry read as over budget while delivering at or under its energy rate, and the cards
    // built from them (fenrir_v1) were quietly underpowered for their price. Complementary
    // HEALTH_THRESHOLD branches on the same subject are now scored as max(), not sum().
    //
    // Deliberately narrow: only paired GT/LT HEALTH_THRESHOLD conditionals on the same target
    // group. A lone conditional (berserk_rush's "+17 below 50%") has nothing to be exclusive
    // WITH and is untouched, and non-threshold conditionals (molten_core's `self_sharp`, which
    // stacks ON TOP of an unconditional base) keep summing, which is correct for them.
    //
    // The 0.7 discount is intentionally kept on the surviving branch. You always get one half,
    // but you do not choose which, so the branch is still not reliably the one you wanted.
    const exclusivityKey = (action: ProgramAction): string | null => {
        const conds = (action.conditionals ?? []) as ReadonlyArray<unknown>;
        if (conds.length !== 1) return null;
        const cond = conds[0] as { type?: string; target?: string; value?: string };
        if (!cond || typeof cond !== 'object') return null;
        if (cond.type !== 'HEALTH_THRESHOLD') return null;
        const value = String(cond.value ?? '');
        const direction = value.startsWith('GT') ? 'GT' : value.startsWith('LT') ? 'LT' : null;
        if (!direction) return null;
        return `HEALTH_THRESHOLD:${cond.target ?? ''}|${direction}`;
    };
    /** Best score seen for each threshold branch group, keyed by subject (direction stripped). */
    const exclusiveGroups = new Map<string, number>();

    card.actions.forEach((action: ProgramAction) => {
        let actionScore = 0;

        if (action.type === 'ATTACK') {
            // `damageOverride` is LITERAL HP - it bypasses calculateDamage entirely - so it
            // must not be read as curve power. desperate_strike's 10 HP self-hit is 13% of a
            // 75 HP pool, which at the spec's 3-power-per-1%-maxHP rate is 40 power; the old
            // code scored it as `power: 10` = 10 power, a 4x under-charge on the one term
            // that was supposed to make the card cost something. Same bug on glass_cannon
            // and dark_pact.
            let power = typeof action.damageOverride === 'number'
                ? (action.damageOverride / ASSUMED_MAX_HP) * 100 * POWER_PER_PERCENT_MAXHP
                : (action.power || 0);
            if (action.scaling === 'CARDS_PLAYED') power *= ASSUMED_CARDS_PLAYED;
            // Ticket 26: MISSING_HP is power-side now, priced at the cap - ASSUMED_HP_PERCENT
            // 0.5 means "assume half HP", which IS the MISSING_HP_PCT_CAP of 50.
            else if (action.scaling === 'MISSING_HP') power += (action.scalingPower || 0) * 50;
            else if (action.scaling === 'HP_PERCENT') power *= ASSUMED_HP_PERCENT;
            else if (action.scaling === 'DISCARD_SIZE') power *= ASSUMED_DISCARD_SIZE;
            else if (action.scaling === 'STATUS_COUNT') power *= ASSUMED_STATUS_COUNT;

            actionScore = (power / 10.0) * ACTION_WEIGHTS['ATTACK'];
        } else if (action.type === 'HEAL') {
            const power = action.power || action.healOverride || 0;
            actionScore = (power / 10.0) * ACTION_WEIGHTS['HEAL'];
        } else if (action.type === 'STATUS') {
            const stacks = action.stacks || 1;
            const absStacks = Math.abs(stacks);
            const status = action.status;

            if (status === 'Strengthened' || status === 'Dazed') {
                actionScore = (absStacks * OFFENSE_STREAM_POWER_PER_STACK) / 10.0;
            } else if (status === 'Weakened' || status === 'Sharp') {
                actionScore = (absStacks * DEFENSE_STREAM_POWER_PER_STACK) / 10.0;
            } else if (status === 'Burn') {
                actionScore = burnPower(absStacks) / 10.0;
            } else if (status === 'Poison') {
                actionScore = poisonPower(absStacks) / 10.0;
            } else if (status === 'Regen') {
                actionScore = regenPower(absStacks) / 10.0;
            } else if (status === 'Energized') {
                actionScore = (absStacks * ENERGIZED_POWER_PER_STACK) / 10.0;
            } else if (status === 'Stunned') {
                actionScore = STUNNED_POWER / 10.0;
            } else if (status === 'Asleep') {
                actionScore = ASLEEP_POWER / 10.0;
            } else if (status === 'BarkShield') {
                actionScore = (absStacks * SHIELD_POWER_PER_PERCENT) / 10.0;
            } else if (['Vulnerable'].includes(status)) {
                actionScore = absStacks * 2.0;
            } else {
                // Unpriced status (e.g. StableOS) - fall back to the historical flat rate
                // rather than inventing a number rev 3 never specified.
                actionScore = absStacks * 2.0;
            }
        } else if (action.type === 'DRAW') {
            const count = action.amount || action.count || 1;
            // 15/10/5 power for 1st/2nd/3rd+ card (docs/power_curve_spec.md), in /10 units.
            for (let i = 1; i <= count; i++) {
                if (i === 1) actionScore += 1.5;
                else if (i === 2) actionScore += 1.0;
                else actionScore += 0.5;
            }
        } else if (action.type === 'ENERGY') {
            const amount = action.amount || 0;
            // 40 power/point immediate energy gain (docs/power_curve_spec.md).
            actionScore = Math.abs(amount) * 4.0;
        } else if (action.type === 'SHIFT_STANCE') {
            // "SHIFT_STANCE ≈ 15 enabler" (docs/power_curve_spec.md "Exotics — verdicts").
            actionScore = 1.5;
        } else if (action.type === 'MULTIPLY_STATUS') {
            // No static board state to multiply against - approximate against the same
            // ASSUMED_STATUS_COUNT baseline the scaling actions use, priced as if it were
            // that many fresh stacks of the doubled status (factor 2 => +ASSUMED_STATUS_COUNT
            // stacks' worth of value; other factors scale linearly off that same baseline).
            const factor = action.factor ?? 2;
            const impliedExtraStacks = ASSUMED_STATUS_COUNT * (factor - 1);
            const perStackPower = DEBUFFS.includes(action.status) || action.status === 'Burn'
                ? BURN_TIER_POWER[0]
                : OFFENSE_STREAM_POWER_PER_STACK;
            actionScore = (impliedExtraStacks * perStackPower) / 10.0;
            manualReview.push(action.type);
        } else if (MANUAL_REVIEW_TYPES.has(action.type)) {
            actionScore = 0;
            manualReview.push(action.type);
        } else {
            // Unknown/future action type - don't silently score 0 without saying so.
            manualReview.push(action.type);
        }

        // Multi-hit scaling
        const hitCount = action.count || 1;
        if (hitCount > 1 && action.type === 'ATTACK') {
            actionScore *= hitCount;
        }

        // Target Scope Multiplier.
        // `action.target` only distinguishes self- vs enemy-facing for *this* action
        // (glass_cannon's recoil sub-action is 'SELF' while its main hit is 'TARGET', on a
        // card whose own `card.target` is 'Single') - it is NOT the AOE count. Every action
        // in the registry that faces the enemy is stamped 'TARGET' regardless of whether the
        // *card* hits one enemy or the whole side, so the count multiplier always comes from
        // `card.target`, never from `action.target` (that was the rev 3 bug: `action.target
        // || card.target` let the ever-present 'TARGET' shadow the real Side/All value).
        const actionIsSelfFacing = (action.target || '').toUpperCase() === 'SELF';
        const scope = actionIsSelfFacing ? 'SELF' : (card.target || 'Single').toUpperCase();
        if (scope === 'SELF') actionScore *= 0.9;
        else if (scope === 'SIDE') actionScore *= 2.2;
        else if (scope === 'ALL') actionScore *= 4.0;
        else actionScore *= 1.0;

        // Condition Discount
        if (action.conditionals && action.conditionals.length > 0) {
            actionScore *= 0.7;
        }

        // Penalties
        if (action.type === 'ATTACK' && actionIsSelfFacing) {
            actionScore *= -1;
        } else if (action.type === 'STATUS') {
            const isBuff = BUFFS.includes(action.status);
            const isDebuff = DEBUFFS.includes(action.status);
            if (isDebuff && actionIsSelfFacing) actionScore *= -1;
            if (isBuff && !actionIsSelfFacing && card.actions.some(a => a.type === 'ATTACK')) actionScore *= -1;
        } else if (action.type === 'ENERGY') {
            const amount = action.amount || 0;
            if (amount < 0 && actionIsSelfFacing) actionScore *= -1;
            if (amount > 0 && !actionIsSelfFacing && card.actions.some(a => a.type === 'ATTACK')) actionScore *= -1;
        }

        const key = exclusivityKey(action);
        if (key === null) {
            score += actionScore;
        } else {
            // Bank per subject, keeping the largest branch; folded into `score` below once
            // every branch has been seen.
            const subject = key.split('|')[0];
            const previous = exclusiveGroups.get(subject);
            exclusiveGroups.set(subject, previous === undefined ? actionScore : Math.max(previous, actionScore));
        }
    });

    for (const branchScore of exclusiveGroups.values()) score += branchScore;

    // Daemon Premium
    if (card.category === 'Daemon') {
        score *= 1.5;
    }

    // Exhaust/Token Discount
    if (card.exhaust || card.isToken) {
        score *= 0.9;
    }

    const costFactor = Math.pow(Math.max(numericBaseCost(card.baseCost), 0.5), 1.25);
    const perEnergy = score / costFactor;

    return {
        score: Math.round(score * 10) / 10,
        perEnergy: Math.round(perEnergy * 10) / 10,
        manualReview,
    };
};
