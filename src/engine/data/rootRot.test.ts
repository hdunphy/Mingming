/**
 * ROOT ROT — ticket 72, and the two traps it is built around.
 *
 * The Driver reads *"whenever this side's card applies Poison, it applies 1 more."* Both of the
 * things that can go wrong here are silent.
 *
 * # TRAP 1: `baseCost` on an `onStatusApplied` hook
 *
 * Named by the ticket, from the deck-archetypes handbook: a `baseCost` clause on this trigger
 * **silently disables the hook**. Nothing errors and the schema is happy — the Driver simply never
 * fires, and a boss that does nothing reads as a boss that is weak.
 *
 * # TRAP 2: the hook re-entering itself
 *
 * `onStatusApplied` is dispatched from `effectHandlers`' single status-application path, so a hook
 * that *applies a status* on that trigger re-enters it. There is no infinite loop —
 * `resolutionEngine` caps synchronous nesting at 12 — but that is a cap, not a design: unguarded,
 * "applies 1 more" would apply about **twelve** more and spray `CRITICAL_EVENT_OVERFLOW` warnings
 * while doing it. The Driver guards itself with a SIDE-scoped re-entry flag set before the nested
 * application and cleared after, so the nested copy's `when` fails.
 *
 * Neither trap throws. Both produce a Driver that looks fine and is wrong, which is why the
 * behavioural test below counts STACKS rather than checking that something happened.
 */

import { describe, expect, it } from 'vitest';

import { effectHandlers } from '../effectHandlers';
import { getHook } from '../core/HookRegistry';
import { applyDriver, getDriver, DRIVER_ROOT_ROT } from './driverRegistry';
import { matchupScenario } from '../../debug/balance/balanceScenarios';
import { buildScenarioState } from '../../debug/scenarios/buildScenarioState';
import type { IBattleState } from '../types';

type HookDecl = {
    trigger: string;
    baseCost?: unknown;
    when: { statusApplied?: string; counter?: { key: string; scope?: string; operator?: string; value?: number } };
    do: Array<{ type?: string; target?: string; status?: string; stacks?: number; operator?: string; scope?: string }>;
};
const decl = (): HookDecl => {
    const wrapper = getDriver(DRIVER_ROOT_ROT)!.hooks
        .find(h => h.id === 'driver_root_rot_spread') as unknown as { data: HookDecl };
    return wrapper.data;
};

const arena = (withDriver: boolean): IBattleState => {
    const setup = matchupScenario({
        player: 'fenrir', enemy: 'jormungandr',
        playerOS: 'fenrir_v1', enemyOS: 'jormungandr_v2', seed: 'root-rot',
    });
    const base = buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
    if (!withDriver) return base;
    return { ...base, enemyParty: base.enemyParty.map(e => applyDriver(e, DRIVER_ROOT_ROT)) } as IBattleState;
};

const poisonOn = (s: IBattleState, id: string): number =>
    [...s.playerParty, ...s.enemyParty].find(e => e.id === id)!
        .statusEffects.find(x => x.type === 'Poison')?.stacks ?? 0;

/** Apply Poison from the enemy side to the player's first unit, the way a card would. */
const applyPoison = (s: IBattleState, stacks: number): IBattleState =>
    effectHandlers.APPLY_STATUS(s, {
        targetId: s.playerParty[0].id, status: 'Poison', stacks, sourceId: s.enemyParty[0].id,
    } as never) as IBattleState;

describe('ROOT ROT', () => {
    it('is registered and attaches without touching the member’s own firmware', () => {
        const driver = getDriver(DRIVER_ROOT_ROT);
        expect(driver?.name).toBe('ROOT ROT');
        expect(driver?.description).toMatch(/Poison/);

        const member = { id: 'm1', hooks: [], activeOS: 'jormungandr_v2' } as never;
        const after = applyDriver(member, DRIVER_ROOT_ROT);
        expect(after.hooks).toContain('driver_root_rot_spread');
        expect(after.activeOS).toBe('jormungandr_v2');
    });

    it('DOES NOT CARRY baseCost — the trap that silently disables an onStatusApplied hook', () => {
        const d = decl();
        expect(d.trigger).toBe('onStatusApplied');
        expect(d.baseCost).toBeUndefined();
        // Read through the BUILT hook too: a clause the schema stripped would be absent from the
        // declaration for the wrong reason, and this is the version the engine actually runs.
        expect(getHook('driver_root_rot_spread')?.onStatusApplied).toBeTypeOf('function');
    });

    it('adds EXACTLY ONE stack — not twelve, which is what an unguarded version would do', () => {
        const withoutDriver = applyPoison(arena(false), 3);
        const withDriver = applyPoison(arena(true), 3);

        const target = arena(false).playerParty[0].id;
        expect(poisonOn(withoutDriver, target)).toBe(3);
        expect(poisonOn(withDriver, target)).toBe(4);
    });

    it('scales with the application, not with the stack count', () => {
        // "+1 per application" — a 1-stack card and a 5-stack card each get one extra, which is
        // what makes the Driver worth ~3-4 stacks a turn rather than a multiplier on the pile.
        const target = arena(false).playerParty[0].id;
        expect(poisonOn(applyPoison(arena(true), 1), target)).toBe(2);
        expect(poisonOn(applyPoison(arena(true), 5), target)).toBe(6);
    });

    it('CLEARS its re-entry flag, so the second card of the fight still procs', () => {
        // The guard is set before the nested application and reset after. If the reset were ever
        // dropped, the Driver would fire once per battle and every measurement of it would read as
        // "ROOT ROT is too weak" rather than as a bug.
        const once = applyPoison(arena(true), 2);
        const flag = Object.entries(once.counters ?? {}).find(([k]) => k.includes('root_rot_reentry'));
        expect(flag?.[1]).toBe(0);

        const twice = applyPoison(once, 2);
        expect(poisonOn(twice, once.playerParty[0].id)).toBe(3 + 3);
    });

    it('is PROC-VISIBLE, once per application', () => {
        const before = arena(true);
        const after = applyPoison(before, 2);
        const lines = after.logs.slice(before.logs.length).filter(l => /ROOT ROT/.test(l));
        expect(lines).toHaveLength(1);
    });

    it('guards with a SIDE-scoped flag, and every COUNTER action carries a target', () => {
        const d = decl();
        expect(d.when.statusApplied).toBe('Poison');
        expect(d.when.counter?.scope).toBe('SIDE');
        // Ticket 71's lesson: a COUNTER with no `target` is silently skipped by
        // `HookFactory.executeActions`, which here would remove the guard and restore the
        // twelve-deep cascade.
        for (const a of d.do) {
            if (a.type === 'COUNTER') expect(a.target, 'COUNTER needs a target').toBeDefined();
        }
        expect(d.do.some(a => a.type === 'COUNTER' && a.operator === 'SET')).toBe(true);
        expect(d.do.some(a => a.type === 'COUNTER' && a.operator === 'RESET')).toBe(true);
    });
});
