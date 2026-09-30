/**
 * TICKET 171h — **IS THERE STILL A PLAY?**
 *
 * Henry, 2026-09-29 playtest: *"I missed out on 3e on a turn because I hit the end button. It would
 * be great to highlight or alert the user if they can still make a play. Something noticeable but
 * not intrusive like a popup or anything. Just like a flash on the button and then the card that is
 * playable lights up."*
 *
 * The question is asked of the REAL reducer, the way the hover preview asks it (`simulatePlay`,
 * ticket 104): a card counts only if some living ally could cast it at some living target and the
 * reducer accepts. A second rule-set here would drift from the one that decides the play.
 *
 * **Every playable card counts, 0e included** (ticket 172, Henry 2026-09-30: *"I think it still should
 * trigger"*). 171h first counted only plays that spent Energy, on the reasoning that a 0e card is
 * nearly always castable; Henry ruled that a card left in hand is a play left, whatever it costs.
 * A caster needs no Energy for a 0e card, so casters are every living ally, not only those with
 * Energy left.
 *
 * Asked on a click, not on render: it is hand x casters x targets reducer runs (at most ~150), which
 * is nothing once and a stutter every frame.
 */

import { battleReducer, getEffectiveCardCost } from '../../engine/battleReducer';
import { isUnaffordableCost } from '../../engine/core/CustomFirmware';
import { GetProgramData } from '../../engine/data/programRegistry';
import { globalBattleEventBus } from '../../engine/events';
import { executeCostCalculated } from '../../engine/resolutionEngine';
import type { IBattleEntity, IBattleState, ProgramEntity } from '../../engine/types';

/** What this caster would pay for this card right now, or null if it cannot be paid at all. */
function costFor(state: IBattleState, caster: IBattleEntity, card: ProgramEntity): number | null {
    const data = GetProgramData(card.dataId);
    const printed = getEffectiveCardCost(caster, data, card.currentCost);
    const cost = executeCostCalculated(state, caster, undefined, data, printed).cost;
    return isUnaffordableCost(cost) ? null : cost;
}

/** Does the reducer accept this play? Muted, so nothing on the stage reacts to the question. */
function accepts(state: IBattleState, casterId: string, cardId: string, targetId: string): boolean {
    const after = globalBattleEventBus.runMuted(() => battleReducer(state, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: casterId, targetId, programId: cardId },
    }));
    return after !== state;
}

/**
 * The ids of the cards in the player's hand that some living ally could cast right now, at any cost
 * it can pay. Empty when it is not the player's turn.
 */
export function playsLeft(state: IBattleState | null | undefined): string[] {
    if (!state || state.activeSide !== 'PLAYER') return [];
    const casters = state.playerParty.filter((unit) => unit.currentHp > 0);
    if (casters.length === 0) return [];
    const targets = [...state.enemyParty, ...state.playerParty].filter((unit) => unit.currentHp > 0);

    const playable: string[] = [];
    for (const card of state.playerDeck.hand) {
        const castable = casters.some((caster) => {
            const cost = costFor(state, caster, card);
            if (cost === null || cost > caster.currentEnergy) return false;
            return targets.some((target) => accepts(state, caster.id, card.id, target.id));
        });
        if (castable) playable.push(card.id);
    }
    return playable;
}
