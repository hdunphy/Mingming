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
            fenrir_v1_daemon: 'daemon_double_strength',
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
                    level: 10,
                    experience: 0,
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
            blueprints: [],
            relics: [],
            gauntlet: {
                type: 'Gym',
                element: 'Fire',
                currentBattleIndex: 2, // Tier 3: Gym Leader
                totalBattles: 3,
                persistedStats: {}
            },
            unlockedSectors: ['Fire', 'Water', 'Nature']
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

    it('draugr_v2_chill (onCostCalculated) charges +1 only when the source has 2+ debuffs', () => {
        const hook = getHook('draugr_v2_chill');
        expect(hook?.onCostCalculated).toBeTypeOf('function');

        const draugr = makeEntity('draugr');
        const cleanAttacker = makeEntity('attacker_clean');
        const debuffedAttacker = makeEntity('attacker_debuffed', [
            { type: 'Burn', stacks: 1 },
            { type: 'Weakened', stacks: 2 }
        ]);
        const state = makeState([cleanAttacker, debuffedAttacker], [draugr]);

        const cleanCost = hook!.onCostCalculated!(2, { state, source: cleanAttacker, target: draugr, triggerDepth: 0 }, draugr);
        expect(cleanCost).toBe(2);

        const taxedCost = hook!.onCostCalculated!(2, { state, source: debuffedAttacker, target: draugr, triggerDepth: 0 }, draugr);
        expect(taxedCost).toBe(3);
    });

    it('fafnir_v2_corrupted fires only for debuffs (statusAppliedIn)', () => {
        // Build straight from hooks.json data: the registered id is shadowed by the
        // hand-written CustomFirmware hook of the same id, and we specifically want
        // to exercise the data-driven statusAppliedIn condition here.
        const hook = HookFactory.createHook((HOOKS_DATA as any).fafnir_v2.hooks[0]);
        const fafnir = makeEntity('fafnir');
        fafnir.currentEnergy = 0;
        const state = makeState([makeEntity('p')], [fafnir]);

        // Buff applied to Fafnir: no energy gained
        const buffResult = hook!.onStatusApplied!({ state, target: fafnir, statusApplied: 'Strengthened' as any, triggerDepth: 0 }, fafnir);
        const fafnirAfterBuff = buffResult.state.enemyParty.find((e: any) => e.id === 'fafnir')!;
        expect(fafnirAfterBuff.currentEnergy).toBe(0);

        // Debuff applied to Fafnir: +1 energy
        const debuffResult = hook!.onStatusApplied!({ state, target: fafnir, statusApplied: 'Burn' as any, triggerDepth: 0 }, fafnir);
        const fafnirAfterDebuff = debuffResult.state.enemyParty.find((e: any) => e.id === 'fafnir')!;
        expect(fafnirAfterDebuff.currentEnergy).toBe(1);
    });

    it('hel_v2_underworld skips Attack cards and 0-cost cards (programCategoryNot + baseCost)', () => {
        const hook = getHook('hel_v2_underworld');
        const hel = makeEntity('hel');
        const state = makeState([hel], [makeEntity('e')]);

        const darkAttack: any = { id: 'atk', category: 'Attack', element: 'Dark', baseCost: 2, actions: [] };
        const attackResult = hook!.onActionStart!({ state, source: hel, program: darkAttack, triggerDepth: 0 }, hel);
        expect(attackResult.state.logs.some((l: string) => l.includes('UNDERWORLD_GATEWAY'))).toBe(false);

        const darkSpell: any = { id: 'spell', category: 'Skill', element: 'Dark', baseCost: 2, actions: [] };
        const spellResult = hook!.onActionStart!({ state, source: hel, program: darkSpell, triggerDepth: 0 }, hel);
        expect(spellResult.state.logs.some((l: string) => l.includes('UNDERWORLD_GATEWAY'))).toBe(true);
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
