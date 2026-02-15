
import { battleReducer, type BattleAction } from '../battleReducer';
import type { IBattleState, IBattleEntity } from '../types';

// Weights for scoring
// Weights for scoring specific statuses
const STATUS_SCORES: Record<string, number> = {
    'Regen': 5,
    'Strengthened': 5,
    'Sharp': 5,
    'Burn': -3,
    'Poison': -3,
    'Weakened': -3,
    'Dazed': -5,
    'Stunned': -10,
    'Asleep': -8
};

/**
 * Calculates the 'Board Score' for a single entity.
 * Formula: (Current_HP * 2) + Sum(Status_Scores)
 */
function getEntityScore(entity: IBattleEntity): number {
    if (entity.currentHp <= 0) return 0; // Dead units have 0 score

    let score = entity.currentHp * 2;

    for (const status of entity.statusEffects) {
        const val = STATUS_SCORES[status.type] || 0;
        score += val * status.stacks;
    }

    return score;
}

/**
 * Evaluates the total board state for a specific side.
 * Formula: Sum(Ally_Scores) - Sum(Enemy_Scores)
 * Higher is better.
 */
function evaluateState(state: IBattleState, side: 'PLAYER' | 'ENEMY'): number {
    const myPartyKey = side === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const oppPartyKey = side === 'PLAYER' ? 'enemyParty' : 'playerParty';

    const myScore = state[myPartyKey].reduce((sum, e) => sum + getEntityScore(e), 0);
    const oppScore = state[oppPartyKey].reduce((sum, e) => sum + getEntityScore(e), 0);

    return myScore - oppScore;
}

/**
 * Recursive search to find the best sequence of actions for the current turn.
 * Simulates permutations of playable cards.
 */
function findBestSequence(
    state: IBattleState,
    side: 'PLAYER' | 'ENEMY',
    depth: number,
    maxDepth: number
): { score: number; firstAction: BattleAction | null } {
    // 1. Evaluate current state
    const currentScore = evaluateState(state, side);

    // 2. Base Cases
    if (depth >= maxDepth) {
        return { score: currentScore, firstAction: null };
    }

    // 3. Generate Valid Actions
    const activeDeckKey = side === 'PLAYER' ? 'playerDeck' : 'enemyDeck';
    const activePartyKey = side === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const oppPartyKey = side === 'PLAYER' ? 'enemyParty' : 'playerParty';

    const hand = state[activeDeckKey].hand;
    const myParty = state[activePartyKey].filter(e => e.currentHp > 0);
    const oppParty = state[oppPartyKey].filter(e => e.currentHp > 0);

    if (myParty.length === 0 || oppParty.length === 0) {
        return { score: currentScore, firstAction: null };
    }

    let bestScore = currentScore;
    let bestAction: BattleAction | null = null;
    let moveFound = false;

    // Iterate all cards in hand
    // Note: We need to handle "once per card instance". 
    // In our state, playing a card removes it from hand (moves to discard). 
    // So recursion naturally handles permutations.

    for (const card of hand) {
        // Optimization: Skip unplayable cards (Cost check)
        // We find the first ally valid to cast it
        for (const source of myParty) {
            if (source.currentEnergy < card.currentCost) continue;

            // Targets: Assume Single Target logic for MVP
            // TODO: check ProgramData target type. For now, try all enemies.
            for (const target of oppParty) {
                const action: BattleAction = {
                    type: 'PLAY_PROGRAM',
                    payload: {
                        sourceId: source.id,
                        targetId: target.id,
                        programId: card.id
                    }
                };

                moveFound = true;

                // Simulate
                const nextState = battleReducer(state, action);

                // Recursive Call
                const result = findBestSequence(nextState, side, depth + 1, maxDepth);

                if (result.score > bestScore) {
                    bestScore = result.score;
                    // If we are at root (depth 0), we record this as the best first action
                    // If we are deeper, we don't care about the action, just the score bubbles up
                    if (depth === 0) {
                        bestAction = action;
                    }
                }
            }
        }
    }

    // If no moves improved score significantly, or no moves possible, we return current
    // (We default to null action, which caller interprets as END_TURN usually)

    return { score: bestScore, firstAction: bestAction };
}

export function getBestAction(state: IBattleState): BattleAction {
    const MAX_DEPTH = 3; // Limit recursion to prevent hangs
    const result = findBestSequence(state, state.activeSide, 0, MAX_DEPTH);

    if (result.firstAction) {
        return result.firstAction;
    }

    return { type: 'END_TURN' };
}
