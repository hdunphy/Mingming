import { describe, it, expect } from 'vitest';
import type { IBattleState, IBattleEntity, ProgramEntity, StatusEffectInstance } from './types';
import { battleReducer, getEffectiveCardCost } from './battleReducer';
import { GetProgramData } from './data/programRegistry';
import { runOne } from '../debug/balance/runBatch';
import { osVarianceScenario } from '../debug/balance/balanceScenarios';

/**
 * Ticket 22 - the X-cost mechanic and the two scalings it feeds.
 *
 * `"baseCost": "X"` means "costs ALL of the source's current Energy, minimum 1",
 * resolved per play by getEffectiveCardCost - which is also what the AI and the UI
 * cost pip call, so none of the three can disagree about what an X card costs.
 * The energy actually paid is recorded as `lastEnergySpent` and read by
 * ENERGY_SPENT_SQUARED (Thermal Lance).
 *
 * TICKET 136j: Firestorm Talon is NO LONGER an X card. It was `10 power x target's Burn x
 * Energy spent` - two multipliers on one card, which is why the Burn-permanence ticket (93)
 * had to cut its power to hold it - and it is now a flat 2 Energy at 25 power per stack of
 * BURN_STACKS. One multiplier, bounded by `BURN_CONFIG.maxStacks` (4) rather than by the pile
 * AND the energy. Its test below moved with it and keeps the two assertions that still mean
 * something: zero Burn deals zero, and the damage is linear in the pile.
 *
 * WORTH KNOWING: that leaves **BURN_TIMES_ENERGY with no card in the registry**. The engine
 * branch is still there and still correct; it is simply unused, and it is a deletion candidate
 * for whoever next audits dead scalings. Not deleted here - removing an engine path is not
 * this ticket's ruling.
 */

const unit = (id: string, name: string, overrides: Partial<IBattleEntity> = {}): IBattleEntity => ({
    id, name,
    currentHp: 100000, maxHp: 100000, tempHp: 0,
    attack: 10, defense: 10,
    maxEnergy: 5, currentEnergy: 2,
    // Level 20, not 1: under the rev-3.3 curve an 11-power card at level 1 floors to 0
    // damage, which would make the CARDS_DISCARDED assertion meaningless.
    cardDraw: 3,
    statusEffects: [], definitionId: 'hraesvelgr', hooks: [], speed: 10,
    primaryElement: 'Air', daemons: [], blueprintsCollected: 0,
    hpIV: 0, attackIV: 0, defenseIV: 0,
    ...overrides
});

const entity = (id: string, dataId: string, cost: number): ProgramEntity =>
    ({ id, dataId, currentCost: cost, isPlayable: true } as ProgramEntity);

function stateWith(hand: ProgramEntity[], energy: number, enemyOverrides: Partial<IBattleEntity> = {}): IBattleState {
    return {
        sessionId: 'test-session',
        turn: 1,
        phase: 'ACTION',
        activeSide: 'PLAYER',
        activeRelics: [],
        playerParty: [unit('p1', 'Hraesvelgr', { currentEnergy: energy })],
        enemyParty: [unit('e1', 'Enemy', { definitionId: 'fenrir', primaryElement: 'None', ...enemyOverrides })],
        playerDeck: { ownerId: 'PLAYER', hand, drawpile: [], discard: [], exhaust: [], deck: [] },
        enemyDeck: { ownerId: 'ENEMY', hand: [], drawpile: [], discard: [], exhaust: [], deck: [] },
        logs: [], osLogs: [], procs: [],
        seed: '12345',
        cardsPlayedThisTurn: 0,
        cardsDrawnThisTurn: 0,
        cardsDiscardedThisTurn: 0,
        lastProgramPlayed: null,
        counters: {}
    } as unknown as IBattleState;
}

const play = (state: IBattleState, programId: string): IBattleState =>
    battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId: 'p1', targetId: 'e1', programId } });

const damageDealt = (before: IBattleState, after: IBattleState) =>
    before.enemyParty[0].currentHp - after.enemyParty[0].currentHp;

describe('X-cost cards (ticket 22)', () => {
    it('costs ALL of the source current Energy', () => {
        const before = stateWith([entity('c1', 'thermal_lance', 0)], 2);
        const after = play(before, 'c1');

        expect(after.playerParty[0].currentEnergy).toBe(0);
        expect(after.lastEnergySpent).toBe(2);
    });

    it('prices at the source Energy, whatever that is right now', () => {
        const source = unit('p1', 'Hraesvelgr', { currentEnergy: 3 });
        const lance = GetProgramData('thermal_lance');

        expect(getEffectiveCardCost(source, lance, 0)).toBe(3);
        expect(getEffectiveCardCost({ ...source, currentEnergy: 1 }, lance, 0)).toBe(1);
    });

    it('has a floor of 1 Energy, so it can never be played for free', () => {
        const broke = unit('p1', 'Hraesvelgr', { currentEnergy: 0 });
        expect(getEffectiveCardCost(broke, GetProgramData('thermal_lance'), 0)).toBe(1);

        // ...and at 0 Energy the energy constraint therefore rejects the play outright.
        const before = stateWith([entity('c1', 'thermal_lance', 0)], 0);
        const after = play(before, 'c1');
        expect(after.playerDeck.hand).toHaveLength(1);
        expect(damageDealt(before, after)).toBe(0);
    });

    it('ENERGY_SPENT scales LINEARLY with the Energy spent', () => {
        // Henry's call (ticket 22): Thermal Lance is 35 x X, not 20 x X^2. A quadratic makes
        // the ramp deck the fastest deck - the same problem the exponential power curves had
        // at registry scale (see power_curve_spec rev 3.2, finding 1).
        const atTwo = stateWith([entity('c1', 'thermal_lance', 0)], 2);
        const atThree = stateWith([entity('c1', 'thermal_lance', 0)], 3);

        const dmg2 = damageDealt(atTwo, play(atTwo, 'c1'));
        const dmg3 = damageDealt(atThree, play(atThree, 'c1'));

        expect(dmg2).toBeGreaterThan(0);
        // 3/2 = 1.5x, allowing a point of floor() slack at each step.
        expect(dmg3 / dmg2).toBeGreaterThan(1.4);
        expect(dmg3 / dmg2).toBeLessThan(1.6);
    });

    it('BURN_STACKS deals nothing without Burn, and is linear in the pile (ticket 136j)', () => {
        const noBurn = stateWith([entity('c1', 'firestorm_talon', 0)], 2);
        expect(damageDealt(noBurn, play(noBurn, 'c1'))).toBe(0);

        // Stack-count-only stand-ins: the scaling reads `stacks`, never the instance `id`.
        const burn2 = stateWith([entity('c1', 'firestorm_talon', 0)], 2,
            { statusEffects: [{ type: 'Burn', stacks: 2 }] as unknown as StatusEffectInstance[] });
        const burn4 = stateWith([entity('c1', 'firestorm_talon', 0)], 2,
            { statusEffects: [{ type: 'Burn', stacks: 4 }] as unknown as StatusEffectInstance[] });

        const d2 = damageDealt(burn2, play(burn2, 'c1'));
        const d4 = damageDealt(burn4, play(burn4, 'c1'));
        expect(d2).toBeGreaterThan(0);
        expect(d4 / d2).toBeGreaterThan(1.9);
        expect(d4 / d2).toBeLessThan(2.1);
    });
});

describe('CARDS_DISCARDED scaling (ticket 22)', () => {
    it('counts the cards Tempest sheds, and Carrion Swoop cashes them', () => {
        const before = stateWith([
            entity('c1', 'tempest', 1),
            entity('c2', 'carrion_swoop', 1),
            entity('c3', 'slipstream', 0),
            entity('c4', 'zephyr_strike', 1)
        ], 5);

        const afterTempest = play(before, 'c1');
        // Tempest discards the whole remaining hand, then draws 2 from an empty
        // drawpile that recycles the discard - the COUNTER is what matters here.
        expect(afterTempest.cardsDiscardedThisTurn).toBe(3);

        const swoop = afterTempest.playerDeck.hand.find(c => c.dataId === 'carrion_swoop');
        expect(swoop).toBeDefined();
        const afterSwoop = play(afterTempest, swoop!.id);
        expect(damageDealt(afterTempest, afterSwoop)).toBeGreaterThan(0);
    });

    it('is zero at the start of a turn, so Carrion Swoop is dead without a discard', () => {
        const before = stateWith([entity('c1', 'carrion_swoop', 1)], 2);
        expect(before.cardsDiscardedThisTurn).toBe(0);
        expect(damageDealt(before, play(before, 'c1'))).toBe(0);
    });
});

describe('AI smoke: an X-cost deck does not wedge the search', () => {
    it('runs a full hraesvelgr v1-vs-v2 battle to a decision', () => {
        const result = runOne(osVarianceScenario('hraesvelgr'), 'xcost-smoke', 60);

        expect(result.winner).toBeDefined();
        expect(result.turns).toBeGreaterThan(0);
        expect(result.turns).toBeLessThanOrEqual(60);
    });
});
