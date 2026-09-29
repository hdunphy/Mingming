/**
 * TICKET 168c — the AI and a card with no actions.
 *
 * Corrupted Data costs 1, does nothing and exhausts. The search enumerates it like any card, so this
 * proves the empty action list does not break it, that the action it returns is one the reducer
 * accepts, and that playing the card just spends the Energy and exhausts it.
 */
import { describe, it, expect } from 'vitest';
import { getBestAction } from './TacticalAI';
import { battleReducer } from '../battleReducer';
import { createSparseBattleState, createSparseEntity } from '../../debug/scenarios/scenarioTestSupport';
import { JUNK_CARD_ID } from '../run/junk';
import type { IBattleState } from '../types';

function board(hand: string[], energy = 3): IBattleState {
    return createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [createSparseEntity({
            id: 'p1', name: 'Caster', currentHp: 900, maxHp: 1000, currentEnergy: energy, maxEnergy: 3,
        })],
        enemyParty: [createSparseEntity({ id: 'e1', name: 'Foe', currentHp: 900, maxHp: 1000 })],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
            hand: hand.map((dataId, i) => ({ id: `h${i}`, dataId, currentCost: 1, isPlayable: true })),
        },
    });
}

describe('168c — Corrupted Data in the AI\'s hand', () => {
    it('returns an action for a hand of nothing but junk, and the reducer accepts it', () => {
        const state = board([JUNK_CARD_ID, JUNK_CARD_ID]);
        const action = getBestAction(state);
        expect(['PLAY_PROGRAM', 'END_TURN']).toContain(action.type);
        expect(() => battleReducer(state, action)).not.toThrow();
    });

    it('plays a real card rather than the junk when both are in hand', () => {
        const state = board([JUNK_CARD_ID, 'baseline_jab'], 1);
        const action = getBestAction(state);
        expect(action.type).toBe('PLAY_PROGRAM');
        if (action.type !== 'PLAY_PROGRAM') return;
        const played = state.playerDeck.hand.find((c) => c.id === action.payload.programId);
        expect(played?.dataId).toBe('baseline_jab');
    });

    it('playing the junk spends its Energy and exhausts it, with nothing else happening', () => {
        const state = board([JUNK_CARD_ID]);
        const after = battleReducer(state, {
            type: 'PLAY_PROGRAM',
            payload: { programId: 'h0', sourceId: 'p1', targetId: 'p1' },
        } as never);
        expect(after.playerDeck.hand).toHaveLength(0);
        expect(after.playerDeck.exhaust.map((c) => c.dataId)).toEqual([JUNK_CARD_ID]);
        expect(after.playerParty[0].currentEnergy).toBe(2);
        expect(after.enemyParty[0].currentHp).toBe(900);
        expect(after.playerParty[0].currentHp).toBe(900);
    });
});
