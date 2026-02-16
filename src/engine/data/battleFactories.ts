import type { IBattleEntity, ProgramEntity, IBattleState } from '../types';
import { GetProgramData } from './programRegistry';

export function createMockEntity(id: string, name: string, team: 'PLAYER' | 'ENEMY'): IBattleEntity {
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
    };
}

export function createMockDeck(isWater: boolean = false): string[] {
    // Using original 34-card core deck IDs from Registry
    return isWater ? [
        'squirt', 'water_jet', 'whirlpool', 'bathe', 'scald',
        'toxic_water', 'renew', 'wave', 'hypnosis', 'reguvinate',
        'rain', 'drink_tea', 'hydro_pump', 'cannon_ball', 'hot_springs', 'nightmare'
    ]
        : [
            'reckless', 'flamethrower', 'erupt', 'rage', 'charge', 'radiate', 'fired_up', 'toats', 'roast', 'spicy_breath', 'preheat', 'flash', 'fire_punch'
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
    const p1 = createMockEntity('p1', 'Hero-Fire 1', 'PLAYER');
    const p2 = createMockEntity('p2', 'Hero-Fire 2', 'PLAYER');
    const p3 = createMockEntity('p3', 'Hero-Fire 3', 'PLAYER');

    const e1 = createMockEntity('e1', 'Villain-Water 1', 'ENEMY');
    const e2 = createMockEntity('e2', 'Villain-Water 2', 'ENEMY');
    const e3 = createMockEntity('e3', 'Villain-Water 3', 'ENEMY');

    const pDeckCards = instantiateDeck(createMockDeck());
    const eDeckCards = instantiateDeck(createMockDeck(true));

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
