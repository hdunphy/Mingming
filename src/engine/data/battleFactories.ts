import type { IBattleEntity, ProgramEntity, IBattleState, IMingmingState } from '../types';
import { initializeBattleEntity } from '../types';
import { GetProgramData } from './programRegistry';
import { GetMingmingData } from './mingmingRegistry';

export function createMockEntity(name: string, mingmingId: string = 'fenrir', level: number = 10, experience: number = 0): IBattleEntity {
    const definition = GetMingmingData(mingmingId);

    const instance: IMingmingState = {
        id: crypto.randomUUID(),
        definitionId: mingmingId,
        nickname: name,
        level: level,
        experience: experience,
        hpIV: Math.floor(Math.random() * 32),
        attackIV: Math.floor(Math.random() * 32),
        defenseIV: Math.floor(Math.random() * 32),
    };

    return initializeBattleEntity(instance, definition);
}

export function createMockDeck(isWater: boolean = false): string[] {
    // Using original 34-card core deck IDs from Registry
    return isWater ? [
        'squirt', 'water_jet', 'whirlpool', 'bathe', 'scald',
        'toxic_water', 'renew', 'wave', 'hypnosis', 'reguvinate',
        'rain', 'drink_tea', 'hydro_pump', 'cannon_ball', 'hot_springs', 'nightmare'
    ]
        : [
            'reckless', 'flamethrower', 'erupt', 'rage', 'charge', 'radiate', 'fired_up',
            'toats', 'roast', 'spicy_breath', 'preheat', 'flash', 'fire_punch'
        ];
}

export function instantiateDeck(deckIds: string[]): ProgramEntity[] {
    return deckIds.map(id => ({
        id: crypto.randomUUID(),
        dataId: id,
        currentCost: GetProgramData(id).baseCost,
        isPlayable: true
    }));
}

export function createInitialBattleState(): IBattleState {
    const p1 = createMockEntity('Hero-Water 1', 'kraken');
    const p2 = createMockEntity('Hero-Water 2', 'kraken');
    const p3 = createMockEntity('Hero-Water 3', 'kraken');

    const e1 = createMockEntity('Villain-Fire 1', 'fenrir');
    const e2 = createMockEntity('Villain-Fire 2', 'fenrir');
    const e3 = createMockEntity('Villain-Fire 3', 'fenrir');

    const pDeckCards = instantiateDeck(createMockDeck(true));
    const eDeckCards = instantiateDeck(createMockDeck());

    // Draw initial hands (9 cards for 3v3)
    const pHand = pDeckCards.slice(0, 9);
    const pDraw = pDeckCards.slice(9);

    const eHand = eDeckCards.slice(0, 9);
    const eDraw = eDeckCards.slice(9);

    return {
        sessionId: 'battle_' + Date.now(),
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
