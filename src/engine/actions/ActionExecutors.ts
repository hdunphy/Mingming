import type { IBattleState, IBattleEntity, ProgramData, Element, StatusEffectInstance } from '../types';
import type { ActionType, ProgramAction, AttackActionData, StatusActionData, HealActionData, DrawActionData, EnergyActionData, GenerateCardActionData, CleanseActionData, DiscardActionData, ExhaustActionData, ReturnActionData, SearchActionData, MultiplyStatusActionData, TriggerStatusActionData, PlayLastCardActionData, TauntActionData, BuffNextProgramActionData, RedirectTargetActionData, ForceDiscardActionData, ShiftStanceActionData, ReviveActionData, StatusType } from '../types';
import type { HookAction, HookContext } from '../core/Hooks';
import { calculateDamage, calculateHeal } from '../combatUtils';
 // Need to refactor checkDefeat or keep it in effectHandlers for now
import { applyMutations, executeDraw, executeStatusDamageCalculated } from '../resolutionEngine';
import { GetProgramData } from '../data/programRegistry';
import { revivedHpFor } from '../data/macroRegistry';
import { getStatusBehavior } from '../StatusBehaviors';
import { globalBattleEventBus } from '../events';
import { PRNG } from '../core/PRNG';
import { NEGATIVE_STATUSES } from '../core/ConditionValidator';

function addLog(state: IBattleState, message: string): IBattleState {
    return { ...state, logs: [...state.logs, message] };
}

/** A writable view of a ProgramAction — every field of one, index signature included, is `readonly`. */
type MutableProgramAction = { -readonly [K in keyof ProgramAction]: ProgramAction[K] };

/**
 * Every action shape an executor can be handed.
 *
 * Cards, macros and discard effects arrive as `ProgramAction`. Firmware hooks do NOT:
 * `HookFactory.executeActions` routes a `HookAction` through this same registry, and a
 * `HookAction` is not a `ProgramAction` (its `type` also covers 'LOG' | 'COUNTER' | 'DRAW' |
 * 'MAX_ENERGY'). The registry's element type used to be `ActionExecutor<any>`, which hid that
 * second caller completely.
 */
export type ExecutableAction = ProgramAction | HookAction;

/**
 * Base abstract class for executing ProgramAction data.
 * Pure execution logic mapping state + pure-data -> new state.
 */
export abstract class ActionExecutor<T extends ExecutableAction> {
    abstract execute(state: IBattleState, sourceId: string, targetId: string, actionData: T, program: ProgramData | undefined, context: HookContext): IBattleState;
}

/**
 * Effective ATTACK power after attacker-only scaling.
 *
 * Currently handles SHARP_STACKS (+5 power per Sharp stack on the attacker) and
 * STRENGTH_STACKS (power MULTIPLIED by the attacker's Strengthened stacks - Momentum
 * Crash cashing MOMENTUM_DRIVE), which boost the POWER fed into the damage formula so
 * the bonus scales with level/stats like any other power and survives resistances.
 * STRENGTH_STACKS reads RAW stacks on purpose: Strengthened's own damage bonus is
 * capped at +-25%, and the whole point of the payoff card is to bypass that cap.
 *
 * Shared by AttackExecutor AND the UI hover preview (computeDamagePreview) so
 * the previewed number and the real reducer damage cannot drift for Sharp
 * scaling. The other scalings (CARDS_PLAYED, MISSING_HP, STATUS_COUNT,
 * CARDS_DRAWN, ELEMENT_PLAYED) depend on battle state / the target and
 * multiply the computed DAMAGE afterwards — they intentionally stay inside
 * AttackExecutor.
 */
/**
 * TICKET 136h: THE CAP IS GONE. Henry: *"No caps allowed."* It was 8, shared by the card-side
 * `STRENGTH_STACKS` scaler here and the hook-side one in `HookFactory.resolveScaling`.
 *
 * This is the same ruling ticket 103 applied to skoll_v2's SOLAR_OVERDRIVE, for the same
 * reason: an arbitrary ceiling stops the one deck built to hoard a resource from being paid
 * for hoarding it, exactly when the hoard is the deck's whole plan. Henry's standing rule is
 * that when something needs to fire less, the answer is a CONDITION, not a cap - and the
 * valve here is already the duality cancel and the sheds, as it is for every other duality
 * status.
 *
 * Nothing shipped binds on it today: `core_overclock_daemon`, the card ticket 26 capped this
 * for, is in no deck. fenrir_v1's `unbound_fang` (136i) is the first live consumer, and it is
 * measured with the cap already gone.
 *
 * `Number.POSITIVE_INFINITY` rather than a large number, per ticket 103: a ceiling you cannot
 * reach is still a ceiling somebody has to reason about.
 */
export const STRENGTH_STACK_CAP = Number.POSITIVE_INFINITY;

/** Max % of maxHP-missing a MISSING_HP scaler may read (ticket 26). The cap is
 *  budget / scalingPower, so it re-derives whenever the curve moves. */
export const MISSING_HP_PCT_CAP = 50;

/**
 * Power a SHARP_STACKS scaler adds per stack of Sharp on the attacker.
 *
 * TICKET 139: named and exported so the CARD TEXT can be held to it. `spike_launch` and
 * `cinder_lance` both print "+5 power per Sharp stack", and until this was a constant the only
 * thing keeping those two descriptions honest was that nobody had changed the 5.
 */
export const SHARP_STACKS_POWER_PER_STACK = 5;

/**
 * Ticket 74: the per-event-count scalers (`CARDS_PLAYED`, `CARDS_DRAWN`, `CARDS_DRAWN_TRIGGERED`,
 * `CARDS_DISCARDED`) are deliberately UNCAPPED, and that is a design decision, not an oversight.
 *
 * Ticket 73 capped them to stop `jormungandr_v1`'s first-turn kill. Henry rejected the shape:
 * *"I don't like caps, that makes playing smart feel bad and you'll end turn with energy. You
 * should be rewarded for playing smart."* Measurement agreed the cap was the worst option on
 * offer - it cost `kraken_v1` 6 points of field win rate (45.3% -> 38.9%) to brake a deck that
 * barely felt it (`jormungandr_v1` stayed at 77.3%), because Kraken draws ~1 card a turn and
 * Jormungandr draws 3. Any change to the SCALER lands hardest on the deck least able to use it.
 *
 * The turn-1 kill was fixed at its source instead - OUROBOROS_LOOP, which was handing
 * `jormungandr_v1` a free +1 Energy AND +1 draw on the 3rd Water card, on a turn where four of
 * her nine cards cost nothing. See `research/ouroboros-nerf.md`.
 *
 * If a new scaler in this family ever needs braking, brake the ENGINE feeding it.
 */

export function getEffectiveAttackPower(
    source: IBattleEntity,
    action: Pick<AttackActionData, 'power' | 'scaling' | 'scalingPower'>,
    target?: IBattleEntity,
): number {
    const power = action.power || 0;
    if (action.scaling === 'DAZED_STACKS') {
        // Ticket 32: reads the TARGET's raw Dazed stacks, deliberately UNCAPPED. The 2%/stack
        // damage effect is capped at +-25% in Hooks.ts, and bypassing that cap is the entire
        // point of a payoff card. Henry's law: per-stack scaling attacks should underperform
        // early and overperform late - that is the shape, not a bug. Cap only if a balance run
        // shows it running away (the STRENGTH_STACKS cap was added AFTER measurement, not
        // before). `target` is optional so the UI preview can call this without one; with no
        // target the card reads as 0 power, which is what an unaimed card is worth.
        const dazed = target?.statusEffects.find(s => s.type === 'Dazed')?.stacks || 0;
        return power * dazed;
    }
    if (action.scaling === 'DISTINCT_STATUS') {
        // Ticket 48: counts DISTINCT negative statuses on the target, not stacks. `STATUS_COUNT`
        // could not be reused - it reads total stacks and adds +25% each, uncapped, so thirteen
        // stacks is +325%. Uncapped by the same reasoning as DAZED_STACKS, and it reads the same
        // NEGATIVE_STATUSES list GRAVE_CHILL_OS gates on, so draugr_v2's payoff and its firmware
        // agree about what a debuff is by construction. `target` optional for the UI preview.
        const distinct = new Set(
            (target?.statusEffects ?? [])
                .filter(s => s.stacks > 0 && NEGATIVE_STATUSES.includes(s.type))
                .map(s => s.type),
        ).size;
        return power * distinct;
    }
    if (action.scaling === 'ANY_STATUS') {
        // TICKET 107: `rimebreaker` reads EVERYTHING on the target - buffs, debuffs, DoTs, Regen,
        // whoever put them there. The inversion is the whole point of the rework: the measured
        // reality of the DEBUFF-only version was 0.70 distinct debuffs on average and one or two
        // against huldra, so the card read ~4 damage in Henry's hands. Against huldra it now eats
        // her own Sharp pile - her win condition becomes draugr's ammunition.
        //
        // Deliberately polarised: enormous against a status deck, ~0 against a clean board. That
        // is legal counter-texture under the archetype web - it is tech, not the plan.
        const distinct = new Set(
            (target?.statusEffects ?? []).filter(s => s.stacks > 0).map(s => s.type),
        ).size;
        return power * distinct;
    }
    if (action.scaling === 'SELF_ANY_STATUS') {
        // TICKET 136n: counts DISTINCT statuses on the CASTER - buffs, debuffs, anything -
        // which is what makes `corroded_edge` fafnir_v2's payoff: CORRUPTED_GOLD pays him in
        // debuffs he is meant to carry, and `tarnish` puts one on him on purpose. Distinct
        // TYPES rather than stacks, so the card rewards VARIETY and cannot be farmed by
        // stacking one status - the same shape valkyrie_v2's CRUSADER_KERNEL uses.
        //
        // The mirror of `ANY_STATUS` (which reads the target and pays a stack per type
        // counted, ticket 124). This one reads the SOURCE and pays nothing: the statuses are
        // already a cost he is carrying, so charging him again would be charging twice.
        const distinctOnSelf = new Set(
            (source?.statusEffects ?? []).filter(s => s.stacks > 0).map(s => s.type),
        ).size;
        return power * distinctOnSelf;
    }
    if (action.scaling === 'BARKSHIELD_STACKS') {
        // Ticket 50: reads the SOURCE's own standing BarkShield - avalanche casts the wall at
        // them. Uncapped, per Henry's law that per-stack scalers should underperform early and
        // overperform late; the 20%/turn decay and incoming damage already bound the pile.
        //
        // FLOOR IS LOAD-BEARING. BarkShield stacks are FRACTIONAL: onPostDamage stores
        // `shieldPercent - absorbedPercent` and the end-of-turn decay multiplies by 0.8, so a
        // live shield is routinely 7.36 stacks. Without the floor this reproduces ticket 36's
        // fractional-product bug, which put 22.5 HP of damage into an entity.
        const shield = source.statusEffects.find(s => s.type === 'BarkShield')?.stacks || 0;
        return power * Math.floor(shield);
    }
    if (action.scaling === 'SHARP_STACKS') {
        const sharpStacks = source.statusEffects.find(s => s.type === 'Sharp')?.stacks || 0;
        return power + SHARP_STACKS_POWER_PER_STACK * sharpStacks;
    }
    if (action.scaling === 'MISSING_HP') {
        // Power-side (ticket 26): rides the divisor, STAB and resistances like every other
        // power bonus. Was a flat post-damage add in AttackExecutor, which bypassed all three
        // and disagreed with what powerscale charged for it.
        const pctMissing = source.maxHp > 0
            ? ((source.maxHp - source.currentHp) / source.maxHp) * 100
            : 0;
        return power + (action.scalingPower || 0) * Math.min(pctMissing, MISSING_HP_PCT_CAP);
    }
    if (action.scaling === 'STRENGTH_STACKS') {
        // TICKET 136h: `STRENGTH_STACK_CAP` is Infinity now (Henry: "No caps allowed"), so the
        // Math.min is a no-op kept as the single seam if a condition-based valve is ever
        // needed. The number it used to hold, 8, came from ticket 23: uncapped, Momentum
        // Crash measured 29.3 damage a play - 38% of a health pool - off a nominal 10 power,
        // an effective ~98 power for 1 Energy against a 40 budget. That card still exists, so
        // if a Strength deck runs away it is the row to look at first.
        const strengthStacks = source.statusEffects.find(s => s.type === 'Strengthened')?.stacks || 0;
        return power * Math.min(strengthStacks, STRENGTH_STACK_CAP);
    }
    return power;
}

/**
 * Post-damage scaling multiplier - the second half of a card's damage, and until ticket 90 the
 * half the UI could not see.
 *
 * `getEffectiveAttackPower` above handles the scalings that ride the POWER (Sharp, missing HP,
 * Strength...). These ones multiply the DAMAGE after the divisor, because they scale on the turn's
 * history rather than on the caster: how many cards you have played, drawn, discarded, how much
 * Energy you spent. That distinction is deliberate (ticket 26) and it stays.
 *
 * What was not deliberate is that `AttackExecutor` computed them inline, so
 * `computeDamagePreview` - which calls `calculateDamage` directly - showed `stampede` at its
 * printed 11 power no matter how many cards you had played. Henry, playtest round 1: *"Damage is
 * not properly previewed when hovering over the card for scaling cards (dmg per card played)"* and
 * *"damage calculations felt wrong"*. Both halves now come from here, so preview and reality
 * cannot drift - the same fix shape as `getEffectiveAttackPower`.
 *
 * Returns 1 for a card with no post-damage scaling, so callers can multiply unconditionally.
 */
export function getDamageScalingMultiplier(
    state: Pick<IBattleState, 'cardsPlayedThisTurn' | 'cardsDrawnThisTurn' | 'nonNaturalCardsDrawnThisTurn'
        | 'cardsDiscardedThisTurn' | 'lastEnergySpent' | 'elementPlays'>,
    scaling: string | undefined,
    element: Element | undefined,
    target: IBattleEntity | undefined,
    /** TICKET 123: the CASTER, for scalers that count the caster's own actions. */
    source?: IBattleEntity,
): number {
    switch (scaling) {
        case 'CARDS_PLAYED':
            // TICKET 123: the CASTER's plays, not the whole active side's.
            //
            // All three cards using this scaler already say so in their own text:
            // `stampede` and `serpents_coil` read "for every card YOU played this turn",
            // and `seed_bomb_v2` reads "per card played by HOST this turn". At 1v1 the
            // caster IS the side, so the distinction never existed and the note above -
            // that reading side history is deliberate per ticket 26 - was written when it
            // could not have meant anything else. 3v3 with a SHARED hand made it mean
            // something and nobody revisited it: every ally's cast pumps your scaler.
            // Henry, playtest: `stampede` for 42 in one game and 78 in a stacked comp,
            // off an 11-power card.
            //
            // `playsThisTurn` is incremented in the SAME reducer snapshot as
            // `cardsPlayedThisTurn`, so the resolving card counts itself either way and
            // the off-by-one is unchanged. At width 1 the two values are equal, so no 1v1
            // cell moves. The `??` is a safety net only - `selfPumpsOnly` in
            // `cardsPlayedScaling.test.ts` is what actually guards this.
            return source?.playsThisTurn ?? state.cardsPlayedThisTurn;
        case 'STATUS_COUNT': {
            const stacks = (target?.statusEffects ?? []).reduce((acc, s) => acc + s.stacks, 0);
            return 1 + stacks * 0.25; // +25% per status stack
        }
        case 'CARDS_DRAWN':
            return state.cardsDrawnThisTurn;
        case 'CARDS_DRAWN_TRIGGERED':
            /*
             * HENRY, 2026-08-30: the CASTER's triggered draws, not the whole battle's.
             *
             * This is the unfixed sibling of the CARDS_PLAYED bug above, found the same way — by
             * asking where a deck's damage came from — and it was worth considerably more. The
             * counter it used to read, `state.nonNaturalCardsDrawnThisTurn`, is a single number on
             * the battle state: not per unit, not even per side. Every ally's engine draw pumped it,
             * and so did an enemy's inside the same turn.
             *
             * MEASURED, on Tidewrack's boss fight: `ink_stream` counted **6.6 triggered draws per
             * cast**, against the ~1.75 `jormungandr_v1` was measured at as a solo caster — a 3.8x
             * amplification bought purely with party width. At 33 power a draw that is ~218 power
             * from a ONE-energy card, landing 52.9 damage where a 3-energy `hydro_blast` (105 power)
             * lands ~26. It was 49% of the winning deck's entire output, and the gym boss runs four
             * copies off the same counter.
             *
             * The card text always said so: *"for each card a card, OS or daemon drew YOU this
             * turn"* — the same second-person singular that settled CARDS_PLAYED.
             *
             * # WHY THIS IS NOT WRITTEN AS `source?.x ?? state.y`, UNLIKE CARDS_PLAYED
             *
             * `playsThisTurn` is written on every play, so it is always a real number by the time
             * anything reads it and the `??` there is genuinely a safety net.
             * `nonNaturalDrawsThisTurn` is written only when a triggered draw actually happens, so a
             * caster who has drawn nothing this turn holds `undefined` — and
             * `undefined ?? state.nonNaturalCardsDrawnThisTurn` would fall straight through to the
             * battle-wide number in exactly the case this ruling exists to fix. The fallback
             * therefore keys off whether a CASTER is known, not off whether the count is set.
             */
            if (source !== undefined) return source.nonNaturalDrawsThisTurn ?? 0;
            return state.nonNaturalCardsDrawnThisTurn ?? 0;
        case 'ELEMENT_PLAYED':
            return (element ? state.elementPlays?.[element] : undefined) || 1;
        case 'CARDS_DISCARDED':
            return state.cardsDiscardedThisTurn ?? 0;
        case 'ENERGY_SPENT':
            return state.lastEnergySpent ?? 0;
        case 'ENERGY_SPENT_SQUARED': {
            const spent = state.lastEnergySpent ?? 0;
            return spent * spent;
        }
        case 'BURN_STACKS':
            // TICKET 136j: the TARGET's raw Burn pile, for hraesvelgr_v2's `firestorm_talon`.
            // Burn caps at 4 (BURN_CONFIG), so this scaler is bounded by the mechanic itself
            // rather than by a number written here - 25 power x 4 is 100 at 2 Energy, which is
            // the hand-price the ticket carries. That bound is why it needs no cap of its own.
            return target?.statusEffects.find(s => s.type === 'Burn')?.stacks || 0;
        case 'BURN_TIMES_ENERGY': {
            const burn = target?.statusEffects.find(s => s.type === 'Burn')?.stacks || 0;
            return burn * (state.lastEnergySpent ?? 0);
        }
        default:
            return 1;
    }
}

export class AttackExecutor extends ActionExecutor<AttackActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: AttackActionData, program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { element, scaling } = actionData;

        const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
        const source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
        const target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);

        if (!target) return state;

        let damage = 0;
        // TICKET 138 amendment: `percentMaxHp` recoil, resolved BEFORE and INSTEAD of the power
        // path. A price denominated in the victim's own health pool: no attacker stats, no STAB,
        // no resistances, no duality POWER term, no damage hooks. `glass_cannon`'s recoil used to
        // run the full formula as a power-15 hit, so skoll's Strength pile made the card that
        // grants Strength cost more the better it was working - 53 HP at no stacks, 178 at eight.
        // Henry ruled the recoil must not scale. It also needs no `source`: hurting yourself does
        // not depend on who is doing it.
        if (typeof actionData.percentMaxHp === 'number') {
            // Floored, and at least 1 on any positive percentage, so a recoil can never round
            // away to a free card on a small frame - the failure mode ticket 84 hit when
            // fenrir_v1's 2% recoil floored to 1 HP and had no second setting.
            damage = Math.max(1, Math.floor(target.maxHp * actionData.percentMaxHp / 100));
        } else if (source) {
            const programToUse = program || ({ element: element } as ProgramData);

            // SHARP_STACKS scaling handled by the shared helper (also used by
            // the UI damage preview, so preview and reality cannot drift).
            let effectivePower = getEffectiveAttackPower(source, actionData, target);

            // Ticket 64: STATUS_CONSUMED on an ATTACK - `sun_devourer` consumes all of the
            // caster's Strengthened and pays damage per stack eaten. The path existed for HEAL
            // (ash_communion) and STATUS (hexbloom) but never for ATTACK.
            //
            // POWER-side, not post-damage, which is the ticket-26 lesson: a post-damage multiply
            // would bypass the divisor, STAB and resistances and disagree with what powerscale
            // charges. Zero consumed means zero power means zero damage, so the card is a payoff
            // and never an opener - the same shape `BURN_TIMES_ENERGY` has.
            if (scaling === 'STATUS_CONSUMED') effectivePower *= (state.lastStatusConsumed ?? 0);

            damage = calculateDamage(source, target, programToUse, effectivePower, state);

            // Ticket 90: one source of truth, shared with the UI preview.
            damage = Math.floor(damage * getDamageScalingMultiplier(state, scaling, element || programToUse.element, target, source));
        }

        // TICKET 124: an ANY_STATUS scaler PAYS one stack of each status it counted.
        //
        // Henry, ticket-118 playtest: *"Rimebreaker in a 1v1 is very easy to snowball. It
        // should probably consume or maybe just reduce some stacks. It consistently did above
        // 25 damage after one turn of setup"*. The card read the pile without paying for it,
        // so the pile only grew and every cast was bigger than the last.
        //
        // ONE STACK per counted type, not a full consume. Ticket 124 took this from what was
        // then `StatusExecutor`'s hexbloom precedent - hexbloom consumes its Weakened as of
        // ticket 136c, so the precedent is gone, but the reasoning stands on its own:
        // consuming makes a card a hoard dump priced off how long you saved up (x3 measured
        // 13.90 against a 6.5 band), while reading without consuming makes it a RATE. A stack
        // keeps the rate and still kills the snowball, because the count feeding the next
        // cast is now strictly smaller unless something re-applies.
        //
        // Counted BEFORE the damage lands, from the same predicate `getEffectiveAttackPower`
        // used, so the decrement and the damage cannot disagree about what a status is.
        const countedTypes = scaling === 'ANY_STATUS'
            ? [...new Set((target.statusEffects ?? []).filter(s => s.stacks > 0).map(s => s.type))]
            : [];

        let next = applyMutations(state, [{
            type: 'HP',
            sourceId: sourceId,
            targetId: targetId,
            payload: {
                amount: damage,
                isHeal: false,
                element: element || program?.element
            }
        }]);

        // Direct party mutation, matching how the `consume` branch in StatusExecutor removes
        // stacks. A STATUS mutation with negative stacks does NOT work: it routes through
        // handleApplyStatus, which returns early unless the stack count is positive, so the
        // first version of this change silently did nothing and the test caught it.
        if (countedTypes.length > 0) {
            const removed: StatusType[] = [];
            const pay = (party: ReadonlyArray<IBattleEntity>) => party.map(e => {
                if (e.id !== targetId) return e;
                const kept: StatusEffectInstance[] = [];
                for (const s of e.statusEffects) {
                    if (!countedTypes.includes(s.type)) { kept.push(s); continue; }
                    const stacks = s.stacks - 1;
                    if (stacks > 0) kept.push({ ...s, stacks });
                    else removed.push(s.type);
                }
                return { ...e, statusEffects: kept };
            });
            next = { ...next, playerParty: pay(next.playerParty), enemyParty: pay(next.enemyParty) };
            // STATUS_REMOVED is emitted for real removals only - draugr_v1's PERMAFROST_WAKE
            // listens on it, so a spurious emit would hand him a free wake.
            for (const status of removed) {
                globalBattleEventBus.emit({
                    type: 'STATUS_REMOVED', targetId, status, timestamp: Date.now(),
                });
            }
            next = addLog(next, `  \u2744\ufe0f ${target.name} loses 1 stack of `
                + `${countedTypes.join(', ')} to the break`);
        }

        return next;
    }
}

export class StatusExecutor extends ActionExecutor<StatusActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: StatusActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { status, stacks, consume } = actionData;

        // Ticket 33: STATUS_CONSUMED scaling, previously implemented for HEAL only. Multiply
        // by the count a preceding consume action in the SAME card recorded (hexbloom:
        // "consume all Weakened on the target, apply that many Poison"). The `consume` branch
        // below returns early, so a consume action can never read its own multiplier - which
        // is what guarantees the two actions resolve in the authored order.
        // Ticket 41: WEAKENED_STACKS reads the TARGET's Weakened WITHOUT consuming it - the
        // scaler itself never spends the pile. Ticket 136c pairs it on hexbloom with an
        // explicit second consume action, so the card now reads the pile at x1 and then
        // clears it. Before 136c it read at x2 and left the pile standing: a RATE rather than
        // a hoard dump (x3-consumed measured 13.90 against a 6.5 band, x2-standing 6.30), but
        // at full grid the standing pile put huldra_v1 at 91.8, so 136c spends it.
        const weakenedOnTarget = actionData.scaling === 'WEAKENED_STACKS'
            ? ((state.playerParty.find(e => e.id === targetId) || state.enemyParty.find(e => e.id === targetId))
                ?.statusEffects.find(s => s.type === 'Weakened')?.stacks ?? 0)
            : 0;
        /*
         * FLOORED, ticket 69. A scaled stack count must be a whole number of stacks — nothing
         * downstream of here rounds, so a fractional value would reach `applyMutations` and a status
         * would carry 1.5 stacks.
         *
         * It is a no-op for every card that predates this: `STATUS_CONSUMED` and `WEAKENED_STACKS`
         * both multiplied integer `stacks` by an integer count. What it BUYS is a ratio below 1 —
         * `discharge` prints "1 Burn per 2 removed" as `stacks: 0.5` against the removal count, and
         * flooring is what makes 3 removed pay 1 Burn rather than 1.5.
         */
        const scaledStacks = actionData.scaling === 'STATUS_CONSUMED'
            ? (stacks || 0) * (state.lastStatusConsumed ?? 0)
            : actionData.scaling === 'WEAKENED_STACKS'
            ? (stacks || 0) * weakenedOnTarget
            : stacks;
        const effectiveStacks = (actionData.scaling === 'STATUS_CONSUMED' || actionData.scaling === 'WEAKENED_STACKS')
            ? Math.sign(scaledStacks) * Math.floor(Math.abs(scaledStacks))
            : scaledStacks;

        if (consume) {
            // Remove ALL stacks of the status and record how many were consumed
            // so a follow-up action with scaling: 'STATUS_CONSUMED' can use it
            // (e.g. Ash Reclamation: "Consume Burn to heal 10 HP per stack").
            const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
            const target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);
            if (!target) return state;

            const existingStatus = target.statusEffects.find(s => s.type === status);
            const consumedStacks = existingStatus ? existingStatus.stacks : 0;

            let newState: IBattleState = { ...state, lastStatusConsumed: consumedStacks };
            if (consumedStacks > 0) {
                const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
                    party.map(e => {
                        if (e.id !== targetId) return e;
                        return { ...e, statusEffects: e.statusEffects.filter(s => s.type !== status) };
                    });
                newState = {
                    ...newState,
                    playerParty: updateParty(newState.playerParty),
                    enemyParty: updateParty(newState.enemyParty)
                };
                newState = addLog(newState, `  🔥 ${target.name}'s ${status} consumed (${consumedStacks} stacks)`);
                globalBattleEventBus.emit({
                    type: 'STATUS_REMOVED',
                    targetId: targetId,
                    status: status,
                    timestamp: Date.now()
                });
            }
            return newState;
        }

        // A scaled apply that resolves to nothing must not create a 0-stack status instance.
        if ((actionData.scaling === 'STATUS_CONSUMED' || actionData.scaling === 'WEAKENED_STACKS') && effectiveStacks === 0) return state;

        if (effectiveStacks < 0) {
            // Contract (types.ts): negative stacks removes that many stacks,
            // deleting the status only when it reaches 0.
            const removeCount = -effectiveStacks;

            /*
             * TICKET 69 (`discharge`): a CAPPED removal now records what it actually took, the way
             * `consume` above records what it consumed.
             *
             * `consume` is all-or-nothing — it strips every stack — so a card that wants "remove up
             * to N, then pay off the amount removed" had no way to express itself. `discharge`
             * ("Remove up to 4 Strengthened from the target. Apply 1 Burn per 2 removed") is exactly
             * that shape, and it needs the REAL figure: against a boss holding 2 Strengthened it
             * must pay 1 Burn, not 2.
             *
             * Writing `lastStatusConsumed` here makes `scaling: 'STATUS_CONSUMED'` work after a
             * capped removal as naturally as it already works after a consume. Nothing existing
             * reads it in this position — no shipped card pairs a negative-stack STATUS with a
             * STATUS_CONSUMED follow-up — so this adds a capability rather than changing one.
             */
            const currentStacks = (state.playerParty.find(e => e.id === targetId)
                ?? state.enemyParty.find(e => e.id === targetId))
                ?.statusEffects.find(s => s.type === status)?.stacks ?? 0;
            const actuallyRemoved = Math.min(removeCount, currentStacks);

            const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
                party.map(e => {
                    if (e.id !== targetId) return e;
                    return {
                        ...e,
                        statusEffects: e.statusEffects
                            .map(s => s.type === status ? { ...s, stacks: s.stacks - removeCount } : s)
                            .filter(s => !(s.type === status && s.stacks <= 0))
                    };
                });
            let newState: IBattleState = {
                ...state,
                lastStatusConsumed: actuallyRemoved,
                playerParty: updateParty(state.playerParty),
                enemyParty: updateParty(state.enemyParty)
            };
            // The log reports what was REMOVED, not what was asked for — "4 stacks removed" off a
            // target holding 2 is the kind of line that sends someone hunting a damage bug.
            newState = addLog(newState, `  ✨ ${actuallyRemoved} stack(s) of ${status} removed from target`);
            return newState;
        }

        // Apply Status Logic
        return applyMutations(state, [{
            type: 'STATUS',
            targetId: targetId,
            sourceId: sourceId,
            payload: { status, stacks: effectiveStacks }
        }]);
    }
}

export class HealExecutor extends ActionExecutor<HealActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: HealActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { power } = actionData;
        const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
        const source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
        const target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);

        if (!target) return state;
        if (!source) return state;

        // Ticket 36: the LightStance +50% branch is gone from both heal pipelines. Heal
        // multipliers are `onHealCalculated` hooks now, applied once at the heal choke point
        // (effectHandlers.handleHealEffect) that every heal funnels through.
        // Ticket 43: `healOverride` is gone - every card heal is power-based, so it scales with
        // level. A flat heal was overpowered on a level-5 frame and negligible on a level-50 one.
        const baseHeal = calculateHeal(source, target, power);
        // STATUS_CONSUMED scaling: heal per stack removed by a preceding
        // consume action in the same card (e.g. Ash Reclamation).
        const healAmount = actionData.scaling === 'STATUS_CONSUMED'
            ? baseHeal * (state.lastStatusConsumed ?? 0)
            : baseHeal;

        return applyMutations(state, [{
            type: 'HP',
            sourceId: sourceId,
            targetId: targetId,
            payload: {
                amount: healAmount,
                isHeal: true,
                // Ticket 56: carry the PRINTED power through the mutation. Every card heal reaches
                // `handleHealEffect` as a `flatHeal` (this executor resolves calculateHeal itself),
                // so the number on the card was being discarded before the choke point ever saw
                // it - which is why NOURISH_ROUTINE could only be denominated in HP. `healPower`
                // is read there into `last_heal_power` and nowhere else.
                healPower: actionData.scaling === 'STATUS_CONSUMED'
                    ? power * (state.lastStatusConsumed ?? 0)
                    : power
            }
        }]);
    }
}

export class DrawExecutor extends ActionExecutor<DrawActionData> {
    execute(state: IBattleState, sourceId: string, _targetId: string, actionData: DrawActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { amount } = actionData;
        const isPlayerSource = state.playerParty.some(e => e.id === sourceId);
        const side = isPlayerSource ? 'PLAYER' : 'ENEMY';

        return executeDraw(state, side, amount, false, sourceId);
    }
}

export class EnergyExecutor extends ActionExecutor<EnergyActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: EnergyActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { amount } = actionData;
        return applyMutations(state, [{
            type: 'ENERGY',
            targetId: targetId,
            sourceId: sourceId,
            payload: { amount }
        }]);
    }
}

export class GenerateCardExecutor extends ActionExecutor<GenerateCardActionData> {
    execute(state: IBattleState, sourceId: string, _targetId: string, actionData: GenerateCardActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { dataId } = actionData;
        return applyMutations(state, [{
            type: 'GENERATE_CARD',
            sourceId: sourceId,
            targetId: _targetId,
            payload: { dataId }
        }]);
    }
}

export class CleanseExecutor extends ActionExecutor<CleanseActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: CleanseActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { statusTarget } = actionData;
        return applyMutations(state, [{
            type: 'CLEANSE',
            sourceId,
            targetId,
            payload: { statusTarget }
        }]);
    }
}

export class DiscardExecutor extends ActionExecutor<DiscardActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: DiscardActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        // `count` is the ticket-21 self-discard cost: N RANDOM cards off the acting
        // side's own hand (the reducer has already routed targetId to the source and
        // suppressed its generic multi-hit loop for DISCARD). `amount` stays the
        // explicit form used by FORCE_DISCARD and discardEffect callers, which keep
        // their existing top-N / opt-in-random behaviour. A hand shorter than N just
        // discards what is there - the rest of the card still resolves.
        const usesCost = typeof actionData.count === 'number';
        const amount = usesCost ? (actionData.count as number) : (actionData.amount ?? 0);
        // The COST form is deterministic, not random - it sheds the least useful cards
        // first (see the DISCARD mutation in resolutionEngine). An explicit isRandom on
        // the action still wins, so FORCE_DISCARD and legacy callers are untouched.
        const isCostPriority = usesCost && actionData.isRandom === undefined;
        const isRandom = actionData.isRandom ?? false;
        const isPlayerTarget = state.playerParty.some(e => e.id === targetId);
        const deckKey = isPlayerTarget ? 'playerDeck' : 'enemyDeck';
        const handOwner = (isPlayerTarget ? state.playerParty : state.enemyParty).find(e => e.id === targetId);

        const oldDiscardLength = state[deckKey].discard.length;

        let newState = applyMutations(state, [{
            type: 'DISCARD',
            sourceId,
            targetId,
            payload: { amount, isRandom, isCostPriority }
        }]);

        const newDiscardLength = newState[deckKey].discard.length;
        if (newDiscardLength > oldDiscardLength) {
            // Need to peek at the cards that were just placed on top of the discard pile
            // Since discard pushes to the end of the array, we can slice from the old length.
            const discardedCards = newState[deckKey].discard.slice(oldDiscardLength, newDiscardLength);

            for (const c of discardedCards) {
                const discardedData = GetProgramData(c.dataId);
                newState = addLog(newState, `${handOwner?.name ?? 'Unknown'} discards ${discardedData.name}!`);
                if (discardedData.discardEffect && discardedData.discardEffect.length > 0) {
                    newState = addLog(newState, `  ✨ ${discardedData.name} discard effect triggered!`);

                    const owner = isPlayerTarget
                        ? newState.playerParty.find(e => e.id === targetId)
                        : newState.enemyParty.find(e => e.id === targetId);

                    if (owner) {
                        for (const effectAction of discardedData.discardEffect) {
                            const executor = (ActionExecutorRegistry as Record<string, ActionExecutor<ExecutableAction> | undefined>)[effectAction.type];
                            if (executor) {
                                // For discard effects, source and target are the owner of the deck
                                newState = executor.execute(newState, targetId, targetId, effectAction, discardedData, _context);
                            } else {
                                console.warn(`[DiscardExecutor] No executor found for discard effect type: ${effectAction.type}`);
                            }
                        }
                    }
                }
            }
        }

        return newState;
    }
}

export class ExhaustExecutor extends ActionExecutor<ExhaustActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: ExhaustActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { amount } = actionData;
        return applyMutations(state, [{
            type: 'EXHAUST',
            sourceId,
            targetId,
            payload: { amount }
        }]);
    }
}

export class ReturnExecutor extends ActionExecutor<ReturnActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: ReturnActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { amount, sourcePile, destinationPile, filter } = actionData;
        return applyMutations(state, [{
            type: 'RETURN',
            sourceId,
            targetId,
            payload: { amount, sourcePile, destinationPile, filter }
        }]);
    }
}

export class SearchExecutor extends ActionExecutor<SearchActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: SearchActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { amount, criteria } = actionData;
        return applyMutations(state, [{
            type: 'SEARCH',
            sourceId,
            targetId,
            payload: { amount, criteria }
        }]);
    }
}

export class MultiplyStatusExecutor extends ActionExecutor<MultiplyStatusActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: MultiplyStatusActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { status, factor } = actionData;
        const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
        const target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);
        if (!target) return state;

        const existingStatus = target.statusEffects.find(s => s.type === status);
        if (!existingStatus) return state;

        const bonusStacks = Math.floor(existingStatus.stacks * (factor - 1));
        if (bonusStacks <= 0) return state;

        return applyMutations(state, [{
            type: 'STATUS',
            targetId: targetId,
            sourceId: sourceId,
            payload: { status, stacks: bonusStacks }
        }]);
    }
}



export class TriggerStatusExecutor extends ActionExecutor<TriggerStatusActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: TriggerStatusActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { status } = actionData;
        const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
        const target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);
        if (!target) return state;

        const effect = target.statusEffects.find(s => s.type === status);
        if (!effect) return state;

        const behavior = getStatusBehavior(effect.type);
        const result = behavior.endTurn(effect, target);

        let finalState = state;
        let damage = result.damage;

        if (damage > 0) {
            const { damage: finalDamage } = executeStatusDamageCalculated(state, target, damage, effect.type);
            damage = finalDamage;

            finalState = addLog(finalState, `  ☣️ ${status} effect triggered for ${damage} damage!`);
            finalState = applyMutations(finalState, [{
                type: 'HP',
                sourceId: sourceId,
                targetId: targetId,
                payload: {
                    amount: damage,
                    isHeal: false,
                    element: status === 'Burn' ? 'Fire' : 'None'
                }
            }]);
        }

        if (result.healing && result.healing > 0) {
            finalState = applyMutations(finalState, [{
                type: 'HP',
                sourceId: sourceId,
                targetId: targetId,
                payload: {
                    amount: result.healing,
                    isHeal: true
                }
            }]);
        }

        return finalState;
    }
}

export class PlayLastCardExecutor extends ActionExecutor<PlayLastCardActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, _actionData: PlayLastCardActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        if (!state.lastProgramPlayed) {
            return applyMutations(state, [{
                type: 'LOG',
                targetId: '',
                payload: '  ⚠️ No program was played previously!'
            }]);
        }

        // Re-execute handlePlayProgram for the last card
        // Note: This might cost energy again if we just call handlePlayProgram.
        // The user said "Re-executes the actions of whatever card is in lastProgramPlayed".
        // Usually "Echo" effects in card games don't re-pay cost.
        // I will manually execute the actions of the last program to avoid re-paying cost.
        const lastProgramData = GetProgramData(state.lastProgramPlayed);
        let finalState = state;

        if (lastProgramData.actions) {
            finalState = addLog(finalState, `  🔁 Reprogramming: ${lastProgramData.name}`);
            for (const action of lastProgramData.actions) {
                // Prevent infinite recursion: do not re-execute PlayLastCard actions
                if (action.type === 'PLAY_LAST_CARD') {
                    continue;
                }

                const executor = (ActionExecutorRegistry as Record<string, ActionExecutor<ExecutableAction> | undefined>)[action.type];
                if (executor) {
                    // For simplicity, we use the current target for the repeated actions
                    finalState = executor.execute(finalState, sourceId, targetId, action, lastProgramData, _context);
                }
            }
        }

        return finalState;
    }
}

/**
 * Ticket 53 - resolve a program's actions for FREE, with no Energy paid, no hand/pile move and
 * no constraint check. This is the same shape as `PlayLastCardExecutor` above (that is what the
 * ticket means by "PLAY_LAST_CARD machinery"), pulled out as a function because VALHALLA_UPLINK
 * needs it from firmware and needs two things the executor cannot give it:
 *
 *  - a per-action target: the free cast has no declared target, so SELF actions land on the
 *    caster and everything else on a seeded random living enemy;
 *  - RAMPAGE growth: the resurrected card is a real INSTANCE, so it reads and banks
 *    `card_growth:<instanceId>` exactly as a paid cast does (ticket 53: "the VALHALLA free
 *    resurrection also grows it").
 *
 * The caller owns the pile: nothing here moves the card, so a card replayed from the discard
 * simply stays in the discard.
 */
export function resolveProgramFree(
    state: IBattleState,
    sourceId: string,
    instanceId: string,
    programData: ProgramData,
    context: HookContext
): IBattleState {
    let finalState = state;
    const isPlayerSource = finalState.playerParty.some(e => e.id === sourceId);

    // One seeded enemy pick for the whole cast, threaded back into the state so the next
    // random consumer does not replay it (same contract as HookFactory.resolveTarget).
    const enemies = (isPlayerSource ? finalState.enemyParty : finalState.playerParty).filter(e => e.currentHp > 0);
    let defaultTargetId = sourceId;
    if (enemies.length > 0) {
        const { value: index, nextSeed } = new PRNG(finalState.seed).nextInt(0, enemies.length - 1);
        defaultTargetId = enemies[index].id;
        finalState = { ...finalState, seed: nextSeed };
    }

    const growth = programData.growPerPlay ? (finalState.counters?.[`card_growth:${instanceId}`] || 0) : 0;

    for (const action of programData.actions ?? []) {
        // No recursion: a free cast may not itself echo, or VALHALLA + Reprogram loops.
        if (action.type === 'PLAY_LAST_CARD') continue;

        const isSelf = action.target === 'SELF' || (action.target as string) === 'Self' || action.type === 'DISCARD';
        const tId = isSelf ? sourceId : defaultTargetId;
        const target = finalState.playerParty.find(e => e.id === tId) || finalState.enemyParty.find(e => e.id === tId);
        if (!target || target.currentHp <= 0) continue;

        // `resolved` is a fresh shallow copy, so mutating it is safe - but every field on a
        // ProgramAction is declared readonly (the index signature included), hence the mutable
        // view for the write. The read side goes through AttackActionData, which is what a
        // `type === 'ATTACK'` action actually is.
        const resolved: ProgramAction = { ...action };
        if (growth > 0 && resolved.type === 'ATTACK' && (resolved as AttackActionData).power !== undefined) {
            (resolved as MutableProgramAction).power = (resolved as AttackActionData).power + growth;
        }

        const executor = (ActionExecutorRegistry as Record<string, ActionExecutor<ExecutableAction> | undefined>)[resolved.type];
        if (executor) {
            finalState = executor.execute(finalState, sourceId, tId, resolved, programData, { ...context, state: finalState });
        }
    }

    if (programData.growPerPlay) {
        finalState = applyMutations(finalState, [{
            type: 'COUNTER',
            targetId: '',
            payload: { key: `card_growth:${instanceId}`, operator: 'ADD', amount: programData.growPerPlay }
        }]);
    }

    return finalState;
}

export class TauntExecutor extends ActionExecutor<TauntActionData> {
    execute(state: IBattleState, sourceId: string, _targetId: string, _actionData: TauntActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const isPlayerSource = state.playerParty.some(e => e.id === sourceId);
        const enemyPartyKey = isPlayerSource ? 'enemyParty' : 'playerParty';
        const sourceName = isPlayerSource ? state.playerParty.find(e => e.id === sourceId)?.name : state.enemyParty.find(e => e.id === sourceId)?.name;

        let newState = state;
        newState = addLog(newState, `  🤬 ${sourceName} uses Taunt! All enemies are forced to target them!`);

        const updatedParty = newState[enemyPartyKey].map(e => ({
            ...e,
            forcedTargetId: sourceId
        }));

        newState = { ...newState, [enemyPartyKey]: updatedParty };
        return newState;
    }
}

export class BuffNextProgramExecutor extends ActionExecutor<BuffNextProgramActionData> {
    execute(state: IBattleState, _sourceId: string, targetId: string, actionData: BuffNextProgramActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const isPlayerTarget = state.playerParty.some(e => e.id === targetId);
        const partyKey = isPlayerTarget ? 'playerParty' : 'enemyParty';
        let newState = state;

        const party = newState[partyKey];
        const targetIndex = party.findIndex(e => e.id === targetId);

        if (targetIndex > -1) {
            const target = party[targetIndex];
            const newModifier = {
                multiplier: actionData.multiplier ?? 1,
                flatBonus: actionData.flatBonus ?? 0,
                costReduction: actionData.costReduction ?? 0,
                powerBonus: actionData.powerBonus ?? 0,
                appliesTo: actionData.appliesTo
            };

            const updatedParty = [...party];
            updatedParty[targetIndex] = {
                ...target,
                nextProgramModifier: newModifier
            };

            newState = { ...newState, [partyKey]: updatedParty };
            newState = addLog(newState, `  ✨ ${target.name} primes their next program!`);
        }

        return newState;
    }
}

export class RedirectTargetExecutor extends ActionExecutor<RedirectTargetActionData> {
    execute(state: IBattleState, _sourceId: string, targetId: string, actionData: RedirectTargetActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const { newTargetId, isRandom } = actionData;

        let finalTargetId = newTargetId;
        let newState = state;

        if (isRandom) {
            const prng = new PRNG(newState.seed);

            // Redirect to a random ally of the originally targeted entity
            const isPlayerTarget = newState.playerParty.some(e => e.id === targetId);
            const targetParty = isPlayerTarget ? newState.playerParty : newState.enemyParty;
            const validTargets = targetParty.filter(e => e.currentHp > 0 && e.id !== targetId);

            if (validTargets.length > 0) {
                const { value: randIndex, nextSeed } = prng.nextInt(0, validTargets.length - 1);
                finalTargetId = validTargets[randIndex].id;
                newState = { ...newState, seed: nextSeed };
            } else {
                return newState; // No valid other targets
            }
        }

        if (!finalTargetId) return newState;

        const isPlayerActualTarget = newState.playerParty.some(e => e.id === targetId);
        const actualTargetPartyKey = isPlayerActualTarget ? 'playerParty' : 'enemyParty';

        const party = newState[actualTargetPartyKey];
        const index = party.findIndex(e => e.id === targetId);

        if (index > -1) {
            const updatedParty = [...party];
            updatedParty[index] = {
                ...party[index],
                forcedTargetId: finalTargetId
            };

            const targetName = party[index].name;
            const newTargetName = newState.playerParty.find(e => e.id === finalTargetId)?.name || newState.enemyParty.find(e => e.id === finalTargetId)?.name || 'someone else';

            newState = { ...newState, [actualTargetPartyKey]: updatedParty };
            newState = addLog(newState, `  🎯 ${targetName} is forced to target ${newTargetName}!`);
            return newState;
        }

        return newState;
    }
}

export class ForceDiscardExecutor extends ActionExecutor<ForceDiscardActionData> {
    execute(state: IBattleState, sourceId: string, targetId: string, actionData: ForceDiscardActionData, program: ProgramData | undefined, context: HookContext): IBattleState {
        // Delegate to DiscardExecutor so we don't duplicate discardEffect logic
        const discardExecutor = ActionExecutorRegistry['DISCARD'];
        return discardExecutor.execute(state, sourceId, targetId, {
            ...actionData,
            type: 'DISCARD'
        }, program, context);
    }
}

/**
 * SHIFT_STANCE (Watcher model): moves the SOURCE of the card into Dark or Light
 * Stance, regardless of the card's target. Entering a stance removes the opposite
 * one (also enforced by StanceBehavior.onApply — belt and suspenders) and routes
 * through the STATUS mutation pipeline so STATUS_APPLIED events and
 * onStatusApplied hooks (e.g. Hel's EQUINOX_TOGGLE draw) fire normally.
 * Re-entering the current stance is a no-op: no event, no hook trigger.
 */
export class ShiftStanceExecutor extends ActionExecutor<ShiftStanceActionData> {
    execute(state: IBattleState, sourceId: string, _targetId: string, actionData: ShiftStanceActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const stanceStatus: StatusType = actionData.stance === 'Dark' ? 'DarkStance' : 'LightStance';
        const oppositeStatus: StatusType = actionData.stance === 'Dark' ? 'LightStance' : 'DarkStance';

        const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
        const source = findEntity(sourceId, state.playerParty) || findEntity(sourceId, state.enemyParty);
        if (!source) return state;

        // Already in this stance: nothing shifts (stacks stay capped at 1).
        if (source.statusEffects.some(s => s.type === stanceStatus)) {
            return addLog(state, `  ⚖️ ${source.name} is already in ${actionData.stance} Stance`);
        }

        let newState = state;
        const hadOpposite = source.statusEffects.some(s => s.type === oppositeStatus);

        // Explicitly strip the opposite stance first (StanceBehavior.onApply would
        // also do this, but removing it here guarantees a STATUS_REMOVED event for
        // the VFX/status-ring even if behaviors change later).
        if (hadOpposite) {
            const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
                party.map(e => e.id === sourceId
                    ? { ...e, statusEffects: e.statusEffects.filter(s => s.type !== oppositeStatus) }
                    : e);
            newState = {
                ...newState,
                playerParty: updateParty(newState.playerParty),
                enemyParty: updateParty(newState.enemyParty)
            };
            globalBattleEventBus.emit({
                type: 'STATUS_REMOVED',
                targetId: sourceId,
                status: oppositeStatus,
                timestamp: Date.now()
            });
        }

        const icon = actionData.stance === 'Dark' ? '☾' : '☀';
        newState = addLog(newState, `  ${icon} ${source.name} enters ${actionData.stance} Stance`);

        // Apply the stance through the standard STATUS pipeline: caps at 1 stack,
        // emits STATUS_APPLIED and fires onStatusApplied hooks (EQUINOX_TOGGLE).
        return applyMutations(newState, [{
            type: 'STATUS',
            targetId: sourceId,
            sourceId: sourceId,
            payload: { status: stanceStatus, stacks: 1 }
        }]);
    }
}

/**
 * REVIVE — ticket 15. Brings a unit at 0 HP back at a percentage of its max HP.
 *
 * The one thing in the engine that deliberately acts on a dead unit, and it is written so that it
 * can only ever do that: a target with HP left is refused outright, so this can never be smuggled in
 * as a percentage heal. `battleReducer.handleFireMacro` is what lets the target through its
 * alive-check, and it does so only for this action type.
 *
 * **It does not run `checkDefeat` in reverse, because there is nothing to run.** `checkDefeat` fires
 * `onUnitFainted` and clears the unit's daemons; the daemons are gone for good (a revived unit
 * re-installs them like anyone else) and no hook phase exists for un-fainting. Death is derived from
 * `currentHp <= 0` everywhere in the engine — there is no `isDead` flag to clear — so restoring HP
 * IS the revival, and the unit is a legal target, a legal caster and a legal hook owner again the
 * moment this returns.
 *
 * Statuses are deliberately left alone: whatever killed them (a Burn, a Poison) is still on them, so
 * a revive into a burning board is a real decision rather than a full cleanse in disguise. Energy is
 * left alone too — the unit gets its refill at the next `processPreTurn` like everyone else, so
 * reviving does not hand the player a fresh caster mid-turn.
 */
export class ReviveExecutor extends ActionExecutor<ReviveActionData> {
    execute(state: IBattleState, _sourceId: string, targetId: string, actionData: ReviveActionData, _program: ProgramData | undefined, _context: HookContext): IBattleState {
        const findEntity = (id: string, party: ReadonlyArray<IBattleEntity>) => party.find(e => e.id === id);
        const target = findEntity(targetId, state.playerParty) || findEntity(targetId, state.enemyParty);
        if (!target) return state;
        // Only the downed. A revive on a living unit is a bug at the call site, not a small heal.
        if (target.currentHp > 0) return state;

        // Ticket 18 moved the arithmetic (the 1-100 clamp and the floor of 1) to
        // `macroRegistry.revivedHpFor`, because the run has to record the same number this writes:
        // `runSlice.reviveGauntletMember` takes the revived member out of `downedMemberIds` and puts
        // this HP into `persistedHp`, or the next gauntlet fight re-downs them. Two copies of the
        // formula would be two answers to "how much HP did that revive give".
        const restored = revivedHpFor(target.maxHp, actionData.percent ?? 0);

        const updateParty = (party: ReadonlyArray<IBattleEntity>) =>
            party.map(e => (e.id === targetId ? { ...e, currentHp: restored, tempHp: 0 } : e));

        let newState: IBattleState = {
            ...state,
            playerParty: updateParty(state.playerParty),
            enemyParty: updateParty(state.enemyParty)
        };
        newState = addLog(newState, `  ✨ ${target.name} is revived at ${restored}/${target.maxHp} HP!`);

        globalBattleEventBus.emit({
            type: 'HEAL',
            targetId,
            amount: restored,
            sourceId: _sourceId,
            timestamp: Date.now()
        });

        return newState;
    }
}

// Registry to route ActionType to Executors
export const ActionExecutorRegistry: Record<ActionType, ActionExecutor<ExecutableAction>> = {
    'ATTACK': new AttackExecutor(),
    'STATUS': new StatusExecutor(),
    'HEAL': new HealExecutor(),
    'DRAW': new DrawExecutor(),
    'ENERGY': new EnergyExecutor(),
    'GENERATE_CARD': new GenerateCardExecutor(),
    'CLEANSE': new CleanseExecutor(),
    'DISCARD': new DiscardExecutor(),
    'EXHAUST': new ExhaustExecutor(),
    'RETURN': new ReturnExecutor(),
    'SEARCH': new SearchExecutor(),
    'MULTIPLY_STATUS': new MultiplyStatusExecutor(),
    'TRIGGER_STATUS': new TriggerStatusExecutor(),
    'PLAY_LAST_CARD': new PlayLastCardExecutor(),
    'TAUNT': new TauntExecutor(),
    'BUFF_NEXT_PROGRAM': new BuffNextProgramExecutor(),
    'REDIRECT_TARGET': new RedirectTargetExecutor(),
    'FORCE_DISCARD': new ForceDiscardExecutor(),
    'SHIFT_STANCE': new ShiftStanceExecutor(),
    'REVIVE': new ReviveExecutor()
};
