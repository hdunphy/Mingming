import type { IBattleState, Element, AttackActionData } from '../../engine/types';
import { GetProgramData } from '../../engine/data/programRegistry';
import { calculateDamage, getModifierBreakdown } from '../../engine/combatUtils';
import { getConstraintBehavior } from '../../engine/ConstraintBehavior';
import { getEffectiveAttackPower, getDamageScalingMultiplier } from '../../engine/actions/ActionExecutors';

/** Result of the on-hover damage preview, with the elemental breakdown that explains the number. */
export interface DamagePreview {
    /** Predicted damage; 0 means "no preview". */
    damage: number;
    /** True when the card's element matches the source's primary/secondary element (×1.5 STAB). */
    stab: boolean;
    /** ElementalMatrix product vs the target (with secondary mitigation); 1 when neutral. */
    effectiveness: number;
    /** The card's element — used to color the STAB chip. */
    element: Element;
    /** Extra POWER granted by SHARP_STACKS scaling (+5/stack); 0 when inactive. */
    sharpBonus: number;
    /**
     * Ticket 90: the POST-damage multiplier this card is riding right now - cards played this
     * turn, Energy spent, the target's Burn stacks. 1 when the card has no such scaling.
     * Surfaced separately so the UI can say WHY the number is what it is: a `stampede` at x1
     * and the same card at x4 are the same card having a very different turn.
     */
    scalingMultiplier: number;
    /** The scaling key driving `scalingMultiplier`, for labelling. Undefined when there is none. */
    scalingKind?: string;
}

const NO_PREVIEW: DamagePreview = { damage: 0, stab: false, effectiveness: 1, element: 'None', sharpBonus: 0, scalingMultiplier: 1 };

/**
 * Pure helper for the on-hover damage preview.
 *
 * Predicts the ATTACK damage of the card `cardId` (from the player's hand)
 * when played by the currently SELECTED source unit against `targetId`,
 * plus the STAB / type-effectiveness breakdown behind that number.
 *
 * Returns the zero preview (damage 0, neutral breakdown) when:
 * - no source is selected, or the selected source is dead,
 * - the card is not in hand or has no ATTACK action,
 * - the target does not exist or is already defeated,
 * - the source cannot play the card (energy / SELF-side constraints).
 */
export function computeDamagePreview(
    state: IBattleState | null | undefined,
    sourceId: string | null | undefined,
    cardId: string | null | undefined,
    targetId: string
): DamagePreview {
    if (!state || !sourceId || !cardId) return NO_PREVIEW;

    const card = state.playerDeck.hand.find(c => c.id === cardId);
    if (!card) return NO_PREVIEW;

    const source = state.playerParty.find(p => p.id === sourceId);
    if (!source || source.currentHp <= 0) return NO_PREVIEW;

    const target =
        state.playerParty.find(e => e.id === targetId) ||
        state.enemyParty.find(e => e.id === targetId);
    if (!target || target.currentHp <= 0) return NO_PREVIEW;

    const data = GetProgramData(card.dataId);

    // Source-side playability: energy (BASE constraint) plus any other SELF constraints.
    const selfConstraintsOk = (data.constraints || [])
        .filter(c => c.target === 'SELF')
        .every(c => getConstraintBehavior(c.type).validate(c, { source, cost: card.currentCost }));
    if (!selfConstraintsOk) return NO_PREVIEW;

    const attackAction = data.actions.find(a => a.type === 'ATTACK');
    if (!attackAction) return NO_PREVIEW;

    const { stab, effectiveness } = getModifierBreakdown(source, target, data);
    // Same effective-power helper the AttackExecutor uses, so action scaling
    // (SHARP_STACKS: +5 power per Sharp stack) shows up in the preview too.
    const basePower = (attackAction as AttackActionData).power || 0;
    const effectivePower = getEffectiveAttackPower(source, attackAction as AttackActionData, target);
    // Ticket 90: the executor multiplies the finished damage by the turn-history scalings
    // (CARDS_PLAYED, ENERGY_SPENT, BURN_TIMES_ENERGY...). The preview used to stop before that
    // step, so `stampede` previewed at its printed power however many cards you had played.
    const action = attackAction as AttackActionData;
    // OFF BY ONE, and it is the one that made the numbers feel wrong: `handlePlayProgram`
    // increments `cardsPlayedThisTurn`, `elementPlays` and `lastEnergySpent` BEFORE the actions
    // resolve, so a scaler counts the card being cast. The preview runs before any of that, so it
    // has to count this card too or it under-reads by exactly one play. Verified against the real
    // reducer in `damagePreview.test.ts`.
    const asResolved = {
        ...state,
        cardsPlayedThisTurn: state.cardsPlayedThisTurn + 1,
        lastEnergySpent: card.currentCost,
        elementPlays: {
            ...(state.elementPlays ?? {}),
            [data.element]: (state.elementPlays?.[data.element] ?? 0) + 1,
        },
    } as IBattleState;
    const multiplier = getDamageScalingMultiplier(asResolved, action.scaling, data.element, target);
    const raw = calculateDamage(source, target, data, effectivePower, state);
    return {
        damage: Math.floor(raw * multiplier),
        stab,
        effectiveness,
        element: data.element,
        sharpBonus: effectivePower - basePower,
        scalingMultiplier: multiplier,
        scalingKind: multiplier === 1 ? undefined : action.scaling,
    };
}
