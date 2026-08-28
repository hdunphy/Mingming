/**
 * TICKET 123 regression: a CARDS_PLAYED scaler counts the CASTER's plays, not the side's.
 *
 * `stampede`, `serpents_coil` and `seed_bomb_v2` are the three cards that use this scaling, and all
 * three already promised caster-scope in their own text - "for every card YOU played this turn",
 * "per card played by HOST this turn" - while the code read `state.cardsPlayedThisTurn`, one counter
 * for the whole active side.
 *
 * At 1v1 the caster IS the side, so the two were the same number and the disagreement could not be
 * observed. 3v3 with a SHARED hand made it observable: every ally's cast pumped your scaler. Henry
 * measured `stampede` at 42 damage in one playtest game and 78 in a stacked comp, off an 11-power
 * card.
 *
 * The first attempt at this fix edited a DEAD branch in `effectHandlers.ts` and measured identical
 * before/after numbers that looked like a real "this lever does nothing" result. The live path is
 * `getDamageScalingMultiplier` in `actions/ActionExecutors.ts`, shared with the UI hover preview.
 * These tests exist so that class of mistake fails loudly instead of reading as a null result.
 */

import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { getDamageScalingMultiplier } from './actions/ActionExecutors';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import type { IBattleState, IBattleEntity, ProgramEntity } from './types';

const card = (id: string, dataId: string): ProgramEntity =>
    ({ id, dataId, currentCost: 0, isPlayable: true } as ProgramEntity);

/** Two allies sharing one hand: two fillers, then the scaler. */
function twoAllyState(): IBattleState {
    return createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [
            createSparseEntity({ id: 'caster', definitionId: 'sleipnir', name: 'Caster', cardDraw: 3 }),
            createSparseEntity({ id: 'ally', definitionId: 'sleipnir', name: 'Ally', cardDraw: 3 }),
        ],
        enemyParty: [createSparseEntity({ id: 'e1', definitionId: 'kraken', name: 'Target' })],
        playerDeck: {
            ownerId: 'PLAYER',
            deck: [],
            drawpile: [],
            hand: [card('f1', 'water_slap'), card('f2', 'water_slap'), card('s1', 'stampede')],
            discard: [],
            exhaust: [],
        },
    });
}

const play = (s: IBattleState, sourceId: string, programId: string): IBattleState =>
    battleReducer(s, { type: 'PLAY_PROGRAM', payload: { sourceId, targetId: 'e1', programId } } as never);

describe('ticket 123 - CARDS_PLAYED scales on the caster', () => {
    it('an ally\'s casts do not pump the caster\'s scaler', () => {
        let state = twoAllyState();
        state = play(state, 'ally', 'f1');
        state = play(state, 'ally', 'f2');

        const before = state.enemyParty[0].currentHp;
        state = play(state, 'caster', 's1');
        const damage = before - state.enemyParty[0].currentHp;

        // The board the caster sees: three cards played on this side, but only ONE by them.
        expect(state.cardsPlayedThisTurn).toBe(3);
        expect(state.playerParty.find(e => e.id === 'caster')?.playsThisTurn).toBe(1);
        expect(state.playerParty.find(e => e.id === 'ally')?.playsThisTurn).toBe(2);

        // Under the old side-wide rule this same board produced 3x this damage.
        const oneCastDamage = damage;
        expect(oneCastDamage).toBeGreaterThan(0);

        // And the caster's OWN second cast must still scale it, or the fix has broken the card.
        let solo = twoAllyState();
        solo = play(solo, 'caster', 'f1');
        const beforeSolo = solo.enemyParty[0].currentHp;
        solo = play(solo, 'caster', 's1');
        const twoCastDamage = beforeSolo - solo.enemyParty[0].currentHp;

        expect(twoCastDamage).toBeGreaterThan(oneCastDamage);
    });

    it('the multiplier helper reads the caster, falling back to the side only when absent', () => {
        const state = { cardsPlayedThisTurn: 7 } as IBattleState;
        const caster = { playsThisTurn: 2 } as IBattleEntity;

        expect(getDamageScalingMultiplier(state, 'CARDS_PLAYED', undefined, undefined, caster)).toBe(2);
        // No caster passed: the old side-wide value, so non-card callers keep working.
        expect(getDamageScalingMultiplier(state, 'CARDS_PLAYED', undefined, undefined)).toBe(7);
    });

    it('is identical to the side counter at 1v1, so no 1v1 cell can move', () => {
        let state = createSparseBattleState({
            activeSide: 'PLAYER',
            phase: 'ACTION',
            playerParty: [createSparseEntity({ id: 'solo', definitionId: 'sleipnir', name: 'Solo', cardDraw: 3 })],
            enemyParty: [createSparseEntity({ id: 'e1', definitionId: 'kraken', name: 'Target' })],
            playerDeck: {
                ownerId: 'PLAYER', deck: [], drawpile: [],
                hand: [card('f1', 'water_slap'), card('s1', 'stampede')],
                discard: [], exhaust: [],
            },
        });
        state = play(state, 'solo', 'f1');
        state = play(state, 'solo', 's1');

        const solo = state.playerParty[0];
        expect(solo.playsThisTurn).toBe(state.cardsPlayedThisTurn);
    });
});
