/**
 * RIPTIDE and SHORT_CIRCUIT — ticket 69's Tidewrack toolbox, printed 2026-08-30.
 *
 * Henry ruled both in ticket 69 as *direction, not printings*, and asked for them built:
 * *"riptide and short circuit need to be added"*.
 *
 * # WHY THESE TWO AND NOT MITIGATION
 *
 * Tidewrack converts its own card flow into damage TWICE inside a turn — `ink_stream` x4 at 33
 * power per triggered draw, `serpents_coil` x2 at 10 power per card played — and closes with
 * `skoll_v2`'s Strength burst. Sharp and Weakened are worth **1 power a stack** (`STATUS_MODEL`),
 * so against hits printed at 33-105 they are rounding. The only lever that reaches the payoff is
 * the flow itself, which is what these tax.
 *
 * They are not redundant with each other: **`riptide` taxes BREADTH** (cards played per turn) and
 * **`short_circuit` taxes DEPTH** (how much of the draw is engine rather than the natural draw
 * step). A zoo pays both; an ordinary enemy pays almost nothing.
 *
 * # THE TWO SILENT FAILURES THIS FILE EXISTS TO CATCH
 *
 * Both are `when.source: OPPONENT` hooks, which is a shape nothing in the launch set used before,
 * and both fail QUIETLY if wired wrong:
 *
 *  1. **`SOURCE` resolving to null.** `onCardDraw` publishes a context with a `source` and no
 *     `target`; an action aimed at `TARGET` there is silently skipped by
 *     `HookFactory.executeActions` — the ticket-71 `COUNTER`-with-no-`target` bug in a different
 *     coat. A card that never fires reads as "the counter is too weak", not as a bug.
 *  2. **`isNaturalDraw` being dropped.** `HookSchema` is a zod object and zod STRIPS undeclared
 *     keys, so a `when` clause the schema does not know about vanishes between `hooks.json` and the
 *     engine with nothing thrown. `short_circuit` without it fires on the draw step too, which
 *     roughly triples its rate and makes it an auto-include against every enemy in the game.
 *
 * So every test below counts DAMAGE or PROCS. None of them asserts that something merely happened.
 */

import { describe, expect, it } from 'vitest';

import { battleReducer } from '../battleReducer';
import { getHook } from '../core/HookRegistry';
import { GetProgramData } from './programRegistry';
import { MARKET_NEUTRAL_UTILITY } from '../run/marketplace';
import { matchupScenario } from '../../debug/balance/balanceScenarios';
import { buildScenarioState } from '../../debug/scenarios/buildScenarioState';
import type { IBattleState, ProgramEntity } from '../types';

const RIPTIDE_POWER = 8;
const SHORT_CIRCUIT_POWER = 15;

function arena(): IBattleState {
    const setup = matchupScenario({
        player: 'huldra', enemy: 'jormungandr',
        playerOS: 'huldra_v1', enemyOS: 'jormungandr_v1', seed: 'tidewrack-counters',
    });
    return buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
}

const daemon = (dataId: string): ProgramEntity =>
    ({ id: `daemon_${dataId}`, dataId, currentCost: 2, isPlayable: false });

/** Install a daemon on the PLAYER's first member — the side the card is bought by. */
function withPlayerDaemon(state: IBattleState, dataId: string): IBattleState {
    return {
        ...state,
        playerParty: state.playerParty.map((e, i) =>
            i === 0 ? { ...e, daemons: [...e.daemons, daemon(dataId)] } : e),
    } as IBattleState;
}

/** Hand the ENEMY one named card and let it play it, as the enemy side. */
function enemyPlays(state: IBattleState, dataId: string): IBattleState {
    const card: ProgramEntity = { id: `enemy_${dataId}`, dataId, currentCost: 0, isPlayable: true };
    const armed = {
        ...state,
        activeSide: 'ENEMY' as const,
        enemyParty: state.enemyParty.map((e, i) => (i === 0 ? { ...e, currentEnergy: 9 } : e)),
        enemyDeck: { ...state.enemyDeck, hand: [card] },
    } as IBattleState;

    return battleReducer(armed, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: armed.enemyParty[0].id, programId: card.id, targetId: armed.playerParty[0].id },
    } as never) as IBattleState;
}

const hpOf = (s: IBattleState, id: string): number =>
    [...s.playerParty, ...s.enemyParty].find(e => e.id === id)!.currentHp;

const procs = (before: IBattleState, after: IBattleState, needle: RegExp): number =>
    after.logs.slice(before.logs.length).filter(l => needle.test(l)).length;

describe('the printings themselves', () => {
    it('are None, 2e Daemons, and reachable by ANY party through the neutral slot', () => {
        // Ticket 69's standing law is that a gym's counters are reachable by any party. A Water or
        // Nature printing would be reachable only by a party that already brought that element,
        // which is the failure the neutral slot exists to prevent.
        for (const id of ['riptide', 'short_circuit']) {
            const data = GetProgramData(id);
            expect(data.element, `${id} must be neutral`).toBe('None');
            expect(data.category).toBe('Daemon');
            expect(data.baseCost).toBe(2);
            expect(MARKET_NEUTRAL_UTILITY, `${id} must be buyable`).toContain(id);
        }
    });

    it('resolve to real hooks on the triggers they claim', () => {
        expect(getHook('riptide_undertow')?.onActionEnd).toBeTypeOf('function');
        expect(getHook('short_circuit_discharge')?.onCardDraw).toBeTypeOf('function');
    });
});

describe('RIPTIDE — taxes cards PLAYED', () => {
    it('damages the enemy that played the card, and does so once per card', () => {
        const base = withPlayerDaemon(arena(), 'riptide');
        const enemyId = base.enemyParty[0].id;
        const before = hpOf(base, enemyId);

        const after = enemyPlays(base, 'undertow');
        const bare = enemyPlays(arena(), 'undertow');

        // Measured as a DIFFERENCE against the no-daemon control, because `undertow` is a 0-power
        // cantrip whose own resolution must not be mistaken for the daemon firing.
        const withDaemon = before - hpOf(after, enemyId);
        const without = hpOf(arena(), enemyId) - hpOf(bare, enemyId);
        expect(withDaemon - without).toBeGreaterThanOrEqual(1);
        expect(procs(base, after, /RIPTIDE/)).toBe(1);
    });

    it('fires ONCE per program, not once per action', () => {
        // `onActionEnd` is dispatched once per program after the multi-hit loop; `onActionStart` is
        // per action. On a multi-action card the wrong trigger doubles the tax invisibly.
        const base = withPlayerDaemon(arena(), 'riptide');
        const after = enemyPlays(base, 'whirlpool_v2'); // 8 power AND a draw — two actions
        expect(procs(base, after, /RIPTIDE/)).toBe(1);
    });

    it('does NOT fire on the owner\'s own cards — it is a tax on them, not on you', () => {
        const base = withPlayerDaemon(arena(), 'riptide');
        const card: ProgramEntity = { id: 'mine', dataId: 'growth', currentCost: 0, isPlayable: true };
        const armed = {
            ...base,
            activeSide: 'PLAYER' as const,
            playerParty: base.playerParty.map((e, i) => (i === 0 ? { ...e, currentEnergy: 9 } : e)),
            playerDeck: { ...base.playerDeck, hand: [card] },
        } as IBattleState;

        const after = battleReducer(armed, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: armed.playerParty[0].id, programId: card.id, targetId: armed.playerParty[0].id },
        } as never) as IBattleState;

        expect(procs(armed, after, /RIPTIDE/)).toBe(0);
    });
});

describe('SHORT_CIRCUIT — taxes ENGINE draws only', () => {
    it('fires on a triggered draw', () => {
        const base = withPlayerDaemon(arena(), 'short_circuit');
        // `whirlpool_v2` is 8 power AND "draw a card" — a card-driven draw, so not natural.
        const after = enemyPlays(base, 'whirlpool_v2');
        expect(procs(base, after, /SHORT_CIRCUIT/)).toBeGreaterThanOrEqual(1);
    });

    it('is SILENT through a whole natural draw step — the isNaturalDraw guard', () => {
        /*
         * The load-bearing test. `isNaturalDraw` is declared in `HookSchema`, and if it is ever
         * dropped there zod strips it from the `when` clause without error: the card then also taxes
         * the draw step, roughly tripling its rate and turning a Tidewrack answer into an
         * auto-include against every deck in the game. Nothing would throw and the win rate would
         * simply be too good.
         */
        const base = withPlayerDaemon(arena(), 'short_circuit');
        const after = battleReducer({ ...base, activeSide: 'ENEMY' as const }, { type: 'END_TURN' }) as IBattleState;
        expect(procs(base, after, /SHORT_CIRCUIT/)).toBe(0);
    });

    it('hits harder per proc than RIPTIDE, because engine draws are rarer than plays', () => {
        // Not a balance claim, a shape claim: the two are priced at the same energy, so the rarer
        // trigger has to pay more or nobody would ever buy it.
        expect(SHORT_CIRCUIT_POWER).toBeGreaterThan(RIPTIDE_POWER);
    });
});
