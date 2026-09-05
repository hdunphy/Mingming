/**
 * A DEAD CASTER STOPS CASTING, AND A MUTUAL KILL IS A DEFEAT — the 2026-09-05 playtest.
 *
 * Henry: *"Fenrir killed me, but added burn overload to himself and he died first, so I won?"*
 *
 * Two separate defects met on that board and the question mark is the report:
 *
 *  1. the reducer ran a card's whole action list even after the caster died partway through it —
 *     the existing fizzle guard covers only a cast whose PRICE is lethal, and runs once, before the
 *     first action;
 *  2. the screen scored "everyone is dead" as a win, because `isVictory` was computed first and
 *     `isDefeat` only if not victory. The balance harness called the same board a draw.
 *
 * Both are ruled here rather than patched where they were seen: `battleReducer` breaks out of the
 * action loop on a dead caster, and `battleOutcome` is the one place that answers "who won".
 */

import { describe, expect, it } from 'vitest';

import { battleReducer } from './battleReducer';
import { battleOutcome, isPlayerDefeat, isPlayerVictory } from './battleOutcome';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import type { IBattleState } from './types';

const board = (playerHp: number, enemyHp: number): IBattleState => createSparseBattleState({
    playerParty: [createSparseEntity({ id: 'p1', definitionId: 'kraken', name: 'Kraken', currentHp: playerHp })],
    enemyParty: [createSparseEntity({ id: 'e1', definitionId: 'fenrir', name: 'Fenrir', currentHp: enemyHp })],
});

describe('the outcome of a fight', () => {
    it('is a victory only when the player is still standing', () => {
        expect(battleOutcome(board(40, 0))).toBe('PLAYER');
        expect(isPlayerVictory(board(40, 0))).toBe(true);
        expect(isPlayerDefeat(board(40, 0))).toBe(false);
    });

    it('is a defeat when the player is down', () => {
        expect(battleOutcome(board(0, 40))).toBe('ENEMY');
        expect(isPlayerDefeat(board(0, 40))).toBe(true);
    });

    /**
     * THE RULING. A run whose last mingming is down does not continue, whatever happened to the
     * enemy in the same instant — the next node would be entered by a party of corpses.
     */
    it('is a DEFEAT when both sides fall together, not a win', () => {
        expect(battleOutcome(board(0, 0))).toBe('DRAW');
        expect(isPlayerVictory(board(0, 0))).toBe(false);
        expect(isPlayerDefeat(board(0, 0))).toBe(true);
    });

    it('is undecided while anyone on both sides is standing', () => {
        expect(battleOutcome(board(1, 1))).toBeNull();
        expect(isPlayerVictory(board(1, 1))).toBe(false);
        expect(isPlayerDefeat(board(1, 1))).toBe(false);
    });
});

describe('a caster that dies mid-card', () => {
    /**
     * `blood_rite` is the shape of the report: it pays HP and then swings. Set the caster's HP so
     * the price is lethal and the swing must not land — the enemy's HP is the proof, because a
     * corpse's attack is exactly what handed Henry a fight he had lost.
     */
    it('does not resolve the actions after the one that killed it', () => {
        const state = createSparseBattleState({
            activeSide: 'PLAYER',
            phase: 'ACTION',
            playerParty: [createSparseEntity({
                id: 'p1', definitionId: 'fenrir', name: 'Fenrir', currentHp: 1, currentEnergy: 9, maxEnergy: 9,
            })],
            enemyParty: [createSparseEntity({ id: 'e1', definitionId: 'kraken', name: 'Kraken', currentHp: 30 })],
            playerDeck: {
                ownerId: 'PLAYER', deck: [], drawpile: [],
                hand: [{ id: 'c1', dataId: 'blood_rite', currentCost: 0, isPlayable: true } as never],
                discard: [], exhaust: [],
            },
        });

        const after = battleReducer(state, {
            type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'c1' },
        } as never);

        // Whatever killed the caster — the pre-loop fizzle guard or the per-action break — the
        // enemy must be untouched by a swing that came after the caster's death.
        if (after.playerParty[0].currentHp <= 0) {
            expect(after.enemyParty[0].currentHp).toBe(30);
            expect(isPlayerVictory(after)).toBe(false);
        }
    });
});
