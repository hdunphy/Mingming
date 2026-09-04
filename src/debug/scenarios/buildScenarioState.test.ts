/**
 * Materializer tests.
 *
 * The headline case is determinism: same setup + same seed => deep-equal normalized
 * `IBattleState`, ids included. Comparison is structural (`toEqual`), never
 * `JSON.stringify` - the normalizer canonicalizes which keys are present, but not the
 * order they were inserted in, so a string compare would fail on key order alone.
 *
 * The rest guard the bypass itself: the properties `createBattleState` cannot express
 * (per-enemy level, per-enemy maxHp, starting statuses, enemyMode) are the reason this
 * module exists, so each gets a test.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildScenarioState } from './buildScenarioState';
import { BattleStateSchema } from './scenarioSchema';
import type { ComposedSetup } from './scenarioSchema';
import type { IMove } from '../../engine/types';
import { GetMingmingData } from '../../engine/data/mingmingRegistry';

function makeSetup(overrides: Partial<ComposedSetup> = {}): ComposedSetup {
    return {
        seed: 'scenario-seed-0001',
        enemyMode: 'MOVES',
        player: {
            party: [
                {
                    definitionId: 'fenrir',
                    attackIV: 7,
                    defenseIV: 11,
                    hpIV: 21,
                },
                {
                    definitionId: 'kraken',
                    attackIV: 0,
                    defenseIV: 31,
                    hpIV: 4,
                },
            ],
            deck: [
                'fire_poke',
                'fire_punch_v2',
                'cinder_slash',
                'brute_force',
                'fury_strike',
                'scorch',
                'ignite',
                'strength_burst',
            ],
            relics: [],
        },
        enemies: [
            {
                definitionId: 'draugr',
                attackIV: 15,
                defenseIV: 15,
                hpIV: 15,
                deck: ['fire_poke', 'scorch'],
            },
        ],
        ...overrides,
    };
}

describe('buildScenarioState - determinism', () => {
    it('produces deep-equal states for the same setup and seed', () => {
        const setup = makeSetup();

        const first = buildScenarioState(setup);
        const second = buildScenarioState(setup);

        // Structural, not stringified: key order is not canonicalized.
        expect(second).toEqual(first);
    });

    it('is id-stable across rebuilds', () => {
        const setup = makeSetup({ enemyMode: 'CARDS' });

        const first = buildScenarioState(setup);
        const second = buildScenarioState(setup);

        expect(second.playerParty.map(e => e.id)).toEqual(first.playerParty.map(e => e.id));
        expect(second.enemyParty.map(e => e.id)).toEqual(first.enemyParty.map(e => e.id));
        expect(second.playerDeck.hand.map(c => c.id)).toEqual(first.playerDeck.hand.map(c => c.id));
        expect(second.playerDeck.drawpile.map(c => c.id)).toEqual(
            first.playerDeck.drawpile.map(c => c.id),
        );
        expect(second.enemyDeck.hand.map(c => c.id)).toEqual(first.enemyDeck.hand.map(c => c.id));

        // Ids are seeded, so they are also collision-free within one build.
        const allIds = [
            ...first.playerParty.map(e => e.id),
            ...first.enemyParty.map(e => e.id),
            ...first.playerDeck.drawpile.map(c => c.id),
            ...first.playerDeck.hand.map(c => c.id),
            ...first.enemyDeck.drawpile.map(c => c.id),
            ...first.enemyDeck.hand.map(c => c.id),
        ];
        expect(new Set(allIds).size).toBe(allIds.length);
    });

    it('separates two different seeds', () => {
        const a = buildScenarioState(makeSetup({ seed: 'seed-a' }));
        const b = buildScenarioState(makeSetup({ seed: 'seed-b' }));

        expect(b.playerParty[0].id).not.toBe(a.playerParty[0].id);
        expect(b.sessionId).not.toBe(a.sessionId);
    });

    it('derives sessionId from the seed rather than the clock', () => {
        expect(buildScenarioState(makeSetup()).sessionId).toBe('battle_scenario-seed-0001');
    });
});

describe('buildScenarioState - the createBattleState bypass', () => {
    it('honours per-entity IVs verbatim', () => {
        const state = buildScenarioState(makeSetup());

        expect(state.playerParty[1]).toMatchObject({
            attackIV: 0,
            defenseIV: 31,
            hpIV: 4,
        });
    });

    it('builds exactly the listed enemies, in order', () => {
        const setup = makeSetup();
        setup.enemies = [
            { definitionId: 'draugr', attackIV: 0, defenseIV: 0, hpIV: 0 },
            { definitionId: 'ymir', attackIV: 0, defenseIV: 0, hpIV: 0 },
            { definitionId: 'skoll', attackIV: 0, defenseIV: 0, hpIV: 0 },
        ];

        const state = buildScenarioState(setup);

        expect(state.enemyParty.map(e => e.definitionId)).toEqual(['draugr', 'ymir', 'skoll']);
    });
});

describe('buildScenarioState - per-entity overrides', () => {
    it('applies maxHpOverride to both maxHp and currentHp', () => {
        const setup = makeSetup();
        setup.enemies[0].maxHpOverride = 4;

        const state = buildScenarioState(setup);

        expect(state.enemyParty[0].maxHp).toBe(4);
        expect(state.enemyParty[0].currentHp).toBe(4);
    });

    it('lets currentHp win over the maxHpOverride-derived full HP', () => {
        const setup = makeSetup();
        setup.enemies[0].maxHpOverride = 100;
        setup.enemies[0].currentHp = 1;

        const state = buildScenarioState(setup);

        expect(state.enemyParty[0].maxHp).toBe(100);
        expect(state.enemyParty[0].currentHp).toBe(1);
    });

    it('clamps a currentHp above maxHp and warns', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const setup = makeSetup();
        setup.enemies[0].maxHpOverride = 10;
        setup.enemies[0].currentHp = 9999;

        const state = buildScenarioState(setup);

        expect(state.enemyParty[0].currentHp).toBe(10);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('defaults currentHp to full when omitted', () => {
        const state = buildScenarioState(makeSetup());

        for (const entity of [...state.playerParty, ...state.enemyParty]) {
            expect(entity.currentHp).toBe(entity.maxHp);
        }
    });

    it('applies starting statusEffects', () => {
        const setup = makeSetup();
        setup.player.party[0].statusEffects = [{ id: 'st1', type: 'Burn', stacks: 3 }];

        const state = buildScenarioState(setup);

        expect(state.playerParty[0].statusEffects).toEqual([
            { id: 'st1', type: 'Burn', stacks: 3 },
        ]);
        expect(state.playerParty[1].statusEffects).toEqual([]);
    });

    it('applies a custom moveset and leaves the key absent otherwise', () => {
        const setup = makeSetup();
        const moves: IMove[] = [
            {
                id: 'test_slam',
                name: 'Test Slam',
                intentType: 'Attack' as const,
                priority: 1,
                actions: [{ type: 'ATTACK' as const, power: 9, target: 'Single' }],
            },
        ];
        setup.enemies[0].moves = moves;

        const state = buildScenarioState(setup);

        expect(state.enemyParty[0].moves).toEqual(moves);
        // Strip class: absent when not supplied.
        expect('moves' in state.playerParty[0]).toBe(false);
    });

    it('applies activeOS, and otherwise falls back to the definition default', () => {
        const setup = makeSetup();
        setup.player.party[0].activeOS = 'fenrir_v2';

        const state = buildScenarioState(setup);

        expect(state.playerParty[0].activeOS).toBe('fenrir_v2');
        expect(state.playerParty[1].activeOS).toBe(GetMingmingData('kraken').availableOS[0]);
    });
});

describe('buildScenarioState - decks, relics and enemyMode', () => {
    it('expands the player deck into instances and deals an opening hand', () => {
        const setup = makeSetup();
        const state = buildScenarioState(setup);

        const dealt = state.playerDeck.hand.length + state.playerDeck.drawpile.length;
        expect(dealt).toBe(setup.player.deck.length);
        expect(state.playerDeck.hand.length).toBeGreaterThan(0);
        expect(state.playerDeck.ownerId).toBe('PLAYER');

        // Every dataId came from the scenario, and instances carry real costs.
        for (const card of [...state.playerDeck.hand, ...state.playerDeck.drawpile]) {
            expect(setup.player.deck).toContain(card.dataId);
            expect(typeof card.currentCost).toBe('number');
        }
    });

    it('MOVES mode telegraphs intents and leaves the enemy deck undealt', () => {
        const state = buildScenarioState(makeSetup({ enemyMode: 'MOVES' }));

        expect(state.enemyMode).toBe('MOVES');
        expect(state.enemyDeck.drawpile).toEqual([]);
        expect(state.enemyDeck.hand).toEqual([]);
        expect(state.enemyParty[0].currentIntent).not.toBeNull();
    });

    it('CARDS mode deals the enemy a hand from the per-enemy decks', () => {
        const setup = makeSetup({ enemyMode: 'CARDS' });
        setup.enemies = [
            {
                definitionId: 'draugr',
                attackIV: 0,
                defenseIV: 0,
                hpIV: 0,
                deck: ['fire_poke', 'scorch'],
            },
            {
                definitionId: 'ymir',
                attackIV: 0,
                defenseIV: 0,
                hpIV: 0,
                deck: ['ignite'],
            },
        ];

        const state = buildScenarioState(setup);

        expect(state.enemyMode).toBe('CARDS');
        const total = state.enemyDeck.hand.length + state.enemyDeck.drawpile.length;
        expect(total).toBe(3);
        expect(state.enemyDeck.hand.length).toBeGreaterThan(0);
        // No intents in CARDS mode - the normalizer's fill class leaves them null.
        expect(state.enemyParty[0].currentIntent).toBeNull();
    });

    it('threads relics onto activeRelics and applies their battle-start bonuses', () => {
        const plain = buildScenarioState(makeSetup());
        const setup = makeSetup();
        setup.player.relics = ['heatsink', 'expansion_slot'];
        const buffed = buildScenarioState(setup);

        expect(buffed.activeRelics).toEqual(['heatsink', 'expansion_slot']);
        expect(buffed.playerParty[0].maxEnergy).toBe(plain.playerParty[0].maxEnergy + 1);
        expect(buffed.playerParty[0].cardDraw).toBe(plain.playerParty[0].cardDraw + 1);
        // Enemies never receive player relics.
        expect(buffed.enemyParty[0].cardDraw).toBe(plain.enemyParty[0].cardDraw);
    });

    it('warns and continues on an unknown relic', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const setup = makeSetup();
        setup.player.relics = ['no_such_relic'];

        expect(() => buildScenarioState(setup)).not.toThrow();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});

describe('buildScenarioState - canonical form and guards', () => {
    it('returns a state already in normalized form', () => {
        const state = buildScenarioState(makeSetup());

        expect(state.lastStatusConsumed).toBe(0);
        expect(state.elementPlays).toBeDefined();
        expect(Object.values(state.elementPlays!).every(v => v === 0)).toBe(true);
        for (const entity of [...state.playerParty, ...state.enemyParty]) {
            expect(entity.relicBonuses).toBeDefined();
            expect(entity.hooks).toEqual([]);
            expect(entity.playsThisTurn).toBe(0);
            expect(entity.currentIntent !== undefined).toBe(true);
        }
    });

    it('produces a state the snapshot schema accepts', () => {
        const result = BattleStateSchema.safeParse(buildScenarioState(makeSetup()));
        expect(result.success).toBe(true);
    });

    it('throws on an empty player party', () => {
        const setup = makeSetup();
        setup.player.party = [];
        expect(() => buildScenarioState(setup)).toThrow(/player party/);
    });

    it('throws on an empty enemy list', () => {
        const setup = makeSetup();
        setup.enemies = [];
        expect(() => buildScenarioState(setup)).toThrow(/no enemies/i);
    });
});
