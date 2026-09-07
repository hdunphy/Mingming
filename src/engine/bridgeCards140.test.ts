/**
 * TICKET 140 — the three bridge cards, and the one thing that can silently break them.
 *
 * WHY THIS FILE EXISTS. All three cards in ticket 140 are WIDTH cards: they are deliberately under
 * the 1v1 curve and only pay for themselves when they land on three bodies. That makes them
 * uniquely vulnerable to the defect the 2026-09-05 playtest found in a different corner of the
 * engine — a `Side` card resolving on a single target. Nothing about that failure is visible in
 * the log or the card text; the effect simply lands once, and the card reads as merely weak rather
 * than as broken. `actionTargetIds` is now the single answer for every resolution path, and these
 * tests are what fails if a future path stops asking it.
 *
 * WHAT EACH CARD IS FOR (ticket 140 §2-4):
 *   chorus         — the zoo bridge: an effect-draw (kraken's ABYSSAL_INK reads it), a buff on the
 *                    whole party (huldra's ALLURE mirrors it), and Sharp on three bodies.
 *   spreading_rot  — the control bridge: the castable 1e version of `toxic_cloud` (3e, uncastable
 *                    on a 2-Energy frame), feeding jormungandr_v2's uncapped, non-consuming reader.
 *   tidal_battery  — the ramp bridge: one spare Energy on every body, so the Fire hammer and the
 *                    Water hammer can fire on the same turn. Henry ruled it side-wide at 1 stack
 *                    rather than the ticket's "you and one ally at 2", because the engine has no
 *                    single-ally card target and 1 stack keeps it a strictly WORSE Capacitor at 1v1.
 */
import { describe, it, expect } from 'vitest';
import { battleReducer } from './battleReducer';
import { getBestAction } from './ai/TacticalAI';
import { createSparseBattleState, createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import { ProgramRegistry } from './data/programRegistry';
import type { IBattleState, IBattleEntity } from './types';

const FRAME = 1000;

function body(id: string, name: string): IBattleEntity {
    return createSparseEntity({ id, name, currentHp: FRAME, maxHp: FRAME, currentEnergy: 3, maxEnergy: 3 });
}

/** A 3v3 board with one card in hand, played by `p1` at `targetId`. */
function play(dataId: string, targetId: string): IBattleState {
    let state: IBattleState = createSparseBattleState({
        activeSide: 'PLAYER',
        phase: 'ACTION',
        playerParty: [body('p1', 'Alpha'), body('p2', 'Beta'), body('p3', 'Gamma')],
        enemyParty: [body('e1', 'Foe A'), body('e2', 'Foe B'), body('e3', 'Foe C')],
        playerDeck: {
            ownerId: 'PLAYER', deck: [], drawpile: [{ id: 'd1', dataId: 'forage', currentCost: 0, isPlayable: true }],
            discard: [], exhaust: [],
            hand: [{ id: 'h1', dataId, currentCost: ProgramRegistry[dataId].baseCost as number, isPlayable: true }],
        },
    });
    state = battleReducer(state, {
        type: 'PLAY_PROGRAM',
        payload: { sourceId: 'p1', targetId, programId: 'h1' },
    } as never);
    return state;
}

const stacks = (e: IBattleEntity, type: string): number =>
    e.statusEffects.filter(s => s.type === type).reduce((n, s) => n + s.stacks, 0);

describe('ticket 140 — the bridge cards are registered and priced as written', () => {
    it.each([
        ['chorus', 'Nature', 1, 'Side'],
        ['spreading_rot', 'Water', 1, 'Side'],
        ['tidal_battery', 'Water', 2, 'Side'],
    ])('%s is a %s card at %ie targeting %s', (id, element, cost, target) => {
        const card = ProgramRegistry[id as string];
        expect(card).toBeDefined();
        expect(card.element).toBe(element);
        expect(card.baseCost).toBe(cost);
        expect(card.target).toBe(target);
    });

    it('tidal_battery is a WORSE capacitor at 1v1 — 1 Energized against 3, for the same 2 Energy', () => {
        const battery = ProgramRegistry.tidal_battery.actions.find(a => a.status === 'Energized');
        const capacitor = ProgramRegistry.capacitor.actions.find(a => a.status === 'Energized');
        expect(ProgramRegistry.tidal_battery.baseCost).toBe(ProgramRegistry.capacitor.baseCost);
        expect(battery?.stacks).toBeLessThan(capacitor?.stacks as number);
    });
});

describe('ticket 140 — every bridge card lands on all three bodies, not one', () => {
    it('chorus gives the whole aimed side 1 Sharp, and draws for its caster', () => {
        const state = play('chorus', 'p2');
        expect(state.playerParty.map(e => stacks(e, 'Sharp'))).toEqual([1, 1, 1]);
        // The draw is the caster's, not the side's — and it is an effect-draw, which is what
        // ABYSSAL_INK reads.
        expect(state.playerDeck.hand.map(c => c.dataId)).toEqual(['forage']);
        expect(state.enemyParty.every(e => stacks(e, 'Sharp') === 0)).toBe(true);
    });

    it('spreading_rot puts 2 Poison on every enemy', () => {
        const state = play('spreading_rot', 'e2');
        expect(state.enemyParty.map(e => stacks(e, 'Poison'))).toEqual([2, 2, 2]);
        expect(state.playerParty.every(e => stacks(e, 'Poison') === 0)).toBe(true);
    });

    it('tidal_battery gives every ally 1 Energized', () => {
        const state = play('tidal_battery', 'p3');
        expect(state.playerParty.map(e => stacks(e, 'Energized'))).toEqual([1, 1, 1]);
        expect(state.enemyParty.every(e => stacks(e, 'Energized') === 0)).toBe(true);
    });

    it('a dead body is not paid — the side is the LIVING side', () => {
        let state: IBattleState = createSparseBattleState({
            activeSide: 'PLAYER',
            phase: 'ACTION',
            playerParty: [
                body('p1', 'Alpha'),
                createSparseEntity({ id: 'p2', name: 'Beta', currentHp: 0, maxHp: FRAME, currentEnergy: 3 }),
                body('p3', 'Gamma'),
            ],
            enemyParty: [body('e1', 'Foe A')],
            playerDeck: {
                ownerId: 'PLAYER', deck: [], drawpile: [], discard: [], exhaust: [],
                hand: [{ id: 'h1', dataId: 'tidal_battery', currentCost: 2, isPlayable: true }],
            },
        });
        state = battleReducer(state, {
            type: 'PLAY_PROGRAM',
            payload: { sourceId: 'p1', targetId: 'p1', programId: 'h1' },
        } as never);
        expect(state.playerParty.map(e => stacks(e, 'Energized'))).toEqual([1, 0, 1]);
    });
});

/**
 * THE OTHER SILENT FAILURE. A `Side` card may be aimed at EITHER side (`targeting.ts`), which is
 * what makes an ally-wide buff expressible at all without an engine change — and also what makes
 * it possible for the search to hand the enemy party a stack of Sharp and call it a play. The AI
 * decides this by score alone, so nothing in the data says which way it goes; only a measurement
 * does.
 */
describe('ticket 140 — the search aims each bridge card at the side it is for', () => {
    function chosenTarget(dataId: string): string {
        const state: IBattleState = createSparseBattleState({
            activeSide: 'PLAYER',
            phase: 'ACTION',
            playerParty: [body('p1', 'Alpha'), body('p2', 'Beta'), body('p3', 'Gamma')],
            enemyParty: [body('e1', 'Foe A'), body('e2', 'Foe B'), body('e3', 'Foe C')],
            playerDeck: {
                ownerId: 'PLAYER', deck: [],
                drawpile: [{ id: 'd1', dataId: 'forage', currentCost: 0, isPlayable: true }],
                discard: [], exhaust: [],
                hand: [{ id: 'h1', dataId, currentCost: ProgramRegistry[dataId].baseCost as number, isPlayable: true }],
            },
        });
        const action = getBestAction(state) as { type: string; payload?: { targetId?: string } };
        expect(action.type).toBe('PLAY_PROGRAM');
        return action.payload?.targetId ?? '';
    }

    it('aims the two buffs at its own side and the Poison at the enemy', () => {
        expect(chosenTarget('chorus')).toMatch(/^p/);
        expect(chosenTarget('tidal_battery')).toMatch(/^p/);
        expect(chosenTarget('spreading_rot')).toMatch(/^e/);
    });
});
