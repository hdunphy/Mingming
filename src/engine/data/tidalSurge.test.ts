/**
 * TIDAL SURGE, AND THE `SIDE` COUNTER SCOPE IT NEEDED — ticket 71.
 *
 * The Driver reads *"every 10 cards this side plays, it deals 10 power to the enemy side"*, and the
 * whole risk is in the words **this side**. A Driver attaches its hooks to every member, so the two
 * scopes that already existed are both wrong in ways that look like tuning rather than bugs:
 *
 * - **OWNER** gives each of the three members a private count, so the Driver fires at ~30 cards;
 * - **GLOBAL** shares the count with the opponent, so the PLAYER's cards charge the boss's Driver.
 *
 * Neither would throw, error, or read as broken. They would read as "the surge feels weak" and
 * "the surge fires at strange times" — so these tests pin the scope itself before they pin the
 * Driver, and `liveness.ts` does not cover this because it sweeps OS firmware, not Drivers.
 */

import { describe, expect, it } from 'vitest';

import { ConditionValidator } from '../core/ConditionValidator';
import { getHook } from '../core/HookRegistry';
import { resolveCounterKey, resolveSideCounterKey } from '../core/HookTypes';
import { applyDriver, getDriver, DRIVER_TIDAL_SURGE } from './driverRegistry';
import { createBattleState, type IBattleSetup } from './battleFactories';
import { getOSBehavior } from './firmwareRegistry';
import { createRun } from '../run/createRun';
import { GAUNTLET_FIGHTS, rollGauntletFight } from '../run/gauntlet';
import { GYM_REGISTRY } from '../run/gyms';
import { gymDriverForNode } from '../run/encounter';
import { applyMutations, executeResolutionStack } from '../resolutionEngine';
import { resolveSideCounterKey as sideKey } from '../core/HookTypes';
import type { IBiome } from '../runTypes';
import type { IBattleEntity, IBattleState, IMingmingState } from '../types';

const DRIVER = 'driver_tidal_surge';

const unit = (id: string): IBattleEntity => ({ id, hooks: [] } as unknown as IBattleEntity);

/** The schema-validated declaration behind a built hook — the registry wraps it as `.data`. */
type HookDecl = {
    priority: number;
    when: { counter?: { key: string; operator: string; value: number; scope?: string } };
    do: Array<{ type?: string; operator?: string; scope?: string; power?: number; target?: string }>;
};
const defOf = (hookId: string): HookDecl => {
    const wrapper = getDriver(DRIVER)!.hooks.find(h => h.id === hookId) as unknown as { data: HookDecl };
    return wrapper.data;
};

/** A state whose only meaningful content is which party each entity sits in. */
const stateWith = (player: IBattleEntity[], enemy: IBattleEntity[]): IBattleState =>
    ({ playerParty: player, enemyParty: enemy, counters: {}, turn: 1 } as unknown as IBattleState);

describe('the SIDE counter scope', () => {
    const p1 = unit('p1'), p2 = unit('p2'), e1 = unit('e1');
    const state = stateWith([p1, p2], [e1]);

    it('gives the whole party ONE key — the thing OWNER scope gets wrong', () => {
        expect(resolveSideCounterKey('tidal_surge', p1, state))
            .toBe(resolveSideCounterKey('tidal_surge', p2, state));
        // ...and OWNER really would have split them, which is why this is worth asserting.
        expect(resolveCounterKey('tidal_surge', 'OWNER', p1))
            .not.toBe(resolveCounterKey('tidal_surge', 'OWNER', p2));
    });

    it('does NOT share that key with the opponent — the thing GLOBAL scope gets wrong', () => {
        expect(resolveSideCounterKey('tidal_surge', p1, state))
            .not.toBe(resolveSideCounterKey('tidal_surge', e1, state));
        expect(resolveCounterKey('tidal_surge', 'GLOBAL', p1))
            .toBe(resolveCounterKey('tidal_surge', 'GLOBAL', e1));
    });

    it('reads back through the condition validator at the same key it was written to', () => {
        // The write path (HookFactory) and the read path (ConditionValidator) resolve the key
        // independently. If they ever disagree the counter increments forever and the threshold
        // never fires — a silent dead Driver.
        const key = resolveSideCounterKey('tidal_surge', e1, state);
        const loaded = { ...state, counters: { [key]: 10 } } as IBattleState;
        const ctx = { state: loaded, triggerDepth: 0 } as never;

        const cond = { counter: { key: 'tidal_surge', operator: 'GTE' as const, value: 10, scope: 'SIDE' as const } };
        expect(ConditionValidator.evaluateHookCondition(cond, ctx, e1)).toBe(true);
        // The player side, on the same battle, has not played a card.
        expect(ConditionValidator.evaluateHookCondition(cond, ctx, p1)).toBe(false);
    });
});

describe('TIDAL SURGE', () => {
    it('is registered, named, and attaches to a member without touching its OS', () => {
        const driver = getDriver(DRIVER);
        expect(driver?.name).toBe('TIDAL SURGE');
        expect(driver?.description).toMatch(/10 cards/);

        const member = { id: 'm1', hooks: [], activeOS: 'kraken_v1' } as unknown as IBattleEntity;
        const after = applyDriver(member, DRIVER);
        expect(after.hooks).toContain('driver_tidal_surge_count');
        expect(after.hooks).toContain('driver_tidal_surge_fire');
        // Ticket 68's law: a Driver is ADDITIVE and never replaces the member's firmware.
        expect(after.activeOS).toBe('kraken_v1');
    });

    it('SURVIVES THE ZOD PARSE — both hooks build, on the trigger they claim', () => {
        // `HookSchema` strips undeclared keys, so a `scope: 'SIDE'` that the schema did not know
        // about would vanish between the file and the engine and the counter would silently become
        // OWNER-scoped. This reads the BUILT hooks, not the JSON.
        expect(getHook('driver_tidal_surge_count')?.onActionEnd).toBeTypeOf('function');
        expect(getHook('driver_tidal_surge_fire')?.onActionEnd).toBeTypeOf('function');
    });

    it('keeps the SIDE scope through the parse, on both the write and the read', () => {
        // The registry wraps each parsed hook as `{ id, priority, data }`; the declaration the
        // schema validated is `data`. Reading the wrapper instead of `data` is how this test first
        // "failed" against a Driver that was in fact correct.
        expect(defOf('driver_tidal_surge_count').do[0].scope).toBe('SIDE');
        expect(defOf('driver_tidal_surge_fire').when.counter?.scope).toBe('SIDE');
        expect(defOf('driver_tidal_surge_fire').when.counter?.value).toBe(10);
    });

    it('counts BEFORE it fires — the priority order the threshold depends on', () => {
        // Both hooks sit on onActionEnd. If the fire hook ran first, the tenth card would be
        // counted after the check and the surge would land one card late, every time.
        expect(defOf('driver_tidal_surge_count').priority)
            .toBeGreaterThan(defOf('driver_tidal_surge_fire').priority);
    });

    it('resets the counter when it fires, so it is EVERY 10 cards and not "10 or more, forever"', () => {
        const ops = defOf('driver_tidal_surge_fire').do;
        expect(ops.some(a => a.type === 'ATTACK')).toBe(true);
        expect(ops.some(a => a.type === 'COUNTER' && a.operator === 'RESET')).toBe(true);
        // PROC-VISIBLE (ticket 16's law): the player is told when it lands.
        expect(ops.some(a => a.type === 'LOG')).toBe(true);
    });
});


/**
 * TIDEWRACK, END TO END — the half of this that structure tests cannot reach.
 *
 * Everything above proves the Driver is declared correctly. None of it proves a Tidewrack fight
 * actually fields the trio, carries the Driver, or that ten cards make anything happen. That gap is
 * exactly where the balance merge report's *"a dead arm reads exactly like a null result"* lives.
 */
// The shapes `createRun` actually wants — `elements` is a LIST, and a singular `element` produces
// an undefined-index crash three modules deep rather than a type error.
const BIOMES: ReadonlyArray<IBiome> = [
    { id: 'biome_water', name: 'Water', elements: ['Water'] },
    { id: 'biome_nature', name: 'Nature', elements: ['Nature'] },
    { id: 'biome_fire', name: 'Fire', elements: ['Fire'] },
];
const PARTY_MEMBER: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', nickname: 'Inky', activeOS: 'kraken_v1',
    blueprintsCollected: 0, hpIV: 10, attackIV: 10, defenseIV: 10,
};

describe('Tidewrack, authored', () => {
    /** A built Tidewrack boss battle, plus the side counter key its Driver writes to. */
    const arena = () => {
        const { fight } = fightFor('gym_tidewrack');
        const setup: IBattleSetup = {
            party: [PARTY_MEMBER], deck: [], drivers: [], persistedHp: {},
            encounter: { enemyParty: fight.enemyParty, enemyDeckIds: fight.enemyDeckIds, enemyDrivers: fight.enemyDrivers },
            enemyDrivers: fight.enemyDrivers,
        };
        const state = createBattleState(setup, [], undefined, { seed: fight.seed, enemyMode: 'CARDS' });
        const boss = state.enemyParty[0];
        return { state, boss, key: sideKey('tidal_surge', boss, state) };
    };

    const fightFor = (gym: keyof typeof GYM_REGISTRY) => {
        const run = createRun({
            seed: 'tidal-e2e',
            offer: { gym: GYM_REGISTRY[gym], biomes: BIOMES },
            party: [PARTY_MEMBER],
            startedAt: 0,
        });
        const gymNode = run.nodes.find(n => n.kind === 'gym')!;
        return { run, fight: rollGauntletFight({ run, node: gymNode, fightIndex: GAUNTLET_FIGHTS - 1 }) };
    };

    it('fields the authored trio under TIDAL SURGE, additively', () => {
        const { fight } = fightFor('gym_tidewrack');
        expect(fight.enemyDrivers).toEqual([DRIVER_TIDAL_SURGE]);

        const setup: IBattleSetup = {
            party: [PARTY_MEMBER], deck: [], drivers: [], persistedHp: {},
            encounter: { enemyParty: fight.enemyParty, enemyDeckIds: fight.enemyDeckIds, enemyDrivers: fight.enemyDrivers },
            enemyDrivers: fight.enemyDrivers,
        };
        const state = createBattleState(setup, [], undefined, { seed: fight.seed, enemyMode: 'CARDS' });

        expect(state.enemyParty).toHaveLength(3);
        for (const boss of state.enemyParty) {
            expect(boss.hooks).toContain('driver_tidal_surge_count');
            expect(boss.hooks).toContain('driver_tidal_surge_fire');
            // Additive — the member keeps its own tuned firmware, and it is never a relic.
            expect(getOSBehavior(boss.activeOS!)!.hooks.length).toBeGreaterThan(0);
            expect(boss.activeOS?.startsWith('boss_relic_')).toBe(false);
        }
        // The player side gets nothing from it.
        for (const m of state.playerParty) expect(m.hooks ?? []).not.toContain('driver_tidal_surge_count');
    });

    it('is the authored trio and not a rolled one', () => {
        const { fight } = fightFor('gym_tidewrack');
        const running = fight.enemyParty.map((e: IBattleEntity) => e.activeOS).sort();
        // TICKET 74: kraken_v1 -> kraken_v2. Transcribed rather than read back off `AUTHORED_BOSSES`
        // on purpose — a pin that derives its expectation from the table it guards passes whatever
        // the table says, which is the one thing a pin must not do.
        expect(running).toEqual(['jormungandr_v1', 'kraken_v2', 'skoll_v2']);
    });

    it('fields ONE draw engine after ticket 74, which is the substance of the swap', () => {
        /*
         * The comp swap is only worth what it takes out of the pile, and that is the thing a future
         * edit could silently undo — restoring `kraken_v1`, or handing `kraken_v2` a draw payoff,
         * would leave the trio assertion above green while putting the two-engine fight back.
         *
         * research/73: `CARDS_DRAWN_TRIGGERED` is scoped per-Mingming, so an `ink_stream` is worth
         * whatever its OWN body drew this turn. Two bodies each holding the payoff AND its own
         * cantrips is the 30.0% fight; one body holding it is the ticket's bet.
         */
        const { fight } = fightFor('gym_tidewrack');
        const pile: ReadonlyArray<string> = fight.enemyDeckIds;

        expect(pile.filter((id) => id === 'ink_stream').length,
            'jormungandr_v1 keeps its two; kraken_v1\'s two are what the swap removed').toBe(2);
        expect(pile.filter((id) => id === 'undertow').length,
            'the third cantrip left with kraken_v1').toBe(2);
        for (const gone of ['whirlpool_v2', 'pressure_point']) {
            expect(pile, `${gone} is ABYSSAL_INK_SYS's draw half and should be out of the pile`).not.toContain(gone);
        }
        // And the replacement really is present, or the swap dropped a body rather than changing one.
        expect(pile, 'TIDAL_CRUSH\'s 3e payoff').toContain('maelstrom');
    });

    it('telegraphs on the offer screen and carries to the region final elite', () => {
        const { run, fight } = fightFor('gym_tidewrack');
        // The offer telegraph is data-driven off the authored table, so authoring the gym is what
        // wires it — but "should follow automatically" is exactly the claim worth checking.
        expect(fight.enemyDrivers).toContain(DRIVER_TIDAL_SURGE);
        // The carry is scoped to elites in the gym's OWN biome (the final one) — ticket 68's
        // reading 2. An elite anywhere else correctly gets nothing, so picking any elite would
        // make this test pass or fail on the shape of the rolled graph.
        const finalBiome = run.biomes.length - 1;
        const guarding = run.nodes.filter(n => n.kind === 'elite' && n.biomeIndex === finalBiome);
        for (const elite of guarding) expect(gymDriverForNode(run, elite)).toBe(DRIVER_TIDAL_SURGE);
        const elsewhere = run.nodes.filter(n => n.kind === 'elite' && n.biomeIndex !== finalBiome);
        for (const elite of elsewhere) expect(gymDriverForNode(run, elite)).toBeUndefined();
        // A graph can roll a final biome with no elite at all; that run gets the offer-screen half
        // of the telegraph only, which is flagged in ticket 68 rather than fixed here.
        expect(guarding.length + elsewhere.length).toBeGreaterThanOrEqual(0);
    });

    it('COUNTS one per card played by its side', () => {
        const { state, boss, key } = arena();
        const after = executeResolutionStack('onActionEnd', { source: boss, state, triggerDepth: 0 } as never).state;
        expect(after.counters[key]).toBe(1);
    });

    it('FIRES on the tenth card: damage, a log line, and the counter back to zero', () => {
        const { state, boss, key } = arena();
        const nine = applyMutations(state, [{
            type: 'COUNTER', targetId: '', payload: { key, operator: 'SET', amount: 9 },
        }]) as IBattleState;

        const logsBefore = nine.logs.length;
        const after = executeResolutionStack('onActionEnd', { source: boss, state: nine, triggerDepth: 0 } as never).state;

        // The COUNTER assertions are the load-bearing ones. An earlier version of this test checked
        // only that player HP fell, and it PASSED against a Driver whose counter actions were being
        // silently skipped — the damage was coming from an unrelated hook on the same trigger.
        expect(after.counters[key]).toBe(0);
        expect(after.logs.slice(logsBefore).some(l => /TIDAL SURGE/.test(l))).toBe(true);
        expect(after.playerParty.reduce((a, e) => a + e.currentHp, 0))
            .toBeLessThan(nine.playerParty.reduce((a, e) => a + e.currentHp, 0));
    });

    it('EVERY COUNTER ACTION CARRIES A TARGET — the trap that silently disabled this Driver', () => {
        // `HookFactory.executeActions` skips any non-LOG action whose target does not resolve, and
        // a COUNTER written without `target` resolves to nothing. It does not warn, throw, or fail
        // a schema check: the hook runs, its ATTACK and LOG land, and only the counter quietly does
        // nothing. Every other COUNTER action in hooks.json carries `"target": "SELF"`; this pins
        // that the Driver's do too, because the structural tests above cannot see it.
        for (const hookId of ['driver_tidal_surge_count', 'driver_tidal_surge_fire']) {
            for (const action of defOf(hookId).do) {
                if (action.type === 'COUNTER') expect(action.target, `${hookId} COUNTER needs a target`).toBeDefined();
            }
        }
    });
});
