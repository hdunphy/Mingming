
import { battleReducer, type BattleAction } from './battleReducer';
import type { IBattleState, IBattleEntity, ProgramEntity } from './types';
import { getBestAction } from './ai/TacticalAI';
import { globalBattleEventBus } from './events';
import { GetProgramData } from './data/programRegistry';

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
    // 15 cards: variety for 3v3
    return [
        'card_ember', 'card_ember', 'card_ember',
        'card_vine_whip', 'card_vine_whip', 'card_vine_whip',
        'card_bubble', 'card_bubble', 'card_bubble',
        'card_earthquake', 'card_earthquake', 'card_earthquake',
        'card_fireball', 'card_fireball', 'card_fireball'
    ];
}

function instantiateDeck(deckIds: string[]): ProgramEntity[] {
    return deckIds.map(id => ({
        id: crypto.randomUUID(),
        dataId: id,
        currentCost: GetProgramData(id).baseCost,
        isPlayable: true
    }));
}

function createInitialState(): IBattleState {
    const p1 = createMockEntity('p1', 'Hero-Fire', 'PLAYER');
    const p2 = createMockEntity('p2', 'Hero-Water', 'PLAYER');
    const p3 = createMockEntity('p3', 'Hero-Nature', 'PLAYER');

    const e1 = createMockEntity('e1', 'Villain-Fire', 'ENEMY');
    const e2 = createMockEntity('e2', 'Villain-Water', 'ENEMY');
    const e3 = createMockEntity('e3', 'Villain-Nature', 'ENEMY');

    const pDeckCards = instantiateDeck(createMockDeck());
    const eDeckCards = instantiateDeck(createMockDeck());

    // Draw initial hands (9 cards for 3v3)
    const pHand = pDeckCards.slice(0, 9);
    const pDraw = pDeckCards.slice(9);

    const eHand = eDeckCards.slice(0, 9);
    const eDraw = eDeckCards.slice(9);

    return {
        sessionId: 'sim_' + Date.now(),
        seed: Date.now(),
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        logs: [],
        playerParty: [p1, p2, p3],
        enemyParty: [e1, e2, e3],
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
