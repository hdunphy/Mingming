import type { IBattleState } from '../../engine/types';
import { GetProgramData } from '../../engine/data/programRegistry';
import { calculateDamage } from '../../engine/combatUtils';
import { getConstraintBehavior } from '../../engine/ConstraintBehavior';

/**
 * Pure helper for the on-hover damage preview.
 *
 * Predicts the ATTACK damage of the card `cardId` (from the player's hand)
 * when played by the currently SELECTED source unit against `targetId`.
 *
 * Returns 0 (no preview) when:
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
): number {
    if (!state || !sourceId || !cardId) return 0;

    const card = state.playerDeck.hand.find(c => c.id === cardId);
    if (!card) return 0;

    const source = state.playerParty.find(p => p.id === sourceId);
    if (!source || source.currentHp <= 0) return 0;

    const target =
        state.playerParty.find(e => e.id === targetId) ||
        state.enemyParty.find(e => e.id === targetId);
    if (!target || target.currentHp <= 0) return 0;

    const data = GetProgramData(card.dataId);

    // Source-side playability: energy (BASE constraint) plus any other SELF constraints.
    const selfConstraintsOk = (data.constraints || [])
        .filter(c => c.target === 'SELF')
        .every(c => getConstraintBehavior(c.type).validate(c, { source, cost: card.currentCost }));
    if (!selfConstraintsOk) return 0;

    const attackAction = data.actions.find(a => a.type === 'ATTACK');
    if (!attackAction) return 0;

    return calculateDamage(source, target, data, (attackAction as { power?: number }).power || 0, state);
}
