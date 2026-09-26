/**
 * THE ENEMY'S FIRST TURN IS ONE HAND, NOT TWO — Henry, 2026-09-25, off the Rootfall playtest.
 *
 * `createBattleState` used to deal BOTH sides an opening hand. The player's is spent on turn 1 and
 * discarded at its end; the enemy's sat untouched through the player's turn, and the refill in
 * `processPreTurn` then drew a second hand on top of it. Every enemy's first turn held eight cards
 * against the player's four — Sköll played all eight on its first turn in both playtest fights, and
 * in fight two that was three Ember Jabs, an Ignite and a Flashover at four Burn: 502 damage (45% of
 * Fenrir's pool) before the player's second hand.
 *
 * Pinned through the REAL factory and the REAL reducer, not a sparse fixture: the bug lived in the
 * seam between the two, and a fixture that builds the state by hand cannot see a seam. The scenario
 * builder the balance sims use is checked the same way, because it is a second copy of the factory
 * and it carried the same deal.
 */

import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { createBattleState } from './data/battleFactories';
import { createMingmingInstance } from './gameTypes';
import { buildScenarioState } from '../debug/scenarios/buildScenarioState';
import { initializeBattleEntity } from './types';
import { GetMingmingData } from './data/mingmingRegistry';
import type { IBattleState } from './types';
import type { ComposedSetup } from '../debug/scenarios/scenarioSchema';

/** Fight two of the 09-25 playtest: fenrir_v2's start deck against Sköll's start-kit-plus-generics. */
const PLAYER_DECK = ['cinder_lance', 'ember_jab', 'ignite', 'ignite', 'slag_strike', 'tackle', 'tackle', 'tackle'];
const ENEMY_DECK = ['ember_jab', 'ember_jab', 'brand', 'ignite', 'flashover', 'tackle', 'tackle', 'tackle'];

function sideDraw(state: IBattleState, side: 'playerParty' | 'enemyParty'): number {
    const party = state[side];
    return party.reduce((sum, e) => sum + e.cardDraw, 0) - party.length + 1;
}

function realBattle(seed: string): IBattleState {
    const fenrir = { ...createMingmingInstance('fenrir'), activeOS: 'fenrir_v2' };
    const skoll = initializeBattleEntity(createMingmingInstance('skoll'), GetMingmingData('skoll'));
    return createBattleState(
        {
            party: [fenrir],
            deck: PLAYER_DECK,
            drivers: [],
            persistedHp: {},
            encounter: { enemyParty: [skoll], enemyDeckIds: ENEMY_DECK },
        },
        [],
        undefined,
        { seed, enemyMode: 'CARDS' },
    );
}

describe('the enemy is not dealt an opening hand', () => {
    it('opens with the player holding a hand and the enemy holding none', () => {
        const state = realBattle('first-hand:open');
        expect(state.activeSide).toBe('PLAYER');
        expect(state.playerDeck.hand).toHaveLength(sideDraw(state, 'playerParty'));
        expect(state.enemyDeck.hand).toHaveLength(0);
        expect(state.enemyDeck.drawpile).toHaveLength(ENEMY_DECK.length);
    });

    it("draws exactly one hand at the enemy's first turn, over many seeds", () => {
        for (let i = 0; i < 40; i += 1) {
            const opened = realBattle(`first-hand:${i}`);
            const enemyTurn = battleReducer(opened, { type: 'END_TURN' });
            expect(enemyTurn.activeSide).toBe('ENEMY');
            // One hand — the same count the player was dealt, and the same count every later turn draws.
            expect(enemyTurn.enemyDeck.hand).toHaveLength(sideDraw(enemyTurn, 'enemyParty'));
        }
    });

    it('the scenario builder the sims use agrees (it is a second copy of the factory)', () => {
        const state = buildScenarioState({
            seed: 'first-hand:scenario',
            enemyMode: 'CARDS',
            player: {
                party: [{ definitionId: 'fenrir', activeOS: 'fenrir_v2', attackIV: 15, defenseIV: 15, hpIV: 15 }],
                deck: PLAYER_DECK,
                drivers: [],
            },
            enemies: [{ definitionId: 'skoll', attackIV: 10, defenseIV: 10, hpIV: 10, deck: ENEMY_DECK }],
        } as ComposedSetup);
        expect(state.enemyDeck.hand).toHaveLength(0);
        const enemyTurn = battleReducer(state, { type: 'END_TURN' });
        expect(enemyTurn.enemyDeck.hand).toHaveLength(sideDraw(enemyTurn, 'enemyParty'));
    });
});
