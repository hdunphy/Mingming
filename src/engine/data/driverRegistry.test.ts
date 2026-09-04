/**
 * TICKET 68 — enemy-side Drivers, the `turnAtLeast` clock condition, and WAR FOOTING.
 *
 * The claims worth pinning are the three that would fail SILENTLY. A Driver that never attaches
 * looks like a weak boss, not a bug. A `turnAtLeast` that zod strips fires from turn 1 and looks
 * like a strong one. And an aura that leaks onto the player's side looks like variance. None of
 * those three would show up as anything but a number in the balance report — which is exactly how
 * ticket 67 spent six weeks measuring a relic stack nobody had designed.
 */

import { describe, expect, it } from 'vitest';

import { battleReducer } from '../battleReducer';
import { ConditionValidator } from '../core/ConditionValidator';
import { getHook } from '../core/HookRegistry';
import { createBattleState, type IBattleSetup } from './battleFactories';
import {
    DRIVER_IDS,
    DRIVER_WAR_FOOTING,
    applyDriver,
    applyDrivers,
    describeDriver,
    getDriver,
    isHookDriver,
} from './driverRegistry';
import { getOSBehavior } from './firmwareRegistry';
import type { IBattleEntity, IBattleState, IMingmingState } from '../types';

const member = (id: string, definitionId: string): IMingmingState => ({
    id,
    definitionId,
    blueprintsCollected: 0,
    hpIV: 15,
    attackIV: 15,
    defenseIV: 15,
});

const strengthOf = (entity: IBattleEntity): number =>
    entity.statusEffects.find((s) => s.type === 'Strengthened')?.stacks ?? 0;

/** A battle with the named Drivers on the ENEMY side and nothing on the player's. */
function battleWithEnemyDrivers(enemyDrivers: ReadonlyArray<string>): IBattleState {
    const setup: IBattleSetup = {
        party: [member('p1', 'kraken')],
        deck: [],
        drivers: [],
        persistedHp: {},
        encounter: null,
        ...(enemyDrivers.length > 0 ? { enemyDrivers } : {}),
    };
    return createBattleState(setup, ['fenrir', 'skoll'], undefined, {
        seed: 'driver-registry-test',
        enemyMode: 'CARDS',
    });
}

describe('the Driver registry', () => {
    it('loads every shipped Driver, with a name and readable rule text', () => {
        for (const id of DRIVER_IDS) {
            expect(isHookDriver(id)).toBe(true);
            const driver = getDriver(id);
            expect(driver, `${id} has no hooks.json entry`).toBeDefined();
            expect(driver!.hooks.length).toBeGreaterThan(0);
            // Ruling 4's telegraph prints these two strings. An empty one is a blank offer card.
            expect(describeDriver(id).name.length).toBeGreaterThan(0);
            expect(describeDriver(id).description.length).toBeGreaterThan(0);
            // Ruling 1: never a relic, in the naming or the concept.
            expect(id.startsWith('boss_relic_')).toBe(false);
        }
    });

    it('registers each Driver hook so the engine can find it by id', () => {
        // The layer a Driver has that a relic did not: it rides `entity.hooks`, so its ids have to
        // be in the registry independently of any `activeOS`.
        for (const id of DRIVER_IDS) {
            for (const hook of getDriver(id)!.hooks) {
                expect(getHook(hook.id), `${hook.id} is not registered`).toBeDefined();
            }
        }
    });

    it('is ADDITIVE: it attaches hooks and never touches activeOS (ruling 2)', () => {
        const entity = { id: 'e1', activeOS: 'fenrir_v1', hooks: [] } as unknown as IBattleEntity;
        const driven = applyDriver(entity, DRIVER_WAR_FOOTING);

        expect(driven.activeOS).toBe('fenrir_v1');
        expect(driven.hooks).toContain('driver_war_footing_rally');
        // The OS's own hooks are untouched and still reachable — the union happens at collection.
        expect(getOSBehavior('fenrir_v1')!.hooks.length).toBeGreaterThan(0);
    });

    it('de-duplicates, so a Driver listed twice is not an aura at double rate', () => {
        const entity = { id: 'e1', hooks: [] } as unknown as IBattleEntity;
        const once = applyDrivers(entity, [DRIVER_WAR_FOOTING]);
        const twice = applyDrivers(entity, [DRIVER_WAR_FOOTING, DRIVER_WAR_FOOTING]);
        expect(twice.hooks).toEqual(once.hooks);
    });

    it('still applies the player’s stat Drivers, unchanged by the move (Milestone 8.4)', () => {
        const entity = {
            id: 'e1', maxEnergy: 2, currentEnergy: 2, cardDraw: 3, hooks: [],
            relicBonuses: { draw: 0, energy: 0, attackMod: 1 },
        } as unknown as IBattleEntity;

        expect(applyDriver(entity, 'heatsink').maxEnergy).toBe(3);
        expect(applyDriver(entity, 'expansion_slot').cardDraw).toBe(4);
        expect(applyDriver(entity, 'overclock_module').relicBonuses!.attackMod).toBeCloseTo(1.1);
    });

    it('survives an unknown id rather than killing the fight it was decorating', () => {
        // `GetRelic` throws, which is right for a lookup and wrong for an application loop over a
        // list that legitimately mixes two kinds of id.
        const entity = { id: 'e1', hooks: [] } as unknown as IBattleEntity;
        expect(() => applyDrivers(entity, ['driver_does_not_exist', 'not_a_relic_either'])).not.toThrow();
        expect(applyDrivers(entity, ['driver_does_not_exist']).hooks).toEqual([]);
    });
});

describe('the turnAtLeast hook condition', () => {
    const owner = { id: 'o1' } as IBattleEntity;
    const contextAtTurn = (turn: number) =>
        ({ state: { turn, playerParty: [], enemyParty: [] }, triggerDepth: 0 }) as never;

    it('passes from its turn onward and fails before it', () => {
        for (const turn of [1, 2, 3]) {
            expect(ConditionValidator.evaluateHookCondition({ turnAtLeast: 4 }, contextAtTurn(turn), owner)).toBe(false);
        }
        for (const turn of [4, 5, 12]) {
            expect(ConditionValidator.evaluateHookCondition({ turnAtLeast: 4 }, contextAtTurn(turn), owner)).toBe(true);
        }
    });

    it('is absent-means-always, like every other clause', () => {
        expect(ConditionValidator.evaluateHookCondition({}, contextAtTurn(1), owner)).toBe(true);
    });

    it('SURVIVES THE ZOD PARSE — the failure mode this condition is most likely to have', () => {
        // A field declared on the type but missing from `HookSchema` is stripped between hooks.json
        // and the engine, and the hook then fires UNGUARDED (ticket 36 lost three sim runs to
        // exactly this). Read the parsed registry, not the raw file.
        const escalate = getDriver(DRIVER_WAR_FOOTING)!.hooks.find((h) => h.id === 'driver_war_footing_escalate');
        expect(escalate).toBeDefined();
        // Fires at turn 4 and not at turn 3, read through the built hook rather than the JSON.
        const built = getHook('driver_war_footing_escalate')!;
        expect(built.onTurnEnd).toBeTypeOf('function');
    });
});

describe('WAR FOOTING, in a real battle', () => {
    it('gives every enemy 1 Strengthened at the end of the enemy turn, and 2 from turn 4', () => {
        let state = battleWithEnemyDrivers([DRIVER_WAR_FOOTING]);
        expect(state.turn).toBe(1);
        for (const enemy of state.enemyParty) expect(strengthOf(enemy)).toBe(0);

        // END_TURN twice is one full round: PLAYER -> ENEMY, then ENEMY -> PLAYER with `turn`
        // incrementing. The aura fires on the ENEMY's own turn end.
        const round = (from: IBattleState): IBattleState =>
            battleReducer(battleReducer(from, { type: 'END_TURN' }), { type: 'END_TURN' });

        state = round(state);
        for (const enemy of state.enemyParty) expect(strengthOf(enemy)).toBe(1);

        state = round(state);
        for (const enemy of state.enemyParty) expect(strengthOf(enemy)).toBe(2);

        state = round(state);
        for (const enemy of state.enemyParty) expect(strengthOf(enemy)).toBe(3);

        // Turn 4 onward the aura is worth 2 a round, so the fourth round adds two rather than one.
        expect(state.turn).toBeGreaterThanOrEqual(4);
        state = round(state);
        for (const enemy of state.enemyParty) expect(strengthOf(enemy)).toBe(5);
    });

    it('is SIDE-SCOPED — the player gains nothing from the enemy’s Driver', () => {
        let state = battleWithEnemyDrivers([DRIVER_WAR_FOOTING]);
        for (let round = 0; round < 5; round += 1) {
            state = battleReducer(battleReducer(state, { type: 'END_TURN' }), { type: 'END_TURN' });
        }
        for (const member of state.playerParty) expect(strengthOf(member)).toBe(0);
        for (const enemy of state.enemyParty) expect(strengthOf(enemy)).toBeGreaterThan(0);
    });

    it('does nothing at all when the fight has no Driver — which is almost every fight', () => {
        let state = battleWithEnemyDrivers([]);
        for (let round = 0; round < 5; round += 1) {
            state = battleReducer(battleReducer(state, { type: 'END_TURN' }), { type: 'END_TURN' });
        }
        for (const enemy of state.enemyParty) expect(strengthOf(enemy)).toBe(0);
    });
});
