/**
 * TICKET 144a — THE AI SORTS ITS OWN THINKING, NOT THE PLAYER'S HAND.
 *
 * Henry's condition when he ruled this in: *"make sure the player is still by draw order."*
 *
 * The search now walks the hand in a canonical order (dataId, cost, banked growth, instance id) so
 * that its decisions stop depending on where a card happened to land when it was drawn. That order
 * exists only inside `findBestSequence`, on a COPY. Nothing writes back to the state.
 *
 * This file is the guard on that promise, and it is deliberately blunt: run the AI against a hand
 * whose draw order is the reverse of its sorted order, and assert the hand comes out exactly as it
 * went in — same instances, same positions. If someone ever "optimises" the copy away by sorting in
 * place, every assertion below fails at once.
 */
import { describe, it, expect } from 'vitest';
import { getBestAction } from './TacticalAI';
import { battleReducer } from '../battleReducer';
import { createSparseBattleState, createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';
import type { IBattleState } from '../types';

/** Draw order chosen to be the OPPOSITE of the canonical sort, so a leak is unmissable. */
const DRAW_ORDER = ['water_slap', 'iron_bark', 'growth', 'fire_poke', 'baseline_jab', 'growth'];

function board(): IBattleState {
    return createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [createSparseEntity({
            id: 'p1', name: 'Caster', currentHp: 900, maxHp: 1000, currentEnergy: 3, maxEnergy: 3,
        })],
        enemyParty: [createSparseEntity({ id: 'e1', name: 'Foe', currentHp: 900, maxHp: 1000 })],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
            hand: DRAW_ORDER.map((dataId, i) => (
                { id: `h${i}`, dataId, currentCost: 1, isPlayable: true }
            )),
        },
    });
}

describe('144a — the player\'s hand stays in draw order', () => {
    it('the hand is untouched by a decision: same instances, same positions', () => {
        const state = board();
        const before = state.playerDeck.hand.map(c => `${c.id}:${c.dataId}`);
        getBestAction(state);
        const after = state.playerDeck.hand.map(c => `${c.id}:${c.dataId}`);
        expect(after).toEqual(before);
        // And it really is the un-sorted order, so the test is testing something.
        expect(after.map(x => x.split(':')[1])).toEqual(DRAW_ORDER);
    });

    it('the hand ARRAY is not even a new object — nothing was rebuilt behind the state\'s back', () => {
        const state = board();
        const handRef = state.playerDeck.hand;
        getBestAction(state);
        expect(state.playerDeck.hand).toBe(handRef);
    });

    it('playing the AI\'s chosen card leaves the REST in draw order', () => {
        // The reducer removes the played instance and leaves the others where they were. If the AI
        // had sorted the real hand, the survivors would come back re-ordered.
        const state = board();
        const action = getBestAction(state);
        if (action.type !== 'PLAY_PROGRAM') return;
        const played = action.payload.programId;
        const expected = state.playerDeck.hand.filter(c => c.id !== played).map(c => c.dataId);
        const after = battleReducer(state, action);
        expect(after.playerDeck.hand.map(c => c.dataId)).toEqual(expected);
    });

    it('a decision is the same whatever order the hand was drawn in — the point of the row', () => {
        // The same six cards, shuffled three ways. The AI must reach the same PLAY, because draw
        // order is an artifact of the shuffle and not information about the board.
        const play = (order: number[]): string => {
            const base = board();
            const hand = order.map(i => base.playerDeck.hand[i]);
            const state: IBattleState = {
                ...base, playerDeck: { ...base.playerDeck, hand },
            };
            const action = getBestAction(state);
            return action.type === 'PLAY_PROGRAM'
                // The card DATA, not the instance: which physical copy of a pair is played is not a
                // decision, and the instances differ between these three hands by construction.
                ? hand.find(c => c.id === action.payload.programId)!.dataId
                : action.type;
        };
        const a = play([0, 1, 2, 3, 4, 5]);
        expect(play([5, 4, 3, 2, 1, 0])).toBe(a);
        expect(play([2, 0, 5, 1, 4, 3])).toBe(a);
    });
});
