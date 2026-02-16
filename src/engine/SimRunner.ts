
import { battleReducer, type BattleAction } from './battleReducer';
import type { IBattleState, IBattleEntity, ProgramEntity } from './types';
import { getBestAction } from './ai/TacticalAI';
import { globalBattleEventBus } from './events';
import { GetProgramData } from './data/programRegistry';

import { createInitialBattleState } from './data/battleFactories';

// --- Simulation Logic ---

export interface SimResult {
    winner: 'PLAYER' | 'ENEMY' | 'DRAW';
    totalTurns: number;
    finalLogs: string[];
    remainingHp: { p1: number, e1: number };
}

export function runSimulation(): SimResult {
    let state = createInitialBattleState();
    const logBuffer: string[] = [];
    const MAX_TURNS = 50;

    const unsubscribe = globalBattleEventBus.subscribe(event => {
        const turnInfo = 'turnNumber' in event ? `[Turn ${event.turnNumber}]` : '';
        const logEntry = `${turnInfo} ${event.type} - ${JSON.stringify(event)}`;
        logBuffer.push(logEntry);

        // Check for Significant Events to log to console immediately
        const significantEvents = ['TURN_START', 'DAMAGE_TAKEN', 'STATUS_APPLIED', 'PROGRAM_PLAYED', 'BATTLE_ENDED', 'TURN_END'];
        if (significantEvents.includes(event.type)) {
            console.log(logEntry);
        }
    });

    let winner: 'PLAYER' | 'ENEMY' | 'DRAW' | null = null;
    let turnCount = 0;

    console.log(`--- Simulation Start: ${state.playerParty[0].name} vs ${state.enemyParty[0].name} ---`);

    while (!winner && state.turn <= MAX_TURNS) {
        turnCount = state.turn;

        // Check for infinite loop / stagnancy safety (if needed)

        // 1. Get AI Action
        const bestAction = getBestAction(state);

        // Log choice usually
        // console.log(`Turn ${state.turn} ${state.activeSide}: ${bestAction.type}`);

        // 2. Execute Action
        const nextState = battleReducer(state, bestAction);

        // 3. Phase Handling integration (if reducer returns POST_TURN)
        // Current reducer implements synchronous full-turn cycle on END_TURN.
        // So nextState should be back to ACTION phase (of next player) or same phase.

        state = nextState;

        // 4. Win/Loss Detection
        const pAlive = state.playerParty.some((e: IBattleEntity) => e.currentHp > 0);
        const eAlive = state.enemyParty.some((e: IBattleEntity) => e.currentHp > 0);

        if (!pAlive) {
            winner = 'ENEMY';
        } else if (!eAlive) {
            winner = 'PLAYER';
        }

        // 5. Max Turn Safety break
        if (state.turn > MAX_TURNS) {
            winner = 'DRAW';
        }
    }

    unsubscribe();

    if (!winner) winner = 'DRAW';

    const result: SimResult = {
        winner,
        totalTurns: turnCount,
        finalLogs: logBuffer,
        remainingHp: {
            p1: state.playerParty[0]?.currentHp || 0,
            e1: state.enemyParty[0]?.currentHp || 0
        }
    };

    console.log(`\n=== Game Over ===`);
    console.log(`Winner: ${result.winner}`);
    console.log(`Turns: ${result.totalTurns}`);
    console.log(`Final HP: P=${result.remainingHp.p1}, E=${result.remainingHp.e1}`);

    return result;
}

// Ensure global accessibility for Console debugging
if (typeof window !== 'undefined') {
    (window as any).runSim = runSimulation;
    console.log("SimRunner loaded. Run `window.runSim()` to execute.");
}
