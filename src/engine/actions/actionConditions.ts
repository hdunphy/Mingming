/**
 * Action-level conditional evaluation for card plays, replays, and free casts.
 *
 * Extracted per Ticket 164e so that card plays (battleReducer), replays (PlayLastCardExecutor / Reprogram / Echo),
 * and free casts (resolveProgramFree / VALHALLA) share the identical conditional evaluation logic.
 */

import type { IBattleEntity, IBattleState, ProgramAction } from '../types';
import { ConditionValidator } from '../core/ConditionValidator';

export const COUNTER_CONSTRAINTS: ReadonlySet<string> = new Set(['CARDS_PLAYED', 'CARDS_DRAWN', 'CARDS_DRAWN_TRIGGERED']);

/**
 * Evaluates whether all action-level conditionals on `action` are met in the current battle context.
 *
 * @param state The current (live/threaded) battle state.
 * @param action The ProgramAction whose conditionals to evaluate.
 * @param declaredTargetId The card or replay's declared target ID (card target).
 * @param currentTarget The per-hit target entity.
 * @param preCastCaster The snapshot of the caster taken before card/replay execution began.
 * @param liveCaster The live caster entity reflecting any state mutations so far.
 */
export function actionConditionsMet(
    state: IBattleState,
    action: ProgramAction,
    declaredTargetId: string | undefined,
    currentTarget: IBattleEntity,
    preCastCaster: IBattleEntity,
    liveCaster: IBattleEntity
): boolean {
    // Ticket 68: `state` is threaded through. It was omitted, so every
    // state-dependent action conditional hit ConditionValidator's
    // `if (!state) return true` fail-safe and passed unconditionally - which is
    // the REAL reason surge_protection's refund fired on 3,371 of 3,371 casts.
    // Same family as 0-TARGETLESS: a guard silently always-true because an
    // argument was not passed.
    if (!action.conditionals || action.conditionals.length === 0) {
        return true;
    }

    // `TARGET` on a conditional means THE CARD'S target, not the target of the
    // action the conditional is written on. pressure_point is the case that
    // found it: "22 power. If Dazed, draw 1" is a DRAW action whose own target
    // is SELF, so `currentTarget` was the CASTER and the rider read the
    // caster's statuses - it never fired on a Dazed enemy and fired every time
    // on a Dazed caster. Both halves of that are wrong and it was silent.
    //
    // Per-hit `currentTarget` still wins wherever the action has a target of
    // its own, which is what keeps an AoE rider ("burn each target that is
    // already Burning") checking each victim rather than the first one.
    const cardTarget = declaredTargetId
        ? (state.playerParty.find(e => e.id === declaredTargetId)
            ?? state.enemyParty.find(e => e.id === declaredTargetId))
        : undefined;

    const conditionSubject = (action.target === 'SELF' || action.target === 'Self'
        || action.type === 'DISCARD')
        ? (cardTarget ?? currentTarget)
        : currentTarget;

    /*
     * TICKET 162a — WHICH CASTER A CONDITIONAL SEES, AND WHY IT DEPENDS ON THE
     * CONSTRAINT.
     *
     * `sourceEntity` is captured at the top of `handlePlayProgram`, BEFORE the
     * snapshot that pays the Energy and increments `playsThisTurn`. So a
     * conditional reading a PER-TURN COUNTER on the caster was reading the
     * state from before this card was played. `riptide_run` found it: *"refund
     * 1 Energy if this is the THIRD or later card you played this turn"* is
     * `CARDS_PLAYED >= 3`, and on the third card the stale entity still said
     * two. It never refunded, silently, and the number looked plausible either
     * way — the shape of the ticket-68 bug the comment above is about.
     *
     * **Reading the live entity for EVERYTHING is wrong, and `molten_core`
     * proves it.** "Apply 4 Burn if you hold Sharp, otherwise 2" is one
     * unconditional Burn plus a conditional one, and on fenrir_v2 the FIRST
     * Burn triggers CINDER_WALL, which grants Sharp. Against the live entity
     * the second half then sees Sharp that the first half had just created, so
     * a card cast with no Sharp at all applied 4 — the card reacting to itself.
     * The suite caught it within one run.
     *
     * So the rule is by CONSTRAINT KIND, and the line is the honest one:
     *
     * - **Per-turn counters** (`CARDS_PLAYED`, `CARDS_DRAWN`,
     *   `CARDS_DRAWN_TRIGGERED`) read the LIVE caster. They are monotonic
     *   within a turn, they cannot be changed by the card's own payload, and
     *   "this is the third card you played" is a sentence that includes the
     *   card saying it.
     * - **Everything else** — statuses, health — reads the PRE-CAST snapshot.
     *   Those are what the card is in the middle of changing, and the board a
     *   card's rider asks about is the board it was played into.
     */
    for (const constraint of action.conditionals) {
        const caster = COUNTER_CONSTRAINTS.has(constraint.type) ? liveCaster : preCastCaster;
        const subject = constraint.target === 'SELF' ? caster : conditionSubject;
        if (!ConditionValidator.evaluateCardConstraint(constraint, caster, subject, 0, state)) {
            return false;
        }
    }

    return true;
}
