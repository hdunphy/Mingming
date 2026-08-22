import { describe, it, expect, beforeEach } from 'vitest';
import type { IBattleState } from './types';
import { ActionExecutorRegistry } from './actions/ActionExecutors';
import { createMockEntity } from './data/battleFactories';
import { SeedStream } from './core/SeedStream';

describe('Advanced Archetypes Logic', () => {
    let initialState: IBattleState;

    beforeEach(() => {
        // Fixed seed: createMockEntity rolls random IVs by default, which made the
        // CARDS_DRAWN test below flaky under docs/power_curve_spec.md rev 3 (a low,
        // unscaled power value can now floor to exactly 0 damage before any IV-driven
        // attack/defense variance, where the old formula's flat +2 guaranteed a nonzero
        // floor regardless of stats).
        // Distinct seeds - the same seed for both would also make `rng.nextId('mm')` mint
        // the same entity id for player and enemy, breaking every id-based lookup.
        const player = createMockEntity('Player', 'fenrir', new SeedStream('new-archetypes-test-player'));
        const enemy = createMockEntity('Enemy', 'fenrir', new SeedStream('new-archetypes-test-enemy'));

        initialState = {
            sessionId: 'test',
            seed: 'seed',
            turn: 1,
            phase: 'ACTION',
            activeSide: 'PLAYER',
            logs: [],
            osLogs: [],
            procs: [],
            playerParty: [player],
            enemyParty: [enemy],
            playerDeck: { ownerId: 'PLAYER', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
            enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand: [], discard: [], exhaust: [] },
            cardsPlayedThisTurn: 0,
            cardsDrawnThisTurn: 0,
            lastProgramPlayed: null,
        counters: {},
            activeRelics: []
        };
    });

    it('MULTIPLY_STATUS should double status stacks', () => {
        // 1. Give enemy some Poison
        const enemy = { ...initialState.enemyParty[0] };
        const state: IBattleState = {
            ...initialState,
            enemyParty: [{
                ...enemy,
                statusEffects: [{ id: 'poison-1', type: 'Poison', stacks: 2 }]
            }]
        };

        const action: any = {
            type: 'MULTIPLY_STATUS',
            status: 'Poison',
            factor: 2
        };

        const executor = ActionExecutorRegistry['MULTIPLY_STATUS'];
        const nextState = executor.execute(state, state.playerParty[0].id, state.enemyParty[0].id, action, undefined, {} as any);

        expect(nextState.enemyParty[0].statusEffects.find(s => s.type === 'Poison')?.stacks).toBe(4);
    });

    it('TRIGGER_STATUS should deal poison damage immediately', () => {
        // 1. Give enemy Poison
        const enemy = { ...initialState.enemyParty[0] };
        const state: IBattleState = {
            ...initialState,
            enemyParty: [{
                ...enemy,
                statusEffects: [{ id: 'poison-1', type: 'Poison', stacks: 5 }]
            }]
        };

        const action: any = {
            type: 'TRIGGER_STATUS',
            status: 'Poison'
        };

        const executor = ActionExecutorRegistry['TRIGGER_STATUS'];
        const nextState = executor.execute(state, state.playerParty[0].id, state.enemyParty[0].id, action, undefined, {} as any);

        // Poison behavior: damage = stacks, then decrement stacks
        expect(nextState.enemyParty[0].currentHp).toBeLessThan(initialState.enemyParty[0].currentHp);
        expect(nextState.logs.some(l => l.includes('☣️ Poison'))).toBe(true);
    });

    it('PLAY_LAST_CARD should repeat the previous card actions', () => {
        // 1. Mock a "Test Strike" played previously
        const state: IBattleState = {
            ...initialState,
            lastProgramPlayed: 'test_strike'
        };

        const action: any = {
            type: 'PLAY_LAST_CARD'
        };

        const executor = ActionExecutorRegistry['PLAY_LAST_CARD'];
        const nextState = executor.execute(state, state.playerParty[0].id, state.enemyParty[0].id, action, undefined, {} as any);

        // Test Strike deals damage. Check if enemy HP dropped.
        expect(nextState.enemyParty[0].currentHp).toBeLessThan(initialState.enemyParty[0].currentHp);
        expect(nextState.logs.some(l => l.includes('🔁 Reprogramming: Test Strike'))).toBe(true);
    });

    it('CARDS_DRAWN scaling should increase damage, without a ceiling', () => {
        // Compare a x10 multiplier against a x1 baseline rather than a hardcoded magic
        // number: docs/power_curve_spec.md rev 3 dropped calculateDamage's flat +2 floor,
        // so a low, off-curve power value (this test used power=5) can now floor to exactly
        // 0 before any scaling - 0 * 10 is still 0, which made this test flaky depending on
        // the entity's random IVs. Power=30 plus the fixed seed set in beforeEach keeps the
        // baseline reliably nonzero (5 damage) without the x10 hit (50) overkilling fenrir's
        // 60 maxHp - overkill would clamp `damageDealt` at the enemy's remaining HP and break
        // the clean x10 relationship this test checks. The comparison itself doesn't need
        // re-deriving every time the curve is retuned again, only this margin does.
        //
        // Ticket 73 capped this at 2 and ticket 74 REMOVED that cap: Henry's call is that a
        // ceiling makes playing well feel bad, and the measurement agreed it was the wrong
        // lever (it cost kraken_v1 6 points of field to barely slow jormungandr_v1). The
        // first-turn kill was fixed at OUROBOROS_LOOP instead. So x10 buys x10 again, and
        // this test is back to asserting exactly that.
        const baselineState: IBattleState = { ...initialState, cardsDrawnThisTurn: 1 };
        const scaledState: IBattleState = { ...initialState, cardsDrawnThisTurn: 10 };
        const action: any = { type: 'ATTACK', power: 30, scaling: 'CARDS_DRAWN' };
        const executor = ActionExecutorRegistry['ATTACK'];

        const baselineNext = executor.execute(baselineState, baselineState.playerParty[0].id, baselineState.enemyParty[0].id, action, undefined, {} as any);
        const scaledNext = executor.execute(scaledState, scaledState.playerParty[0].id, scaledState.enemyParty[0].id, action, undefined, {} as any);

        const baselineDamage = initialState.enemyParty[0].currentHp - baselineNext.enemyParty[0].currentHp;
        const scaledDamage = initialState.enemyParty[0].currentHp - scaledNext.enemyParty[0].currentHp;

        expect(baselineDamage).toBeGreaterThan(0);
        expect(scaledDamage).toBe(baselineDamage * 10);
    });
});
