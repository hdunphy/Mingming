import { STATUS_MODEL } from '../../engine/core/Hooks';
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
import HOOK_LIBRARY from '../../engine/data/lib/hooks.json';
import { GetProgramData } from '../../engine/data/programRegistry';
import { numericBaseCost } from '../../engine/types';
import { DEFAULT_GAME_CONFIG } from '../../engine/data/gameConfig';
import { BURN_CONFIG } from '../../engine/StatusBehaviors';

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
    /**
     * Ticket 26: how much of `score` came from ATTACK actions, and how much from STATUS.
     *
     * The deck report's `measuredScore` replaces exactly these two terms with what the card
     * measurably did, and leaves every deterministic term (DRAW, ENERGY, flat heal) alone -
     * a card that draws 2 always draws 2, and re-measuring it just re-derives the constant.
     * They are reported rather than recomputed so the two numbers cannot drift apart.
     *
     * Both are post-multiplier, so `score - damagePortion - statusPortion` is the part of the
     * card the static pass prices correctly by construction.
     */
    damagePortion: number;
    statusPortion: number;
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
 * Stacks that actually do something. Hooks.ts applies 2%/stack to a NET CAP of 25%, so
 * the 13th stack and every stack after it changes nothing - but the price was linear and
 * uncapped, so the model would happily charge a card 10.0 for 20 stacks that deliver the
 * same 25% as 13. Any card designed against the uncapped price is paying for stacks the
 * engine throws away.
 */
/**
 * TICKET 102: how many stacks the price counts.
 *
 * Under the PERCENT shape the damage effect capped at a net 25% swing, so stack 14 and beyond were
 * worth literally nothing and the price clamped there. **The POWER shape has no cap** - stack 20 is
 * worth exactly as much as stack 2 - so the clamp has to go, and a card that hands out a big pile is
 * now priced for all of it. That is the single largest repricing in this change: `keen_edge` grants
 * 5 Sharp, `iron_will` 4 Strengthened, `strength_burst` 5, and every one of them used to be scored
 * against a ceiling they now blow through.
 *
 * Read off `STATUS_MODEL` rather than mirrored by hand, so a future change of shape or rate cannot
 * leave the scorer describing a mechanic the engine no longer has (0-BURN-PRICE-LAG, twice).
 */
const streamStacks = (stacks: number): number =>
    STATUS_MODEL.shape === 'POWER'
        ? stacks
        : Math.min(stacks, Math.ceil(STATUS_MODEL.pctCap / STATUS_MODEL.pctPerStack));

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
/**
 * TICKET 102 re-derivation, POWER shape. A stack of Strengthened adds `powerPerStack` POWER to every
 * attack you make for the rest of the fight. Its worth is therefore
 *
 *     powerPerStack x (attacks it will ride)
 *
 * and "attacks it will ride" is the same horizon question every other future-scaling status answers
 * here: ~2 attacks a turn (measured 1.7-3.6 cards/turn across the roster, most of them attacks)
 * over the 2.5-turn horizon `TacticalAI` already uses = **5 attacks**.
 *
 * At `powerPerStack: 1` that lands on **5 power a stack** - the same number the percent shape was
 * priced at, arrived at from the other direction. That coincidence is worth stating plainly: +1
 * power a stack is worth about what 2% a stack was worth IN TOTAL. What changed is not the average
 * value, it is that the value is now VISIBLE per hit and, crucially, **uncapped** - which is what
 * moves the engines and what the grid measured.
 */
const STACK_ATTACK_HORIZON = 5;
const OFFENSE_STREAM_POWER_PER_STACK = STATUS_MODEL.shape === 'POWER'
    ? STATUS_MODEL.powerPerStack * STACK_ATTACK_HORIZON
    : 5;
/**
 * 2%/stack, 25% cap; defense stream (stalls a fight, priced lower - see cap note below).
 * Ticket 28: 10 -> 3.5, holding the 1.5:1 offense:defense ratio the old pair encoded.
 */
const DEFENSE_STREAM_POWER_PER_STACK = STATUS_MODEL.shape === 'POWER'
    // The defensive pair rides the same count of attacks - the opponent's rather than yours - so the
    // horizon term is identical and only the 1.5:1 offence premium separates them. That ratio is a
    // design choice this file has encoded since ticket 28 (accelerating a fight is worth more than
    // stalling one) and the re-denomination gives no reason to revisit it.
    ? STATUS_MODEL.powerPerStack * STACK_ATTACK_HORIZON * (3.5 / 5)
    : 3.5;
/**
 * Burn's cumulative price to reach N stacks - tiered, not linear, because Burn decays 1/turn
 * and a pile of N therefore ticks N, N-1, ... 1 before it wears off.
 *
 * DERIVED FROM THE ENGINE, not transcribed from it. Ticket 62 shipped a four-tier table and a
 * detonating overflow while this file still held `[4.5, 15, 40]` and a per-excess-stack price
 * from the era when overflow floored to ZERO damage - so every Burn card was scored against a
 * mechanic that no longer existed (HANDOFF 0-BURN-PRICE-LAG). Transcribing the new numbers
 * would have fixed today and left the same trap armed for the next tier edit. Reading
 * `DEFAULT_GAME_CONFIG.status.burnStacks` disarms it: the scorer cannot lag the engine now,
 * because there is only one table.
 *
 * At the shipped four-tier table (1.5 / 3 / 5 / 8% maxHP) this evaluates to
 * `[4.5, 13.5, 28.5, 52.5]` - cumulative 1.5 / 4.5 / 9.5 / 17.5% of a pool at the spec's
 * 3-power-per-1%-maxHP rate. It was `[4.5, 15, 40]` on the old three-tier table.
 */
/**
 * TICKET 93: how long a PERMANENT pile is priced for.
 *
 * The triangular model below assumes the pile decays, so a pile of N delivers N + (N-1) + ... + 1
 * tiers and then stops. With `decayPerTurn: 0` that sum is unbounded and the price is undefined -
 * `burnPricing.test.ts` proved it the hard way by looping forever.
 *
 * A permanent pile is therefore priced over a fixed HORIZON, which is the same shape
 * `TacticalAI.statusValue` already uses for stream statuses (`STATUS_HORIZON_TURNS`). Two turns is
 * chosen rather than the AI's 2.5 because it very nearly preserves the price of a FULL pile across
 * the change: a 4-stack pile used to deliver 8+5+3+1.5 = 17.5% of a pool over its life, and at a
 * horizon of 2 it delivers 16%. What does move - correctly - is the price of SMALL piles: one
 * stack was 1.5% and is now 3%, because a single stack that never wears off really is worth twice
 * one that ticks once and dies.
 */
export const BURN_PERMANENT_HORIZON_TURNS = 2;

export const BURN_TIER_POWER: number[] = BURN_CONFIG.decayPerTurn === 0
    ? DEFAULT_GAME_CONFIG.status.burnStacks.map(
        tier => tier.damagePercent * 100 * BURN_PERMANENT_HORIZON_TURNS * POWER_PER_PERCENT_MAXHP,
    )
    : DEFAULT_GAME_CONFIG.status.burnStacks.reduce<number[]>(
        (acc, tier) => {
            const priorPercent = acc.length === 0 ? 0 : acc[acc.length - 1] / POWER_PER_PERCENT_MAXHP;
            acc.push((priorPercent + tier.damagePercent * 100) * POWER_PER_PERCENT_MAXHP);
            return acc;
        },
        [],
    );

/**
 * Price of ONE detonation - ticket 62's overflow, at the same rate as everything else here.
 * 14% of a pool x 3 power per 1% = 42 power.
 *
 * NOTE THE SHAPE CHANGE, because it is not merely a bigger number. The old model charged
 * `stacks - cap` excess stacks at a per-STACK rate. The engine now pays once per CAP-CROSSING
 * and subtracts the cap from the pile, so the count is `ceil(stacks / cap) - 1` and what
 * survives is the remainder - which means a detonation SPENDS the DoT it was built from.
 * `burnPower` below models both halves; charging per excess stack would over-price every
 * multi-stack Burn card by counting damage the pile no longer lives to deal.
 */
// Rounded to 6dp: `0.14 * 100` is 14.000000000000002 in binary floating point, and a card
// sitting exactly on its budget should not redline because of the last bit of a double.
export const BURN_DETONATION_POWER = Math.round(BURN_CONFIG.overflowPercent * 100 * POWER_PER_PERCENT_MAXHP * 1e6) / 1e6;
const ENERGIZED_POWER_PER_STACK = 35;
const STUNNED_POWER = 55;
const ASLEEP_POWER = 45;
/**
 * Ticket 48: self-applied Asleep is NOT the enemy-facing effect. The sleeper keeps their turn,
 * their energy and their draw; all they lose is access to cards carrying `not_asleep`. Priced at
 * a tenth of the enemy-facing rate.
 *
 * CAVEAT, same class as `brute_force`'s OS-guaranteed conditional (HANDOFF item 8): this price
 * assumes the deck can act while asleep. For a deck that CANNOT, self-sleep really does cost a
 * whole turn (~55 power) and this model under-charges it 5x. Any self-sleep card printed outside
 * a sleep deck must be hand-checked.
 */
const ASLEEP_SELF_POWER = 11;
/** 4 power/1%maxHP; BarkShield's `stacks` is %maxHP as of the StatusBehaviors.ts rev 3 change. */
const SHIELD_POWER_PER_PERCENT = 4;

/**
 * Ticket 46: CLEANSE is priced now, from measurement rather than a guess.
 *
 * A cleanse is worth whatever the debuffs it removes would have cost to apply, so the price is
 * the debuff load a unit actually carries. Sampled at every side-turn across all 90 pairings of
 * the ten tuned species (4,922 samples, 540 games), valuing each held status with the tables
 * above:
 *
 *   - a unit is carrying at least one debuff **63.3%** of the time
 *   - **median load when loaded: 15 power** (p25 7, p75 38.5)
 *   - trimmed mean, top 5% dropped: 13.4-16.9 depending on how Poison's tail is valued
 *
 * The raw mean (51.8) is useless here - it is dominated by nidhoggr's runaway poison piles,
 * where the triangular `poisonPower` reaches 6,678 for a single unit. Robust statistics agree
 * across both valuations, which is why the median is the number to trust.
 *
 * Shipped at **10, deliberately under the measurement** (Henry: lowball it). Two reasons beyond
 * caution: a cleanse does nothing at all on the 36.7% of turns with no debuff to remove, and it
 * has to be in hand at the right moment - neither of which a static price can see.
 */
const CLEANSE_POWER = 10;

/**
 * Ticket 51: removing a status from yourself costs MORE than applying one, not less.
 *
 * Henry's rule, and it is an argument about the game rather than about the sampler: **if an
 * answer is cheaper than the threat it answers, the status archetype is structurally dead.**
 * A shed cancels a card the opponent spent energy and a slot on, so it has to cost at least
 * that much or it is free neutralisation.
 *
 * This REPLACES ticket 47's flat `min(removal, CLEANSE_POWER)` cap, which had two problems
 * once CLEANSE stopped being printable on cards. Its dominance argument ("a full cleanse
 * removes everything for 10, so a partial one cannot cost more") lost its anchor - no card can
 * print one any more. And, worse, it was FLAT: shedding 2/2, 3/3, 4/4 and 5/5 all scored
 * exactly 1.00, so the scorer could not tell a small shed from a large one at all.
 *
 * 1.25 is where the roster lands honestly: `purify` shedding 2 Poison + 2 Burn prices at 2.75
 * against a 1e band of 2.4-3.0, and `soothe` at 1.00 against a 0e band. At 1.5 `purify` reaches
 * 3.30 and breaches.
 *
 * Applies to EVERY self-facing removal - negative stacks and self-`consume` alike - because two
 * mechanics that do the same thing should not price differently.
 */
const REMOVAL_PREMIUM = 1.25;

function poisonPower(stacks: number): number {
    // 1.5 * S * (S+1): decaying-DoT total lifetime damage at 1%maxHP/stack/turn, priced at
    // damage's 3-power-per-1% rate.
    return 1.5 * stacks * (stacks + 1);
}

function regenPower(stacks: number): number {
    // Ticket 34: Regen is a FLAT 3% of maxHP per turn and `stacks` is DURATION, so one
    // application heals 3% x S of a pool - LINEAR, not the triangular shape Poison has.
    // At the spec's heal rate of 4 power per 1% maxHP that is 12 power per stack.
    //
    // The old formula was 3*S*(S+1), which was wrong twice over: it used Poison's triangular
    // shape for a status that no longer has one, AND it applied damage's 3-power-per-1% rate
    // instead of heal's 4, so it under-charged by 2x on top of the wrong curve.
    return 12 * stacks;
}

/**
 * What N stacks of Burn applied to a FRESH target are worth, ticket 62 shape.
 *
 * Mirrors `BurnBehavior.onApply` exactly: while the pile exceeds the cap it pays a detonation
 * and subtracts the cap, so N stacks cause `ceil(N / cap) - 1` detonations and leave
 * `N - detonations x cap` behind to tick down.
 *
 * A consequence worth knowing before reading any score off this function: **it is NOT monotonic
 * in stacks.** At the shipped cap of 4, five stacks (one detonation + a 1-stack pile = 46.5)
 * price BELOW four stacks (a full pile = 52.5), because the detonation consumes the pile that
 * would otherwise have ticked four more times. That is the engine's behaviour, not an artifact
 * of the model - on an 80 HP frame 4 stacks deal 13 HP and 5 stacks deal 12.
 */
/**
 * Measured mean size of each status pile, GIVEN one exists, at the moment a card is played.
 * research/status-pile-census.md, 3,840 real battles. Ticket 66.
 *
 * Used by MULTIPLY_STATUS, which doubles whatever is already there: `heat_wave` doubles Burn
 * and `contagion` doubles Poison, and those are not the same card. Before this they shared one
 * constant and therefore scored as if they were.
 */
const MEASURED_BOARD_PILE: Record<string, number> = {
    BarkShield: 7.7, Sharp: 7.61, Poison: 6.57, Strengthened: 5.9, Weakened: 5.04,
    Dazed: 3.62, Burn: 2.27, Regen: 2.25, Asleep: 2.01, Energized: 1.22, Stunned: 1,
};

/**
 * What N stacks of `status` are worth, in power. The dispatch mirrors the STATUS branch in
 * `calculatePowerscale` - extracted so MULTIPLY_STATUS can price a pile going from P to P x
 * factor as the DIFFERENCE between two piles, which is what doubling actually delivers.
 *
 * Takes fractional stacks: the measured piles are means (2.27 Burn, 6.57 Poison), and the
 * fractional-stack law applies - every function reached here interpolates or is a formula, and
 * none of them index an array (the burnPower NaN lesson).
 */
export function statusPileValue(status: string | undefined, stacks: number): number {
    if (!status || stacks <= 0) return 0;
    if (status === 'Strengthened' || status === 'Dazed') return streamStacks(stacks) * OFFENSE_STREAM_POWER_PER_STACK;
    if (status === 'Weakened' || status === 'Sharp') return streamStacks(stacks) * DEFENSE_STREAM_POWER_PER_STACK;
    if (status === 'Burn') return burnPower(stacks);
    if (status === 'Poison') return poisonPower(stacks);
    if (status === 'Regen') return regenPower(stacks);
    if (status === 'Energized') return stacks * ENERGIZED_POWER_PER_STACK;
    if (status === 'BarkShield') return stacks * SHIELD_POWER_PER_PERCENT;
    if (status === 'Stunned') return STUNNED_POWER;
    if (status === 'Asleep') return ASLEEP_POWER;
    return stacks * 20;   // the historical flat fallback, in power units
}

export function burnPower(stacks: number): number {
    if (stacks <= 0) return 0;
    const cap = BURN_CONFIG.maxStacks;
    const detonations = stacks <= cap ? 0 : Math.ceil(stacks / cap) - 1;
    return detonations * BURN_DETONATION_POWER + tier(stacks - detonations * cap);
}

/**
 * Cumulative Burn price at a possibly FRACTIONAL stack count, interpolated between rungs.
 *
 * Fractions are not hypothetical: `ASSUMED_CONSUMED_STACKS.Burn` is 1.5, and a `consume: true` Burn
 * action prices at exactly that. The previous form indexed `BURN_TIER_POWER[n - 1]` directly,
 * so 1.5 read index 0.5, returned `undefined`, and propagated a silent NaN into the card score
 * - the kind of failure that shows up as a blank cell rather than a wrong number.
 *
 * Linear interpolation is the honest reading of "on average this consumes 1.5 stacks": half the
 * time it takes 1 (4.5 power), half the time 2 (13.5), so the expected price is 9.0. Clamped at
 * both ends - below 1 it scales the first rung, at or above the last rung it returns it.
 */
function tier(n: number): number {
    if (n <= 0) return 0;
    const last = BURN_TIER_POWER.length;
    if (n >= last) return BURN_TIER_POWER[last - 1];
    if (n <= 1) return BURN_TIER_POWER[0] * n;
    const lower = Math.floor(n);
    const frac = n - lower;
    return BURN_TIER_POWER[lower - 1] + frac * (BURN_TIER_POWER[lower] - BURN_TIER_POWER[lower - 1]);
}

/** Action types whose value depends on board state a static pass can't see - flag, don't guess. */
/**
 * Ticket 32: daemons carry empty `actions` - their whole value is in hooks, so the static model
 * scored every one of them 0.00 and the existing "Daemon Premium x1.5" multiplied nothing.
 * Price one proc's worth of the hook's `do` actions against a fixed expected-proc count.
 *
 * This is a FLOOR, not a price. powerscale has no deck context (the same limitation ticket 29
 * documented for `brute_force`), so a daemon in a deck built around it - echo_chamber in
 * ratatoskr_v1, where five 0-costs each proc it - runs at roughly twice this.
 */
const EXPECTED_DAEMON_PROCS = 4;

const MANUAL_REVIEW_TYPES = new Set([
    // Ticket 46: CLEANSE left this set - it is priced from measured debuff load now.
    'SEARCH', 'PLAY_LAST_CARD', 'TRIGGER_STATUS',
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
/**
 * The `do` actions of every hook a daemon card registers, flattened. LOG entries are dropped -
 * they are flavour, not value. Returns [] for hook shapes that carry no `do` at all (a pure
 * damage multiplier like core_overclock_daemon), which correctly leaves those scoring 0 rather
 * than inventing a number for an effect this model cannot see.
 */
function daemonHookActions(card: ProgramData): ProgramAction[] {
    const ids = (card as unknown as { hooks?: ReadonlyArray<string> }).hooks;
    if (!ids || ids.length === 0) return [];
    const wanted = new Set(ids);
    const out: ProgramAction[] = [];
    for (const entry of Object.values(HOOK_LIBRARY as Record<string, unknown>)) {
        const hooks = (entry as { hooks?: ReadonlyArray<{ id: string; do?: ReadonlyArray<ProgramAction> }> }).hooks;
        if (!hooks) continue;
        for (const h of hooks) {
            if (!wanted.has(h.id) || !h.do) continue;
            for (const a of h.do) if ((a.type as string) !== 'LOG') out.push(a);
        }
    }
    return out;
}

export const calculatePowerscale = (card: ProgramData, seen: ReadonlySet<string> = new Set()): PowerscaleResult => {
    let score = 0;
    const manualReview: string[] = [];

    // Baseline assumptions
    const ASSUMED_CARDS_PLAYED = 2.5;
    const ASSUMED_HP_PERCENT = 0.5;
    const ASSUMED_DISCARD_SIZE = 8;
    // The BOARD-pile assumption: how many stacks of a status a card can expect to find when it
    // reads one. Stays at 3 - Henry, 2026-08-15, after the roster-wide census. This is a FLOOR,
    // not a price: a static pass cannot see the board, and several paths that use it meet
    // larger piles in play (see research/status-pile-census.md).
    const ASSUMED_STATUS_COUNT = 3;

    // The CONSUMED-pile assumption, which is a different question and gets a different number:
    // how many stacks are actually on your own pile at the moment you cash it in. Ticket 58
    // measured `ash_communion` consuming ~1.5 Burn against the 3 it was charged for, and that
    // gap was its entire redline.
    //
    // Burn ONLY, deliberately (Henry, 2026-08-15). Burn is the one status with a hard cap that
    // the decks routinely overflow and that decays 1/turn, so its pile is small and short-lived
    // in a way Poison's and the stream statuses' are not. Anything absent from this table falls
    // back to ASSUMED_STATUS_COUNT above.
    // Every number here is measured — research/status-pile-census.md, 3,840 real battles.
    //   Burn 1.5          measured 1.50 (and 22.7% of casts consume NOTHING — the 4-stack cap
    //                     plus 1/turn decay keep the pile small in a way no other status's is)
    //   Poison 8          measured 11.47 mean / median 12, priced at the CONSERVATIVE end of the
    //                     8-12 band because umbral_feast's median is 3 against a mean of 7.58 —
    //                     a long right tail rather than a typical big pile (max observed 79)
    //   Strengthened 8    measured 7.91 mean / 8 median in ticket 64's shipped skoll_v1, where
    //                     the whole list feeds the pile, not just TREACHERY's 4.8
    // Anything absent falls back to ASSUMED_STATUS_COUNT.
    // Ticket 66: the board assumptions the census re-set. Each is a mean over 3,840 battles,
    // conditional on the pile existing — except ASSUMED_DISTINCT_STATUS, which counts zeros and
    // is therefore the only one needing no floor caveat.
    const ASSUMED_DISTINCT_STATUS = 1;      // measured 0.70, unconditional
    // TICKET 107: the any-status variant for `rimebreaker`'s rework, measured the SAME way as its
    // debuff-only sibling above - distinct status TYPES on the card's target, counted
    // unconditionally, zeros included - so the two constants are comparable.
    // `scratch/anystatuscensus.ts`, 32,603 card-aims: **roster mean 2.01, median 2**.
    // Two numbers from the same run worth recording:
    //   - draugr_v2's OWN targets read 3.18, because his deck loads them. The constant prices the
    //     card for the REGISTRY (anyone can draft it), not for the deck that ships it - which is
    //     the same choice ticket 66 made.
    //   - debuff-only has drifted 0.70 -> 1.19 since ticket 66 measured it, which is the POWER
    //     re-denomination putting more statuses on more boards. It still rounds to 1, so
    //     ASSUMED_DISTINCT_STATUS stays - but it is no longer the comfortable margin it was.
    const ASSUMED_ANY_STATUS = 2;           // measured 2.01, unconditional
    const ASSUMED_WEAKENED_STACKS = 5;      // measured 5.04
    const ASSUMED_BARKSHIELD_STACKS = 7;    // measured 7.70

    // TICKET 101: `Regen: 10` is MEASURED, not guessed - `scratch/drinkcensus.ts` walked 60 real
    // games of the rebuilt audhumbla_v2 and recorded the pile at the instant `drink_deep`
    // resolved: mean 9.85, median 9, p90 17. The ticket expected ~6; the battery banks faster
    // than that because PRIMORDIAL_MILK grants 3 per heal card against Regen's 1/turn decay.
    // Without an entry here the fallback is ONE stack, and the pricer read `drink_deep` at 1.3
    // against a 5.2-6.5 band - a card it could not see at all.
    const ASSUMED_CONSUMED_STACKS: Record<string, number> = { Burn: 1.5, Poison: 8, Strengthened: 8, Regen: 10 };
    const consumedCount = (status?: string): number =>
        (status && ASSUMED_CONSUMED_STACKS[status] !== undefined)
            ? ASSUMED_CONSUMED_STACKS[status]
            : ASSUMED_STATUS_COUNT;

    // A `STATUS_CONSUMED` heal names no status of its own - the status is whatever the card's
    // consume action took. `ash_communion` consumes Burn and heals per stack; `umbral_feast`
    // consumes Poison and heals per stack. They must not price off the same number.
    const consumedStatusOnThisCard: string | undefined =
        (card.actions ?? []).find(a => (a as unknown as { consume?: boolean }).consume === true)?.status;
    /**
     * Ticket 53: CARDS_DRAWN multiplies damage by `cardsDrawnThisTurn`, which is never zero on
     * the turn a card is castable - every species draws at turn start. 3 is the roster's modal
     * `cardDraw`, so this is the floor case: a deck that adds draw effects (valkyrie_v2 runs
     * `glimmer` and `morning_light`) pushes `starfall` above what this prices.
     */
    const ASSUMED_CARDS_DRAWN = 3;
    /**
     * Ticket 71: `CARDS_DRAWN_TRIGGERED` counts only draws an effect caused, so unlike the
     * constant above it IS frequently zero. Measured over 1,365 real casts across the three
     * carrier decks (`scratch/drawcount.ts`): `ink_stream` sees 0.92 triggered draws a cast and
     * `starfall` 1.85. Cast-weighted: (886 x 0.92 + 479 x 1.85) / 1365 = 1.25. Unlike the other
     * ASSUMED_* constants this is a MEAN, not a floor - the distribution has a 24-42% zero mass,
     * so a deck with no draw engine is charged more than it gets and one with a real engine less.
     */
    const ASSUMED_TRIGGERED_CARDS_DRAWN = 1.25;
    /**
     * Ticket 53: how many times a RAMPAGE card (`growPerPlay`) is assumed to resolve in one
     * battle. The static scorer sees printed power, i.e. the FIRST cast; a growth card's real
     * value is its average over the casts it gets. At H casts the average bonus is
     * `growPerPlay x (H-1)/2`, so H=3 charges one full growth step. Chosen, not derived:
     * three casts is roughly what a 10-card deck gives one instance over a 20-turn game.
     * Like every other ASSUMED_* here this is a FLOOR - a recursion deck that replays the same
     * instance (valkyrie_v1's VALHALLA_UPLINK does exactly that) gets more than it pays for.
     */
    const GROWTH_HORIZON_PLAYS = 3;

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
    const exclusiveGroups = new Map<string, { score: number; type: string }>();

    // Ticket 26: the ATTACK and STATUS shares of `score`, tracked alongside it so the deck
    // report can swap exactly those two terms for measured ones.
    let damagePortion = 0;
    let statusPortion = 0;

    /**
     * Ticket 47: self-facing debuff REMOVAL, banked separately so the card's total removal can
     * be capped at the price of removing everything. See the fold-in below `forEach`.
     */
    let removalScore = 0;

    /**
     * Ticket 66: stacks of each status this card has ALREADY applied to a given target, so a
     * second application is priced against the pile the first one built.
     *
     * `molten_core` is the case that forced it: it applies Burn twice (2 + 2), and the scorer
     * priced two independent 2-stack rungs at 13.5 each = 27, where the engine builds ONE pile
     * of 4 worth 52.5 on the non-linear table. Under by 2.55 on a 3.0 budget. The independence
     * was always there; ticket 62's spread table is what made it matter, because the value
     * curve stopped being close to linear across the cap.
     *
     * Keyed by status AND target, because applying 2 Burn to each of two different entities
     * really is two independent 2-stack piles.
     */
    const appliedSoFar = new Map<string, number>();

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
            // Ticket 64: STATUS_CONSUMED on an ATTACK (`sun_devourer` eats its own Strength and
            // pays damage per stack). The path was priced for HEAL and STATUS and would otherwise
            // score the card at its raw printed power, which reads 0.1 against a 6.5 band.
            // Known under-read and sanctioned by the ticket: the fallback assumption is 3 stacks
            // and TREACHERY's measured feed is 4.8, so the sim gate decides this card, not §1.3.
            if (action.scaling === 'STATUS_CONSUMED') power *= consumedCount(consumedStatusOnThisCard);
            else if (action.scaling === 'CARDS_PLAYED') power *= ASSUMED_CARDS_PLAYED;
            // Ticket 26: MISSING_HP is power-side now, priced at the cap - ASSUMED_HP_PERCENT
            // 0.5 means "assume half HP", which IS the MISSING_HP_PCT_CAP of 50.
            else if (action.scaling === 'MISSING_HP') power += (action.scalingPower || 0) * 50;
            else if (action.scaling === 'HP_PERCENT') power *= ASSUMED_HP_PERCENT;
            else if (action.scaling === 'DISCARD_SIZE') power *= ASSUMED_DISCARD_SIZE;
            else if (action.scaling === 'STATUS_COUNT') power *= ASSUMED_STATUS_COUNT;
            // Ticket 66: DAZED_STACKS stays at 3 - it is the ONE board assumption the census
            // vindicated (measured 3.62). Ticket 32's note here claimed ratatoskr_v2's realistic
            // count is ~10; that was hand-derived and is measurably wrong, so it is deleted
            // rather than carried forward.
            else if (action.scaling === 'DAZED_STACKS') power *= ASSUMED_STATUS_COUNT;
            // Ticket 66: DISTINCT_STATUS 3 -> 1. Measured 0.70 distinct debuff types on the
            // card's target, and this is the ONE census number counted UNCONDITIONALLY - zeros
            // included - so it needs no floor caveat. It was over-priced by 4.3x, which is most
            // of why `rimebreaker` carried a redline row.
            else if (action.scaling === 'DISTINCT_STATUS') power *= ASSUMED_DISTINCT_STATUS;
            else if (action.scaling === 'ANY_STATUS') power *= ASSUMED_ANY_STATUS;
            // Ticket 66: BARKSHIELD_STACKS 3 -> 7 (measured 7.70, the largest board pile in the
            // game). Ticket 50's hand-derived "7-10" guess was close; the measurement replaces it.
            else if (action.scaling === 'BARKSHIELD_STACKS') power *= ASSUMED_BARKSHIELD_STACKS;
            // Ticket 53: CARDS_DRAWN multiplies the resolved damage, not the power, but the
            // scorer has one knob and they are the same knob at this resolution.
            else if (action.scaling === 'CARDS_DRAWN') power *= ASSUMED_CARDS_DRAWN;
            else if (action.scaling === 'CARDS_DRAWN_TRIGGERED') power *= ASSUMED_TRIGGERED_CARDS_DRAWN;

            // Ticket 53: RAMPAGE growth. Charge the AVERAGE over the assumed horizon, so the
            // printed power is what the card opens at and the score is what it is worth.
            if (card.growPerPlay) power += card.growPerPlay * (GROWTH_HORIZON_PLAYS - 1) / 2;

            actionScore = (power / 10.0) * ACTION_WEIGHTS['ATTACK'];
        } else if (action.type === 'HEAL') {
            // Ticket 43: `healOverride` is gone from the data model - heals are power-based, so
            // this reads `power` only. And STATUS_CONSUMED applies HERE too: ticket 33 added the
            // multiplier to the STATUS branch and left this one reading a literal, so a card
            // healing "per stack consumed" was priced as if it consumed exactly one.
            const raw = action.power || 0;
            const power = action.scaling === 'STATUS_CONSUMED'
                ? raw * consumedCount(consumedStatusOnThisCard)
                : raw;
            actionScore = (power / 10.0) * ACTION_WEIGHTS['HEAL'];
        } else if (action.type === 'STATUS') {
            // Ticket 33: STATUS_CONSUMED reads a count produced at runtime by a preceding
            // consume action, which static analysis cannot see - the literal `stacks` is 1 and
            // meaningless. Price at ASSUMED_STATUS_COUNT. This is a FLOOR, not a price, the
            // same caveat ticket 32 carries for `slander` and the daemons: hexbloom at its
            // realistic 6 consumed stacks hand-prices to 6.3 against a 6.5 band.
            // Ticket 43: a `consume: true` action REMOVES the status; it was falling through to
            // the apply path and being scored as if it granted one stack, so consuming Poison off
            // an enemy ADDED to the card's score. `stacks` is absent on a consume (it takes the
            // whole pile), so it prices at the same ASSUMED_STATUS_COUNT the scalings use, and
            // the score is negated below.
            const isConsume = (action as unknown as { consume?: boolean }).consume === true;
            const stacks = isConsume
                ? consumedCount(action.status)
                : (action.scaling === 'STATUS_CONSUMED' || action.scaling === 'WEAKENED_STACKS')
                    ? (action.stacks || 1) * (action.scaling === 'STATUS_CONSUMED'
                        ? consumedCount(action.status ?? consumedStatusOnThisCard)
                        : ASSUMED_WEAKENED_STACKS)
                    : (action.stacks || 1);
            const absStacks = Math.abs(stacks);
            const status = action.status;

            // Ticket 66: price this application against the pile the card has already built on
            // this target, not from zero. `priorPile` is 0 for the first application of a
            // status, which makes this a no-op for every single-application card in the roster.
            // A consume is excluded: it REMOVES a pile rather than adding to one.
            const pileKey = `${status}|${(action.target || 'TARGET').toUpperCase()}`;
            const priorPile = isConsume ? 0 : (appliedSoFar.get(pileKey) ?? 0);
            if (!isConsume && status) appliedSoFar.set(pileKey, priorPile + absStacks);
            const marginal = (valueAt: (n: number) => number) =>
                valueAt(priorPile + absStacks) - valueAt(priorPile);

            if (status === 'Strengthened' || status === 'Dazed') {
                actionScore = marginal(n => streamStacks(n) * OFFENSE_STREAM_POWER_PER_STACK) / 10.0;
            } else if (status === 'Weakened' || status === 'Sharp') {
                actionScore = marginal(n => streamStacks(n) * DEFENSE_STREAM_POWER_PER_STACK) / 10.0;
            } else if (status === 'Burn') {
                actionScore = marginal(burnPower) / 10.0;
            } else if (status === 'Poison') {
                actionScore = marginal(poisonPower) / 10.0;
            } else if (status === 'Regen') {
                actionScore = marginal(regenPower) / 10.0;
            } else if (status === 'Energized') {
                actionScore = (absStacks * ENERGIZED_POWER_PER_STACK) / 10.0;
            } else if (status === 'Stunned') {
                actionScore = STUNNED_POWER / 10.0;
            } else if (status === 'Asleep') {
                // `actionIsSelfFacing` is computed further down (it also drives the sign
                // flips), so read the field directly here rather than hoisting it.
                const selfSleep = (action.target || '').toUpperCase() === 'SELF';
                actionScore = (selfSleep ? ASLEEP_SELF_POWER : ASLEEP_POWER) / 10.0;
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
            // Ticket 66: price the pile of the status this card actually multiplies, and price
            // it as a DIFFERENCE. The old model used one shared constant and one shared
            // per-stack rate, so `heat_wave` (doubles Burn) and `contagion` (doubles Poison)
            // scored identically despite their piles measuring 2.27 and 6.57 and their value
            // curves being non-linear in opposite ways - Burn's flattens at its cap, Poison's is
            // quadratic. Doubling a pile is worth `value(P x factor) - value(P)`, nothing else.
            const factor = action.factor ?? 2;
            const pile = MEASURED_BOARD_PILE[action.status ?? ''] ?? ASSUMED_STATUS_COUNT;
            actionScore = (statusPileValue(action.status, pile * factor)
                - statusPileValue(action.status, pile)) / 10.0;
            manualReview.push(action.type);
        } else if (action.type === 'GENERATE_CARD') {
            // Ticket 32: a generated card is worth the card it generates. Recursion is bounded
            // by `seen` - a token that generates itself is scored once and then contributes
            // nothing, so feedback_token -> feedback_token cannot spin.
            const dataId = (action as unknown as { dataId?: string }).dataId;
            if (dataId && !seen.has(dataId)) {
                const next = new Set(seen);
                next.add(dataId);
                actionScore = calculatePowerscale(GetProgramData(dataId), next).score;
            } else {
                actionScore = 0;
                manualReview.push(action.type);
            }
        } else if (action.type === 'CLEANSE') {
            actionScore = CLEANSE_POWER / 10.0;
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
        // GENERATE_CARD is already a whole-card score (scope included) - do not scope it twice.
        if (action.type === 'GENERATE_CARD') { /* no scope multiplier */ }
        else if (scope === 'SELF') actionScore *= 0.9;
        else if (scope === 'SIDE') actionScore *= 2.2;
        else if (scope === 'ALL') actionScore *= 4.0;
        else actionScore *= 1.0;

        // Condition Discount
        if (action.conditionals && action.conditionals.length > 0) {
            // Ticket 48: the flat 0.7 assumes you get the effect ~70% of the time. A self-Asleep
            // gate is worth less than that, because StableOS forces an awake turn after every
            // wake - so Draugr is asleep at most every OTHER turn. Deliberately narrow: only when
            // that is the action's ONLY conditional. A second condition falls back to 0.7.
            const onlyCond = action.conditionals.length === 1
                ? action.conditionals[0] as { type?: string; target?: string; value?: string }
                : null;
            const asleepGated = onlyCond
                && onlyCond.type === 'HAS_STATUS'
                && onlyCond.target === 'SELF'
                && onlyCond.value === 'Asleep';
            actionScore *= asleepGated ? 0.5 : 0.7;
        }

        // Penalties
        if (action.type === 'ATTACK' && actionIsSelfFacing) {
            actionScore *= -1;
        } else if (action.type === 'STATUS') {
            const isBuff = BUFFS.includes(action.status);
            const isDebuff = DEBUFFS.includes(action.status);
            if (isDebuff && actionIsSelfFacing) actionScore *= -1;
            if (isBuff && !actionIsSelfFacing && card.actions.some(a => a.type === 'ATTACK')) actionScore *= -1;
            // Ticket 43: removing a status is worth the negation of applying it, which gives the
            // right sign in all four cases once the two flips above have run - cleansing a debuff
            // off yourself is a gain, eating a debuff you placed on the enemy is a loss.
            if ((action as unknown as { consume?: boolean }).consume === true) actionScore *= -1;
            // Ticket 47: NEGATIVE `stacks` is the other way to remove a status, and it had no
            // flip at all. `absStacks` strips the sign before the tables are read, so `soothe`
            // ("remove 1 Weakened, remove 1 Dazed" on SELF) priced as if it APPLIED both and
            // then took the self-debuff negation above - scoring -0.80 for a card that helps
            // you. Same argument as the consume flip, same shape of fix.
            if ((action.stacks ?? 0) < 0) actionScore *= -1;
        } else if (action.type === 'ENERGY') {
            const amount = action.amount || 0;
            if (amount < 0 && actionIsSelfFacing) actionScore *= -1;
            if (amount > 0 && !actionIsSelfFacing && card.actions.some(a => a.type === 'ATTACK')) actionScore *= -1;
        }

        const key = exclusivityKey(action);
        const removesOwnDebuff = action.type === 'STATUS'
            && actionIsSelfFacing
            && DEBUFFS.includes(action.status)
            && ((action.stacks ?? 0) < 0 || (action as unknown as { consume?: boolean }).consume === true);
        if (removesOwnDebuff && key === null) {
            removalScore += actionScore;
        } else if (key === null) {
            score += actionScore;
            if (action.type === 'ATTACK') damagePortion += actionScore;
            else if (action.type === 'STATUS') statusPortion += actionScore;
        } else {
            // Bank per subject, keeping the largest branch; folded into `score` below once
            // every branch has been seen.
            const subject = key.split('|')[0];
            const previous = exclusiveGroups.get(subject);
            if (previous === undefined || actionScore > previous.score) {
                exclusiveGroups.set(subject, { score: actionScore, type: action.type });
            }
        }
    });

    for (const branch of exclusiveGroups.values()) {
        score += branch.score;
        if (branch.type === 'ATTACK') damagePortion += branch.score;
        else if (branch.type === 'STATUS') statusPortion += branch.score;
    }

    // Ticket 51: removal is priced at a PREMIUM over application, not capped. See
    // `REMOVAL_PREMIUM` for why the ticket-47 cap had to go.
    //
    // Applied to the CARD's total rather than per action, which is the one thing worth keeping
    // from the old shape: what matters is how much the card sheds in total. Removals inside an
    // either/or threshold branch keep the existing max() path and are not premium-charged - no
    // such card exists, and folding them in would break that accounting.
    const chargedRemoval = removalScore * REMOVAL_PREMIUM;
    score += chargedRemoval;
    statusPortion += chargedRemoval;

    // Ticket 32: a daemon's `actions` is empty by construction - score its registered hooks'
    // `do` actions once and multiply by the expected proc count. Recursion is bounded by
    // `seen`: a token that generates itself is scored once and then contributes nothing, so
    // feedback_token -> feedback_token cannot spin.
    if (card.category === 'Daemon' && score === 0) {
        const doActions = daemonHookActions(card);
        if (doActions.length > 0) {
            const proc = calculatePowerscale({
                ...card,
                category: 'Skill',
                exhaust: false,
                isToken: false,
                actions: doActions,
            } as ProgramData, new Set([...seen, card.id]));
            score = proc.score * EXPECTED_DAEMON_PROCS;
            damagePortion = proc.damagePortion * EXPECTED_DAEMON_PROCS;
            statusPortion = proc.statusPortion * EXPECTED_DAEMON_PROCS;
            for (const m of proc.manualReview) manualReview.push(m);
        }
    }

    // Daemon Premium
    if (card.category === 'Daemon') {
        score *= 1.5;
        damagePortion *= 1.5;
        statusPortion *= 1.5;
    }

    // Exhaust/Token Discount
    if (card.exhaust || card.isToken) {
        score *= 0.9;
        damagePortion *= 0.9;
        statusPortion *= 0.9;
    }

    const costFactor = Math.pow(Math.max(numericBaseCost(card.baseCost), 0.5), 1.25);
    const perEnergy = score / costFactor;

    return {
        score: Math.round(score * 10) / 10,
        perEnergy: Math.round(perEnergy * 10) / 10,
        manualReview,
        damagePortion: Math.round(damagePortion * 10) / 10,
        statusPortion: Math.round(statusPortion * 10) / 10,
    };
};
