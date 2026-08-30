/**
 * A CONDITIONAL ASKS ABOUT THE CARD'S TARGET — the 2026-08-30 playtest.
 *
 * Henry: *"Pressure point doesn't work. Enemy was dazed I didn't get a card."*
 *
 * `pressure_point` is "22 power. If Dazed, draw 1", written as an ATTACK plus a DRAW carrying
 * `{ HAS_STATUS, target: TARGET, value: Dazed }`. The DRAW's own target is SELF - a draw goes to
 * the caster - and `battleReducer` resolved the conditional's `TARGET` against the ACTION's target
 * rather than the CARD's. So the rider asked whether the CASTER was Dazed: dead on a Dazed enemy,
 * and free on a Dazed caster, which is the same defect twice and neither half was visible in a log.
 *
 * The third case below is the one that proves it was inverted rather than merely broken, and it is
 * why "it never fires" was the wrong bug to go looking for.
 *
 * A card whose conditional is an ATTACK (the ordinary shape - `mingmingRegistry`'s Poison rider)
 * is unaffected either way, because there the action's target and the card's are the same entity.
 * The fourth test pins that, so a later change cannot "fix" this by making every conditional read
 * the card target and quietly break per-victim AoE riders.
 */

import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import type { IBattleState, ProgramEntity, StatusEffectInstance } from './types';

const card = (id: string, dataId: string): ProgramEntity =>
    ({ id, dataId, currentCost: 0, isPlayable: true } as ProgramEntity);

const status = (type: string, stacks: number): StatusEffectInstance =>
    ({ id: `s-${type}`, type, stacks } as StatusEffectInstance);

/** Three spare cards in the drawpile, so "did it draw?" is a hand-size question with an answer. */
const drawpile = (): ProgramEntity[] =>
    [0, 1, 2].map((i) => card(`sp${i}`, 'fire_poke'));

function board(enemyStatuses: StatusEffectInstance[], casterStatuses: StatusEffectInstance[] = []): IBattleState {
    return createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [createSparseEntity({
            id: 'p1', definitionId: 'draugr', name: 'Caster', statusEffects: casterStatuses,
        })],
        enemyParty: [createSparseEntity({
            id: 'e1', definitionId: 'huldra', name: 'Target', statusEffects: enemyStatuses,
        })],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: drawpile(),
            hand: [card('pp', 'pressure_point')], discard: [], exhaust: [],
        },
    });
}

const cast = (s: IBattleState): IBattleState =>
    battleReducer(s, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: 'p1', targetId: 'e1', programId: 'pp' },
    } as never);

describe('pressure_point - a rider on a SELF-targeted action', () => {
    it('draws when the ENEMY is Dazed', () => {
        expect(cast(board([status('Dazed', 2)])).playerDeck.hand.length).toBe(1);
    });

    it('does not draw when nobody is Dazed', () => {
        expect(cast(board([])).playerDeck.hand.length).toBe(0);
    });

    // The inversion. Before the fix this drew a card, which is the same bug seen from the other end.
    it('does not draw when only the CASTER is Dazed', () => {
        expect(cast(board([], [status('Dazed', 2)])).playerDeck.hand.length).toBe(0);
    });

    it('lands its damage either way - the rider is the only thing that is conditional', () => {
        const before = board([]);
        const after = cast(before);
        expect(after.enemyParty[0].currentHp).toBeLessThan(before.enemyParty[0].currentHp);
    });
});
