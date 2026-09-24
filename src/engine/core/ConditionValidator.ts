import type { IBattleState, IBattleEntity, ProgramConstraint } from '../types';
import type { HookCondition, HookContext } from './HookTypes';
import { resolveCounterKey, resolveSideCounterKey } from './HookTypes';
import { numericBaseCost } from '../types';

/**
 * Statuses considered "negative" (debuffs) for condition checks like sourceDebuffCount.
 * Mirrors the debuff lists previously embedded in hand-written hook conditions.
 */
export const NEGATIVE_STATUSES: ReadonlyArray<string> = ['Burn', 'Poison', 'Asleep', 'Weakened', 'Dazed', 'Stunned', 'Bleed'];

function compareValues(operator: 'LT' | 'GT' | 'LTE' | 'GTE' | 'EQ', currentVal: number, value: number): boolean {
    if (operator === 'LT') return currentVal < value;
    if (operator === 'GT') return currentVal > value;
    if (operator === 'LTE') return currentVal <= value;
    if (operator === 'GTE') return currentVal >= value;
    return currentVal === value;
}

/**
 * A purely functional, stateless utility for evaluating logic conditions.
 * Used by both OS/Daemon Hooks and ProgramCard Constraints to ensure 1:1 logic.
 */
export const ConditionValidator = {
    /**
     * Evaluates an OS or Daemon HookCondition against the current runtime context.
     */
    evaluateHookCondition(condition: HookCondition | undefined, context: HookContext, owner: IBattleEntity): boolean {
        if (!condition) return true;

        // 1. Source & Target Checks
        const isOwnerPlayer = context.state.playerParty.some((e: IBattleEntity) => e.id === owner.id);

        // 'ANY' is an explicit always-match on the source/target axis (used by e.g.
        // nidhoggr_v2's on-faint hook). Ticket 07 (2026-08-05): it previously "worked"
        // only by falling through every branch below; now it is a named, typed value.
        if (condition.source && condition.source !== 'ANY') {
            if (condition.source === 'SELF' && context.source?.id !== owner.id) {
                return false;
            }
            const isSourcePlayer = context.source ? context.state.playerParty.some((e: IBattleEntity) => e.id === context.source?.id) : false;
            if (condition.source === 'ALLY' && isOwnerPlayer !== isSourcePlayer) return false;
            if (condition.source === 'OPPONENT' && isOwnerPlayer === isSourcePlayer) return false;
        }

        if (condition.target && condition.target !== 'ANY') {
            if (condition.target === 'SELF' && context.target?.id !== owner.id) {
                return false;
            }
            const isTargetPlayer = context.target ? context.state.playerParty.some((e: IBattleEntity) => e.id === context.target?.id) : false;
            if (condition.target === 'ALLY' && isOwnerPlayer !== isTargetPlayer) return false;
            if (condition.target === 'OPPONENT' && isOwnerPlayer === isTargetPlayer) return false;
        }

        // 1b. THIS ACTION Check — ticket 162e.
        //
        // `actionType` below asks about the CARD ("does it have an ATTACK anywhere"); this asks
        // about the SWING. A per-hit hook needs the second question, and the field that was meant
        // to answer it had been in the schema since ticket 103 with nothing reading it. See
        // `HookCondition.isAttack` for what that cost `ember_ward`.
        //
        // `context.action` is set only at the per-hit dispatches, so `isAttack: true` is false at
        // `onActionStart` / `onActionEnd` / `runVitalsHook` rather than accidentally true — a hook
        // that wants a swing cannot get one from a dispatch that has no swing.
        if (condition.isAttack !== undefined) {
            if ((context.action?.type === 'ATTACK') !== condition.isAttack) return false;
        }

        // 2. Program Checks
        if (condition.actionType && context.program) {
            // A program satisfies the actionType check if ANY of its actions match
            const hasAction = context.program.actions.some(a => a.type === condition.actionType);
            if (!hasAction) return false;
        }
        if (condition.programElement && context.program?.element !== condition.programElement) return false;

        // 3. Cost Check
        if (condition.baseCost !== undefined) {
            const cost = numericBaseCost(context.program?.baseCost ?? 0);
            if (typeof condition.baseCost === 'number') {
                if (cost !== condition.baseCost) return false;
            } else {
                const { operator, value } = condition.baseCost;
                if (operator === 'LT' && !(cost < value)) return false;
                if (operator === 'GT' && !(cost > value)) return false;
                if (operator === 'LTE' && !(cost <= value)) return false;
                if (operator === 'GTE' && !(cost >= value)) return false;
                if (operator === 'EQ' && !(cost === value)) return false;
            }
        }

        // 4. Status Check
        if (condition.statusApplied && context.statusApplied !== condition.statusApplied) return false;

        // 4b. Status-In-Set Check (e.g. "any debuff", "any buff")
        if (condition.statusAppliedIn) {
            if (!context.statusApplied || !condition.statusAppliedIn.includes(context.statusApplied)) return false;
        }

        // 4b-ii. Ticket 107: the exclusion form. A hook that applies a status in response to a
        // status application has to be able to say "but not the one I apply", or it feeds itself.
        if (condition.statusAppliedNotIn) {
            if (context.statusApplied && condition.statusAppliedNotIn.includes(context.statusApplied)) return false;
        }

        // 4c. Program Category Checks
        if (condition.programCategoryIn) {
            if (!context.program || !condition.programCategoryIn.includes(context.program.category)) return false;
        }
        if (condition.programCategoryNot) {
            if (!context.program || condition.programCategoryNot.includes(context.program.category)) return false;
        }

        if (condition.programAppliesStatus !== undefined) {
            const applies = !!context.program?.actions?.some(a => a.type === 'STATUS');
            if (condition.programAppliesStatus !== applies) return false;
        }

        // 4d. Source Debuff Count Check (number of negative statuses on the source)
        if (condition.sourceDebuffCount) {
            const debuffCount = context.source
                ? context.source.statusEffects.filter(s => NEGATIVE_STATUSES.includes(s.type)).length
                : 0;
            const { operator, value } = condition.sourceDebuffCount;
            if (!compareValues(operator, debuffCount, value)) return false;
        }

        // 5. Draw Check
        if (condition.isNaturalDraw !== undefined && context.isNaturalDraw !== condition.isNaturalDraw) return false;

        // 6. Token Check
        if (condition.isToken !== undefined && (context.program?.isToken ?? false) !== condition.isToken) return false;

        // 7. Target Status Check
        if (condition.targetStatus && context.target) {
            const targetStat = context.target.statusEffects.find(s => s.type === condition.targetStatus!.status);
            if (!targetStat) return false;
            if (condition.targetStatus.minStacks !== undefined && targetStat.stacks < condition.targetStatus.minStacks) return false;
        }

        // 8. Source Status Check
        if (condition.sourceStatus && context.source) {
            const sourceStat = context.source.statusEffects.find(s => s.type === condition.sourceStatus!.status);
            if (!sourceStat) return false;
            if (condition.sourceStatus.minStacks !== undefined && sourceStat.stacks < condition.sourceStatus.minStacks) return false;
        }

        // 9. Counter Check (hook counters are OWNER-scoped by default so units
        // sharing an OS count independently; scope: 'GLOBAL' reads the raw key)
        //
        // Ticket 53: `counters` is the AND-list form of `counter`. GENESIS_FIRMWARE needs two
        // at once - a GLOBAL read of `last_overheal` and an OWNER-scoped once-per-turn guard -
        // and one object cannot express that. Both fields are honoured; `counter` stays because
        // eleven existing hooks use it and the single case reads better without a wrapper array.
        const counterChecks = [
            ...(condition.counter ? [condition.counter] : []),
            ...(condition.counters ?? [])
        ];
        for (const check of counterChecks) {
            const { key, operator, value, scope } = check;
            const currentCounters = context.state.counters || {};
            // Ticket 71: SIDE needs the state to know which party the owner is in, so it cannot
            // go through `resolveCounterKey` — see `resolveSideCounterKey`.
            const resolved = scope === 'SIDE'
                ? resolveSideCounterKey(key, owner, context.state)
                : resolveCounterKey(key, scope, owner);
            const currentVal = currentCounters[resolved] || 0;
            if (operator === 'LT' && !(currentVal < value)) return false;
            if (operator === 'GT' && !(currentVal > value)) return false;
            if (operator === 'LTE' && !(currentVal <= value)) return false;
            if (operator === 'GTE' && !(currentVal >= value)) return false;
            if (operator === 'EQ' && !(currentVal === value)) return false;
        }

        /*
         * 10. Current Energy Check — **the SOURCE's Energy, not the hook owner's.**
         *
         * TICKET 162a: it read `owner.currentEnergy`, and that had never been observed because the
         * field had no user until `short_fuse` ("an enemy that ends its turn with unspent Energy
         * takes 10 power per point"). Its condition is `{ source: 'OPPONENT', currentEnergy: > 0 }`,
         * which the old reading turned into *"an enemy acted AND **I** still have Energy"* — so the
         * daemon taxed an enemy who had spent out, as long as its own host was holding some. The
         * card's whole point is the CONDITION, and the condition was about the wrong body.
         *
         * `context.source` is the entity every trigger names as the actor — `onTurnEnd` dispatches
         * one hook per unit with `source: entity`, which is exactly the unit whose Energy this asks
         * about. Falls back to the owner when a trigger carries no source, so a future hook that
         * writes `currentEnergy` with no `source` clause still means something.
         */
        if (condition.currentEnergy) {
            const { operator, value } = condition.currentEnergy;
            const currentVal = (context.source ?? owner).currentEnergy;
            if (operator === 'LT' && !(currentVal < value)) return false;
            if (operator === 'GT' && !(currentVal > value)) return false;
            if (operator === 'LTE' && !(currentVal <= value)) return false;
            if (operator === 'GTE' && !(currentVal >= value)) return false;
            if (operator === 'EQ' && !(currentVal === value)) return false;
        }

        // 11. Clock Check (ticket 68). `state.turn` is a full round, not a side-turn — see
        // `HookCondition.turnAtLeast` for why an escalating aura written against side-turns would
        // tick twice as fast for the side that moves first.
        if (condition.turnAtLeast !== undefined && context.state.turn < condition.turnAtLeast) return false;

        return true;
    },

    /**
     * Evaluates a ProgramConstraint (usually found on Cards directly) against the target.
     */
    evaluateCardConstraint(constraint: ProgramConstraint, source: IBattleEntity, subject: IBattleEntity, cost: number, state?: IBattleState): boolean {
        switch (constraint.type) {
            case 'HAS_STATUS': {
                const held = subject.statusEffects.find(s => s.type === constraint.value);
                if (!held) return false;
                // Ticket 39: optional stack floor so a payoff card can refuse to be
                // played early. The AI validates through this same path
                // (TacticalAI -> validateProgramConstraints), which is the point:
                // without it the search cashes wither_feast at the first stack it
                // sees and the sim measures a card nobody would ever play that way.
                if (constraint.minStacks !== undefined && held.stacks < constraint.minStacks) return false;
                break;
            }

            case 'HEALTH_THRESHOLD': {
                // value format: "LT:30" (Less Than 30%) or "GT:50" (Greater Than 50%)
                //
                // Ticket 55: braced. `const` in an unbraced case is scoped to the WHOLE switch, so
                // `op`, `valStr` and `threshold` were visible (in the temporal dead zone) to every
                // case below this one — which is what `no-case-declarations` is warning about. The
                // neighbouring `AURA`/`STATUS` cases were already braced; this one was not.
                if (typeof constraint.value !== 'string') break;
                const [op, valStr] = constraint.value.split(':');
                const threshold = parseInt(valStr);
                const hpPercent = (subject.currentHp / subject.maxHp) * 100;

                if (op === 'LT' && hpPercent >= threshold) return false;
                if (op === 'GT' && hpPercent <= threshold) return false;
                break;
            }

            case 'BASE':
                // Base Energy Check
                if (source.currentEnergy < cost) return false;
                break;

            case 'CARDS_DRAWN':
                // Check if enough cards were drawn this turn
                if (!state) return true; // Fail safe
                if (state.cardsDrawnThisTurn < (constraint.value as number)) return false;
                break;

            case 'CARDS_DRAWN_TRIGGERED':
                // Ticket 68: only draws an EFFECT caused count - a card, an OS or a daemon.
                // The draw-phase refill is excluded, which is the whole point: `CARDS_DRAWN`
                // above is satisfied on ~91% of turns for every species purely by the refill
                // (it fails only when a full hand clamps the draw to zero), so a card priced
                // for a conditional refund was getting an unconditional one.
                if (!state) return true; // Fail safe, same as CARDS_DRAWN
                /*
                 * PER-CASTER since Henry's 2026-08-30 scope ruling, for the same reason the
                 * `CARDS_DRAWN_TRIGGERED` scaler is — see `ActionExecutors.getScalingValue`.
                 *
                 * The one card on this path is `surge_protection`'s energy refund, whose constraint
                 * is declared `"target": "SELF"` in `constraints.json` and whose text reads *"if a
                 * card, OS or daemon drew YOU a card this turn"*. Both already said caster; only the
                 * counter disagreed.
                 *
                 * **This is a real behaviour change and it makes the refund harder to get** — at 3v3
                 * an ally's draw used to satisfy it. Called out rather than buried, because leaving
                 * this half global while the scaler went per-unit would rebuild the exact
                 * inconsistency the ruling removed.
                 */
                if ((source.nonNaturalDrawsThisTurn ?? 0) < (constraint.value as number)) return false;
                break;

            case 'CARDS_PLAYED':
                /*
                 * TICKET 162a - how many cards THIS CASTER has played this turn, `riptide_run`'s
                 * refund gate.
                 *
                 * `source.playsThisTurn` rather than `state.cardsPlayedThisTurn`, for the reason
                 * ticket 123 settled for the scaler of the same name: at 3v3 the hand is SHARED,
                 * so the side counter lets an ally's turn pay for your card. The card's own text
                 * says "you".
                 *
                 * No `if (!state) return true` fail-safe here, unlike the two cases above: the
                 * counter lives on the entity, so there is nothing to fail safe ABOUT - and a
                 * fail-safe that returns true is how surge_protection's refund fired on 3,371 of
                 * 3,371 casts (see the CARDS_DRAWN_TRIGGERED note).
                 */
                if ((source.playsThisTurn ?? 0) < (constraint.value as number)) return false;
                break;

            case 'NOT_STATUS':
                if (subject.statusEffects.some(s => s.type === constraint.value)) {
                    return false;
                }
                break;

            default:
                console.warn(`Unknown constraint type: ${constraint.type}`);
                break;
        }

        return true;
    }
};
