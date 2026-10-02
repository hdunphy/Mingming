/**
 * TICKET 177e — `cheap` is a grade a simulation can ask for, on either side, and asking for nothing
 * changes nothing.
 *
 * The lesson of `optionsThreading.test.ts` applies in full: an option that is declared, parsed and
 * never reaches the battle fails nothing and measures the wrong arm. So every way in (`getBestAction`
 * on a state, `runOne`, `runBatch`, the walker) is checked by a SPY on the cheap policy: it was
 * called, and only for the side that was asked for. The default path is pinned by the 177a hashes
 * (`aiDeterminism.test.ts`); here it is checked that an unset tier never reaches the cheap policy
 * and that naming the default tier explicitly is the same fight.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as policy from '../../../engine/ai/cheap/cheapPolicy';
import { getBestAction } from '../../../engine/ai/TacticalAI';
import { createSparseBattleState, createSparseEntity } from '../../scenarios/scenarioTestSupport';
import { matchupScenario } from '../balanceScenarios';
import { runBatch, runOne } from '../runBatch';
import { walkRun } from '../runWalker';
import type { IBattleState, ProgramEntity } from '../../../engine/types';

const card = (id: string, dataId: string): ProgramEntity => ({ id, dataId, currentCost: 1, isPlayable: true });

function board(activeSide: 'PLAYER' | 'ENEMY', extra: Partial<IBattleState> = {}): IBattleState {
    const hand = [card('h0', 'baseline_jab'), card('h1', 'water_slap')];
    return createSparseBattleState({
        activeSide, phase: 'ACTION', enemyMode: 'CARDS',
        playerParty: [createSparseEntity({ id: 'p1', name: 'Mine', currentHp: 900, maxHp: 1000, currentEnergy: 3, maxEnergy: 3 })],
        enemyParty: [createSparseEntity({ id: 'e1', name: 'Theirs', currentHp: 900, maxHp: 1000, currentEnergy: 3, maxEnergy: 3 })],
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [], hand },
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], discard: [], exhaust: [], hand },
        ...extra,
    });
}

const SETUP = matchupScenario({ player: 'fenrir', playerOS: 'fenrir_v1', enemy: 'skoll', enemyOS: 'skoll_v2', seed: 't177e' });

afterEach(() => vi.restoreAllMocks());

describe('177e — getBestAction reads the tier of the side that is acting', () => {
    it('playerAiTier "cheap" sends the PLAYER\'s decision to the cheap policy, and only the player\'s', () => {
        const spy = vi.spyOn(policy, 'cheapBestAction');
        getBestAction(board('PLAYER', { playerAiTier: 'cheap' }));
        expect(spy).toHaveBeenCalledTimes(1);
        // The enemy's turn on the same battle is NOT graded by the player's field.
        getBestAction(board('ENEMY', { playerAiTier: 'cheap' }));
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('enemyAiTier "cheap" sends the ENEMY\'s decision to the cheap policy, and only the enemy\'s', () => {
        const spy = vi.spyOn(policy, 'cheapBestAction');
        getBestAction(board('ENEMY', { enemyAiTier: 'cheap' }));
        expect(spy).toHaveBeenCalledTimes(1);
        getBestAction(board('PLAYER', { enemyAiTier: 'cheap' }));
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('with neither field set the cheap policy is never called', () => {
        const spy = vi.spyOn(policy, 'cheapBestAction');
        getBestAction(board('PLAYER'));
        getBestAction(board('ENEMY'));
        expect(spy).not.toHaveBeenCalled();
    });

    it('returns exactly what the policy returns', () => {
        const state = board('PLAYER', { playerAiTier: 'cheap' });
        const fake = { type: 'END_TURN' } as const;
        vi.spyOn(policy, 'cheapBestAction').mockReturnValue(fake);
        expect(getBestAction(state)).toBe(fake);
    });
});

describe('177e — the options reach the fight', () => {
    it('runOne with playerAiTier "cheap" calls the cheap policy for the player only, and the fight finishes', () => {
        const spy = vi.spyOn(policy, 'cheapBestAction');
        const result = runOne(SETUP, 'seed-a', undefined, 'PLAYER', false, undefined, undefined, undefined, undefined, undefined, 'cheap');
        expect(result.truncated).toBe(false);
        expect(['PLAYER', 'ENEMY', 'DRAW']).toContain(result.winner);
        expect(spy.mock.calls.length).toBeGreaterThan(0);
        for (const [state] of spy.mock.calls) expect(state.activeSide).toBe('PLAYER');
    });

    it('runOne with enemyAiTier "cheap" calls the cheap policy for the enemy only', () => {
        const spy = vi.spyOn(policy, 'cheapBestAction');
        runOne(SETUP, 'seed-a', undefined, 'PLAYER', false, 'cheap');
        expect(spy.mock.calls.length).toBeGreaterThan(0);
        for (const [state] of spy.mock.calls) expect(state.activeSide).toBe('ENEMY');
    });

    it('runBatch passes playerAiTier and enemyAiTier through', () => {
        const spy = vi.spyOn(policy, 'cheapBestAction');
        runBatch(SETUP, { iterations: 2, playerAiTier: 'cheap', enemyAiTier: 'cheap' });
        const sides = new Set(spy.mock.calls.map(([state]) => state.activeSide));
        expect(sides).toEqual(new Set(['PLAYER', 'ENEMY']));
    });

    it('naming the default tier is the same fight as naming nothing, and calls no cheap policy', () => {
        const spy = vi.spyOn(policy, 'cheapBestAction');
        const plain = runOne(SETUP, 'seed-b');
        const named = runOne(SETUP, 'seed-b', undefined, 'PLAYER', false, undefined, undefined, undefined, undefined, undefined, 'full');
        expect(named).toEqual(plain);
        expect(spy).not.toHaveBeenCalled();
    });

    it('the walker\'s WalkInput carries playerAiTier and enemyAiTier to its fights', () => {
        const spy = vi.spyOn(policy, 'cheapBestAction');
        const base = { seed: 't177e-walk', starter: 'fenrir_v1', gymIndex: 0, stopAfterFights: 1 } as const;
        walkRun(base);
        expect(spy).not.toHaveBeenCalled();

        walkRun({ ...base, playerAiTier: 'cheap' });
        const afterPlayer = spy.mock.calls.length;
        expect(afterPlayer).toBeGreaterThan(0);
        for (const [state] of spy.mock.calls) expect(state.activeSide).toBe('PLAYER');

        walkRun({ ...base, enemyAiTier: 'cheap' });
        expect(spy.mock.calls.length).toBeGreaterThan(afterPlayer);
        for (const [state] of spy.mock.calls.slice(afterPlayer)) expect(state.activeSide).toBe('ENEMY');
    }, 120_000);
});
