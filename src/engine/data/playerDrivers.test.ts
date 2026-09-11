/**
 * THE PLAYER'S EIGHT DRIVERS, END TO END — steam-release ticket 16.
 *
 * Every test here PLAYS A CARD through `battleReducer` and reads what changed. Nothing here reads
 * the JSON back to itself. The reason is written all over this repo's HANDOFFs: a hook can be
 * schema-valid, registered, attached and completely INERT — a missing `target` is skipped by
 * `executeActions`, an undeclared key is stripped by zod, a hand-maintained allowlist forgets an id
 * — and every one of those reads as "the Driver feels weak" rather than as a failure. Three of the
 * repo's Drivers were dead on arrival that way (OUROBOROS_LOOP for eight tickets). So the claim
 * each test pins is *the player played, and the game was different because of the Driver* — with
 * the same fight, same seed, same cards played, and the Driver the only variable.
 *
 * And the PROC-VISIBLE half is pinned the same way: each Driver's payoff must put a `DRIVER_PROC`
 * on the bus, because a Driver the UI cannot see is a Driver `macros-and-drivers.md` forbids.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { battleReducer } from '../battleReducer';
import { globalBattleEventBus, type BattleEvent, type DriverProcEvent } from '../events';
import { buildScenarioState } from '../../debug/scenarios/buildScenarioState';
import { teamScenario } from '../../debug/balance/balanceScenarios';
import type { ComposedSetup } from '../../debug/scenarios/scenarioSchema';
import type { IBattleState, ProgramEntity } from '../types';
import {
    DRIVER_ANTIVENOM,
    DRIVER_BULWARK_REFLEX,
    DRIVER_DEEP_CACHE,
    DRIVER_FIRST_BLOOD,
    DRIVER_OVERKILL_RECOVERY,
    DRIVER_STATIC_FIELD,
    DRIVER_THIRD_STRIKE,
    ELEMENT_DRIVER_IDS,
    GYM_DRIVER_IDS,
    PLAYER_DRIVER_IDS,
    elementDriverId,
    getDriver,
} from './driverRegistry';
import { getHook } from '../core/HookRegistry';
import { applyMutations } from '../resolutionEngine';

// --- the arena -------------------------------------------------------------------------------

/** A 3v3 whose shared pile is exactly the cards a test wants in hand, three members wide. */
function arena(deck: ReadonlyArray<string>, drivers: ReadonlyArray<string>, seed = 'drivers-e2e'): IBattleState {
    const base = teamScenario({
        player: [['fenrir', 'fenrir_v1'], ['kraken', 'kraken_v1'], ['huldra', 'huldra_v1']],
        enemy: [['skoll', 'skoll_v1'], ['ratatoskr', 'ratatoskr_v1'], ['ymir', 'ymir_v1']],
        seed,
    });
    const setup: ComposedSetup = {
        ...base,
        player: { ...base.player, deck: [...deck], drivers: [...drivers] },
    };
    return buildScenarioState(setup);
}

const hp = (s: IBattleState, id: string) =>
    [...s.playerParty, ...s.enemyParty].find(e => e.id === id)!.currentHp;
const stacks = (s: IBattleState, id: string, status: string) =>
    [...s.playerParty, ...s.enemyParty].find(e => e.id === id)!.statusEffects.find(x => x.type === status)?.stacks ?? 0;
const enemyPool = (s: IBattleState) => s.enemyParty.reduce((sum, e) => sum + e.currentHp, 0);
const handOf = (s: IBattleState, dataId: string): ProgramEntity[] => s.playerDeck.hand.filter(c => c.dataId === dataId);

/** Debug write of a unit's HP (no hooks, no crossing) — for staging a board, never for the claim. */
const setHp = (s: IBattleState, entityId: string, hp: number): IBattleState =>
    // `sourceId` must be a real unit (hooks read it for retaliation); the unit itself will do.
    battleReducer(s, { type: 'SET_VITALS', payload: { entityId, hp, sourceId: entityId } });

/** Real damage through the engine's HP mutation — the path that detects the 50% crossing. */
const damage = (s: IBattleState, targetId: string, amount: number): IBattleState =>
    applyMutations(s, [{ type: 'HP', targetId, payload: { amount, isHeal: false, element: 'None' } }]);

/** Play the first copy of `dataId` in hand from `sourceId` at `targetId`. Throws if none is in hand. */
function play(s: IBattleState, dataId: string, sourceId: string, targetId: string): IBattleState {
    const card = handOf(s, dataId)[0];
    if (!card) throw new Error(`no ${dataId} in hand: [${s.playerDeck.hand.map(c => c.dataId).join(', ')}]`);
    return battleReducer(s, { type: 'PLAY_PROGRAM', payload: { sourceId, targetId, programId: card.id } });
}

// --- the bus ---------------------------------------------------------------------------------

let procs: DriverProcEvent[] = [];
let unsubscribe: (() => void) | null = null;
beforeEach(() => {
    procs = [];
    unsubscribe = globalBattleEventBus.subscribe((e: BattleEvent) => {
        if (e.type === 'DRIVER_PROC') procs.push(e);
    });
});
afterEach(() => { unsubscribe?.(); unsubscribe = null; });

const procsOf = (driverId: string) => procs.filter(p => p.driverId === driverId);

// --- the roster ------------------------------------------------------------------------------

describe('the player Driver roster', () => {
    it('is the ruled eight, with one Element Driver per real element', () => {
        // 7 named + 8 elements = 15 ids; `None` has no Driver.
        expect(ELEMENT_DRIVER_IDS).toHaveLength(8);
        expect(ELEMENT_DRIVER_IDS).not.toContain('driver_element_none');
        expect(PLAYER_DRIVER_IDS).toHaveLength(7 + 8);
        for (const gym of GYM_DRIVER_IDS) expect(PLAYER_DRIVER_IDS).not.toContain(gym);
    });

    it('every one is loaded, named, described, and its hooks are registered', () => {
        for (const id of PLAYER_DRIVER_IDS) {
            const d = getDriver(id);
            expect(d, id).toBeDefined();
            expect(d!.name.length).toBeGreaterThan(0);
            expect(d!.description.length).toBeGreaterThan(0);
            for (const h of d!.hooks) expect(getHook(h.id), `${h.id} unregistered`).toBeDefined();
        }
    });

    it('SURVIVES THE ZOD PARSE: every payoff hook keeps its proc flag (HANDOFF 8c2)', () => {
        // The flag is what makes a Driver visible. A schema that stripped it would leave every
        // Driver working and every chip dark — the exact class of silent failure this file exists for.
        for (const id of PLAYER_DRIVER_IDS) {
            const flagged = getDriver(id)!.hooks.filter(h => (h.data as { proc?: boolean } | undefined)?.proc);
            expect(flagged.length, `${id} has no proc-flagged hook`).toBeGreaterThan(0);
        }
    });
});

// --- one probe per Driver --------------------------------------------------------------------

describe('FIRST BLOOD — the first attack card this side plays each turn, 1.2x', () => {
    const DECK = Array(12).fill('frost_jab');

    it('boosts the FIRST attack of the turn and not the second, and procs once', () => {
        const bare = arena(DECK, []);
        const driven = arena(DECK, [DRIVER_FIRST_BLOOD]);
        const target = bare.enemyParty[0].id;
        const caster = bare.playerParty[0].id;

        const bare1 = play(bare, 'frost_jab', caster, target);
        const driven1 = play(driven, 'frost_jab', caster, target);
        const bareHit1 = hp(bare, target) - hp(bare1, target);
        const drivenHit1 = hp(driven, target) - hp(driven1, target);
        expect(bareHit1).toBeGreaterThan(0);
        expect(drivenHit1).toBe(Math.floor(bareHit1 * 1.2));

        // Second attack of the same turn: no boost.
        const bare2 = play(bare1, 'frost_jab', caster, target);
        const driven2 = play(driven1, 'frost_jab', caster, target);
        expect(hp(driven1, target) - hp(driven2, target)).toBe(hp(bare1, target) - hp(bare2, target));

        expect(procsOf(DRIVER_FIRST_BLOOD)).toHaveLength(1);
        expect(procsOf(DRIVER_FIRST_BLOOD)[0]).toMatchObject({ ownerId: caster, fromPlayer: true });
    });

    it('is SIDE-scoped: a second member\'s first attack is not a second First Blood', () => {
        const driven = arena(DECK, [DRIVER_FIRST_BLOOD]);
        const target = driven.enemyParty[0].id;
        const bare = arena(DECK, []);
        const a1 = play(driven, 'frost_jab', driven.playerParty[0].id, target);
        const a2 = play(a1, 'frost_jab', driven.playerParty[1].id, target);
        const b1 = play(bare, 'frost_jab', bare.playerParty[0].id, target);
        const b2 = play(b1, 'frost_jab', bare.playerParty[1].id, target);
        expect(hp(a1, target) - hp(a2, target)).toBe(hp(b1, target) - hp(b2, target));
        expect(procsOf(DRIVER_FIRST_BLOOD)).toHaveLength(1);
    });
});

describe('THIRD STRIKE — every 10th attack card this side plays, 1.5x', () => {
    const DECK = Array(24).fill('frost_jab');

    it('boosts exactly the tenth attack, procs there, and resets to count again', () => {
        let bare = arena(DECK, []);
        let driven = arena(DECK, [DRIVER_THIRD_STRIKE]);
        const target = bare.enemyParty[2].id;
        const casters = bare.playerParty.map(m => m.id);

        const hits: Array<{ bare: number; driven: number }> = [];
        for (let i = 0; i < 12; i++) {
            const caster = casters[i % 3];
            // The hand refills only on a turn boundary; keep a card in hand by drawing from the pile
            // between plays through the reducer's own cheat-free path: play from whatever is in hand.
            if (handOf(bare, 'frost_jab').length === 0) break;
            const b = play(bare, 'frost_jab', caster, target);
            const d = play(driven, 'frost_jab', caster, target);
            hits.push({ bare: hp(bare, target) - hp(b, target), driven: hp(driven, target) - hp(d, target) });
            bare = b; driven = d;
        }
        expect(hits.length, 'the hand ran dry before the tenth attack').toBeGreaterThanOrEqual(10);
        for (let i = 0; i < hits.length; i++) {
            if (i === 9) expect(hits[i].driven, `attack ${i + 1}`).toBe(Math.floor(hits[i].bare * 1.5));
            else expect(hits[i].driven, `attack ${i + 1}`).toBe(hits[i].bare);
        }
        expect(procsOf(DRIVER_THIRD_STRIKE)).toHaveLength(1);
        // The counter reset: after the tenth, the side is back to zero.
        const key = Object.keys(driven.counters).find(k => k.startsWith('third_strike@'));
        expect(key).toBeDefined();
        expect(driven.counters[key!]).toBe(hits.length - 10);
    });
});

describe('STATIC FIELD — every card this side plays, 2 power to a random enemy', () => {
    it('zaps on an attack AND on a skill, and procs each time', () => {
        const DECK = Array(6).fill('frost_jab').concat(Array(6).fill('undertow'));
        const bare = arena(DECK, []);
        const driven = arena(DECK, [DRIVER_STATIC_FIELD]);
        const target = bare.enemyParty[0].id;
        const caster = bare.playerParty[1].id; // kraken: Water, so undertow is castable

        const b1 = play(bare, 'frost_jab', caster, target);
        const d1 = play(driven, 'frost_jab', caster, target);
        expect(enemyPool(driven) - enemyPool(d1)).toBeGreaterThan(enemyPool(bare) - enemyPool(b1));

        const b2 = play(b1, 'undertow', caster, caster);
        const d2 = play(d1, 'undertow', caster, caster);
        expect(enemyPool(b1) - enemyPool(b2)).toBe(0);
        expect(enemyPool(d1) - enemyPool(d2)).toBeGreaterThan(0);

        expect(procsOf(DRIVER_STATIC_FIELD)).toHaveLength(2);
    });

    it('is deterministic: the random enemy comes off the seeded stream, not Math.random', () => {
        const a = play(arena(['frost_jab', 'frost_jab'], [DRIVER_STATIC_FIELD]), 'frost_jab', 'p1', 'e1');
        const b = play(arena(['frost_jab', 'frost_jab'], [DRIVER_STATIC_FIELD]), 'frost_jab', 'p1', 'e1');
        expect(a.enemyParty.map(e => e.currentHp)).toEqual(b.enemyParty.map(e => e.currentHp));
    });
});

describe('the Element Drivers — that element\'s attack cards, 1.1x', () => {
    it('ICE DRIVER boosts an Ice attack and leaves a Light one alone; both are procs only for Ice', () => {
        const DECK = Array(6).fill('frost_jab').concat(Array(6).fill('radiant_spark'));
        const bare = arena(DECK, []);
        const driven = arena(DECK, [elementDriverId('Ice')]);
        const target = bare.enemyParty[0].id;
        const caster = bare.playerParty[0].id;

        const b1 = play(bare, 'frost_jab', caster, target);
        const d1 = play(driven, 'frost_jab', caster, target);
        const bareIce = hp(bare, target) - hp(b1, target);
        expect(hp(driven, target) - hp(d1, target)).toBe(Math.floor(bareIce * 1.1));

        const b2 = play(b1, 'radiant_spark', caster, target);
        const d2 = play(d1, 'radiant_spark', caster, target);
        expect(hp(d1, target) - hp(d2, target)).toBe(hp(b1, target) - hp(b2, target));

        expect(procsOf(elementDriverId('Ice'))).toHaveLength(1);
        expect(procsOf(elementDriverId('Light'))).toHaveLength(0);
    });
});

describe('OVERKILL RECOVERY — an enemy faints, every living member heals 8% max HP', () => {
    it('heals each member on the kill and procs once per member', () => {
        const DECK = Array(12).fill('frost_jab');
        let driven = arena(DECK, [DRIVER_OVERKILL_RECOVERY]);
        const victim = driven.enemyParty[0].id;
        // Wound the party first so a heal has somewhere to go, then bring the victim to the edge.
        driven = setHp(driven, victim, 1);
        for (const m of driven.playerParty) driven = setHp(driven, m.id, Math.floor(m.maxHp / 2));
        const before = driven.playerParty.map(m => m.currentHp);
        // kraken casts: fenrir_v1's OS pays a recoil on every attack, which would muddy the read.
        const after = play(driven, 'frost_jab', driven.playerParty[1].id, victim);
        expect(hp(after, victim)).toBe(0);
        after.playerParty.forEach((m, i) => {
            expect(m.currentHp - before[i], m.name).toBe(Math.floor(m.maxHp * 0.08));
        });
        expect(procsOf(DRIVER_OVERKILL_RECOVERY)).toHaveLength(3);
    });

    it('does NOT fire when one of your own faints', () => {
        let driven = arena(Array(4).fill('frost_jab'), [DRIVER_OVERKILL_RECOVERY]);
        const victim = driven.playerParty[2].id;
        driven = battleReducer(driven, { type: 'KILL_ENTITY', payload: { entityId: victim, sourceId: victim } });
        expect(procsOf(DRIVER_OVERKILL_RECOVERY)).toHaveLength(0);
    });
});

describe('ANTIVENOM — end of this side\'s turn, each poisoned member loses 1 extra Poison', () => {
    it('takes one stack at the end of the turn, only from the poisoned, and procs per poisoned member', () => {
        // Poison TICKS at the owner's turn START (ticket 126, "died at the end of our turn"), so the
        // end-of-turn purge is the whole difference between the two arms here; the tick's own decay
        // lands on the way back in. Over a full round: -1 from the tick, -1 from ANTIVENOM.
        const DECK = Array(4).fill('frost_jab');
        let bare = arena(DECK, []);
        let driven = arena(DECK, [DRIVER_ANTIVENOM]);
        const p0 = bare.playerParty[0].id, p1 = bare.playerParty[1].id;
        bare = battleReducer(bare, { type: 'APPLY_STATUS', payload: { targetId: p0, status: 'Poison', stacks: 4 } });
        driven = battleReducer(driven, { type: 'APPLY_STATUS', payload: { targetId: p0, status: 'Poison', stacks: 4 } });
        expect(stacks(driven, p0, 'Poison')).toBe(4);

        const bareEnd = battleReducer(bare, { type: 'END_TURN' });
        const drivenEnd = battleReducer(driven, { type: 'END_TURN' });
        expect(stacks(bareEnd, p0, 'Poison')).toBe(4);   // nothing ticks at turn end
        expect(stacks(drivenEnd, p0, 'Poison')).toBe(3); // ANTIVENOM's extra stack
        expect(stacks(drivenEnd, p1, 'Poison')).toBe(0);
        expect(procsOf(DRIVER_ANTIVENOM)).toHaveLength(1);
        expect(procsOf(DRIVER_ANTIVENOM)[0].ownerId).toBe(p0);
    });
});

describe('BULWARK REFLEX — a member drops below 50%, once per fight per member, +15 Bark Shield', () => {
    it('shields on the crossing, once per fight, and procs once', () => {
        const driven = arena(Array(4).fill('frost_jab'), [DRIVER_BULWARK_REFLEX]);
        const m = driven.playerParty[0];
        expect(stacks(driven, m.id, 'BarkShield')).toBe(0);

        // Real damage, from full to under half: the crossing.
        const bite = Math.floor(m.maxHp * 0.6);
        const crossed = damage(driven, m.id, bite);
        expect(hp(crossed, m.id)).toBeLessThan(m.maxHp / 2);
        expect(stacks(crossed, m.id, 'BarkShield')).toBeCloseTo(15, 5);
        expect(procsOf(DRIVER_BULWARK_REFLEX)).toHaveLength(1);
        expect(procsOf(DRIVER_BULWARK_REFLEX)[0].ownerId).toBe(m.id);

        // Heal back over the line and cross again: the shield was once per fight.
        let again = battleReducer(crossed, { type: 'REMOVE_STATUS', payload: { entityId: m.id, status: 'BarkShield' } });
        again = setHp(again, m.id, m.maxHp);
        again = damage(again, m.id, bite);
        expect(hp(again, m.id)).toBeLessThan(m.maxHp / 2);
        expect(stacks(again, m.id, 'BarkShield')).toBe(0);
        expect(procsOf(DRIVER_BULWARK_REFLEX)).toHaveLength(1);

        // ...but it is per MEMBER, so a second member gets its own.
        const m2 = again.playerParty[1];
        const second = damage(again, m2.id, Math.floor(m2.maxHp * 0.6));
        expect(stacks(second, m2.id, 'BarkShield')).toBeCloseTo(15, 5);
        expect(procsOf(DRIVER_BULWARK_REFLEX)).toHaveLength(2);
    });

    it('does NOT shield the enemy when the enemy crosses', () => {
        const driven = arena(Array(4).fill('frost_jab'), [DRIVER_BULWARK_REFLEX]);
        const e = driven.enemyParty[0];
        const crossed = damage(driven, e.id, Math.floor(e.maxHp * 0.6));
        expect(stacks(crossed, e.id, 'BarkShield')).toBe(0);
        expect(procsOf(DRIVER_BULWARK_REFLEX)).toHaveLength(0);
    });
});

describe('DEEP CACHE — this side\'s first bonus draw each turn, the drawer gains 1 Strengthened', () => {
    it('fires on the first triggered draw, not the second, and never on the natural draw', () => {
        const DECK = Array(6).fill('undertow').concat(Array(6).fill('frost_jab'));
        const driven = arena(DECK, [DRIVER_DEEP_CACHE]);
        const kraken = driven.playerParty[1].id;
        // The opening hand was a NATURAL draw: nothing yet.
        expect(procsOf(DRIVER_DEEP_CACHE)).toHaveLength(0);
        expect(stacks(driven, kraken, 'Strengthened')).toBe(0);

        const one = play(driven, 'undertow', kraken, kraken);
        expect(stacks(one, kraken, 'Strengthened')).toBe(1);
        expect(procsOf(DRIVER_DEEP_CACHE)).toHaveLength(1);
        expect(procsOf(DRIVER_DEEP_CACHE)[0].ownerId).toBeDefined();

        const two = play(one, 'undertow', kraken, kraken);
        expect(stacks(two, kraken, 'Strengthened')).toBe(1);
        expect(procsOf(DRIVER_DEEP_CACHE)).toHaveLength(1);
    });
});

describe('the whole roster at once', () => {
    it('all fifteen attach to every member and a fight still plays', () => {
        const s = arena(Array(12).fill('frost_jab'), PLAYER_DRIVER_IDS);
        for (const m of s.playerParty) {
            for (const id of PLAYER_DRIVER_IDS) {
                for (const h of getDriver(id)!.hooks) expect(m.hooks).toContain(h.id);
            }
        }
        const after = play(s, 'frost_jab', s.playerParty[0].id, s.enemyParty[0].id);
        expect(hp(after, s.enemyParty[0].id)).toBeLessThan(hp(s, s.enemyParty[0].id));
        expect(procsOf(DRIVER_FIRST_BLOOD)).toHaveLength(1);
        expect(procsOf(DRIVER_STATIC_FIELD)).toHaveLength(1);
        /*
         * TWO, not one — a pinned FINDING rather than a design. A hook-originated ATTACK runs under
         * the triggering card's `context.program` (`AttackExecutor`: `program || { element }`), so
         * STATIC FIELD's zap reads as "an Ice attack card" to the ICE DRIVER's modifier and the
         * modifier procs again on the zap. At 2 power the compounding is worth at most a point of
         * damage; the visible cost is a second ICE DRIVER float when both Drivers are held. Engine
         * semantics predate this ticket (riptide's undertow inherits the OPPONENT's card the same
         * way) and changing them is not authorised here — flagged in the ticket for Henry.
         */
        expect(procsOf(elementDriverId('Ice'))).toHaveLength(2);
    });
});
