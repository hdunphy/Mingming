import { describe, it, expect, vi } from 'vitest';
import { battleReducer } from './battleReducer';
import type { IBattleState, IBattleEntity, ProgramEntity, StatusEffectInstance, StatusType } from './types';
import { registerHook } from './core/Hooks';
import { FIRMWARE_REGISTRY } from './data/firmwareRegistry';
import { initDaemonHooks } from './data/daemonHooks';
import { applyMutations } from './resolutionEngine';
import { TestProgramRegistry } from './data/testProgramRegistry';

// Mock GetProgramData to use the test registry with real-registry fallback
vi.mock('./data/programRegistry', async () => {
    const actual = await vi.importActual<typeof import('./data/programRegistry')>('./data/programRegistry');
    return {
        ...actual,
        GetProgramData: (id: string) => {
            return TestProgramRegistry[id] || actual.GetProgramData(id);
        }
    };
});

const makeUnit = (id: string, name: string, overrides: Partial<IBattleEntity> = {}): IBattleEntity => ({
    id,
    name,
    currentHp: 100,
    maxHp: 100,
    tempHp: 0,
    attack: 10,
    defense: 10,
    maxEnergy: 5,
    currentEnergy: 5,
    cardDraw: 3,
    statusEffects: [],
    definitionId: 'fenrir',
    hooks: [],
    speed: 10,
    primaryElement: 'None',
    daemons: [],
    blueprintsCollected: 0,
    hpIV: 0,
    attackIV: 0,
    defenseIV: 0,
    ...overrides
});

const makeState = (playerParty: IBattleEntity[], enemyParty: IBattleEntity[], hand: ProgramEntity[] = []): IBattleState => ({
    sessionId: 'test-session',
    turn: 1,
    phase: 'ACTION',
    activeSide: 'PLAYER',
    activeRelics: [],
    playerParty,
    enemyParty,
    playerDeck: { ownerId: 'PLAYER', hand, drawpile: [], discard: [], exhaust: [], deck: [] },
    enemyDeck: { ownerId: 'ENEMY', hand: [], drawpile: [], discard: [], exhaust: [], deck: [] },
    logs: [],
    osLogs: [],
    procs: [],
    seed: '12345',
    cardsPlayedThisTurn: 0,
    cardsDrawnThisTurn: 0,
    lastProgramPlayed: null,
    counters: {}
});

const card = (id: string, dataId: string, cost: number): ProgramEntity =>
    ({ id, dataId, currentCost: cost, isPlayable: true });

const play = (state: IBattleState, sourceId: string, targetId: string, programId: string): IBattleState =>
    battleReducer(state, { type: 'PLAY_PROGRAM', payload: { sourceId, targetId, programId } });

// `duration` is not part of StatusEffectInstance; it is kept because the fixture has always
// carried it, so the cast is what lets the extra field through.
const status = (id: string, type: StatusType, stacks: number): StatusEffectInstance =>
    ({ id, type, stacks, duration: -1 } as StatusEffectInstance);

// Register OS + daemon hooks
Object.values(FIRMWARE_REGISTRY).forEach(os => { os.hooks.forEach(h => registerHook(h)); });
initDaemonHooks();

// ---------------------------------------------------------------------------
// Ticket 12: OS rework implementations
// ---------------------------------------------------------------------------

/**
 * TICKET 131c — THESE TESTS WERE DELETED, AND WHY IS WORTH MORE THAN THEY WERE.
 *
 * This block held two tests for **valkyrie_v2's CRUSADER_KERNEL** (+10% Light damage per distinct
 * positive status, so two buff types = +20%). They asserted `buffed === floor(base * 1.2)` and
 * `stacked === floor(base * 1.1)`, and they were GREEN.
 *
 * **CRUSADER_KERNEL does not exist.** `CustomFirmware.ts` records that ticket 53 deleted it and gave
 * the slot to REBIRTH_CYCLE_OS, a data hook on `onDeckShuffled`. There has been no per-buff-type
 * damage bonus in the game since.
 *
 * They passed because the numbers were too small to tell. At the pre-131c scale `smite` on this
 * dummy dealt **4**, and `floor(4 * 1.2)` is also **4** — so an assertion that the OS added 20%
 * was satisfied by an OS that added nothing. The x10 presentation scale made the same hit read 48,
 * `floor(48 * 1.2)` became 57, and the tests finally failed.
 *
 * That is the resolution argument for ticket 131c, found the hard way: **two tests sat green for
 * months certifying a firmware that had been deleted**, because integer rounding at a median hit of
 * 4 damage could not distinguish a 20% bonus from no bonus at all. Anything else hiding in that gap
 * is still hiding.
 *
 * Nothing replaces them here: there is no behaviour left to test. REBIRTH_CYCLE_OS has its own
 * coverage, and `deckReport.ts` was still describing this slot as CRUSADER_KERNEL until now.
 */

describe('Ticket 12/39 - NIDHOGGR v2 BLOOD_SCENT_OS (50% threshold crossings)', () => {
    // Ticket 39 changed what the hook PAYS, not when it fires: +2 Strengthened / +2 Sharp
    // became +1 Energy and a card. The stack version paid ~34 power across a whole game -
    // one 1e card's worth - and it arrived after the kill window had already opened. These
    // tests still pin the trigger conditions; only the payout assertions moved.
    //
    // Asserting on the OS log rather than on Energy wherever a turn boundary is involved:
    // processPreTurn resets currentEnergy at the start of his turn, so Energy granted during
    // the OPPONENT's turn is wiped. That asymmetry is documented and deliberate (ticket 39 §6).
    const nid = () => makeUnit('n1', 'Nidhoggr', { activeOS: 'nidhoggr_v2', currentEnergy: 0 });
    const scentProcs = (state: IBattleState) =>
        state.logs.filter(l => l.includes('BLOOD_SCENT_OS smells blood')).length;

    it('procs when direct damage drops the enemy below 50%', () => {
        let state = makeState([nid()], [makeUnit('e1', 'Enemy', { currentHp: 51 })]);
        state = applyMutations(state, [{ type: 'HP', targetId: 'e1', payload: { amount: 5 } }]);
        expect(state.enemyParty[0].currentHp).toBeLessThan(50);
        expect(scentProcs(state)).toBe(1);
        expect(state.playerParty[0].currentEnergy).toBe(1);
    });

    it('does NOT proc on damage that stays above the line', () => {
        let state = makeState([nid()], [makeUnit('e1', 'Enemy', { currentHp: 90 })]);
        state = applyMutations(state, [{ type: 'HP', targetId: 'e1', payload: { amount: 5 } }]);
        expect(scentProcs(state)).toBe(0);
        expect(state.playerParty[0].currentEnergy).toBe(0);
    });

    it('procs on his OWN crossing (self-inflicted included)', () => {
        let state = makeState([nid()], [makeUnit('e1', 'Enemy')]);
        state = applyMutations(state, [{ type: 'HP', targetId: 'n1', payload: { amount: 55 } }]);
        expect(state.playerParty[0].currentHp).toBeLessThan(50);
        expect(scentProcs(state)).toBe(1);
    });

    it('draws a card as well as granting the Energy', () => {
        let state = makeState([nid()], [makeUnit('e1', 'Enemy', { currentHp: 51 })]);
        state = { ...state, playerDeck: { ...state.playerDeck, drawpile: [card('d1', 'test_strike', 1)] } };
        state = applyMutations(state, [{ type: 'HP', targetId: 'e1', payload: { amount: 5 } }]);
        expect(state.playerDeck.hand).toHaveLength(1);
        expect(state.playerDeck.drawpile).toHaveLength(0);
    });

    it('healing above the line RE-ARMS the scent (anti-heal)', () => {
        let state = makeState([nid()], [makeUnit('e1', 'Enemy', { currentHp: 51 })]);
        state = applyMutations(state, [{ type: 'HP', targetId: 'e1', payload: { amount: 5 } }]); // proc 1
        state = applyMutations(state, [{ type: 'HP', targetId: 'e1', payload: { amount: 10, isHeal: true } }]); // back above 50
        expect(state.enemyParty[0].currentHp).toBeGreaterThanOrEqual(50);
        state = applyMutations(state, [{ type: 'HP', targetId: 'e1', payload: { amount: 10 } }]); // proc 2
        expect(scentProcs(state)).toBe(2);
    });

    it('procs on DoT ticks (poison crossing at end of enemy turn)', () => {
        const enemy = makeUnit('e1', 'Enemy', {
            currentHp: 51,
            statusEffects: [status('p1', 'Poison', 3)]
        });
        let state = makeState([nid()], [enemy]);
        state = battleReducer(state, { type: 'END_TURN' }); // player -> enemy
        state = battleReducer(state, { type: 'END_TURN' }); // enemy turn ends: poison ticks 3% = 3 -> 48
        expect(state.enemyParty[0].currentHp).toBeLessThan(50);
        expect(scentProcs(state)).toBe(1);
    });
});

describe('Ticket 12 - DRAUGR v2 GRAVE_CHILL_OS rebuilt (works vs cards AND intents)', () => {
    it('an attacker with 2 distinct debuff types deals 20% less to Draugr (card play)', () => {
        const dmgFrom = (attackerStatuses: StatusEffectInstance[]): number => {
            const attacker = makeUnit('p1', 'Attacker', { statusEffects: attackerStatuses });
            const draugr = makeUnit('e1', 'Draugr', { activeOS: 'draugr_v2' });
            let state = makeState([attacker], [draugr], [card('c1', 'fire_punch_v2', 1)]);
            state = play(state, 'p1', 'e1', 'c1');
            return 100 - state.enemyParty[0].currentHp;
        };
        // Poison and Burn do not modify outgoing damage, isolating the OS.
        const base = dmgFrom([]);
        const debuffed = dmgFrom([status('d1', 'Poison', 2), status('d2', 'Burn', 1)]);
        expect(base).toBeGreaterThan(0);
        expect(debuffed).toBe(Math.floor(base * 0.8));
    });

    it('fires against INTENT attacks too (the old cost-tax never could)', () => {
        const intentDmg = (enemyStatuses: StatusEffectInstance[]): number => {
            const draugr = makeUnit('p1', 'Draugr', { activeOS: 'draugr_v2' });
            const enemy = makeUnit('e1', 'Enemy', { statusEffects: enemyStatuses });
            let state = makeState([draugr], [enemy]);
            state = battleReducer(state, {
                type: 'SET_INTENT',
                payload: { entityId: 'e1', move: { id: 'm1', name: 'Bite', intentType: 'Attack', priority: 1, actions: [{ type: 'ATTACK', power: 30, element: 'None', target: 'Single' }] } }
            });
            state = battleReducer(state, { type: 'EXECUTE_INTENT', payload: { sourceId: 'e1' } });
            return 100 - state.playerParty[0].currentHp;
        };
        const base = intentDmg([]);
        const debuffed = intentDmg([status('d1', 'Poison', 2), status('d2', 'Burn', 1)]);
        expect(base).toBeGreaterThan(0);
        expect(debuffed).toBe(Math.floor(base * 0.8));
    });
});

describe('Ticket 12 - einherjar_standard team daemon (the retired EINHERJAR_RALLY)', () => {
    const lightDmg = (party: IBattleEntity[]): number => {
        let state = makeState(party, [makeUnit('e1', 'Enemy')], [card('c1', 'smite', 1)]);
        state = play(state, party[0].id, 'e1', 'c1');
        return 100 - state.enemyParty[0].currentHp;
    };

    it('inert in 1v1, +10% per other living ally', () => {
        const withDaemon = (allies: IBattleEntity[]) => {
            const owner = makeUnit('v1', 'Bearer', {
                daemons: [card('dm1', 'einherjar_standard', 2)]
            });
            return lightDmg([owner, ...allies]);
        };
        const base = lightDmg([makeUnit('v1', 'Bearer')]);
        expect(withDaemon([])).toBe(base); // ALIVE_ALLIES = 0 -> x1.0
        expect(withDaemon([makeUnit('a1', 'Ally')])).toBe(Math.floor(base * 1.1));
    });
});
