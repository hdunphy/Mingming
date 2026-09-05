/**
 * TICKET 141 — any ally may pull the trigger; the firmware pays its owner.
 *
 * WHY THIS FILE EXISTS. Ticket 140's comp grid split the whole 3v3 field on one firmware: comps
 * containing kraken_v1 averaged 68 and the other 108 averaged 27. The cause was not the ally
 * trigger by itself — it was ABYSSAL_INK stacking three things at once (fires on ANY ally's
 * effect-draw, pays out on EVERY enemy, and pays in Dazed, which is uncapped). Either half alone
 * measures as an ordinary firmware. So 141a shrinks the payoff to one enemy and keeps the trigger,
 * and 141b-j give the other nine firmwares the trigger half they were missing.
 *
 * THE ENGINE FACT THE WHOLE TICKET RESTS ON: `when.source: "ALLY"` matches SAME SIDE, owner
 * included (`ConditionValidator` L42 — it compares which party the source is on, and never
 * excludes the owner). That is why seven of these rows are 1v1-invariant by construction: with one
 * body, the ally set IS the owner, so the hook fires exactly as often as it did before. Only 141d
 * (skoll_v2, whose own Fire attacks now charge her) and 141e (a stack change) move a 1v1 number,
 * and both carry a measured gate.
 *
 * WHAT EACH TEST HAS TO PROVE, per §3 of the ticket: an ALLY's action fires the hook, and an
 * ENEMY's does not. The second half is the one that matters — `source: "OPPONENT"` and
 * `source: "ALLY"` are one word apart in the data, and a firmware that pays the enemy's actions
 * is invisible in the log and reads only as a deck that mysteriously underperforms.
 */
import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import { ProgramRegistry } from './data/programRegistry';
import type { IBattleState, IBattleEntity } from './types';

const FRAME = 1000;

function unit(id: string, name: string, activeOS?: string): IBattleEntity {
    return createSparseEntity({
        id, name, activeOS,
        currentHp: FRAME, maxHp: FRAME, currentEnergy: 5, maxEnergy: 5,
    });
}

const stacks = (e: IBattleEntity, type: string): number =>
    e.statusEffects.filter(s => s.type === type).reduce((n, s) => n + s.stacks, 0);

/**
 * A 3v3 board. `casterId` plays `dataId` at `targetId` — the caster may be on EITHER side, which
 * is how each row's "an enemy's action does not fire it" half is expressed.
 */
function play(
    opts: {
        playerOS: Array<string | undefined>,
        enemyOS?: Array<string | undefined>,
        dataId: string,
        casterId: string,
        targetId: string,
        drawpile?: number,
    },
): IBattleState {
    const casterIsEnemy = opts.casterId.startsWith('e');
    const pile = Array.from({ length: opts.drawpile ?? 0 }, (_, i) => (
        { id: `d${i}`, dataId: 'baseline_jab', currentCost: 0, isPlayable: true }
    ));
    const deck = {
        ownerId: casterIsEnemy ? 'ENEMY' : 'PLAYER',
        deck: [], drawpile: pile, discard: [], exhaust: [],
        hand: [{ id: 'h1', dataId: opts.dataId, currentCost: ProgramRegistry[opts.dataId].baseCost as number, isPlayable: true }],
    };
    const empty = { ownerId: '', deck: [], drawpile: [], discard: [], exhaust: [], hand: [] };
    const state: IBattleState = createSparseBattleState({
        activeSide: casterIsEnemy ? 'ENEMY' : 'PLAYER',
        phase: 'ACTION',
        playerParty: opts.playerOS.map((os, i) => unit(`p${i + 1}`, `Ally ${i + 1}`, os)),
        enemyParty: (opts.enemyOS ?? [undefined, undefined, undefined])
            .map((os, i) => unit(`e${i + 1}`, `Foe ${i + 1}`, os)),
        playerDeck: casterIsEnemy ? { ...empty, ownerId: 'PLAYER' } : deck,
        enemyDeck: casterIsEnemy ? deck : { ...empty, ownerId: 'ENEMY' },
    });
    return battleReducer(state, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: opts.casterId, targetId: opts.targetId, programId: 'h1' },
    } as never);
}

describe('141a — ABYSSAL_INK pays one enemy, not the side', () => {
    it('an ally\'s effect-draw Dazes exactly one enemy', () => {
        const state = play({
            playerOS: [undefined, 'kraken_v1', undefined],
            dataId: 'forage', casterId: 'p1', targetId: 'p1', drawpile: 2,
        });
        const dazed = state.enemyParty.map(e => stacks(e, 'Dazed'));
        expect(dazed.filter(n => n === 2)).toHaveLength(1);
        expect(dazed.reduce((a, b) => a + b, 0)).toBe(2);
    });

    it('the ally trigger survives the nerf — a body that is NOT Kraken still fires it', () => {
        // This is the half of ABYSSAL_INK the ticket deliberately keeps: the synergy, not the size.
        const state = play({
            playerOS: ['kraken_v1', undefined, undefined],
            dataId: 'forage', casterId: 'p3', targetId: 'p3', drawpile: 2,
        });
        expect(state.enemyParty.reduce((n, e) => n + stacks(e, 'Dazed'), 0)).toBe(2);
    });

    it('an ENEMY drawing a card does not feed the player\'s Kraken', () => {
        const state = play({
            playerOS: ['kraken_v1', undefined, undefined],
            dataId: 'forage', casterId: 'e1', targetId: 'e1', drawpile: 2,
        });
        // The enemy's own draw may only ever reach the enemy's own firmware. Nobody on the player
        // side holds one here, so the board must be clean of Dazed entirely.
        expect(state.playerParty.every(e => stacks(e, 'Dazed') === 0)).toBe(true);
        expect(state.enemyParty.every(e => stacks(e, 'Dazed') === 0)).toBe(true);
    });
});
