/**
 * IS THIS CARD'S "IF" TRUE RIGHT NOW? — the hand's conditional read.
 *
 * Henry, 2026-09-25: *"We also need an indicator if a conditional is true. Like 'if dazed draw one
 * card'. It should highlight green or something similar."*
 *
 * Thirty-eight cards carry an action that only fires under a condition (`action.conditionals`):
 * `pressure_point` draws if the target is Dazed, `brute_force` hits harder if you hold Strength,
 * `war_pact` does one thing above half HP and another below. The player had to check the target's
 * statuses by eye and hold the rule in their head. This module answers the question the same way
 * the reducer will, for the caster and target the hand is already reading for.
 *
 * # THE SAME CHECK, AND THE SAME SUBJECT, AS THE REDUCER
 *
 * `ConditionValidator.evaluateCardConstraint` is the one predicate, reached through
 * `validateSingleConstraint` exactly as `handlePlayProgram` does. What this file has to get right is
 * WHO each constraint is asked about, because that is where the engine has been wrong before:
 *
 * - **`TARGET` means the card's target** — the unit the hand is quoting its numbers against — even on
 *   a SELF-targeted action. That is the `pressure_point` fix in `battleReducer`: "If Dazed, draw 1"
 *   is a DRAW whose own target is the caster, and it asks about the enemy.
 * - **`SELF` reads the caster BEFORE the cast** for statuses and HP (the `molten_core` rule: a card
 *   must not see the Sharp its own first half just granted), and the caster AFTER paying for the
 *   per-turn counters. `CARDS_PLAYED` is the one where that shows: `riptide_run` "third or later card
 *   you played this turn" counts itself, because the reducer has already incremented `playsThisTurn`
 *   when the rider is checked. So the preview adds this card's one play.
 *
 * # WHAT IT CANNOT KNOW, SAID AS `null`
 *
 * No caster picked, or a `TARGET` condition with nobody to aim at, is `null` — not `false`. A card
 * that stays un-highlighted because the question has no answer yet must not read the same as a card
 * whose condition is known to fail, in the tooltip at least; on the face both are simply unlit.
 *
 * AoE caveat, stated rather than hidden: on a Side/All action the engine re-asks a `TARGET` rider for
 * each victim. The hand has one target, so it answers for that one. No shipped conditional card is
 * AoE today (the registry test pins that), so this is a note about the future, not a live gap.
 */

import type { IBattleEntity, IBattleState, ProgramConstraint, ProgramData } from '../../engine/types';
import { validateSingleConstraint } from '../../engine/battleReducer';

/** The per-turn counters the reducer reads on the LIVE caster — see `battleReducer`, ticket 162a. */
const COUNTER_CONSTRAINTS: ReadonlySet<string> = new Set(['CARDS_PLAYED', 'CARDS_DRAWN', 'CARDS_DRAWN_TRIGGERED']);

/** One conditional action on a card, and whether its condition holds right now. */
export interface ConditionalReading {
    /** Index into `data.actions`. */
    readonly actionIndex: number;
    readonly constraints: ReadonlyArray<ProgramConstraint>;
    /** `true` all hold, `false` one fails, `null` the hand cannot answer yet (no caster / no target). */
    readonly met: boolean | null;
}

/**
 * The caster as the reducer sees it at rider time for a COUNTER constraint: this card already paid
 * for and counted. Only the play counter moves — the draw counters are not changed by paying.
 */
function casterAfterPaying(caster: IBattleEntity): IBattleEntity {
    return { ...caster, playsThisTurn: (caster.playsThisTurn ?? 0) + 1 };
}

function evaluateOne(
    constraint: ProgramConstraint,
    state: IBattleState,
    caster: IBattleEntity,
    target: IBattleEntity | null,
): boolean | null {
    const source = COUNTER_CONSTRAINTS.has(constraint.type) ? casterAfterPaying(caster) : caster;
    const subject = constraint.target === 'SELF' ? source : target;
    if (!subject) return null;
    return validateSingleConstraint(constraint, source, subject, 0, state);
}

/**
 * Every conditional action on `data`, read for `caster` against `target`.
 *
 * Empty for a card with no conditionals, which is 328 of the 366 — the caller can skip all of its
 * highlight work on `length === 0`.
 */
export function readCardConditionals(
    state: IBattleState | null | undefined,
    caster: IBattleEntity | null | undefined,
    target: IBattleEntity | null | undefined,
    data: ProgramData,
): ConditionalReading[] {
    const readings: ConditionalReading[] = [];
    (data.actions ?? []).forEach((action, actionIndex) => {
        const constraints = action.conditionals ?? [];
        if (constraints.length === 0) return;

        let met: boolean | null;
        if (!state || !caster || caster.currentHp <= 0) {
            met = null;
        } else {
            met = true;
            for (const c of constraints) {
                const one = evaluateOne(c, state, caster, target ?? null);
                if (one === false) { met = false; break; }
                if (one === null) met = null;
            }
        }
        readings.push({ actionIndex, constraints, met });
    });
    return readings;
}

/**
 * A conditional as a clause the tooltip can print after the effect it gates — "if the target has
 * Dazed". Plain words, and the threshold as the engine holds it (`LT:51` is "below 51% HP", not a
 * rounder number the check does not use: no hidden math).
 */
export function describeConditional(c: ProgramConstraint): string {
    const who = c.target === 'SELF' ? 'the caster' : 'the target';
    switch (c.type) {
        case 'HAS_STATUS':
            return c.minStacks !== undefined
                ? `if ${who} has ${c.minStacks}+ ${c.value}`
                : `if ${who} has ${c.value}`;
        case 'NOT_STATUS':
            return `if ${who} does not have ${c.value}`;
        case 'HEALTH_THRESHOLD': {
            const [op, pct] = String(c.value).split(':');
            return `if ${who} is ${op === 'LT' ? 'below' : 'above'} ${pct}% HP`;
        }
        case 'CARDS_PLAYED':
            return `if this is card ${c.value}+ the caster played this turn`;
        case 'CARDS_DRAWN_TRIGGERED':
            return `if an effect drew the caster ${c.value}+ card${Number(c.value) === 1 ? '' : 's'} this turn`;
        case 'CARDS_DRAWN':
            return `if ${c.value}+ cards were drawn this turn`;
        default:
            return `if ${c.type}`;
    }
}
