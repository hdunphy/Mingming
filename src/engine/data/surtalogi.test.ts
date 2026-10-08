/**
 * SURTALOGI — Emberfall's Totem since ticket 207 (Henry, 2026-10-08: *"Change this totem to give
 * more damage on overflow for burn"*, and *"5% is good"*).
 *
 * Whenever this side makes an enemy's Burn detonate, the blast deals 5% more of that enemy's max HP.
 * The hook rides `onStatusApplied` and reads `statusDetonated`, which `applyStatus` sets only when
 * the application crossed the cap. So the checks below are about WHEN it fires as much as how much:
 * a Burn that does not detonate must not pay.
 */
import { describe, expect, it } from 'vitest';

import { effectHandlers } from '../effectHandlers';
import { BURN_CONFIG } from '../StatusBehaviors';
import { applyDriver, getDriver, DRIVER_SURTALOGI } from './driverRegistry';
import { matchupScenario } from '../../debug/balance/balanceScenarios';
import { buildScenarioState } from '../../debug/scenarios/buildScenarioState';
import type { IBattleState } from '../types';

const arena = (withDriver: boolean): IBattleState => {
    const setup = matchupScenario({
        player: 'kraken', enemy: 'skoll',
        playerOS: 'kraken_v2', enemyOS: 'skoll_v2', seed: 'surtalogi',
    });
    const base = buildScenarioState({ ...setup, seed: setup.seed }) as IBattleState;
    if (!withDriver) return base;
    return { ...base, enemyParty: base.enemyParty.map((e) => applyDriver(e, DRIVER_SURTALOGI)) } as IBattleState;
};

/** Burn from the enemy side onto the player's first unit, the way a card would apply it. */
const burn = (s: IBattleState, stacks: number): IBattleState =>
    effectHandlers.APPLY_STATUS(s, {
        targetId: s.playerParty[0].id, status: 'Burn', stacks, sourceId: s.enemyParty[0].id,
    } as never) as IBattleState;

const hp = (s: IBattleState): number => s.playerParty[0].currentHp;
const surtalogiLines = (before: IBattleState, after: IBattleState): string[] =>
    after.logs.slice(before.logs.length).filter((l) => /SURTALOGI/.test(l));

describe('SURTALOGI', () => {
    it('is registered, named, and attaches without touching the member’s firmware', () => {
        const driver = getDriver(DRIVER_SURTALOGI);
        expect(driver?.name).toBe('SURTALOGI');
        expect(driver?.description).toMatch(/Burn/);
        expect(driver?.description).toMatch(/5%/);
        const member = { id: 'm1', hooks: [], activeOS: 'skoll_v2' } as never;
        const after = applyDriver(member, DRIVER_SURTALOGI);
        expect(after.hooks).toContain('driver_surtalogi_blast');
        expect(after.activeOS).toBe('skoll_v2');
    });

    it('does nothing on a Burn that does not detonate', () => {
        const before = arena(true);
        const after = burn(before, BURN_CONFIG.maxStacks);
        expect(surtalogiLines(before, after)).toHaveLength(0);
        expect(hp(after)).toBe(hp(burn(arena(false), BURN_CONFIG.maxStacks)));
    });

    it('adds 5% of the target’s max HP to a detonation, once', () => {
        const loaded = burn(arena(true), BURN_CONFIG.maxStacks);
        const plainLoaded = burn(arena(false), BURN_CONFIG.maxStacks);
        const blown = burn(loaded, 1);
        const plainBlown = burn(plainLoaded, 1);
        expect(surtalogiLines(loaded, blown)).toHaveLength(1);
        const maxHp = loaded.playerParty[0].maxHp;
        const extra = (hp(loaded) - hp(blown)) - (hp(plainLoaded) - hp(plainBlown));
        expect(extra).toBe(Math.max(1, Math.floor(maxHp * 5 / 100)));
    });

    it('does not fire for the OTHER side’s detonations', () => {
        const before = arena(true);
        // The player burns the enemy past the cap: the enemy's Totem must not pay for that.
        const onEnemy = (s: IBattleState, stacks: number): IBattleState =>
            effectHandlers.APPLY_STATUS(s, {
                targetId: s.enemyParty[0].id, status: 'Burn', stacks, sourceId: s.playerParty[0].id,
            } as never) as IBattleState;
        const after = onEnemy(onEnemy(before, BURN_CONFIG.maxStacks), 1);
        expect(surtalogiLines(before, after)).toHaveLength(0);
    });
});
