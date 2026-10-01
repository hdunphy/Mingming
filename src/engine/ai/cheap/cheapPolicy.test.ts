/**
 * TICKET 177b — the cheap policy plays by weights, one simulation per legal action.
 */
import { describe, it, expect } from 'vitest';
import { cheapBestAction, featuresForLegalActions } from './cheapPolicy';
import { actionFeatures, FEATURE_NAMES } from './features';
import { cheapWeights, weightsTable } from './weights';
import { parseWeights } from './weightsSchema';
import { legalActions } from '../legalActions';
import { battleReducer, type BattleAction } from '../../battleReducer';
import { createSparseBattleState, createSparseEntity } from '../../../debug/scenarios/scenarioTestSupport';
import type { IBattleState, ProgramEntity } from '../../types';

const card = (id: string, dataId: string, currentCost = 1): ProgramEntity => (
    { id, dataId, currentCost, isPlayable: true }
);

/** One caster with `baseline_jab` and `water_slap`; the SECOND enemy is the one a hit kills. */
function board(hand: ProgramEntity[] = [card('h0', 'baseline_jab'), card('h1', 'water_slap')]): IBattleState {
    return createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [createSparseEntity({ id: 'p1', name: 'Caster', currentHp: 900, maxHp: 1000, currentEnergy: 3, maxEnergy: 3 })],
        enemyParty: [
            createSparseEntity({ id: 'e1', name: 'Big', currentHp: 900, maxHp: 1000 }),
            createSparseEntity({ id: 'e2', name: 'Frail', currentHp: 5, maxHp: 1000 }),
        ],
        playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [], hand },
    });
}

const target = (a: BattleAction): string => (a.type === 'PLAY_PROGRAM' ? a.payload.targetId : a.type);

describe('177b — cheapBestAction', () => {
    it('takes the lethal hit over a non-lethal one when enemyKills has a positive weight', () => {
        // `e1` is listed first, so only the kill weight can send the play to `e2`.
        const action = cheapBestAction(board(), { enemyKills: 3 });
        expect(action.type).toBe('PLAY_PROGRAM');
        expect(target(action)).toBe('e2');
    });

    it('with no kill weight and a zero-weight tie, the earlier action in legalActions order wins', () => {
        const state = board();
        const first = legalActions(state, 'PLAYER')[0];
        expect(cheapBestAction(state, {})).toEqual(first);
    });

    it('ends the turn when every play scores below END_TURN', () => {
        // Passing is worth 1; every play is worth 0 (and a negative cost for its HP loss).
        const action = cheapBestAction(board(), { isEndTurn: 1, allyHpLost: -1 });
        expect(action).toEqual({ type: 'END_TURN' });
    });

    it('plays rather than passes when a play scores above END_TURN', () => {
        const action = cheapBestAction(board(), { enemyHpRemoved: 1 });
        expect(action.type).toBe('PLAY_PROGRAM');
    });

    it('with an empty hand the only action is END_TURN', () => {
        expect(cheapBestAction(board([]), cheapWeights())).toEqual({ type: 'END_TURN' });
    });

    it('is deterministic: the same state and weights give the same action, and the state is untouched', () => {
        const state = board();
        const handBefore = [...state.playerDeck.hand];
        const a = cheapBestAction(state, cheapWeights());
        const b = cheapBestAction(state, cheapWeights());
        expect(b).toEqual(a);
        expect(state.playerDeck.hand).toEqual(handBefore);
    });

    it('applies the reducer once per legal action, END_TURN included, in legalActions order', () => {
        const state = board();
        const rows = featuresForLegalActions(state, 'PLAYER');
        const legal = legalActions(state, 'PLAYER');
        expect(rows.map((r) => r.action)).toEqual(legal);
        expect(rows[rows.length - 1].action).toEqual({ type: 'END_TURN' });
        expect(rows[rows.length - 1].features.isEndTurn).toBe(1);
    });
});

describe('177b — actionFeatures', () => {
    const jabAt = (targetId: string): BattleAction => (
        { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId, programId: 'h0' } }
    );

    it('reads damage, a kill and overkill off the two states and the ledger', () => {
        const before = board();
        const hit = jabAt('e2');
        const after = battleReducer(before, hit);
        const f = actionFeatures(before, after, hit, 'PLAYER');
        expect(f.enemyKills).toBe(1);
        expect(f.enemyHpRemoved).toBeCloseTo(5 / 100, 5);   // only the 5 HP it had
        expect(f.overkill).toBeGreaterThan(0);              // the jab hit for more than 5
        expect(f.allyDeaths).toBe(0);
        expect(f.isEndTurn).toBe(0);
        expect(f.energySpent).toBeGreaterThan(0);
        expect(f.lowestEnemyHpFraction).toBeCloseTo(0.9, 5); // only `Big` is still up
    });

    it('a non-lethal hit removes HP and kills nobody', () => {
        const before = board();
        const hit = jabAt('e1');
        const after = battleReducer(before, hit);
        const f = actionFeatures(before, after, hit, 'PLAYER');
        expect(f.enemyKills).toBe(0);
        expect(f.enemyHpRemoved).toBeGreaterThan(0);
        expect(f.overkill).toBe(0);
    });

    it('END_TURN reads the resources off `before`: nothing spent, nothing drawn, the energy held', () => {
        const before = board();
        const end: BattleAction = { type: 'END_TURN' };
        const f = actionFeatures(before, battleReducer(before, end), end, 'PLAYER');
        expect(f.isEndTurn).toBe(1);
        expect(f.energySpent).toBe(0);
        expect(f.cardsDrawn).toBe(0);
        expect(f.energyLeft).toBe(3);
    });

    it('is from the acting side: the same hit is an ally loss for the other side', () => {
        const before = board();
        const hit = jabAt('e1');
        const after = battleReducer(before, hit);
        const mine = actionFeatures(before, after, hit, 'PLAYER');
        const theirs = actionFeatures(before, after, hit, 'ENEMY');
        expect(theirs.allyHpLost).toBeCloseTo(mine.enemyHpRemoved, 8);
        expect(theirs.enemyHpRemoved).toBe(0);
    });

    it('reading the same starting state again (it is cached by state) changes nothing', () => {
        const before = board();
        const hit = jabAt('e1');
        const after = battleReducer(before, hit);
        const first = actionFeatures(before, after, hit, 'PLAYER');
        const again = actionFeatures(before, after, hit, 'PLAYER');
        expect(again).toEqual(first);
        // And the other side's reading of the same `before` is its own, not the first side's.
        expect(actionFeatures(before, after, hit, 'ENEMY').evalDelta).toBeCloseTo(-first.evalDelta, 6);
    });

    it('returns every named feature as a finite number', () => {
        const before = board();
        const hit = jabAt('e1');
        const f = actionFeatures(before, battleReducer(before, hit), hit, 'PLAYER');
        for (const name of FEATURE_NAMES) expect(Number.isFinite(f[name]), name).toBe(true);
    });
});

describe('177b — weights', () => {
    it('the shipped weights.json validates and starts as the hand-set version', () => {
        expect(cheapWeights().enemyHpRemoved).toBe(1);
        expect(cheapWeights().enemyKills).toBe(3);
        expect(cheapWeights().allyDeaths).toBe(-5);
        expect(cheapWeights().evalDelta).toBe(0.05);
    });

    it('rejects a missing feature, an unknown one, and a non-number', () => {
        const ok = { source: 't', weights: Object.fromEntries(FEATURE_NAMES.map((n) => [n, 0])) };
        expect(() => parseWeights(ok)).not.toThrow();

        const { enemyKills: _dropped, ...missing } = ok.weights as Record<string, number>;
        void _dropped;
        expect(() => parseWeights({ ...ok, weights: missing })).toThrow(/enemyKills/);
        expect(() => parseWeights({ ...ok, weights: { ...ok.weights, enemyKils: 1 } })).toThrow();
        expect(() => parseWeights({ ...ok, weights: { ...ok.weights, enemyKills: Number.NaN } })).toThrow();
    });

    it('prints a table sorted by size, biggest first', () => {
        const lines = weightsTable(cheapWeights()).split('\n');
        expect(lines).toHaveLength(FEATURE_NAMES.length);
        expect(lines[0].startsWith('allyDeaths')).toBe(true);   // |-5| is the largest
        expect(lines[1].startsWith('enemyKills')).toBe(true);
    });
});
