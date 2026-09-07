/**
 * A REPLAY IS THE CARD — the 2026-09-05 playtest, two defects with one root.
 *
 * Henry:
 *   *"Reprogram plays last card played by anyone. It should be last played by this side."*
 *   *"When reprogram played Heat wave to double a side's burn. It only worked on the single
 *    target. Same for any 'side' attack/status applier."*
 *
 * `PLAY_LAST_CARD` re-executed a card's action list directly, and in doing so lost two things the
 * reducer's own resolution loop does around that list: WHOSE card it was, and HOW WIDE the card is.
 * Neither loss said anything in the log — the burn simply landed once, on a card the player may not
 * have played — which is why both survived to a playtest.
 *
 * The width rule now lives in `actionTargetIds`, imported by the reducer and by both free-cast
 * paths, so "who does this action hit" has exactly one answer in the engine.
 */

import { describe, expect, it } from 'vitest';

import { battleReducer } from './battleReducer';
import { actionTargetIds } from './actions/ActionExecutors';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import { GetProgramData } from './data/programRegistry';
import type { IBattleState, ProgramEntity, StatusEffectInstance } from './types';

const card = (id: string, dataId: string): ProgramEntity =>
    ({ id, dataId, currentCost: 0, isPlayable: true } as ProgramEntity);

const burn = (stacks: number): StatusEffectInstance =>
    ({ id: 's-burn', type: 'Burn', stacks } as StatusEffectInstance);

/**
 * Three lightly burning enemies, and a player holding Reprogram.
 *
 * ONE stack each, deliberately: Burn's cap is 4 and crossing it DETONATES (`BURN_CONFIG`, shape
 * `DETONATE`), so a fixture starting at 3 doubles to 6, pays a detonation and settles at 2 — a
 * number that says nothing about whether the replay was wide. At 1 stack, doubling is 2 on every
 * body it reached and nothing else moves.
 */
function board(over: Partial<IBattleState> = {}): IBattleState {
    return createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [createSparseEntity({ id: 'p1', definitionId: 'kraken', name: 'Kraken', currentEnergy: 9, maxEnergy: 9 })],
        enemyParty: [
            createSparseEntity({ id: 'e1', definitionId: 'fenrir', name: 'Foe 1', statusEffects: [burn(1)] }),
            createSparseEntity({ id: 'e2', definitionId: 'huldra', name: 'Foe 2', statusEffects: [burn(1)] }),
            createSparseEntity({ id: 'e3', definitionId: 'draugr', name: 'Foe 3', statusEffects: [burn(1)] }),
        ],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [],
            hand: [card('rp', 'reprogram')], discard: [], exhaust: [],
        },
        ...over,
    });
}

const burnOn = (s: IBattleState, id: string): number =>
    s.enemyParty.find(e => e.id === id)?.statusEffects.find(x => x.type === 'Burn')?.stacks ?? 0;

const reprogram = (s: IBattleState): IBattleState =>
    battleReducer(s, { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'rp' } } as never);

describe('a replayed card keeps its WIDTH', () => {
    it('doubles the Burn on the whole side, exactly as Heat Wave does when played', () => {
        const before = board({
            lastProgramPlayed: 'heat_wave',
            lastProgramBySide: { PLAYER: 'heat_wave', ENEMY: null },
        });
        const after = reprogram(before);

        // Heat Wave is `target: 'Side'`. Before the fix only `e1` doubled.
        expect(GetProgramData('heat_wave').target).toBe('Side');
        expect([burnOn(after, 'e1'), burnOn(after, 'e2'), burnOn(after, 'e3')]).toEqual([2, 2, 2]);
    });

    it('resolves the width from the CARD, not from the action — the rule the reducer uses', () => {
        const state = board();
        const wide = GetProgramData('heat_wave');
        const narrow = GetProgramData('pressure_point');

        expect(actionTargetIds(state, wide, wide.actions[0], 'p1', 'e1')).toEqual(['e1', 'e2', 'e3']);
        expect(actionTargetIds(state, narrow, narrow.actions[0], 'p1', 'e1')).toEqual(['e1']);
        // A SELF action lands on the caster whatever the card's width says.
        expect(actionTargetIds(state, wide, { type: 'DRAW', amount: 1, target: 'SELF' } as never, 'p1', 'e1'))
            .toEqual(['p1']);
    });

    it('skips the dead: a wide replay pays the living side only', () => {
        const state = board();
        const withCorpse = {
            ...state,
            enemyParty: state.enemyParty.map(e => (e.id === 'e2' ? { ...e, currentHp: 0 } : e)),
        } as IBattleState;
        const wide = GetProgramData('heat_wave');

        expect(actionTargetIds(withCorpse, wide, wide.actions[0], 'p1', 'e1')).toEqual(['e1', 'e3']);
    });
});

describe('a replayed card is YOUR card', () => {
    it('replays this side’s last card, not the last card anybody played', () => {
        const after = reprogram(board({
            lastProgramPlayed: 'ignite',                                   // the enemy went last
            lastProgramBySide: { PLAYER: 'heat_wave', ENEMY: 'ignite' },
        }));

        // Heat Wave doubled all three; `ignite` would have burned `e1` alone and left the others.
        expect([burnOn(after, 'e1'), burnOn(after, 'e2'), burnOn(after, 'e3')]).toEqual([2, 2, 2]);
        expect(after.logs.some(l => l.includes('Heat Wave'))).toBe(true);
        expect(after.logs.some(l => l.includes('Ignite'))).toBe(false);
    });

    it('refuses when only the ENEMY has played — there is nothing of yours to repeat', () => {
        const after = reprogram(board({
            lastProgramPlayed: 'ignite',
            lastProgramBySide: { PLAYER: null, ENEMY: 'ignite' },
        }));

        expect([burnOn(after, 'e1'), burnOn(after, 'e2'), burnOn(after, 'e3')]).toEqual([1, 1, 1]);
        expect(after.logs.some(l => l.includes('No program was played previously'))).toBe(true);
    });

    it('records both slots when a card is played, so the two can never disagree', () => {
        const state = createSparseBattleState({
            activeSide: 'PLAYER',
            phase: 'ACTION',
            playerParty: [createSparseEntity({ id: 'p1', definitionId: 'kraken', name: 'Kraken', currentEnergy: 9, maxEnergy: 9 })],
            enemyParty: [createSparseEntity({ id: 'e1', definitionId: 'fenrir', name: 'Foe' })],
            playerDeck: {
                ownerId: 'PLAYER', deck: [], drawpile: [],
                hand: [card('hw', 'heat_wave')], discard: [], exhaust: [],
            },
        });
        const after = battleReducer(state, {
            type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'hw' },
        } as never);

        expect(after.lastProgramPlayed).toBe('heat_wave');
        expect(after.lastProgramBySide).toEqual({ PLAYER: 'heat_wave', ENEMY: null });
    });
});
