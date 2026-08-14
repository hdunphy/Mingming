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
const streamStacks = (stacks: number): number =>
    Math.min(stacks, Math.ceil(STATUS_PCT_CAP_MIRROR / STATUS_PCT_PER_STACK_MIRROR));
/** Mirrors Hooks.ts applyDamageModifiers - kept in sync with the engine constants. */
const STATUS_PCT_PER_STACK_MIRROR = 0.02;
const STATUS_PCT_CAP_MIRROR = 0.25;

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
export const BURN_TIER_POWER: number[] = DEFAULT_GAME_CONFIG.status.burnStacks.reduce<number[]>(
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
export function burnPower(stacks: number): number {
    if (stacks <= 0) return 0;
    const cap = BURN_CONFIG.maxStacks;
    const tier = (n: number) => BURN_TIER_POWER[Math.min(n, BURN_TIER_POWER.length) - 1];
    if (stacks <= cap) return tier(stacks);
    const detonations = Math.ceil(stacks / cap) - 1;
    return detonations * BURN_DETONATION_POWER + tier(stacks - detonations * cap);
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
    const ASSUMED_STATUS_COUNT = 3;
    /**
     * Ticket 53: CARDS_DRAWN multiplies damage by `cardsDrawnThisTurn`, which is never zero on
     * the turn a card is castable - every species draws at turn start. 3 is the roster's modal
     * `cardDraw`, so this is the floor case: a deck that adds draw effects (valkyrie_v2 runs
     * `glimmer` and `morning_light`) pushes `starfall` above what this prices.
     */
    const ASSUMED_CARDS_DRAWN = 3;
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
            // Ticket 32: DAZED_STACKS reads the TARGET's stacks, which static analysis cannot
            // see, so this is a FLOOR not a price - the same no-deck-context limit ticket 29
            // documented for brute_force. ratatoskr_v2's realistic count at cast is ~10, not 3.
            else if (action.scaling === 'DAZED_STACKS') power *= ASSUMED_STATUS_COUNT;
            // Ticket 48: DISTINCT_STATUS counts distinct debuff TYPES on the target, so the same
            // FLOOR caveat applies - draugr_v2's realistic count at cast is 3, which is what
            // ASSUMED_STATUS_COUNT happens to be. Coincidence, not derivation.
            else if (action.scaling === 'DISTINCT_STATUS') power *= ASSUMED_STATUS_COUNT;
            // Ticket 50: BARKSHIELD_STACKS reads the SOURCE's own shield, which static analysis
            // cannot see either. Same FLOOR caveat - avalanche's realistic cast is 7-10 stacks
            // (GLACIER_HEART's 5 plus survivors), not the 3 this assumes.
            else if (action.scaling === 'BARKSHIELD_STACKS') power *= ASSUMED_STATUS_COUNT;
            // Ticket 53: CARDS_DRAWN multiplies the resolved damage, not the power, but the
            // scorer has one knob and they are the same knob at this resolution.
            else if (action.scaling === 'CARDS_DRAWN') power *= ASSUMED_CARDS_DRAWN;

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
            const power = action.scaling === 'STATUS_CONSUMED' ? raw * ASSUMED_STATUS_COUNT : raw;
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
                ? ASSUMED_STATUS_COUNT
                : (action.scaling === 'STATUS_CONSUMED' || action.scaling === 'WEAKENED_STACKS')
                    ? (action.stacks || 1) * ASSUMED_STATUS_COUNT
                    : (action.stacks || 1);
            const absStacks = Math.abs(stacks);
            const status = action.status;

            if (status === 'Strengthened' || status === 'Dazed') {
                actionScore = (streamStacks(absStacks) * OFFENSE_STREAM_POWER_PER_STACK) / 10.0;
            } else if (status === 'Weakened' || status === 'Sharp') {
                actionScore = (streamStacks(absStacks) * DEFENSE_STREAM_POWER_PER_STACK) / 10.0;
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
