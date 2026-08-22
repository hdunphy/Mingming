import { describe, it, expect } from 'vitest';
import PROGRAMS from './programs.json';
import HOOKS_DATA from './lib/hooks.json';
import { initDaemonHooks } from './daemonHooks';
import { getOSBehavior } from './firmwareRegistry';
import { getHook } from '../core/HookRegistry';
import { HookFactory } from '../core/HookFactory';
import { createBattleState } from './battleFactories';
import type { IPlayerSave } from '../gameTypes';

// Force both registration paths before asserting anything.
initDaemonHooks();
getOSBehavior('fenrir_v1'); // triggers firmware init (OS + boss relic hooks)

describe('programs.json hook wiring', () => {
    it('every hook id referenced by a card resolves to a registered hook', () => {
        const programs = PROGRAMS as Record<string, { hooks?: string[] }>;
        const missing: string[] = [];

        for (const [cardId, card] of Object.entries(programs)) {
            if (!card.hooks) continue;
            for (const hookId of card.hooks) {
                if (!getHook(hookId)) {
                    missing.push(`${cardId} -> ${hookId}`);
                }
            }
        }

        expect(missing, `Cards referencing unregistered hooks: ${missing.join(', ')}`).toEqual([]);
    });

    it('the five previously-inert daemon cards resolve to live hooks', () => {
        const expectations: Record<string, string> = {
            harden_daemon: 'defensive_daemon_hook',
            core_overclock_daemon: 'daemon_double_strength',
            cinder_armor_daemon: 'daemon_burn_sharp_synergy',
            feedback_loop_daemon: 'daemon_draw_damage_proc',
            fertile_ground_daemon: 'daemon_extra_draw'
        };

        const programs = PROGRAMS as Record<string, { hooks?: string[] }>;
        for (const [cardId, hookId] of Object.entries(expectations)) {
            expect(programs[cardId].hooks, `${cardId} should reference ${hookId}`).toContain(hookId);
            expect(getHook(hookId), `${hookId} should be registered`).toBeDefined();
        }
    });
});

describe('boss relic OSes', () => {
    it('getOSBehavior returns a working definition for each boss relic', () => {
        const fire = getOSBehavior('boss_relic_fire');
        expect(fire).toBeDefined();
        expect(fire!.hooks.length).toBeGreaterThan(0);
        expect(getHook('boss_relic_fire_end')?.onTurnEnd).toBeTypeOf('function');

        const water = getOSBehavior('boss_relic_water');
        expect(water).toBeDefined();
        expect(water!.hooks.length).toBeGreaterThan(0);
        expect(getHook('boss_relic_water_reactive')?.onPostDamage).toBeTypeOf('function');

        const ice = getOSBehavior('boss_relic_ice');
        expect(ice).toBeDefined();
        expect(ice!.hooks.length).toBeGreaterThan(0);
        expect(getHook('boss_relic_ice_tax')?.onCostCalculated).toBeTypeOf('function');
    });

    it('a gym tier-3 boss retains its boss_relic OS through createBattleState', () => {
        const save: IPlayerSave = {
            version: 2,
            roster: [
                {
                    id: 'mm1',
                    definitionId: 'fenrir',
                    nickname: 'Iggy',
                    blueprintsCollected: 0,
                    hpIV: 10,
                    attackIV: 10,
                    defenseIV: 10
                }
            ],
            activeParty: ['mm1'],
            cardInventory: [],
            activeDeck: null,
            scrapCount: 0,
            blueprints: {},
            relics: [],
            gauntlet: {
                type: 'Gym',
                element: 'Fire',
                currentBattleIndex: 2, // Tier 3: Gym Leader
                totalBattles: 3,
                persistedStats: {}
            },
            unlockedSectors: ['Fire', 'Water', 'Nature'],
            baseDecksGranted: []
        };

        const state = createBattleState(save, []);

        expect(state.enemyParty).toHaveLength(3);
        const boss = state.enemyParty.find(e => e.activeOS?.startsWith('boss_relic_'));
        expect(boss, 'gym boss should keep its boss_relic OS').toBeDefined();
        expect(boss!.activeOS).toBe('boss_relic_fire');
        expect(getOSBehavior(boss!.activeOS!)).toBeDefined();

        // Regular enemies (the guards) still have their OS stripped.
        const others = state.enemyParty.filter(e => e.id !== boss!.id);
        expect(others).toHaveLength(2);
        others.forEach(guard => expect(guard.activeOS).toBeUndefined());
    });
});

describe('data-driven condition translations', () => {
    const makeEntity = (id: string, statusEffects: any[] = []): any => ({
        id,
        name: id,
        currentHp: 100,
        maxHp: 100,
        currentEnergy: 3,
        maxEnergy: 3,
        statusEffects,
        daemons: []
    });

    const makeState = (playerParty: any[], enemyParty: any[]): any => ({
        playerParty,
        enemyParty,
        logs: [],
        counters: {},
        seed: '42'
    });

    it('draugr_v2_chill (onDamageCalculated, ticket 12 rebuild) reduces damage 20% only when the source has 2+ debuff types', () => {
        const hook = getHook('draugr_v2_chill');
        expect(hook?.onDamageCalculated).toBeTypeOf('function');

        const draugr = makeEntity('draugr');
        const cleanAttacker = makeEntity('attacker_clean');
        const debuffedAttacker = makeEntity('attacker_debuffed', [
            { type: 'Burn', stacks: 1 },
            { type: 'Weakened', stacks: 2 }
        ]);
        const state = makeState([cleanAttacker, debuffedAttacker], [draugr]);

        const cleanDamage = hook!.onDamageCalculated!(20, { state, source: cleanAttacker, target: draugr, triggerDepth: 0 }, draugr);
        expect(cleanDamage).toBe(20);

        const chilledDamage = hook!.onDamageCalculated!(20, { state, source: debuffedAttacker, target: draugr, triggerDepth: 0 }, draugr);
        expect(chilledDamage).toBe(16);
    });

    it('fafnir_v2_corrupted pays 2 Strengthened per DISTINCT debuff at turn start (ticket 52)', () => {
        // Ticket 52 rewrote this OS. It used to grant +1 Energy per debuff APPLICATION, which
        // mostly did nothing: debuffs arrive on the enemy's turn and `processPreTurn` SETS
        // currentEnergy rather than adding, so the point was deleted before Fafnir could spend
        // it (third occurrence of that trap - BLOOD_SCENT ticket 39, PERMAFROST_WAKE ticket 48).
        // It now reads distinct TYPES at turn start, so a self-debuff card pays once per turn
        // rather than once per cast.
        const hook = HookFactory.createHook((HOOKS_DATA as any).fafnir_v2.hooks[0]);
        expect(hook!.onTurnStart).toBeDefined();
        expect(hook!.onStatusApplied).toBeUndefined();

        const clean = makeEntity('fafnir');
        const cleanState = makeState([makeEntity('p')], [clean]);
        const noDebuffs = hook!.onTurnStart!({ state: cleanState, source: clean, target: clean, triggerDepth: 0 } as any, clean);
        const afterClean = noDebuffs.state.enemyParty.find((e: any) => e.id === 'fafnir')!;
        expect(afterClean.statusEffects.some((s: any) => s.type === 'Strengthened')).toBe(false);

        // Two DISTINCT types, six stacks between them: the grant reads types, not stacks.
        const rotted = makeEntity('fafnir', [
            { id: 's1', type: 'Poison', stacks: 4 },
            { id: 's2', type: 'Dazed', stacks: 2 },
        ]);
        const rottedState = makeState([makeEntity('p')], [rotted]);
        const result = hook!.onTurnStart!({ state: rottedState, source: rotted, target: rotted, triggerDepth: 0 } as any, rotted);
        const after = result.state.enemyParty.find((e: any) => e.id === 'fafnir')!;
        expect(after.statusEffects.find((s: any) => s.type === 'Strengthened')?.stacks).toBe(4);
        // ...and each of those debuffs sheds a stack, which is what stops it compounding forever.
        expect(after.statusEffects.find((s: any) => s.type === 'Poison')?.stacks).toBe(3);
        expect(after.statusEffects.find((s: any) => s.type === 'Dazed')?.stacks).toBe(1);
    });

    it('hel_v2_underworld_toll taxes DARK cards with a printed cost, and only those (ticket 57)', () => {
        // History, because this `when` has now moved twice. Ticket 36 WIDENED it from
        // "Dark non-Attacks" to every card with a printed cost, on the reasoning that the OS
        // zeroed her Energy outright. Ticket 57 NARROWED it back to Dark, because the approved
        // OS text is "Hel's DARK spells cost 5% of her max HP ... instead of Energy" - so her
        // Light and None cards pay Energy again, which is what keeps the new 20% blood cap from
        // being a hard stop on her turn. The hook also left hooks.json for CustomFirmware, since
        // the cap needs per-card arithmetic a data `when` cannot express.
        const hook = getHook('hel_v2_underworld_toll');
        const hel = makeEntity('hel');
        const state = makeState([hel], [makeEntity('e')]);

        const darkAttack: any = { id: 'atk', category: 'Attack', element: 'Dark', baseCost: 2, actions: [] };
        const attackResult = hook!.onActionStart!({ state, source: hel, program: darkAttack, triggerDepth: 0 }, hel);
        expect(attackResult.state.logs.some((l: string) => l.includes('UNDERWORLD_GATEWAY'))).toBe(true);

        const lightSkill: any = { id: 'spell', category: 'Skill', element: 'Light', baseCost: 2, actions: [] };
        const spellResult = hook!.onActionStart!({ state, source: hel, program: lightSkill, triggerDepth: 0 }, hel);
        expect(spellResult.state.logs.some((l: string) => l.includes('UNDERWORLD_GATEWAY'))).toBe(false);

        const freebie: any = { id: 'free', category: 'Attack', element: 'Dark', baseCost: 0, actions: [] };
        const freeResult = hook!.onActionStart!({ state, source: hel, program: freebie, triggerDepth: 0 }, hel);
        expect(freeResult.state.logs.some((l: string) => l.includes('UNDERWORLD_GATEWAY'))).toBe(false);
    });

    it('hel_v2_underworld_cost zeroes the Energy cost of her cards (onCostCalculated multiplier 0)', () => {
        const hook = getHook('hel_v2_underworld_cost');
        const hel = makeEntity('hel');
        const state = makeState([hel], [makeEntity('e')]);

        const bigSpell: any = { id: 'soul_tithe', category: 'Attack', element: 'Dark', baseCost: 3, actions: [] };
        expect(hook!.onCostCalculated!(3, { state, source: hel, program: bigSpell, triggerDepth: 0 } as any, hel)).toBe(0);
    });

    it('RANDOM_ENEMY targeting advances the state seed (no repeated picks forever)', () => {
        const owner = makeEntity('owner');
        const state = makeState([owner], [makeEntity('e1'), makeEntity('e2')]);

        const { targetId, state: newState } = HookFactory.resolveTarget('RANDOM_ENEMY', { state, triggerDepth: 0 }, owner);
        expect(targetId).toBeTruthy();
        expect(newState.seed).not.toBe(state.seed);
    });
});

describe('HookFactory condition safety', () => {
    it('a non-function condition (e.g. a JS-source string in JSON) never crashes the hook', () => {
        const hook = HookFactory.createHook({
            id: 'test_bad_condition_hook',
            trigger: 'onTurnEnd',
            priority: 40,
            condition: '(context) => context.doesNotExist.boom' as any,
            do: []
        } as any);

        const owner: any = { id: 'o1', name: 'Owner', currentHp: 10, maxHp: 10, currentEnergy: 0, statusEffects: [], daemons: [] };
        const state: any = {
            playerParty: [owner],
            enemyParty: [],
            logs: [],
            counters: {},
            seed: '1'
        };

        expect(() => hook.onTurnEnd!({ state, triggerDepth: 0, source: owner }, owner)).not.toThrow();
    });
});
