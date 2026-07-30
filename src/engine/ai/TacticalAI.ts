
import { battleReducer, validateProgramConstraints, type BattleAction } from '../battleReducer';
import type { IBattleState, IBattleEntity } from '../types';
import { globalBattleEventBus } from '../events';
import { GetProgramData } from '../data/programRegistry';

// Weights for scoring
// Weights for scoring specific statuses
const STATUS_SCORES: Record<string, number> = {
    'Regen': 3,
    'Strengthened': 5,
    'Sharp': 5,
    'Burn': -3,
    'Poison': -3,
    'Weakened': -3,
    'Dazed': -5,
    'Stunned': -8,
    'Asleep': -6
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

    // Kill bonus: strongly incentivize finishing off enemies
    const oppDead = state[oppPartyKey].filter(e => e.currentHp <= 0).length;

    return myScore - oppScore + (oppDead * 50);
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

    for (const card of hand) {
        const programData = GetProgramData(card.dataId);

        // Determine valid targets based on card target type
        let potentialTargets: IBattleEntity[] = [];

        if (programData.target === 'Self') {
            potentialTargets = [...myParty]; // Self cards target own units
        } else if (programData.actions.some(a => a.type === 'HEAL') && programData.target !== 'Side') {
            potentialTargets = [...myParty]; // Heal cards target allies
        } else if (programData.target === 'Side' || programData.target === 'All') {
            // Side/All can target either side; try both
            potentialTargets = [...oppParty, ...myParty];
        } else {
            potentialTargets = [...oppParty]; // Single attacks target enemies
        }

        for (const source of myParty) {
            if (source.currentEnergy < card.currentCost) continue;

            for (const target of potentialTargets) {
                // Validate constraints BEFORE simulating
                if (!validateProgramConstraints(state, source, target, programData, card.currentCost)) {
                    continue; // Skip this card/target combo — constraints not met
                }

                // For Self cards, the effective target is always the source
                const effectiveTargetId = programData.target === 'Self' ? source.id : target.id;

                const action: BattleAction = {
                    type: 'PLAY_PROGRAM',
                    payload: {
                        sourceId: source.id,
                        targetId: effectiveTargetId,
                        programId: card.id
                    }
                };

                // Simulate
                const nextState = battleReducer(state, action);

                // Skip if state didn't change (reducer rejected it)
                if (nextState === state) continue;

                // Recursive Call
                const result = findBestSequence(nextState, side, depth + 1, maxDepth);

                if (result.score > bestScore) {
                    bestScore = result.score;
                    if (depth === 0) {
                        bestAction = action;
                    }
                }
            }
        }
    }

    return { score: bestScore, firstAction: bestAction };
}

export function getBestAction(state: IBattleState): BattleAction {
    // 1. First check if any entity on the active side has an intent to execute
    // (Intents are generated in PRE_TURN for enemies)
    const activePartyKey = state.activeSide === 'PLAYER' ? 'playerParty' : 'enemyParty';
    const activeParty = state[activePartyKey];

    // Find first alive unit with an intent that hasn't executed yet
    for (const entity of activeParty) {
        if (entity.currentHp > 0 && entity.currentIntent) {
            return {
                type: 'EXECUTE_INTENT',
                payload: { sourceId: entity.id }
            };
        }
    }

    // 2. Design decision: enemies are Slay-the-Spire style — they ONLY execute
    // telegraphed intents, never play cards. Once every intent has been
    // executed, the enemy turn is over. The card-play simulation below is
    // reserved for the PLAYER side (used by the Balance Tester / SimRunner
    // auto-battles); without this guard, enemies fell through to it and
    // played cards from their dealt hand after their intent.
    if (state.activeSide === 'ENEMY') {
        return { type: 'END_TURN' };
    }

    // 3. Player-side tactical simulation (headless sims / auto-battle)
    const MAX_DEPTH = 3; // Limit recursion to prevent hangs

    // Silence events during AI simulation to prevent log spam and side effects
    globalBattleEventBus.mute();
    const result = findBestSequence(state, state.activeSide, 0, MAX_DEPTH);
    globalBattleEventBus.unmute();

    if (result.firstAction) {
        return result.firstAction;
    }

    return { type: 'END_TURN' };
}
