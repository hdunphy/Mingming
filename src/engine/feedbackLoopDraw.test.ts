/**
 * FEEDBACK_LOOP IS AN EFFECT-DRAW PAYOFF, NOT A TURN TAX — the 2026-08-30 playtest.
 *
 * Henry: *"Feedback loop deals damage on natural draws."*
 *
 * It did. `daemon_draw_damage_proc` was the only `onCardDraw` hook in `lib/hooks.json` whose `when`
 * omitted `isNaturalDraw: false`; `kraken_v1`'s ABYSSAL_INK and `recursion_daemon` both carry it,
 * and ticket 68 already made the same distinction on the card side (`CARDS_DRAWN_TRIGGERED` exists
 * because the draw-phase refill satisfies `CARDS_DRAWN` on ~91% of turns for free).
 *
 * The refill is 3-5 cards, so an ungated hook paid 15-25 damage a turn for doing nothing, on a
 * 2-energy card that exhausts. That is not a tuning miss - it is a different card from the one the
 * description sells, and the sim has been costing the wrong one.
 *
 * `executeDraw` is called directly rather than through a turn, because `isNatural` is a parameter
 * of exactly that function: this asks the question the bug was about and nothing else.
 */

import { describe, it, expect } from 'vitest';
import { executeDraw } from './resolutionEngine';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import type { IBattleState, ProgramEntity } from './types';

const spare = (i: number): ProgramEntity =>
    ({ id: `sp${i}`, dataId: 'fire_poke', currentCost: 0, isPlayable: true } as ProgramEntity);

/** A player carrying the installed daemon, and a full drawpile to pull from. */
function board(): IBattleState {
    return createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [createSparseEntity({
            id: 'p1', definitionId: 'ratatoskr', name: 'Host',
            daemons: [{ id: 'd1', dataId: 'feedback_loop_daemon', currentCost: 2, isPlayable: false } as ProgramEntity],
        })],
        enemyParty: [createSparseEntity({ id: 'e1', definitionId: 'huldra', name: 'Target' })],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [0, 1, 2, 3].map(spare),
            hand: [], discard: [], exhaust: [],
        },
    });
}

const hpAfter = (isNatural: boolean, count = 3): number => {
    const before = board();
    const after = executeDraw(before, 'PLAYER', count, isNatural, 'p1');
    // The draw itself must have happened either way, or the test proves nothing about the hook.
    expect(after.playerDeck.hand.length).toBe(count);
    return after.enemyParty[0].currentHp;
};

describe('FEEDBACK_LOOP', () => {
    it('does NOT fire on the draw-phase refill', () => {
        expect(hpAfter(true)).toBe(board().enemyParty[0].currentHp);
    });

    it('fires on a draw an effect caused', () => {
        expect(hpAfter(false)).toBeLessThan(board().enemyParty[0].currentHp);
    });

    it('still fires once per card on a multi-card effect draw', () => {
        const one = board().enemyParty[0].currentHp - hpAfter(false, 1);
        const two = board().enemyParty[0].currentHp - hpAfter(false, 2);
        expect(two).toBe(one * 2);
    });
});
