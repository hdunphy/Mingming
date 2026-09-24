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
import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { GetProgramData, getInflatedProgramRegistry } from '../../engine/data/programRegistry';
import { numericBaseCost, HP_MULTIPLIER, NUMBER_SCALE } from '../../engine/types';
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
    /**
     * ── TICKET 149c-4 — THE SAME CARD, PRICED AT BOTH WIDTHS ─────────────────────────────
     *
     * A `Side` card hits one enemy at 1v1 and three at 3v3, and the scorer had exactly one
     * answer: it charged the 3v3 multiplier always. So every Side card in the pool read as
     * over-budget in a 1v1 fight it is merely ordinary in — the five Ice cards being the
     * clearest case — and the report had no way to say which width it was talking about.
     *
     * §4.2 rules two scores rather than one, and a verdict rule to go with them: the band
     * verdict is against `score1v1` unless the card is `Side`/`All`, where **both are printed
     * and the verdict is the worse of the two**. That last clause is the whole reason this is
     * not simply "score it at 1v1": a card that is fine at one width and egregious at the
     * other is still a card Henry has to see.
     *
     * `score` above is `score1v1` — the general reading, and what every existing consumer
     * wants — so nothing that did not ask for width has to learn about it.
     */
    score1v1: number;
    score3v3: number;
    /**
     * TICKET 149c-6 — §4.4's two hook columns.
     *
     * `hookFloor` is the part of `score` that came from hooks, priced at the ROSTER-MEAN trigger
     * rate; it is included in `score`. `hookCeiling` is the same hooks at the best home-deck rate
     * the census saw, and is included in nothing — no card is ever priced at a ceiling.
     *
     * Their ratio is the build-around index. A high floor is a card everyone has to take; a low
     * floor with a high ceiling is a legitimate deck-specific rare. Both are 0 for the 229 cards
     * that register no hooks.
     */
    hookFloor: number;
    hookCeiling: number;
}

/**
 * Coarse per-action-type value table.
 *
 * Only `ATTACK` and `HEAL` are consumed as flat multipliers on the raw `power` field - the
 * finer section 1.2 rules (below) supersede the rest: status weight depends on *which*
 * status, draw has diminishing returns per card, energy is priced directly in power.
 */
/*
 * ONLY `ATTACK` AND `HEAL` ARE LIVE — ticket 149c-2.
 *
 * Two of these are read (L732, L742). The rest are historical: STATUS, REMOVE_STATUS and ENERGY
 * are each priced by their own branch in the big switch, and `DRAW` was priced by the ladder
 * below. `'DRAW': 15` has been DELETED rather than left sitting here, because it was the one that
 * actively misled — 149b's report opens on it: the live price is the ladder, and a reader looking
 * up "what is a draw worth" found this number instead and got the wrong answer.
 *
 * The other three are left in place because they are §5's next rows' business, not this one's, but
 * they are dead code too: changing any of them changes nothing.
 */
export const ACTION_WEIGHTS: Record<string, number> = {
    'ATTACK': 1,
    // 4 power/1%HP vs damage's 3 power/1%HP => heal's raw `power` field is worth 3/4 as
    // much per point as an attack's (docs/power_curve_spec.md rev 3, "heal costs more than
    // damage").
    'HEAL': 0.75,
    // Dead: priced by their own branches in `calculatePowerscale`. See the note above.
    'STATUS': 12,
    'REMOVE_STATUS': 8,
    'ENERGY': 20,
};

/** Statuses that help whoever holds them - granting one to an enemy is a downside. */
export const BUFFS = ['Strengthened', 'Sharp', 'Regen', 'Energized', 'Haste', 'Protected', 'BarkShield'];

/** Statuses that hurt whoever holds them - taking one yourself is a downside. */
export const DEBUFFS = ['Burn', 'Poison', 'Dazed', 'Stunned', 'Weakened', 'Asleep', 'Vulnerable'];

/**
 * Section 1.3's target-score table, one band per energy cost.
 *
 * Divided by 10 to match the ATTACK branch's `power/10` scoring unit, so `over: 3.0` is a
 * 30-power target. `over` IS the point target, not a redline above it; `under` is 80% of it, an
 * advisory amber line. The numbers themselves are Henry's slot tax — see the block above
 * `BUDGET_BANDS`.
 */
export interface BudgetBand {
    /** Lowest energy cost this band covers. The last band is open-ended (`3+`). */
    cost: number;
    /** Score above this is over budget - a section 1.3 redline. */
    over: number;
    /** Score below this is under budget - advisory only, never a redline. */
    under: number | null;
}

/*
 * ── HENRY'S SLOT TAX, RULED 2026-09-23 (ticket 162 §4b, adopted by 162b) ──────────────────
 *
 * **10 / 30 / 65 / 105 power  ->  12 / 30 / 70 / 120.** Henry: *"keep my numbers."*
 *
 * The rule behind the change, in his words: *"you pay for the cost of playing 1 card — 1e ≈ 30,
 * 2e at least 70"*, and the principle underneath it is that **a 2e or 3e card must beat two 1e
 * cards**. It spends a hand slot as well as the Energy, and the old curve charged it only for the
 * Energy — which is why a 2-energy card at 65 was a worse deal than two 1-energy cards at 30 each
 * and the pool's 2e rung read as a tax on itself.
 *
 * WHAT MOVED, AND WHAT DID NOT. The 1e rung is unchanged at 30, so the curve is anchored where the
 * roster is densest (41 of collection v2's 98 cards) and every price below is still denominated
 * against the same power unit. `under` stays at 80% of `over`, which is where it has always been.
 *
 * WHAT THIS REPRICES. Every costed card in the registry, not only collection v2's 98 — the 170 v1
 * entries twenty post-EA species still field are audited against this table too. That is the
 * intended blast radius: one curve, or the audit says two different things about two halves of the
 * same registry. The v1 entries move by at most a rung's tolerance at 0e and 2e; `results/t162/`
 * holds the before/after.
 *
 * The 3+ band still has no upper bound of its own — a 4-cost card is expected to clear 12.0
 * legitimately.
 *
 * (Was: rev 3.2 / ticket 24's 10/35/75/120 curve, itself down from 10/40/90/140. The POWER UNIT
 * has never changed through any of these — a point of power still buys the same fraction of a
 * health pool — so the per-status prices below are deliberately NOT rescaled. What moves is only
 * how much power a card of a given cost is expected to carry.)
 */
export const BUDGET_BANDS: ReadonlyArray<BudgetBand> = [
    { cost: 0, over: 1.2, under: 0.96 },
    { cost: 1, over: 3.0, under: 2.4 },
    { cost: 2, over: 7.0, under: 5.6 },
    { cost: 3, over: 12.0, under: 9.6 },
];

/**
 * ── TICKET 149c-5 — THE BAND IS A TARGET, NOT A CLIFF ─────────────────────────────
 *
 * Henry, 2026-08-26, on `frost_bite` scoring 3.3 against a 3.0 ceiling: *"3.3 vs 3 is not a
 * problem. 3 is not a hard cut off but a general target we can be +/- some percentage."*
 *
 * The audit was binary — IN BAND or OVER — so a card 1% over and a card 150% over produced the
 * same word, and every audit in this repo has treated them the same way. §4.3 rules ±15% with the
 * percentage always printed.
 *
 * **15% is where the pool's own noise sits**, which is why it is 15 and not a round number picked
 * for being round. `scratch/bandspread.ts` measures the distribution the rule has to describe:
 * the MEDIAN ABSOLUTE deviation from band across 236 costed non-token cards is **15.4% at 1v1**
 * and 13.8% at 3v3. A tolerance under that reclassifies the pool's ordinary spread as violations;
 * one far over it waves through cards that really are mispriced.
 *
 * MAD and not standard deviation, on §4.3's explicit ruling, and the numbers say why: the sd is
 * **68.8%**, four and a half times the MAD, because a handful of cards sit 200–570% over and drag
 * it. A tolerance built on the sd would be built on `bloodwrath`, not on the pool.
 */
export const BAND_TOLERANCE_PCT = 15;

/** The four states §4.3 rules. The strings are what gets printed — there is no second vocabulary. */
export type BandState = 'IN BAND' | 'WITHIN TOLERANCE' | 'OUT OF BAND' | 'MANUAL REVIEW';

export interface BandVerdict {
    state: BandState;
    /** How far past the band, in percent. Negative is under. Always printed, per §4.3. */
    pct: number;
    /** The printable form: `OUT OF BAND +37%`, `IN BAND -23%`. */
    label: string;
}

/**
 * Where a score sits against its band, as one of §4.3's four states.
 *
 * The MANUAL REVIEW branch is the one worth explaining. A score of zero or less is not an
 * under-powered card — it is a card the scorer priced as a net NEGATIVE, which in this pool means
 * a drawback card: `scrubber` scores −1.6 because it sheds an ally's Poison and the model reads
 * removal-from-an-ally as a downside. §4.7 parks that whole tail behind ticket 138, and this state
 * is what keeps it out of the under-band list meanwhile. Routing those to "under band" would be
 * the report asserting nine cards are too weak when what it actually knows is that it cannot
 * price them.
 */
export function bandVerdict(score: number, band: number): BandVerdict {
    const pct = band > 0 ? Math.round((score / band - 1) * 100) : 0;
    const signed = `${pct >= 0 ? '+' : ''}${pct}%`;

    // Checked BEFORE the band comparison: a negative score is under every band there is, and the
    // thing worth saying about it is not "under".
    if (score <= 0) return { state: 'MANUAL REVIEW', pct, label: `MANUAL REVIEW ${signed}` };
    if (pct <= 0) return { state: 'IN BAND', pct, label: `IN BAND ${signed}` };
    if (pct <= BAND_TOLERANCE_PCT) return { state: 'WITHIN TOLERANCE', pct, label: `WITHIN TOLERANCE ${signed}` };
    return { state: 'OUT OF BAND', pct, label: `OUT OF BAND ${signed}` };
}

/**
 * TICKET 163a — **an upgraded card is priced and NOT judged.**
 *
 * Henry, 2026-09-23: *"upgrades are supposed to be broken."* A `+` card is the same card with a
 * bigger number, so it is over its cost band by construction — that is what an upgrade IS, and a
 * band flag on ninety-eight of them would say nothing except that the pass did what it was ruled
 * to do. Three of them (Inferno+, Wildfire+, Heat Wave+) push Burn past its cap of 4 and detonate,
 * also ruled intended.
 *
 * So the SCORE is still computed and still printed — 163 §2 wants the ledger to show how far each
 * `+` moved, and `budget-plus.txt` is that table. What is suppressed is the VERDICT, and only for
 * these cards. This is a predicate rather than a branch inside `bandVerdict` because `bandVerdict`
 * takes two numbers and knows nothing about a card; a report that wants to exempt a row asks here.
 *
 * It is NOT a licence for the rest of the pool. The base card keeps its band, and a `+` more than
 * one band above its base is still worth Henry's eye — 163 §2 asks for that flag specifically, and
 * `budget-plus.txt` prints it as the `rungs` column rather than as a band state.
 */
export function isBandExempt(card: Pick<ProgramData, 'upgradeOf'>): boolean {
    return card.upgradeOf !== undefined;
}

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
/**
 * TICKET 131c: was a bare 75, the pre-buff frame. It derives now because it is the one constant in
 * this file denominated in absolute HP, and it silently mis-prices the three `damageOverride` cards
 * whenever a frame changes size - ticket 131b's x1.5 had already left it 1.5x stale.
 */
const ASSUMED_MAX_HP = Math.round(75 * HP_MULTIPLIER * NUMBER_SCALE);

/**
 * The BOARD-pile assumption: how many stacks of a status a card can expect to find when it reads
 * one. Stays at 3 - Henry, 2026-08-15, after the roster-wide census.
 *
 * This is a FLOOR, not a price: a static pass cannot see the board, and several paths that use it
 * meet larger piles in play (see research/status-pile-census.md). Ticket 149c-7 moved it to module
 * scope so `scoreOS` prices a flat-bonus firmware hook against this number rather than inventing a
 * second one - the census read 9.4 Poison stacks for TOXIN_FANG and 13 Sharp for KINETIC_RAM on
 * the decks that ship them, and those decks are built to feed the hook.
 */
const ASSUMED_BOARD_STATUS_COUNT = 3;
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
/*
 * `EXPECTED_DAEMON_PROCS = 4` STOOD HERE UNTIL TICKET 149c-6, and its own comment said what was
 * wrong with it: *"This is a FLOOR, not a price. powerscale has no deck context, so a daemon in a
 * deck built around it runs at roughly twice this."* Ticket 32 was right about the shape and had
 * no way to measure it, so it picked one number for fourteen cards.
 *
 * 149b measured all fourteen. The replacement is `TRIGGER_RATE_FLOOR` / `TRIGGER_RATE_CEILING`
 * and `scoreHook` below: a rate per trigger class, and the "roughly twice" is now a printed
 * column rather than a caveat in a comment.
 */

/**
 * What a drawn card is worth — the 1st, 2nd and 3rd-or-later card of one DRAW action, in power.
 *
 * TICKET 149c-2, §4.1: **20/15/10**, up from 15/10/5.
 *
 * 149b measured the thing the old numbers were guessing at: the mean scorer value of a card drawn
 * across the 33 shipped decks is **3.39** in /10 units, i.e. 33.9 power, and it is under the deck
 * mean in 31 of the 33 (range 1.39 on nidhoggr_v1 to 7.09 on ymir_v2 —
 * `research/scorer-pricing.md` §2). 15 power was therefore selling the first card at 44% of what
 * a card is worth on an average deck.
 *
 * The raise is deliberately short of the measurement. A scorer that paid the full 33.9 would price
 * a draw as the best line in the game on every deck, which is a deck property rather than a card
 * one — Henry's framing for the whole ticket: *"its numbers are not meant to work for a specific
 * width or deck."* 20 is the general floor; the decks that beat it are the decks built to.
 *
 * The shape is unchanged and is not a guess: a second card joins a hand that is already deciding,
 * so it is worth less than the first, and a third less again.
 */
const DRAW_LADDER_POWER: ReadonlyArray<number> = [20, 15, 10];

/** The two widths a card is priced at — ticket 149c-4. */
export type ScoreWidth = '1v1' | '3v3';

/**
 * What hitting the enemy SIDE is worth, per width.
 *
 * 1v1 is ×1.0 because there is one enemy: a Side card is a single-target card in that fight,
 * and charging it 2.2 was the scorer stating a fact about a different game.
 *
 * 3v3 is ×2.2 and it is measured, not counted. Three targets does not mean three times the
 * value — 149b measured 1.9–2.2 delivered per cast across the pool, because units die and the
 * third target is often already dead or irrelevant. A pure-debuff Side card reads 2.6, and
 * §4.2 rules 2.2 for all of them rather than splitting the constant on a card property the
 * scorer would then have to keep classifying (`research/scorer-pricing.md` §1).
 */
export const SIDE_SCOPE_MULTIPLIER: Record<ScoreWidth, number> = { '1v1': 1.0, '3v3': 2.2 };

/**
 * The same, for `All` scope.
 *
 * **No card in the pool has `target: 'All'`** — 158 Single, 63 Self, 22 Side, 0 All — so this
 * constant prices nothing today and the ledger cannot move on it. It collapses to ×1.0 at 1v1
 * for the same reason Side does, and keeps its historical ×4.0 at 3v3 rather than inheriting
 * Side's 2.2: 2.2 is a MEASURED delivery rate for Side cards and there is no All card to have
 * measured. Carrying a number across from a different scope would read as a measurement.
 *
 * If an `All` card is ever authored, this wants measuring before it is trusted.
 */
export const ALL_SCOPE_MULTIPLIER: Record<ScoreWidth, number> = { '1v1': 1.0, '3v3': 4.0 };

const MANUAL_REVIEW_TYPES = new Set([
    // Ticket 46: CLEANSE left this set - it is priced from measured debuff load now.
    'SEARCH', 'PLAY_LAST_CARD', 'TRIGGER_STATUS',
    'GENERATE_CARD', 'DISCARD', 'EXHAUST', 'RETURN', 'TAUNT',
    'BUFF_NEXT_PROGRAM', 'REDIRECT_TARGET', 'FORCE_DISCARD',
    /*
     * TICKET 162b: `MAX_ENERGY` is listed EXPLICITLY, and the distinction matters.
     *
     * It already scored 0 — through the `else` branch at the bottom of the switch, whose comment
     * reads "Unknown/future action type - don't silently score 0 without saying so". That was the
     * right default for a verb nobody had seen. It is the wrong LABEL for this one: `MAX_ENERGY` is
     * a shipped card action (`overclock_core`) and a shipped hook action (GENESIS_FIRMWARE), and
     * reporting it as unknown invites someone to "fix" the scorer by adding a number.
     *
     * The number is not available statically. A permanent +1 max Energy is worth 40 power per point
     * PER REMAINING REFILL, so its price is `40 x (turns the caster has left)` — a horizon nothing
     * on the card knows. `GROWTH_HORIZON_PLAYS` is the precedent for measuring such a horizon and
     * writing it down; until somebody does that for this verb, the honest reading is "unmeasured".
     */
    'MAX_ENERGY',
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
/*
 * ══ TICKET 149c-6 — HOOKS GET A FORMULA, AND THE FORMULA IS MEASURED ══════════════════
 *
 * `EXPECTED_DAEMON_PROCS = 4` was one number for fourteen cards whose triggers fire at rates an
 * order of magnitude apart. 149b measured every one of them with probe hooks over **22,780
 * unit-turns at 1v1** (`research/scorer-pricing.md` §2), and the constant turned out to be right
 * for exactly one trigger class and wrong by up to 5× for another:
 *
 *   - turn start / turn end fires 0.79 per unit-turn — about 3.9 a game, so 4 was right **by
 *     accident of game length**, which is not the same as being right;
 *   - opponent card played fires **4.2**, roughly 20 a game: `riptide` was priced at a fifth of
 *     what it does;
 *   - Light attack fires **0.00** — no shipped deck has a Light attacker, so `einherjar` was
 *     being charged four procs of an effect that has never once happened.
 *
 * §4.4 replaces the constant with `payoff × rate × horizon`, printed TWICE: a FLOOR at the
 * roster-mean rate and a CEILING at the best home-deck rate the census saw. The ratio between
 * them is the build-around index, and it is the number that answers a question a single score
 * cannot: a high floor is a card everyone has to take, while a low floor with a high ceiling is
 * a legitimate deck-specific rare. `echo_chamber_v2` on ratatoskr_v1 procs 3.3× the roster mean;
 * that is the card working as designed, not a balance problem, and the old single number had no
 * way to say so.
 */

/** The trigger classes the 149b census measured. One rate per class, not per hook. */
export type TriggerClass =
    | 'TURN_BOUNDARY'
    | 'OWN_ZERO_COST_PLAY'
    | 'OWN_TRIGGERED_DRAW'
    | 'BURN_ON_SELF'
    | 'LIGHT_ATTACK'
    | 'OPPONENT_CARD_PLAYED'
    | 'OPPONENT_TRIGGERED_DRAW'
    | 'DAMAGE_TAKEN';

/**
 * Procs per unit-turn at the ROSTER MEAN — what this trigger does on a deck not built for it.
 *
 * Every figure is `research/scorer-pricing.md` §2, measured over 22,780 unit-turns at 1v1 with
 * probe hooks counted outside AI lookahead. This is the rate a card is PRICED at, because the
 * scorer prices cards for the registry — anyone can draft them — and not for the one deck that
 * ships them. The same choice ticket 66 made for the board-pile constants.
 */
export const TRIGGER_RATE_FLOOR: Record<TriggerClass, number> = {
    TURN_BOUNDARY: 0.8,             // measured 0.79; 0-3% of units never see it
    OWN_ZERO_COST_PLAY: 1.0,        // echo_chamber, hoofbeat. 6% of units never see it
    OWN_TRIGGERED_DRAW: 0.33,       // feedback_loop. 67% of units never see it at all
    BURN_ON_SELF: 0.14,             // cinder_armor. 84% of units never see it
    LIGHT_ATTACK: 0.0,              // einherjar. 100% of units never see it - no Light attacker ships
    OPPONENT_CARD_PLAYED: 4.2,      // riptide. 0% miss it; ~20 procs a game
    OPPONENT_TRIGGERED_DRAW: 0.84,  // short_circuit. 41% of units never see it
    DAMAGE_TAKEN: 2.2,              // reactive_plating. Capped by its own counter, see below
};

/**
 * The highest rate the census saw on a deck BUILT for the trigger — the ceiling column.
 *
 * Only two classes have a home deck that beats the roster: `own 0-cost play` reaches 3.3 on
 * ratatoskr_v1 (five 0-costs, each one a proc) and `own triggered draw` reaches 1.4 on kraken_v1.
 * Every other class is its own floor, and that is a finding rather than a gap in the data: an
 * opponent-triggered hook cannot be built around, because the rate is the OPPONENT's behaviour.
 *
 * Nothing is ever priced at these. They exist so the report can say how much headroom a card has
 * on the deck that wants it, which is §4.4's build-around index.
 */
export const TRIGGER_RATE_CEILING: Record<TriggerClass, number> = {
    ...TRIGGER_RATE_FLOOR,
    OWN_ZERO_COST_PLAY: 3.3,        // ratatoskr_v1
    OWN_TRIGGERED_DRAW: 1.4,        // kraken_v1
};

/**
 * When a daemon lands and how long it has to work — §4.4.
 *
 * The AI casts shipped daemons on turn 1.9 mean, median 2, so 2 is the cast turn. The horizon is
 * 3 turns, which is Henry's bar from the design session: a daemon should be worth its energy even
 * when it lands late. Pricing at the full remaining game would flatter every daemon in the pool.
 */
export const DAEMON_CAST_TURN = 2;
export const DAEMON_HORIZON_TURNS = 3;

/** An OS is installed from turn 0 and never leaves, so it gets the longer horizon (§4.4). */
export const OS_HORIZON_TURNS = 5;

/**
 * The daemon premium, kept at 1.5 and finally named for what it is.
 *
 * §4.4: daemons keep it, *"now stated as the size of the sanctioned rare"*. It is not a claim
 * that a daemon delivers 50% more than its actions say — it is Henry's ruling that a daemon is
 * ALLOWED to be over band by half, because *"some rare over-band cards are wanted so players win
 * easier, and daemons may be that rare"*.
 */
export const DAEMON_RARE_PREMIUM = 1.5;

/**
 * Which measured class a hook's trigger belongs to, or `null` when the census never saw it.
 *
 * `null` is a real answer and is handled as one by the caller: a hook the census did not measure
 * is left UNPRICED and flagged for manual review, rather than falling back to a default rate. A
 * default here would read as a measurement, which is the failure mode ticket 66 spent a whole
 * census correcting.
 */
export function classifyHook(hook: HookRecord): TriggerClass | null {
    const trigger = hook.trigger ?? '';
    const from = (hook.when?.source ?? 'SELF').toUpperCase();
    const opponent = from === 'OPPONENT';

    if (trigger === 'onTurnStart' || trigger === 'onTurnEnd') return 'TURN_BOUNDARY';
    if (trigger === 'onCardDraw') {
        // `isNaturalDraw: false` is the discriminator: the census counted EFFECT draws only,
        // because the draw-phase refill happens once a turn for everyone and is not a trigger a
        // card can be built around.
        if (hook.when?.isNaturalDraw !== false) return null;
        return opponent ? 'OPPONENT_TRIGGERED_DRAW' : 'OWN_TRIGGERED_DRAW';
    }
    if (trigger === 'onActionStart') {
        if (opponent) return 'OPPONENT_CARD_PLAYED';
        // The 0-cost gate is what the census measured: echo_chamber and hoofbeat both carry
        // `baseCost: 0, isToken: false`. A hypothetical any-cost own-play hook is a different
        // rate and has never been measured.
        return hook.when?.baseCost === 0 ? 'OWN_ZERO_COST_PLAY' : null;
    }
    if (trigger === 'onActionEnd') return opponent ? 'OPPONENT_CARD_PLAYED' : null;
    if (trigger === 'onStatusApplied') {
        return hook.when?.statusApplied === 'Burn' && !opponent ? 'BURN_ON_SELF' : null;
    }
    if (trigger === 'onDamageCalculated') {
        return (hook.when?.programElement ?? '').toUpperCase() === 'LIGHT' ? 'LIGHT_ATTACK' : null;
    }
    if (trigger === 'onPostDamage') return opponent ? 'DAMAGE_TAKEN' : null;
    return null;
}

/**
 * §4.4's formula: **per-proc payoff × trigger rate × horizon**.
 *
 * Three inputs, each of which is somebody's measurement rather than this function's opinion: the
 * payoff comes from scoring the hook's own actions through the ordinary card formula, the rate
 * from the 149b census, and the horizon from §4.4's cast-turn ruling. That is the whole point of
 * replacing `EXPECTED_DAEMON_PROCS` — the old number silently blended all three.
 */
export function scoreHook(perProcScore: number, opts: { rate: number; horizon: number }): number {
    return perProcScore * opts.rate * opts.horizon;
}

/** A hook as the library stores it, with only the fields the scorer reads. */
export interface HookRecord {
    id: string;
    trigger?: string;
    when?: {
        source?: string;
        statusApplied?: string;
        programElement?: string;
        isNaturalDraw?: boolean;
        baseCost?: number;
    };
    multiplier?: number;
    do?: ReadonlyArray<ProgramAction>;
}

/**
 * Every hook a card registers, as records rather than a flat list of actions.
 *
 * TICKET 149c-6 changed the shape here, and the reason is `reactive_plating`: it registers TWO
 * hooks on different triggers (one on damage taken, one on turn start), and the old flattening
 * put both sets of actions in one bag to be multiplied by one proc count. Once each trigger has
 * its OWN measured rate, a bag is not something that can be priced — the hooks have to stay
 * apart.
 */
export function hooksOf(card: ProgramData): HookRecord[] {
    const ids = (card as unknown as { hooks?: ReadonlyArray<string> }).hooks;
    if (!ids || ids.length === 0) return [];
    const wanted = new Set(ids);
    const out: HookRecord[] = [];
    for (const entry of Object.values(HOOK_LIBRARY as Record<string, unknown>)) {
        const hooks = (entry as { hooks?: ReadonlyArray<HookRecord> }).hooks;
        if (!hooks) continue;
        for (const h of hooks) if (wanted.has(h.id)) out.push(h);
    }
    return out;
}

/** A hook's `do` actions, LOG entries dropped - they are flavour, not value. */
export function hookActions(hook: HookRecord): ProgramAction[] {
    if (!hook.do) return [];
    return hook.do.filter(a => (a.type as string) !== 'LOG');
}

/**
 * One width's worth of the formula — everything `calculatePowerscale` used to be.
 *
 * Split out by ticket 149c-4 so the public entry point can run it twice. It is a pure function
 * of `(card, width)`, so running it twice costs two passes over 243 cards and buys the width
 * honesty §4.2 asks for; the alternative was threading a second running total through every
 * `score +=` in the body, which is the same arithmetic written twice and one place for the two
 * copies to drift.
 */
const scoreAtWidth = (
    card: ProgramData,
    width: ScoreWidth,
    seen: ReadonlySet<string> = new Set(),
): Omit<PowerscaleResult, 'score1v1' | 'score3v3'> => {
    let score = 0;
    /*
     * Ticket 149c-6: the hook half of `score`, at the roster-mean rate and at the best home-deck
     * rate the census saw. `hookFloor` is INCLUDED in `score`; `hookCeiling` never is - nothing
     * is priced at a ceiling. Their ratio is section 4.4's build-around index.
     */
    let hookFloor = 0;
    let hookCeiling = 0;
    const manualReview: string[] = [];

    // Baseline assumptions
    const ASSUMED_CARDS_PLAYED = 2.5;
    const ASSUMED_HP_PERCENT = 0.5;
    const ASSUMED_DISCARD_SIZE = 8;
    /*
     * ── TICKET 149c-3 — `CARDS_DISCARDED` HAD NO BRANCH AT ALL ────────────────────────────
     *
     * `carrion_swoop` is "11 power for every card discarded this turn", and the scorer read the
     * printed 11 with no scaling and no `manualReview` flag — the flag at L724 covers only
     * BURN_STACKS and SELF_ANY_STATUS. 149b called it *"the largest single miss in either
     * table"*: a 1-energy card that lands **2.2 fire_punches a cast** (16.6% of a target's pool,
     * 1.6 casts a game on hraesvelgr_v1) and scored **1.1**. Not over-priced or under-priced —
     * unseen, and silently, which is the failure mode ticket 66 spent a whole census closing.
     *
     * **2, not the measured 5.03.** The 5.03 is hraesvelgr_v1's number, and hraesvelgr_v1 IS the
     * discard engine — every card in it feeds this one. `carrion_swoop` on sleipnir_v2, which has
     * no engine, discards about one and prices exactly. Henry's framing governs which of those
     * the constant is: *"its numbers are not meant to work for a specific width or deck."* So the
     * constant is the roster-general low end, and the 5.03 is what the ceiling column in 149c-6
     * is for. Pricing the engine's number here would redline the card for everyone who cannot
     * build it.
     *
     * Cited: `results/t149_oscensus/FINDINGS.md` line 64 (1,200 games, 1,951 casts, 5.03 cards
     * discarded per cast on the owning deck) and `research/scorer-pricing.md` §4.
     */
    const ASSUMED_CARDS_DISCARDED = 2;
    // The board-pile assumption, hoisted to module scope by ticket 149c-7 so `scoreOS` can price
    // a flat-bonus firmware hook against the same number rather than a second copy of it.
    const ASSUMED_STATUS_COUNT = ASSUMED_BOARD_STATUS_COUNT;

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
            // TICKET 138 amendment: `percentMaxHp` is already a percentage of a health pool, so it
            // prices at the spec rate directly and needs no ASSUMED_MAX_HP at all. That is the
            // reason it replaced `damageOverride` on all three cards that carried one: a literal-HP
            // effect has to be re-derived against a frame every time frames move, and this one does
            // not. The `damageOverride` branch is kept for the relic/system HP path, which still
            // uses it; no CARD action carries it any more, and `noDamageOverrideOnCards.test.ts`
            // fails if one appears again - it never worked there.
            let power = typeof action.percentMaxHp === 'number'
                ? action.percentMaxHp * POWER_PER_PERCENT_MAXHP
                : typeof action.damageOverride === 'number'
                    ? (action.damageOverride / ASSUMED_MAX_HP) * 100 * POWER_PER_PERCENT_MAXHP
                    : (action.power || 0);
            // Ticket 64: STATUS_CONSUMED on an ATTACK (`sun_devourer` eats its own Strength and
            // pays damage per stack). The path was priced for HEAL and STATUS and would otherwise
            // score the card at its raw printed power, which reads 0.1 against a 6.5 band.
            // Known under-read and sanctioned by the ticket: the fallback assumption is 3 stacks
            // and TREACHERY's measured feed is 4.8, so the sim gate decides this card, not §1.3.
            if (action.scaling === 'STATUS_CONSUMED') power *= consumedCount(consumedStatusOnThisCard);
            else if (action.scaling === 'CARDS_PLAYED') power *= ASSUMED_CARDS_PLAYED;
            // Ticket 149c-3: the mirror of CARDS_PLAYED above, and it was simply missing. See
            // `ASSUMED_CARDS_DISCARDED` for why the constant is the roster's 2 and not the
            // owning deck's measured 5.03.
            else if (action.scaling === 'CARDS_DISCARDED') power *= ASSUMED_CARDS_DISCARDED;
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
            // TICKET 136h: two scalings this scorer deliberately CANNOT price, flagged rather
            // than silently read at their printed base - which would score `firestorm_talon` at
            // 25 power when it is 25 x up to 4 Burn, and `corroded_edge` at 20 when it is 20 x
            // 3-4 statuses. Both were HAND-PRICED in ticket 136 against their real ceilings
            // (Talon 25 x <=4 Burn = <=100 at 2e, because Burn caps at 4; Corroded Edge 20 x 3-4
            // at 1e) and both are decided by the sim gate, not by section 1.3.
            //
            // Not given an ASSUMED_ constant on purpose: every one of those in this file came
            // from the ticket-66 census of REAL battles, and neither pile has been measured.
            // A guessed constant here would read as a measurement, which is the failure mode
            // ticket 66 spent a whole census correcting.
            else if (action.scaling === 'BURN_STACKS' || action.scaling === 'SELF_ANY_STATUS') {
                manualReview.push(`ATTACK:${action.scaling}`);
            }
            /*
             * TICKET 163a — three more scalings this scorer cannot price, found by the `+` ledger.
             *
             * `SHARP_STACKS`, `STRENGTH_STACKS` and `TARGET_STATUS_STACKS` fell off the end of this
             * chain and contributed NOTHING, with no flag. That is the one outcome the paragraph
             * above rules out: a silent zero reads as a price, and six shipped cards were priced at
             * their printed base with their whole rider invisible — `flashover` (50 **+15 per
             * Burn**), `cinder_lance` (40 +6 per Sharp), `sap_strength` (20 +6 per Weakened),
             * `thorn_whip` and `spike_launch` (15 +5 per Sharp), and `unbound_fang`, whose power is
             * MULTIPLIED by the pile and was therefore read at 5.
             *
             * Found because 163a's ledger asks a question 162b's could not: the `+` pass moved every
             * one of those riders and the scorer reported a lift of **exactly zero** on all five
             * that have one. A card that does not move when its only number moves is an instrument
             * fault, not a dud upgrade.
             *
             * FLAGGED, NOT PRICED, on this file's own rule: every `ASSUMED_` constant here came out
             * of ticket 66's census of real battles, and the Sharp, Strength and target-Burn piles
             * have not been measured. A number invented here would read as a measurement. So these
             * say UNPRICED and the ledger prints it, which is the honest state until somebody runs
             * the census — and it is a smaller claim than the zero they were making before.
             */
            else if (action.scaling === 'SHARP_STACKS' || action.scaling === 'STRENGTH_STACKS'
                || action.scaling === 'TARGET_STATUS_STACKS') {
                manualReview.push(`ATTACK:${action.scaling}`);
            }

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
            /*
             * The ladder, in /10 units. `DRAW_LADDER_POWER` is the price; the table above is not.
             *
             * Ticket 149c-2 raised it from 15/10/5 to 20/15/10 on §4.1. 149b measured what 15
             * power was buying: the mean scorer value of a card drawn across the 33 shipped decks
             * is **3.39** — 2.26× the 1.5 the first card was priced at, and under the deck mean
             * in 31 of the 33 (`research/scorer-pricing.md` §2). The scorer was selling a card for
             * less than half what a card is worth, which is why every draw-2 in the pool read as
             * under-band while ticket 131's field test had the draw-2 arm of `whirlpool_v2` at
             * 73.9% against the shipped arm's 47.1%.
             *
             * 20/15/10 rather than 34/34/34: the ladder's SHAPE is right even where its level was
             * not. The second card off a refill is worth less than the first because the hand it
             * joins is already making the decision, and the third less again — what changes here
             * is the floor, not the slope.
             */
            for (let i = 1; i <= count; i++) {
                actionScore += DRAW_LADDER_POWER[Math.min(i, DRAW_LADDER_POWER.length) - 1] / 10;
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
        // Ticket 149c-4: these two are the only terms that know how wide the fight is.
        else if (scope === 'SIDE') actionScore *= SIDE_SCOPE_MULTIPLIER[width];
        else if (scope === 'ALL') actionScore *= ALL_SCOPE_MULTIPLIER[width];
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

        /*
         * ── TICKET 162b — WHOSE SIDE DOES THIS LAND ON ────────────────────────────────────
         *
         * Every sign flip below asks one question: is this effect happening to ME or to THEM. It
         * asked it as `action.target === 'SELF'`, which was the same question until 160-e1, because
         * `TARGET` could only ever mean an enemy.
         *
         * It cannot now. An `allyTarget` card's payload is written on `TARGET` and lands on a
         * FRIENDLY body, so the old test read every one of them backwards: `soothe` ("remove 1
         * stack of a debuff from an ally") priced at **-0.8**, a card that helps you scored as a
         * cost. That is ticket 47's bug exactly, re-created from the other direction — and ticket
         * 47's note is still three lines below, describing the shape.
         *
         * `scope` above is deliberately NOT changed. It asks how WIDE the card reaches, and an ally
         * card reaches one body or three by the same arithmetic an enemy card does. Only the signs
         * were ever about sides.
         */
        const landsOnOwnSide = actionIsSelfFacing || card.allyTarget === true;

        // Penalties
        if (action.type === 'ATTACK' && actionIsSelfFacing) {
            actionScore *= -1;
        } else if (action.type === 'STATUS') {
            const isBuff = BUFFS.includes(action.status);
            const isDebuff = DEBUFFS.includes(action.status);
            if (isDebuff && landsOnOwnSide) actionScore *= -1;
            if (isBuff && !landsOnOwnSide && card.actions.some(a => a.type === 'ATTACK')) actionScore *= -1;
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
            if (amount < 0 && landsOnOwnSide) actionScore *= -1;
            if (amount > 0 && !landsOnOwnSide && card.actions.some(a => a.type === 'ATTACK')) actionScore *= -1;
        }

        const key = exclusivityKey(action);
        /*
         * ── TICKET 149c-8 (§4.8) — CONSUMING YOUR OWN PILE IS NOT REMOVAL ────────────────
         *
         * `REMOVAL_PREMIUM` exists because shedding a debuff undoes an OPPONENT's card as well as
         * helping you — two cards' worth of swing for one, which is why ticket 51 priced it above
         * plain application. That rationale does not survive contact with a `consume`.
         *
         * `umbral_feast` and `bloodwrath` consume **their own Poison**, which their own deck put
         * there on purpose as fuel. Nothing is being neutralised; the pile is being cashed. They
         * were collecting a 25% premium for spending a resource they built themselves, and §4.8
         * rules it off: the shed term goes 12.15 -> 9.7.
         *
         * The discriminator is `consume`, not the target. A `stacks: -N` shed on yourself is still
         * removal in the sense the premium means — the Poison on you is usually the opponent's —
         * and keeps it. A `consume` takes the WHOLE pile as fuel, which is a card design that only
         * makes sense when the pile is yours.
         */
        const isConsumeAction = (action as unknown as { consume?: boolean }).consume === true;
        const removesOwnDebuff = action.type === 'STATUS'
            && actionIsSelfFacing
            && DEBUFFS.includes(action.status)
            && (action.stacks ?? 0) < 0;
        if (isConsumeAction && actionIsSelfFacing && action.type === 'STATUS'
            && DEBUFFS.includes(action.status) && key === null) {
            // Scored at face value, with no premium and no separate accounting.
            score += actionScore;
            statusPortion += actionScore;
        } else if (removesOwnDebuff && key === null) {
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

    /*
     * Ticket 32: a daemon's `actions` is empty by construction - score its registered hooks'
     * `do` actions once and multiply by the expected proc count. Recursion is bounded by
     * `seen`: a token that generates itself is scored once and then contributes nothing, so
     * feedback_token -> feedback_token cannot spin.
     *
     * ── TICKET 149c-1 — THE HOOKS ARE ADDED, NOT SUBSTITUTED ───────────────────────────
     *
     * This was gated on `score === 0` and ASSIGNED rather than added, which made it a fallback
     * for "the card scored nothing" instead of a price for "the card has hooks". A daemon with
     * BOTH an on-cast action and a hook had its hook silently dropped — 149b measured it: an
     * in-memory `feedback_loop_daemon` with an added on-cast ATTACK 10 scored **1.2 instead of
     * 3.2**, the on-cast action alone, with the entire reason the card exists priced at zero.
     *
     * No shipped daemon trips it today, and that was checked rather than taken from the ticket:
     * of the fourteen daemons in the pool, thirteen carry `actions: []` and the one that does not
     * (`battery_pack`) registers no hooks. So §1.3 is byte-identical and this is a trap removed
     * before anyone stands on it, not a repricing.
     *
     * `+=` rather than `=` is the whole fix. A daemon is worth what it does on cast PLUS what its
     * hooks do, and there is no reading of the card on which one replaces the other.
     */
    /*
     * ── TICKET 149c-6 — ONE RATE PER TRIGGER, NOT ONE CONSTANT FOR FOURTEEN CARDS ────────
     *
     * The hooks are priced one at a time now, each at its OWN measured rate. `reactive_plating`
     * is why they cannot be pooled: it registers a damage-taken hook and a turn-start hook, and
     * those fire at 2.2 and 0.8 per unit-turn. One bag of actions times one proc count cannot
     * express that.
     *
     * See `TRIGGER_RATE_FLOOR` for the census and for why the FLOOR is what gets charged.
     */
    if (card.category === 'Daemon') {
        for (const hook of hooksOf(card)) {
            const triggerClass = classifyHook(hook);
            if (triggerClass === null) {
                /*
                 * A trigger the census never measured. Flagged, not defaulted: a fallback rate
                 * here would read as a measurement, which is exactly the failure ticket 66 spent
                 * a whole census correcting. `core_overclock_daemon`'s damage multiplier lands
                 * here, and 149c-7 is where multiplier hooks get a price.
                 */
                manualReview.push(`HOOK:${hook.trigger ?? hook.id}`);
                continue;
            }

            const floorRate = TRIGGER_RATE_FLOOR[triggerClass];
            const ceilingRate = TRIGGER_RATE_CEILING[triggerClass];
            /*
             * An HONEST ZERO, and the one place a zero is an answer rather than a gap.
             * `einherjar_standard` triggers on a Light attack, and the census measured that at
             * 0.00 across 22,780 unit-turns because no shipped deck has a Light attacker. The
             * card is worth nothing today; saying so is the measurement doing its job, and
             * flagging it for review would be asking a human to re-derive a number we have.
             */
            if (floorRate === 0 && ceilingRate === 0) continue;

            const actions = hookActions(hook);
            if (actions.length === 0) {
                // A modifier hook - its value is in `multiplier`, which needs the deck's mean
                // attack score to price. 149c-7's business; flagged rather than read as 0.
                if (hook.multiplier !== undefined) manualReview.push(`HOOK_MULTIPLIER:${hook.id}`);
                continue;
            }

            const proc = scoreAtWidth({
                ...card,
                category: 'Skill',
                exhaust: false,
                isToken: false,
                actions,
                // Ticket 149c-4: the hook is priced at the SAME width as the card carrying it.
            } as ProgramData, width, new Set([...seen, card.id]));

            const horizon = DAEMON_HORIZON_TURNS;
            const atFloor = scoreHook(proc.score, { rate: floorRate, horizon });
            score += atFloor;
            damagePortion += scoreHook(proc.damagePortion, { rate: floorRate, horizon });
            statusPortion += scoreHook(proc.statusPortion, { rate: floorRate, horizon });
            hookFloor += atFloor;
            hookCeiling += scoreHook(proc.score, { rate: ceilingRate, horizon });
            for (const m of proc.manualReview) manualReview.push(m);
        }
    }

    // Daemon Premium - ticket 149c-6 named it `DAEMON_RARE_PREMIUM`; see that constant for what
    // it is actually asserting, which is a ruling rather than a measurement.
    if (card.category === 'Daemon') {
        score *= DAEMON_RARE_PREMIUM;
        damagePortion *= DAEMON_RARE_PREMIUM;
        statusPortion *= DAEMON_RARE_PREMIUM;
        hookFloor *= DAEMON_RARE_PREMIUM;
        hookCeiling *= DAEMON_RARE_PREMIUM;
    }

    // Exhaust/Token Discount
    if (card.exhaust || card.isToken) {
        score *= 0.9;
        damagePortion *= 0.9;
        statusPortion *= 0.9;
        // The two hook columns take it too, so `hookFloor` stays a component of `score` that a
        // reader can subtract rather than a parallel number on a different scale.
        hookFloor *= 0.9;
        hookCeiling *= 0.9;
    }

    const costFactor = Math.pow(Math.max(numericBaseCost(card.baseCost), 0.5), 1.25);
    const perEnergy = score / costFactor;

    return {
        score: Math.round(score * 10) / 10,
        perEnergy: Math.round(perEnergy * 10) / 10,
        manualReview,
        damagePortion: Math.round(damagePortion * 10) / 10,
        statusPortion: Math.round(statusPortion * 10) / 10,
        hookFloor: Math.round(hookFloor * 10) / 10,
        hookCeiling: Math.round(hookCeiling * 10) / 10,
    };
};

/**
 * Section 1.1's score for a card, at both widths — ticket 149c-4.
 *
 * `score`, `perEnergy` and the two portions are the **1v1** reading, because that is the general
 * one and it is what every consumer that does not ask about width means. `score3v3` sits beside
 * them for the report's Side/All rows and for §4.2's "the verdict is the worse of the two".
 *
 * Identical for the 221 of 243 cards that are not Side or All: the two passes differ in exactly
 * two multipliers, so a card with no Side action gets the same number twice. That is not waste
 * worth optimising — the whole registry scores in milliseconds either way, and a fast path here
 * would be a second place for the widths to disagree.
 */
export const calculatePowerscale = (
    card: ProgramData,
    seen: ReadonlySet<string> = new Set(),
): PowerscaleResult => {
    const narrow = scoreAtWidth(card, '1v1', seen);
    const wide = scoreAtWidth(card, '3v3', seen);
    return { ...narrow, score1v1: narrow.score, score3v3: wide.score };
};

/*
 * ══ TICKET 149c-7 — FIRMWARE GETS A BAND OF ITS OWN ═══════════════════════════════════════
 *
 * §4.5: OSes are scored in **delivered value per game as a percentage of a health pool** — the
 * census unit — with **15–40% in band and anything above 50% flagged**.
 *
 * A percentage of a pool rather than a card score, because an OS is not a card. It costs no
 * energy, occupies no slot, is chosen once and then runs for the whole game; there is no budget
 * band to hold it against. What CAN be asked is "how much of a health pool does this firmware
 * move over a game", and the census answered it for 33 of them.
 *
 * ── WHERE THE RATES COME FROM, AND WHY NOT §5's "HORIZON 5" ───────────────────────────────
 *
 * §5 said "Σ hooks via 149c-6 with horizon 5", i.e. the daemon trigger table times five turns.
 * That table cannot reach firmware: it has eight classes, drawn from the fourteen DAEMON hooks,
 * and the OS hooks fire on `onHeal`, `onDiscarded`, `onDeckShuffled`, `onHpThresholdCrossed`,
 * `onStatusRemoved` and any-cost own-play — none of which the daemon census measured. Applying
 * it would have returned MANUAL REVIEW for most of the roster.
 *
 * The firmware census measured each OS directly instead, in **procs per game**, which is the
 * denominator §4.5's band is already expressed in. So `OS_PROC_RATE` is per-hook and measured,
 * and there is no horizon to multiply by — a per-game rate already spans the game, and
 * multiplying it by five would be counting the same procs five times.
 *
 * This keeps 149c-6's split exactly: **the payoff is computed from the card data, the rate is
 * measured**. Re-tune what a hook does and the score follows; change how often it fires and the
 * census has to be re-run, which is the honest dependency rather than a hidden one.
 */

/** §4.5's band, in percent of a health pool delivered per game. */
export const OS_BAND_MIN_PCT = 15;
export const OS_BAND_MAX_PCT = 40;
export const OS_FLAG_PCT = 50;

/**
 * Procs per game, per HOOK, from the ticket-63 firmware census delivered under 149 §3d
 * (`research/firmware-power-census.md`, tables 1–3; the parenthesised "offers" column there is
 * how often the trigger CONDITION was met, this is how often the hook actually fired).
 *
 * Per hook and not per OS because several OSes register more than one, at different rates:
 * `fenrir_v1` fires its own-attack hook and its ally-attack hook 6.09 times each, while
 * `jormungandr_v1` counts on every ally action and only pays out on the fifth, 1.63 times.
 *
 * An OS absent from this table is NOT scored 0 — it is reported as unmeasured. A default here
 * would read as a measurement, which is the failure mode ticket 66 spent a whole census
 * correcting.
 */
export const OS_PROC_RATE: Record<string, number> = {
    // ── Table 1: HP-denominated payoffs ──
    valk_v2_rebirth: 14.12,             // valkyrie_v2 REBIRTH_CYCLE_OS, on reshuffle
    hraes_v1_gale: 12.80,               // hraesvelgr_v1 GALE_FORCE_OS, on voluntary discard
    ratatoskr_v1_hook: 53.8,            // ratatoskr_v1 GOSSIP_NODE — the largest rate in the census
    fenrir_v1_hook: 6.09,               // fenrir_v1 UNBOUND_KERNEL, own attack
    fenrir_v1_ally_hook: 6.09,          // ...and the ally half, same rate (SELF is an ally at 1v1)

    // ── Table 2: modifier hooks ──
    jorm_v2_toxin_fang: 5.70,           // jormungandr_v2 TOXIN_FANG_OS
    draugr_v2_chill: 8.70,              // draugr_v2 GRAVE_CHILL_OS, fires on 35% of hits
    gullin_v2_ram: 23.39,               // gullinbursti_v2 KINETIC_RAM_OS, on her multi-hit list
    kraken_v2_hook: 3.00,               // kraken_v2 TIDAL_CRUSH_OS

    // ── Table 3: stat / resource grants ──
    huldra_v1_hook: 20.34,              // huldra_v1 ALLURE_PROXY
    kraken_v1_hook: 6.58,               // kraken_v1 ABYSSAL_INK_SYS
    ratatoskr_v2_hook: 12.55,           // ratatoskr_v2 INSTIGATOR_OS
    nidhoggr_v2_bloodscent: 2.11,       // nidhoggr_v2 BLOOD_SCENT_OS
    nidhoggr_v1_root: 2.66,             // nidhoggr_v1 ROOT_CORRUPTION
    ymir_v1_hook: 7.90,                 // ymir_v1 GLACIER_HEART_SYS
    aud_v2_milk: 10.20,                 // audhumbla_v2 PRIMORDIAL_MILK
    fafnir_v2_corrupted: 3.08,          // fafnir_v2 CORRUPTED_GOLD_OS
    fenrir_v2_hook: 9.24,               // fenrir_v2 CINDER_WALL_OS
    skoll_v2_solar_charge: 4.98,        // skoll_v2 solar_charge (the Strengthened half)
    jorm_v1_trigger: 1.63,              // jormungandr_v1 OUROBOROS_LOOP, the 5th-card payout
    draugr_v1_wake: 0.91,               // draugr_v1 PERMAFROST_WAKE
    hel_v1_cadence_dark: 6.02,          // hel_v1 TWILIGHT_CADENCE, Dark half
    hel_v1_cadence_light: 5.89,         // ...and Light half
    skoll_v1_hook: 10.90,               // skoll_v1 TREACHERY_KERNEL
    sleipnir_v1_hook: 10.74,            // sleipnir_v1 MOMENTUM_DRIVE
    sleipnir_v2_hook: 8.80,             // sleipnir_v2 WAR_STEED_OS
    aud_v1_genesis: 1.87,               // audhumbla_v1 GENESIS_FIRMWARE, the overheal payout
    gullin_v1_prepare: 0.00,            // gullinbursti_v1 UNSTOPPABLE_MASS — see the note below
};

/**
 * Hooks whose measured rate is a real zero rather than a gap, with the reason.
 *
 * `gullin_v1_prepare` is `BUFF_NEXT_PROGRAM`, which leaves no state delta the census probe could
 * read — 42.84 offers and nothing measurable. That is a limit of the INSTRUMENT, not a fact about
 * the card, so a zero here would be the report asserting the firmware does nothing.
 *
 * `hel_v2_lifeblood` stood here too, at a genuine zero: an `onHealCalculated` multiplier of 1.0,
 * which 149b measured as **inert** and reported as one of the two findings that were not on the
 * ticket. **Ticket 150a deleted the hook**, so there is nothing left to rate. The entry is gone
 * rather than kept at zero, because a rate for a hook that does not exist is not a measurement.
 */
export const OS_RATE_ZERO_REASON: Record<string, string> = {
    gullin_v1_prepare: 'BUFF_NEXT_PROGRAM leaves no state delta the census probe reads (42.8 offers)',
};

/** How one hook contributes to its OS's per-game total. */
export interface OsHookContribution {
    hookId: string;
    /** `ACTIONS` scores the hook's own `do`; `MULTIPLIER` and `FLAT_BONUS` are priced below. */
    kind: 'ACTIONS' | 'MULTIPLIER' | 'FLAT_BONUS' | 'UNREADABLE';
    /** Procs per game from the census, or null when this hook was never measured. */
    procsPerGame: number | null;
    /** The payoff of one proc, in the scorer's /10 power units. */
    perProcScore: number;
    /** `perProcScore x procsPerGame`, converted to percent of a health pool. */
    pctOfPool: number;
}

export type OsVerdict = 'UNDER BAND' | 'IN BAND' | 'OVER BAND' | 'FLAGGED' | 'UNMEASURED';

export interface OsScore {
    id: string;
    name: string;
    /** §4.5's unit: delivered value per game as a percentage of a health pool. */
    pctOfPoolPerGame: number;
    verdict: OsVerdict;
    contributions: OsHookContribution[];
    /** Hook ids this OS registers that the census never measured. */
    unmeasured: string[];
    /**
     * Action types inside a hook's payoff that the static formula cannot honestly price -
     * `MAX_ENERGY`, `COUNTER`, `BUFF_NEXT_PROGRAM` and the rest of `MANUAL_REVIEW_TYPES`.
     *
     * A percentage with entries here is a FLOOR, not a price, in exactly the way a card's score
     * is when its `manualReview` is non-empty. `audhumbla_v1` GENESIS_FIRMWARE is the clearest
     * case: its whole payoff is `MAX_ENERGY`, so its honest reading is "unmeasured", not "0%".
     */
    unpriced: string[];
    /**
     * True when the OS registers no hooks at all in `hooks.json` — its behaviour lives in
     * `CustomFirmware` rather than in data, so a hook-walking scorer cannot see it. Six of them:
     * reported as such rather than scored 0, which would read as "this firmware does nothing".
     */
    codeDriven: boolean;
}

/**
 * The pool's mean ATTACK-card score, for pricing multiplier hooks.
 *
 * §4.5 prices a modifier hook as `(multiplier - 1) x the deck's mean attack score x rate`, and
 * the scorer has no deck. The ROSTER mean is the general form of the same quantity, and it is
 * the same choice every other constant in this file makes: price for the registry, because
 * anyone can draft the mingming.
 *
 * Computed from the live registry rather than frozen as a literal, so a repricing of attacks
 * carries through instead of leaving this behind as a stale number with a citation on it.
 */
let meanAttackScoreCache: number | null = null;
export function meanAttackScore(): number {
    if (meanAttackScoreCache !== null) return meanAttackScoreCache;
    const registry = getInflatedProgramRegistry();
    const attacks = (Object.values(registry) as ProgramData[]).filter(
        // TICKET 163a: BASE cards only. This mean is the scorer's own reference rate — §4.5 prices
        // an OS multiplier as `(m - 1) x meanAttackScore()` — so letting ninety-eight upgraded
        // attacks into it would have raised every firmware's price because the UPGRADE PASS
        // shipped, which is a balance instrument reading its own reflection.
        c => (c.actions ?? []).some(a => (a.type as string) === 'ATTACK') && !c.isToken && !c.upgradeOf,
    );
    const total = attacks.reduce((sum: number, c) => sum + Math.max(0, scoreAtWidth(c, '1v1').score), 0);
    meanAttackScoreCache = attacks.length > 0 ? total / attacks.length : 0;
    return meanAttackScoreCache;
}

/** A score in /10 power units, as a percentage of one health pool. */
function pctOfPool(score: number): number {
    // `POWER_PER_PERCENT_MAXHP` is the scorer's own power->HP table: 3 power buys 1% of a pool.
    return Math.round((score * 10 / POWER_PER_PERCENT_MAXHP) * 10) / 10;
}

/**
 * What one firmware delivers per game, as a percentage of a health pool — §4.5.
 *
 * Three hook shapes, priced three ways, and a fourth that is not priced at all:
 *
 *   - `do` actions    scored through the ordinary card formula, exactly as a daemon's are;
 *   - `multiplier`    `(m - 1) x meanAttackScore()`, §4.5's rule;
 *   - `bonus`         a FLAT HP bonus per stack (TOXIN_FANG, KINETIC_RAM). Priced at the
 *                     scorer's roster-general stack assumption, which is a FLOOR: the census
 *                     read 9.4 Poison stacks for TOXIN_FANG and 13 Sharp for KINETIC_RAM on the
 *                     decks that ship them, and those decks are built to feed the hook;
 *   - anything else   `UNREADABLE`, and it says so rather than contributing a silent zero.
 */
export function scoreOS(osId: string): OsScore {
    const entry = (HOOK_LIBRARY as Record<string, unknown>)[osId] as
        { id?: string; name?: string; hooks?: HookRecord[] } | undefined;
    const name = entry?.name ?? osId;
    const hooks = entry?.hooks ?? [];

    const contributions: OsHookContribution[] = [];
    const unmeasured: string[] = [];
    const unpriced: string[] = [];
    let total = 0;

    for (const hook of hooks) {
        const rate = Object.prototype.hasOwnProperty.call(OS_PROC_RATE, hook.id)
            ? OS_PROC_RATE[hook.id]
            : null;

        let kind: OsHookContribution['kind'] = 'UNREADABLE';
        let perProc = 0;

        const actions = hookActions(hook);
        const bonus = (hook as unknown as { bonus?: number }).bonus;
        if (actions.length > 0) {
            kind = 'ACTIONS';
            const scored = scoreAtWidth({
                id: `${osId}__${hook.id}`,
                name: hook.id,
                description: '',
                element: 'None',
                target: 'Single',
                category: 'Skill',
                rarity: 'Common',
                baseCost: 1,
                constraints: [],
                actions,
            } as unknown as ProgramData, '1v1');
            perProc = scored.score;
            for (const m of scored.manualReview) if (!unpriced.includes(m)) unpriced.push(m);
        } else if (hook.multiplier !== undefined) {
            kind = 'MULTIPLIER';
            /*
             * THE SIGN DEPENDS ON WHOSE DAMAGE IS BEING MULTIPLIED, and getting it wrong is the
             * easy mistake here. A hook on the OWNER's damage is worth `(m - 1)`: TIDAL_CRUSH at
             * x1.3 adds three tenths of an attack. A hook on the OPPONENT's damage is worth
             * `(1 - m)`: GRAVE_CHILL at x0.8 REDUCES what Draugr takes, which is a fifth of an
             * attack's worth of value TO HIM. Priced as `(m - 1)` it came out at -23% of a pool,
             * i.e. the report calling a defensive firmware a liability.
             */
            const onOpponentsDamage = (hook.when?.source ?? 'SELF').toUpperCase() === 'OPPONENT';
            perProc = (onOpponentsDamage ? 1 - hook.multiplier : hook.multiplier - 1) * meanAttackScore();
        } else if (typeof bonus === 'number') {
            kind = 'FLAT_BONUS';
            const stacks = ASSUMED_BOARD_STATUS_COUNT;
            /*
             * TICKET 150c — THE UNIT DEPENDS ON THE TRIGGER, AND READING IT WRONG IS A 4x ERROR.
             *
             * An `onDamageCalculated` bonus is flat HP applied AFTER the pace divisor, so it has
             * to come back through the scorer's own HP table to become power. An
             * `onPowerCalculated` bonus (ticket 150b) is already power and goes straight in —
             * running it through the HP table would divide it by the frame a second time.
             *
             * Measured on TOXIN_FANG, which 150c moved from `bonus: 10` HP to `bonus: 4` power:
             * those are the same OS by the field (53.2% against 55.0%), and a scorer that read
             * the second as HP would price it at a fraction of the first.
             */
            perProc = hook.trigger === 'onPowerCalculated'
                ? (bonus * stacks) / 10
                : (bonus * stacks / ASSUMED_MAX_HP) * 100 * POWER_PER_PERCENT_MAXHP / 10;
        }

        if (rate === null) {
            unmeasured.push(hook.id);
            contributions.push({ hookId: hook.id, kind, procsPerGame: null, perProcScore: perProc, pctOfPool: 0 });
            continue;
        }

        const delivered = perProc * rate;
        total += delivered;
        contributions.push({
            hookId: hook.id,
            kind,
            procsPerGame: rate,
            perProcScore: Math.round(perProc * 100) / 100,
            pctOfPool: pctOfPool(delivered),
        });
    }

    const pct = pctOfPool(total);
    /*
     * A zero the census could not measure is not a zero. `gullin_v1_prepare` is BUFF_NEXT_PROGRAM
     * and left no state delta the probe could read across 42.8 offers - that is a limit of the
     * INSTRUMENT, and reporting UNSTOPPABLE_MASS as "0% of a pool, under band" would be the
     * report asserting the firmware does nothing.
     *
     * The exception that used to sit here — `hel_v2_lifeblood`, a genuinely inert x1.0 multiplier
     * measured at 0 procs — is gone with the hook itself (ticket 150a).
     */
    const instrumentBlind = hooks.some(h => OS_RATE_ZERO_REASON[h.id] !== undefined
        && OS_PROC_RATE[h.id] === 0);

    let verdict: OsVerdict;
    if (hooks.length === 0 || instrumentBlind || (total === 0 && (unmeasured.length > 0 || unpriced.length > 0))) {
        verdict = 'UNMEASURED';
    }
    else if (pct > OS_FLAG_PCT) verdict = 'FLAGGED';
    else if (pct > OS_BAND_MAX_PCT) verdict = 'OVER BAND';
    else if (pct < OS_BAND_MIN_PCT) verdict = 'UNDER BAND';
    else verdict = 'IN BAND';

    return {
        id: osId,
        name,
        pctOfPoolPerGame: pct,
        verdict,
        contributions,
        unmeasured,
        unpriced,
        codeDriven: hooks.length === 0,
    };
}

/**
 * The 33 shipped firmware, scored. The input to report section 1.4.
 *
 * Driven from `MingmingRegistry`'s `availableOS` lists rather than from the hook library's keys,
 * because that file also holds the daemon CARDS' hooks - `riptide`, `echo_chamber`, `drip_feed`
 * and the rest sit in it beside the firmware. Walking its keys produced a 51-row firmware section
 * containing eighteen cards, which is a category error the reader would have had to undo by hand.
 */
export function osRoster(): string[] {
    const ids = new Set<string>();
    for (const mingming of Object.values(MingmingRegistry)) {
        for (const os of (mingming as unknown as { availableOS?: string[] }).availableOS ?? []) {
            ids.add(os);
        }
    }
    return [...ids].sort();
}

export function scoreAllOS(): OsScore[] {
    return osRoster()
        .map(scoreOS)
        .sort((a, b) => b.pctOfPoolPerGame - a.pctOfPoolPerGame || (a.id < b.id ? -1 : 1));
}
