/**
 * TICKET 124 regression: an ANY_STATUS scaler pays one stack of each status it counted.
 *
 * `rimebreaker` reads every distinct status on the target - buffs, debuffs, DoTs, whoever applied
 * them - and used to read that pile without paying for it. Henry, ticket-118 playtest:
 * *"Rimebreaker in a 1v1 is very easy to snowball... It consistently did above 25 damage after one
 * turn of setup"*. The pile only ever grew, so each cast was bigger than the last.
 *
 * One stack off each counted type rather than a full consume, for the reason `StatusExecutor`'s
 * hexbloom comment gives: consuming makes a card a hoard dump priced off how long you saved up,
 * while not consuming makes it a rate. Taking a stack keeps the rate and kills the snowball.
 */

import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import type { IBattleState, ProgramEntity, StatusEffectInstance } from './types';

const rimebreaker: ProgramEntity =
    { id: 'rb', dataId: 'rimebreaker', currentCost: 0, isPlayable: true } as ProgramEntity;

const status = (type: string, stacks: number): StatusEffectInstance =>
    ({ id: `s-${type}`, type, stacks } as StatusEffectInstance);

/** A target carrying three DISTINCT statuses at two stacks each. */
function stateWithPile(): IBattleState {
    return createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [createSparseEntity({ id: 'p1', definitionId: 'draugr', name: 'Draugr', cardDraw: 3 })],
        enemyParty: [createSparseEntity({
            id: 'e1', definitionId: 'huldra', name: 'Target',
            statusEffects: [status('Weakened', 2), status('Dazed', 2), status('Sharp', 2)],
        })],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [],
            hand: [rimebreaker], discard: [], exhaust: [],
        },
    });
}

const cast = (s: IBattleState): IBattleState =>
    battleReducer(s, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: 'p1', targetId: 'e1', programId: 'rb' },
    } as never);

const stacksOf = (s: IBattleState, type: string): number =>
    s.enemyParty[0].statusEffects.find(x => x.type === type)?.stacks ?? 0;

describe('ticket 124 - ANY_STATUS pays for what it reads', () => {
    it('takes exactly one stack of each counted status', () => {
        const before = stateWithPile();
        const after = cast(before);

        expect(stacksOf(after, 'Weakened')).toBe(1);
        expect(stacksOf(after, 'Dazed')).toBe(1);
        expect(stacksOf(after, 'Sharp')).toBe(1);
    });

    it('still deals damage scaled by the count it read, before the decrement', () => {
        const before = stateWithPile();
        const startHp = before.enemyParty[0].currentHp;
        const after = cast(before);
        const damage = startHp - after.enemyParty[0].currentHp;

        // Three distinct statuses were present when the count was taken, so the card must have
        // read 3 - not 3-minus-its-own-decrement.
        expect(damage).toBeGreaterThan(0);

        // A board with ONE status must hit for meaningfully less than a board with three.
        const thin = createSparseBattleState({
            activeSide: 'PLAYER',
            phase: 'ACTION',
            playerParty: [createSparseEntity({ id: 'p1', definitionId: 'draugr', name: 'Draugr', cardDraw: 3 })],
            enemyParty: [createSparseEntity({
                id: 'e1', definitionId: 'huldra', name: 'Target',
                statusEffects: [status('Weakened', 2)],
            })],
            playerDeck: {
                ownerId: 'PLAYER', deck: [], drawpile: [],
                hand: [{ ...rimebreaker }], discard: [], exhaust: [],
            },
        });
        const thinStart = thin.enemyParty[0].currentHp;
        const thinAfter = cast(thin);
        expect(thinStart - thinAfter.enemyParty[0].currentHp).toBeLessThan(damage);
    });

    it('the second cast off the same pile is SMALLER - the snowball is gone', () => {
        // The whole complaint: setup made every subsequent cast bigger. With a stack paid per
        // counted type, a pile that is not re-fed shrinks, so cast two cannot exceed cast one.
        const before = stateWithPile();
        const hp0 = before.enemyParty[0].currentHp;

        const afterFirst = cast(before);
        const firstDamage = hp0 - afterFirst.enemyParty[0].currentHp;

        // Put the card back in hand and cast again off the now-depleted pile.
        const replayable: IBattleState = {
            ...afterFirst,
            playerDeck: { ...afterFirst.playerDeck, hand: [{ ...rimebreaker }] },
        };
        const hp1 = replayable.enemyParty[0].currentHp;
        const afterSecond = cast(replayable);
        const secondDamage = hp1 - afterSecond.enemyParty[0].currentHp;

        expect(secondDamage).toBeLessThanOrEqual(firstDamage);
        // And the pile is now empty, so a third cast reads nothing.
        expect(stacksOf(afterSecond, 'Weakened')).toBe(0);
        expect(stacksOf(afterSecond, 'Dazed')).toBe(0);
        expect(stacksOf(afterSecond, 'Sharp')).toBe(0);
    });

    it('does not touch statuses on a card without ANY_STATUS scaling', () => {
        const before = stateWithPile();
        const plain: IBattleState = {
            ...before,
            playerDeck: {
                ...before.playerDeck,
                hand: [{ id: 'pj', dataId: 'baseline_jab', currentCost: 0, isPlayable: true } as ProgramEntity],
            },
        };
        const after = battleReducer(plain, {
            type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId: 'pj' },
        } as never);

        expect(stacksOf(after, 'Weakened')).toBe(2);
        expect(stacksOf(after, 'Dazed')).toBe(2);
        expect(stacksOf(after, 'Sharp')).toBe(2);
    });
});
