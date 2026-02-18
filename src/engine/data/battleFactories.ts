import type { IBattleEntity, ProgramEntity, IBattleState, IMingmingState, IDeckState } from '../types';
import { initializeBattleEntity } from '../types';
import { GetProgramData } from './programRegistry';
import { GetMingmingData } from './mingmingRegistry';
import { drawCards } from '../deckLogic';

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
    const p1 = createMockEntity('Hero-Water 1', 'kraken', 5);
    const e1 = createMockEntity('Villain-Fire 1', 'fenrir', 5);

    const pDeckCards = instantiateDeck(createMockDeck(true).slice(0, 12));
    const eDeckCards = instantiateDeck(createMockDeck().slice(0, 12));

    // Calculate card draw using the formula: sum(cardDraw) - aliveCount + 1
    const playerParty = [p1];
    const enemyParty = [e1];

    const playerCardDraw = playerParty.reduce((sum, e) => sum + e.cardDraw, 0) - playerParty.length + 1;
    const enemyCardDraw = enemyParty.reduce((sum, e) => sum + e.cardDraw, 0) - enemyParty.length + 1;

    const initialSeed = Date.now();

    // Use drawCards for proper deck cycling
    const pInitialDeck: IDeckState = {
        ownerId: 'PLAYER',
        deck: [],
        drawpile: pDeckCards,
        hand: [],
        discard: []
    };
    const { state: pDeckState, nextSeed: seed2 } = drawCards(pInitialDeck, playerCardDraw, initialSeed);

    const eInitialDeck: IDeckState = {
        ownerId: 'ENEMY',
        deck: [],
        drawpile: eDeckCards,
        hand: [],
        discard: []
    };
    const { state: eDeckState, nextSeed: seed3 } = drawCards(eInitialDeck, enemyCardDraw, seed2);

    return {
        sessionId: 'battle_' + Date.now(),
        seed: seed3,
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        logs: [],
        playerParty: playerParty,
        enemyParty: enemyParty,
        playerDeck: pDeckState,
        enemyDeck: eDeckState
    };
}
