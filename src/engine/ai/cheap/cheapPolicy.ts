/**
 * TICKET 177b — THE CHEAP POLICY: ONE SIMULATION PER LEGAL ACTION, NO SEARCH.
 *
 * The full AI (`getBestAction`) walks whole same-turn card sequences and then re-ranks the best with
 * a one-turn lookahead: thousands of reducer calls per decision at 3v3. This copies its choices
 * with a fraction of the work. For each legal action it applies the reducer ONCE, reads a fixed
 * list of named numbers off the before and after states (`actionFeatures`), and scores
 * `Σ weight × feature`. The best score is played; the caller asks again after each play, and the
 * turn ends when ending the turn is what scores best.
 *
 * Ties go to the EARLIER action in `legalActions` order, and `END_TURN` is last in that order, so a
 * play that scores exactly what passing scores is preferred to passing. Same state and same weights
 * always give the same action: nothing here draws a random number.
 *
 * `END_TURN` is scored like any other action, on the state the reducer returns for it. A play the
 * reducer refuses (returns the very same state object) is not a play and is skipped, exactly as the
 * search skips it.
 *
 * Engine module: no React, no Redux, no `Math.random`, no `Date.now()`.
 */

import { battleReducer, type BattleAction } from '../../battleReducer';
import { beginSimulation, endSimulation } from '../../core/simulationDepth';
import { globalBattleEventBus } from '../../events';
import type { IBattleState } from '../../types';
import { legalActions } from '../legalActions';
import { actionFeatures, scoreFeatures, type FeatureName } from './features';

/** One action with its feature vector and score. The teacher recorder and the fitter use these. */
export interface ScoredAction {
    readonly action: BattleAction;
    readonly features: Record<FeatureName, number>;
    readonly score: number;
}

/**
 * Every legal action the reducer accepts, in `legalActions` order, with its features.
 *
 * The event bus is muted (`runMuted`, which restores whatever it was) and the simulation depth
 * raised for the duration, as `getBestAction` does: everything in here is a question put to the
 * engine, not a play.
 */
export function featuresForLegalActions(
    state: IBattleState,
    side: 'PLAYER' | 'ENEMY' = state.activeSide,
): Array<Omit<ScoredAction, 'score'>> {
    return globalBattleEventBus.runMuted(() => {
        beginSimulation();
        try {
            const rows: Array<Omit<ScoredAction, 'score'>> = [];
            for (const action of legalActions(state, side)) {
                const after = battleReducer(state, action);
                if (after === state) continue;
                rows.push({ action, features: actionFeatures(state, after, action, side) });
            }
            return rows;
        } finally {
            endSimulation();
        }
    });
}

/** The action `weights` rates highest from `state`, for the side whose turn it is. */
export function cheapBestAction(
    state: IBattleState,
    weights: Readonly<Partial<Record<FeatureName, number>>>,
): BattleAction {
    const side = state.activeSide;
    let best: BattleAction = { type: 'END_TURN' };
    let bestScore = -Infinity;
    for (const row of featuresForLegalActions(state, side)) {
        const score = scoreFeatures(row.features, weights);
        // Strictly greater: a tie keeps the earlier action.
        if (score > bestScore) {
            bestScore = score;
            best = row.action;
        }
    }
    return best;
}
