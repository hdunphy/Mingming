/**
 * Ticket 164c — The player's turn 1 runs the full turn-start sequence.
 */
import { describe, expect, it } from 'vitest';
import { createBattleState, type IBattleSetup } from './data/battleFactories';
import { buildScenarioState } from '../debug/scenarios/buildScenarioState';
import type { ComposedSetup } from '../debug/scenarios/scenarioSchema';

function ymirBattleSetup(): IBattleSetup {
    return {
        party: [{
            id: 'p1',
            definitionId: 'ymir',
            activeOS: 'ymir_v1',
            blueprintsCollected: 0,
            attackIV: 0,
            defenseIV: 0,
            hpIV: 0,
        }],
        deck: ['water_slap', 'water_slap', 'water_slap', 'water_slap'],
        drivers: [],
        persistedHp: {},
    };
}

function ymirScenarioSetup(): ComposedSetup {
    return {
        seed: 'ymir-turn-one-seed',
        enemyMode: 'CARDS',
        player: {
            drivers: [],
            party: [{
                definitionId: 'ymir',
                activeOS: 'ymir_v1',
                attackIV: 0,
                defenseIV: 0,
                hpIV: 0,
            }],
            deck: ['water_slap', 'water_slap', 'water_slap', 'water_slap'],
        },
        enemies: [{
            definitionId: 'fenrir',
            activeOS: 'fenrir_v1',
            attackIV: 0,
            defenseIV: 0,
            hpIV: 0,
            deck: ['water_slap'],
        }],
    };
}

function gauntletBattleSetup(): IBattleSetup {
    return {
        party: [
            {
                id: 'p1',
                definitionId: 'fenrir',
                activeOS: 'fenrir_v1',
                blueprintsCollected: 0,
                attackIV: 0,
                defenseIV: 0,
                hpIV: 0,
            },
            {
                id: 'p2',
                definitionId: 'skoll',
                activeOS: 'skoll_v1',
                blueprintsCollected: 0,
                attackIV: 0,
                defenseIV: 0,
                hpIV: 0,
            },
        ],
        deck: ['water_slap', 'water_slap', 'water_slap', 'water_slap', 'water_slap', 'water_slap', 'water_slap', 'water_slap'],
        drivers: [],
        persistedHp: { p2: 0 },
    };
}

function gauntletScenarioSetup(): ComposedSetup {
    return {
        seed: 'gauntlet-turn-one-seed',
        enemyMode: 'CARDS',
        player: {
            drivers: [],
            party: [
                {
                    definitionId: 'fenrir',
                    activeOS: 'fenrir_v1',
                    attackIV: 0,
                    defenseIV: 0,
                    hpIV: 0,
                },
                {
                    definitionId: 'skoll',
                    activeOS: 'skoll_v1',
                    attackIV: 0,
                    defenseIV: 0,
                    hpIV: 0,
                    currentHp: 0,
                },
            ],
            deck: ['water_slap', 'water_slap', 'water_slap', 'water_slap', 'water_slap', 'water_slap', 'water_slap', 'water_slap'],
        },
        enemies: [{
            definitionId: 'kraken',
            activeOS: 'kraken_v1',
            attackIV: 0,
            defenseIV: 0,
            hpIV: 0,
            deck: ['water_slap'],
        }],
    };
}

describe('Ticket 164c — The player\'s turn 1 runs the full turn-start sequence', () => {
    describe('createBattleState (real factory)', () => {
        it('1. Ymir player gains Bark Shield on turn 1 via onTurnStart hook', () => {
            const state = createBattleState(ymirBattleSetup(), ['fenrir'], undefined, { seed: 'battle-seed', enemyMode: 'CARDS' });
            const ymir = state.playerParty[0];
            const barkShield = ymir.statusEffects.find(s => s.type === 'BarkShield');
            expect(barkShield?.stacks, 'Ymir has 4 Bark Shield on turn 1').toBe(4);
        });

        it('2. A party with a member at persistedHp 0 opens on living-units draw count', () => {
            const state = createBattleState(gauntletBattleSetup(), ['kraken'], undefined, { seed: 'battle-seed', enemyMode: 'CARDS' });
            // fenrir alone alive: 4 cardDraw. Both alive would be 4 + 4 - 2 + 1 = 7.
            expect(state.playerDeck.hand.length).toBe(4);
        });

        it('3. cardsDrawnThisTurn on turn 1 equals the opening draw', () => {
            const state = createBattleState(ymirBattleSetup(), ['fenrir'], undefined, { seed: 'battle-seed', enemyMode: 'CARDS' });
            expect(state.cardsDrawnThisTurn).toBe(state.playerDeck.hand.length);
            expect(state.cardsDrawnThisTurn).toBeGreaterThan(0);
        });
    });

    describe('buildScenarioState (sim twin)', () => {
        it('1. Ymir player gains Bark Shield on turn 1 via onTurnStart hook', () => {
            const state = buildScenarioState(ymirScenarioSetup());
            const ymir = state.playerParty[0];
            const barkShield = ymir.statusEffects.find(s => s.type === 'BarkShield');
            expect(barkShield?.stacks, 'Ymir has 4 Bark Shield on turn 1').toBe(4);
        });

        it('2. A party with a member at currentHp 0 opens on living-units draw count', () => {
            const state = buildScenarioState(gauntletScenarioSetup());
            expect(state.playerDeck.hand.length).toBe(4);
        });

        it('3. cardsDrawnThisTurn on turn 1 equals the opening draw', () => {
            const state = buildScenarioState(ymirScenarioSetup());
            expect(state.cardsDrawnThisTurn).toBe(state.playerDeck.hand.length);
            expect(state.cardsDrawnThisTurn).toBeGreaterThan(0);
        });
    });
});
