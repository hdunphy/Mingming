
import { battleReducer, type BattleAction } from './battleReducer';
import type { IBattleState, IBattleEntity, ProgramEntity } from './types';
import { getBestAction } from './ai/TacticalAI';
import { globalBattleEventBus } from './events';

// --- Mock Data Factories ---

function createMockEntity(id: string, name: string, team: 'PLAYER' | 'ENEMY'): IBattleEntity {
    return {
        id,
        name,
        level: 10,
        experience: 0,
        hpIV: 0, attackIV: 0, defenseIV: 0,
        maxHp: 100,
        attack: 15,
        defense: 5,
        maxEnergy: 10,
        cardDraw: 1,
        currentHp: 100,
        currentEnergy: 10,
        primaryElement: team === 'PLAYER' ? 'Fire' : 'Water',
        statusEffects: [],
        definitionId: 'def_1',
        tempHp: 0, speed: 10
        // baseStats removed to match IBattleEntity type
    };
}

function createMockDeck(): string[] {
    // 10 cards using valid IDs from Registry
    return [
        'card_ember', 'card_ember', 'card_ember', 'card_ember', 'card_ember',
        'card_vine_whip', 'card_vine_whip', 'card_vine_whip', 'card_vine_whip', 'card_vine_whip'
    ];
}

function instantiateDeck(deckIds: string[]): ProgramEntity[] {
    return deckIds.map(id => ({
        id: crypto.randomUUID(),
        dataId: id,
        currentCost: 1, // Mock cost
        isPlayable: true
    }));
}

function createInitialState(): IBattleState {
    const p1 = createMockEntity('p1', 'Hero', 'PLAYER');
    const e1 = createMockEntity('e1', 'Villain', 'ENEMY');

    const pDeckCards = instantiateDeck(createMockDeck());
    const eDeckCards = instantiateDeck(createMockDeck());

    // Draw initial hands (5 cards) manually for the "Start"
    const pHand = pDeckCards.slice(0, 5);
    const pDraw = pDeckCards.slice(5);

    const eHand = eDeckCards.slice(0, 5);
    const eDraw = eDeckCards.slice(5);

    return {
        sessionId: 'sim_' + Date.now(),
        seed: Date.now(),
        turn: 1,
        phase: 'ACTION', // Start in ACTION to avoid Pre-Turn complexity in sim for now
        activeSide: 'PLAYER',
        logs: [],
        playerParty: [p1],
        enemyParty: [e1],
        playerDeck: {
            ownerId: 'PLAYER',
            deck: [],
            drawpile: pDraw,
            hand: pHand,
            discard: []
        },
        enemyDeck: {
            ownerId: 'ENEMY',
            deck: [],
            drawpile: eDraw,
            hand: eHand,
            discard: []
        }
    };
}

// --- Simulation Logic ---

export interface SimResult {
    winner: 'PLAYER' | 'ENEMY' | 'DRAW';
    totalTurns: number;
    finalLogs: string[];
    remainingHp: { p1: number, e1: number };
}

export function runSimulation(): SimResult {
    let state = createInitialState();
    const logBuffer: string[] = [];
    const MAX_TURNS = 50;

    const unsubscribe = globalBattleEventBus.subscribe(event => {
        const turnInfo = 'turnNumber' in event ? `[Turn ${event.turnNumber}]` : '';
        logBuffer.push(`${turnInfo} ${event.type} - ${JSON.stringify(event)}`);
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
        const pAlive = state.playerParty.some(e => e.currentHp > 0);
        const eAlive = state.enemyParty.some(e => e.currentHp > 0);

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
