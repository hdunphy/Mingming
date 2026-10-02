/**
 * TICKET 180d — THE ENEMY'S TURN, PLAYED BY THE GAME'S OWN AI.
 *
 * END TURN hands the turn over: the enemy side moves with `getBestAction` and the encounter's own AI
 * tier and beam (both ride on the state, set when the battle was opened as `runOne` sets them),
 * move by move, until the turn is the player's again or the fight is decided. It is `autoPlay`'s
 * loop with the player's half taken out: a move the reducer refuses becomes END TURN, and a state
 * that will not even end its turn, or a turn that will not stop, is cut off as `truncated`.
 */
import { battleOutcome } from '../../../engine/battleOutcome';
import { getBestAction } from '../../../engine/ai/TacticalAI';
import type { IBattleState } from '../../../engine/types';
import { stabilizeIds } from './stableIds';
import { MAX_ACTIONS_PER_TURN, mergeHits, sortedHits, step, type HitTotal } from '../battleSim';

export interface EnemyTurn {
    readonly state: IBattleState;
    /** What the enemy did this turn, merged by source, target and card, biggest first. */
    readonly hits: ReadonlyArray<HitTotal>;
    readonly truncated: boolean;
    /** The battle's count of repeatable ids named, carried on from the caller's. */
    readonly minted: number;
}

export function runEnemyTurn(start: IBattleState, minted: number): EnemyTurn {
    let state = start;
    let count = minted;
    const table = new Map<string, HitTotal>();
    let truncated = false;
    let actions = 0;
    while (state.activeSide === 'ENEMY' && battleOutcome(state) === null) {
        let moved = step(state, getBestAction(state));
        if (!moved.changed) {
            moved = step(state, { type: 'END_TURN' });
            if (!moved.changed) { truncated = true; break; }
        }
        ({ state, minted: count } = stabilizeIds(moved.state, count));
        mergeHits(table, moved.hits);
        actions += 1;
        if (actions > MAX_ACTIONS_PER_TURN) { truncated = true; break; }
    }
    return { state, hits: sortedHits(table), truncated, minted: count };
}
