/**
 * TICKET 180d — THE PLAYS THE AGENT MAY MAKE: `legalActions` from the game, each as a written line.
 *
 * The list is the game's own (`legalPlays`, ticket 177a): every distinct card in hand, by every
 * living caster that can pay for it, at every legal target. Nothing is filtered or added here. Each
 * line carries what the hand shows the player on a card: its cost for this caster, and the true
 * numbers the card face previews (`computeHandPreviews`, the call the hand makes), so the agent has
 * what a player has. Previews are not predictions: damage is read off the game, never guessed.
 */
import type { BattleAction } from '../../../engine/battleReducer';
import { getEffectiveCardCost } from '../../../engine/battleReducer';
import { legalPlays } from '../../../engine/ai/legalActions';
import { GetProgramData } from '../../../engine/data/programRegistry';
import { executeCostCalculated } from '../../../engine/resolutionEngine';
import type { IBattleEntity, IBattleState } from '../../../engine/types';
import { computeHandPreviews, type HandCardPreview } from '../../../ui/utils/handPreview';
import { cardName } from '../gameText';
import type { Move } from '../types';
import { battleKeyOf } from './keys';
import { playCard } from './play';

/** What the player pays for the card from this caster, the way the reducer prices it. */
export function costFor(state: IBattleState, caster: IBattleEntity, dataId: string, currentCost: number): number {
    const data = GetProgramData(dataId);
    const printed = getEffectiveCardCost(caster, data, currentCost);
    return executeCostCalculated(state, caster, undefined, data, printed).cost;
}

function previewNote(preview: HandCardPreview | undefined): string {
    if (!preview) return '';
    const parts: string[] = [];
    if (preview.damage > 0) {
        parts.push(`${preview.damage} damage${preview.hitCount > 1 ? ` over ${preview.hitCount} hits` : ''}${preview.lethal ? ', defeats it' : ''}`);
    }
    if (preview.healing > 0) parts.push(`heals ${preview.healing}`);
    return parts.length > 0 ? ` [${parts.join('; ')}]` : '';
}

export function playMoves(state: IBattleState): Move[] {
    const entity = (id: string): IBattleEntity | undefined => [...state.playerParty, ...state.enemyParty].find((e) => e.id === id);
    return legalPlays(state, 'PLAYER').flatMap((action: BattleAction) => {
        if (action.type !== 'PLAY_PROGRAM') return [];
        const { programId, sourceId, targetId } = action.payload;
        const card = state.playerDeck.hand.find((c) => c.id === programId);
        const caster = entity(sourceId);
        const target = entity(targetId);
        if (!card || !caster || !target) return [];
        const previews = computeHandPreviews(state, sourceId, target);
        const cost = costFor(state, caster, card.dataId, card.currentCost);
        return [{
            key: battleKeyOf(action),
            label: `Play ${cardName(card.dataId)} (${cost}e) from ${caster.name} → ${target.name}${previewNote(previews.get(programId))}`,
            apply: (world) => playCard(world, action),
        }];
    });
}
