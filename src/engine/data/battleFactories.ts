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

export function createMockDeck(): string[] {
    return [
        'card_ember', 'card_ember', 'card_ember',
        'card_vine_whip', 'card_vine_whip', 'card_vine_whip',
        'card_bubble', 'card_bubble', 'card_bubble',
        'card_earthquake', 'card_earthquake', 'card_earthquake',
        'card_fireball', 'card_fireball', 'card_fireball'
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
