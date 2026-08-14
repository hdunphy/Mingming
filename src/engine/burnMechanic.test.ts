import { describe, it, expect, afterEach } from 'vitest';
import { getStatusBehavior, BURN_CONFIG, type BurnMechanicConfig } from './StatusBehaviors';
import { DEFAULT_GAME_CONFIG } from './data/gameConfig';
import type { IBattleEntity, StatusEffectInstance } from './types';

/**
 * Ticket 62 — BurnBehavior's config refactor.
 *
 * The point of this file is the FIRST describe block: the committed `BURN_CONFIG` must
 * reproduce the pre-62 behaviour exactly, so the grid's refactor cannot ship a balance change
 * under cover of a refactor. The rest pins the DETONATE shape the grid measures, which is
 * NOT live and is reached only by mutating the config in memory.
 */

const target = (maxHp: number): IBattleEntity =>
    ({ id: 't1', name: 'Target', maxHp, currentHp: maxHp, defense: 100 } as IBattleEntity);

const burn = (stacks: number): StatusEffectInstance => ({ id: 'b1', type: 'Burn', stacks });

const LIVE: BurnMechanicConfig = { ...BURN_CONFIG, tiers: BURN_CONFIG.tiers };

/** Grid arms mutate the module-level config; every test here puts it back. */
function withConfig<T>(patch: Partial<BurnMechanicConfig>, fn: () => T): T {
    Object.assign(BURN_CONFIG, patch);
    try {
        return fn();
    } finally {
        Object.assign(BURN_CONFIG, LIVE);
    }
}

afterEach(() => Object.assign(BURN_CONFIG, LIVE));

describe('BURN_CONFIG reproduces the live pre-ticket-62 behaviour', () => {
    it('the committed config IS the historical constant set', () => {
        expect(BURN_CONFIG.shape).toBe('VENT');
        expect(BURN_CONFIG.maxStacks).toBe(3);
        expect(BURN_CONFIG.overflowPercent).toBe(0.01);
        expect(BURN_CONFIG.tiers).toBe(DEFAULT_GAME_CONFIG.status.burnStacks);
    });

    it('stacks below the cap add normally', () => {
        const b = getStatusBehavior('Burn');
        const r = b.onApply([burn(1)], 1, target(80));
        expect(r.updatedEffects.find(s => s.type === 'Burn')?.stacks).toBe(2);
        expect(r.immediateDamage).toBe(0);
    });

    it('overflow HOLDS the pile at the cap — it does not reset it', () => {
        const b = getStatusBehavior('Burn');
        const r = b.onApply([burn(3)], 2, target(80));
        expect(r.updatedEffects.find(s => s.type === 'Burn')?.stacks).toBe(3);
    });

    it('overflow pays ZERO on every frame under 100 max HP (ticket 58: 0 damage across 54,767 stacks)', () => {
        const b = getStatusBehavior('Burn');
        for (const hp of [58, 66, 75, 80, 95, 99]) {
            expect(b.onApply([burn(3)], 3, target(hp)).immediateDamage).toBe(0);
        }
        // ...and starts biting only at 100+, one per excess stack.
        expect(b.onApply([burn(3)], 2, target(120)).immediateDamage).toBe(2);
    });

    it('ticks at the live tiers and decays one stack a turn', () => {
        const b = getStatusBehavior('Burn');
        const e = target(1000);
        const tiers = DEFAULT_GAME_CONFIG.status.burnStacks;
        expect(b.endTurn(burn(3), e).damage).toBe(Math.floor(1000 * tiers[2].damagePercent));
        expect(b.endTurn(burn(3), e).defenseShred).toBe(Math.floor(100 * tiers[2].defShredPercent));
        expect(b.endTurn(burn(3), e).updatedInstance?.stacks).toBe(2);
        expect(b.endTurn(burn(1), e).updatedInstance).toBeNull();
    });
});

describe('DETONATE shape (ticket 62 grid — not live)', () => {
    const D = { shape: 'DETONATE' as const, overflowPercent: 0.06 };

    it('3 + 1 = 4 → ONE detonation, 1 stack remains', () => {
        withConfig(D, () => {
            const r = getStatusBehavior('Burn').onApply([burn(3)], 1, target(100));
            expect(r.updatedEffects.find(s => s.type === 'Burn')?.stacks).toBe(1);
            expect(r.immediateDamage).toBe(6);
            expect(r.logs.filter(l => l.includes('Detonation'))).toHaveLength(1);
        });
    });

    it('3 + 4 = 7 → TWO detonations, 1 stack remains', () => {
        withConfig(D, () => {
            const r = getStatusBehavior('Burn').onApply([burn(3)], 4, target(100));
            expect(r.updatedEffects.find(s => s.type === 'Burn')?.stacks).toBe(1);
            expect(r.immediateDamage).toBe(12);
            expect(r.logs.filter(l => l.includes('Detonation'))).toHaveLength(2);
        });
    });

    it('3 + 3 = 6 → ONE detonation and the pile stays AT the cap (exactly divisible)', () => {
        withConfig(D, () => {
            const r = getStatusBehavior('Burn').onApply([burn(3)], 3, target(100));
            expect(r.updatedEffects.find(s => s.type === 'Burn')?.stacks).toBe(3);
            expect(r.immediateDamage).toBe(6);
        });
    });

    it('a single-stack applier detonates at most every 3rd cast into a hot target', () => {
        withConfig(D, () => {
            const b = getStatusBehavior('Burn');
            let effects: StatusEffectInstance[] = [burn(3)];
            const paid: number[] = [];
            for (let i = 0; i < 6; i++) {
                const r = b.onApply(effects, 1, target(100));
                effects = r.updatedEffects;
                paid.push(r.immediateDamage);
            }
            // cast 1 detonates (4 -> 1), then 2 and 3 rebuild, cast 4 detonates again.
            expect(paid).toEqual([6, 0, 0, 6, 0, 0]);
        });
    });

    it('carries at a higher cap too: cap 5, 5 + 6 = 11 → two detonations, 1 remains', () => {
        withConfig({ ...D, maxStacks: 5 }, () => {
            const r = getStatusBehavior('Burn').onApply([burn(5)], 6, target(100));
            expect(r.updatedEffects.find(s => s.type === 'Burn')?.stacks).toBe(1);
            expect(r.immediateDamage).toBe(12);
        });
    });

    it('is symmetric: the payout is computed against the BURNED entity, whoever applied it', () => {
        withConfig(D, () => {
            const small = getStatusBehavior('Burn').onApply([burn(3)], 1, target(60));
            const big = getStatusBehavior('Burn').onApply([burn(3)], 1, target(120));
            expect(small.immediateDamage).toBe(3);
            expect(big.immediateDamage).toBe(7);
        });
    });
});

describe('VENT shape at a live dial (ticket 62 grid — the historical design)', () => {
    it('every excess stack pays and the pile holds at the cap', () => {
        withConfig({ shape: 'VENT', overflowPercent: 0.06 }, () => {
            const r = getStatusBehavior('Burn').onApply([burn(3)], 4, target(100));
            expect(r.updatedEffects.find(s => s.type === 'Burn')?.stacks).toBe(3);
            expect(r.immediateDamage).toBe(24);
        });
    });

    it('pays 4x what DETONATE pays on the same 3 + 4 application — the rate difference the grid measures', () => {
        const vent = withConfig({ shape: 'VENT', overflowPercent: 0.06 }, () =>
            getStatusBehavior('Burn').onApply([burn(3)], 4, target(100)).immediateDamage);
        const det = withConfig({ shape: 'DETONATE', overflowPercent: 0.06 }, () =>
            getStatusBehavior('Burn').onApply([burn(3)], 4, target(100)).immediateDamage);
        expect(vent).toBe(24);
        expect(det).toBe(12);
    });
});

describe('spread tick tiers (cap 4 and cap 5 arms)', () => {
    const C4 = [
        { damagePercent: 0.015, defShredPercent: 0 },
        { damagePercent: 0.03, defShredPercent: 0.01 },
        { damagePercent: 0.05, defShredPercent: 0.025 },
        { damagePercent: 0.08, defShredPercent: 0.05 },
    ];

    it('the top tier is identical to the live one, and the climb is longer', () => {
        withConfig({ maxStacks: 4, tiers: C4 }, () => {
            const b = getStatusBehavior('Burn');
            const e = target(1000);
            expect(b.endTurn(burn(4), e).damage).toBe(80);
            expect(b.endTurn(burn(4), e).defenseShred).toBe(5);
            expect(b.endTurn(burn(3), e).damage).toBe(50);
            expect(b.endTurn(burn(2), e).damage).toBe(30);
            expect(b.endTurn(burn(1), e).damage).toBe(15);
        });
    });

    it('config is restored between arms — the live tiers are back', () => {
        expect(BURN_CONFIG.tiers).toBe(DEFAULT_GAME_CONFIG.status.burnStacks);
        expect(BURN_CONFIG.maxStacks).toBe(3);
    });
});
