import { describe, it, expect, afterEach } from 'vitest';
import { getStatusBehavior, BURN_CONFIG, type BurnMechanicConfig } from './StatusBehaviors';
import { DEFAULT_GAME_CONFIG } from './data/gameConfig';
import type { IBattleEntity, StatusEffectInstance } from './types';

/**
 * Ticket 62 — Burn's shipped mechanic.
 *
 * The FIRST describe block pins what is LIVE: DETONATE, cap 4, 14% of max HP per cap-crossing,
 * the four-tier spread table. It was written against the pre-62 config (VENT / cap 3 / 1%) to
 * prove the config refactor changed nothing, and was rewritten here when Henry shipped
 * `DET-C4-D14` — so its job is unchanged, only its subject moved.
 *
 * The later blocks exercise configurations that are NOT live (VENT, other caps), reached only
 * by mutating the config in memory the way ticket 62's grid arms did.
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

describe('BURN_CONFIG is the shipped ticket-62 mechanic (DET-C4-D14)', () => {
    it('the committed config is DETONATE / cap 4 / 14%', () => {
        expect(BURN_CONFIG.shape).toBe('DETONATE');
        expect(BURN_CONFIG.maxStacks).toBe(4);
        expect(BURN_CONFIG.overflowPercent).toBe(0.14);
        expect(BURN_CONFIG.tiers).toBe(DEFAULT_GAME_CONFIG.status.burnStacks);
        expect(BURN_CONFIG.tiers).toHaveLength(4);
    });

    it('the four-tier spread table keeps the 8% + 5%-shred top tier and lengthens the climb', () => {
        expect(DEFAULT_GAME_CONFIG.status.burnStacks.map(t => t.damagePercent))
            .toEqual([0.015, 0.03, 0.05, 0.08]);
        expect(DEFAULT_GAME_CONFIG.status.burnStacks.map(t => t.defShredPercent))
            .toEqual([0, 0.01, 0.025, 0.05]);
    });

    it('stacks below the cap add normally and pay nothing', () => {
        const b = getStatusBehavior('Burn');
        const r = b.onApply([burn(2)], 2, target(80));
        expect(r.updatedEffects.find(s => s.type === 'Burn')?.stacks).toBe(4);
        expect(r.immediateDamage).toBe(0);
    });

    it('crossing the cap detonates for 14% of max HP and carries the remainder', () => {
        const b = getStatusBehavior('Burn');
        const r = b.onApply([burn(4)], 1, target(80));
        expect(r.immediateDamage).toBe(11);           // floor(80 * 0.14)
        expect(r.updatedEffects.find(s => s.type === 'Burn')?.stacks).toBe(1);
        expect(r.logs.filter(l => l.includes('Detonation'))).toHaveLength(1);
    });

    it('exactly divisible stays AT the cap: 4 + 4 detonates once and leaves 4', () => {
        const r = getStatusBehavior('Burn').onApply([burn(4)], 4, target(80));
        expect(r.immediateDamage).toBe(11);
        expect(r.updatedEffects.find(s => s.type === 'Burn')?.stacks).toBe(4);
    });

    it('4 + 5 detonates TWICE and leaves 1', () => {
        const r = getStatusBehavior('Burn').onApply([burn(4)], 5, target(80));
        expect(r.immediateDamage).toBe(22);
        expect(r.updatedEffects.find(s => s.type === 'Burn')?.stacks).toBe(1);
    });

    it('a single-stack applier detonates at most every 4th cast into a hot target', () => {
        const b = getStatusBehavior('Burn');
        let effects: StatusEffectInstance[] = [burn(4)];
        const paid: number[] = [];
        for (let i = 0; i < 8; i++) {
            const r = b.onApply(effects, 1, target(80));
            effects = r.updatedEffects;
            paid.push(r.immediateDamage);
        }
        // cast 1 detonates (5 -> 1), casts 2-4 rebuild to 4, cast 5 detonates again.
        expect(paid).toEqual([11, 0, 0, 0, 11, 0, 0, 0]);
    });

    it('detonation is SYMMETRIC — it is priced off the burned entity, whoever applied it', () => {
        const b = getStatusBehavior('Burn');
        expect(b.onApply([burn(4)], 1, target(58)).immediateDamage).toBe(8);    // kraken frame
        expect(b.onApply([burn(4)], 1, target(120)).immediateDamage).toBe(16);  // ymir frame
    });

    it('unlike the old 1% overflow, detonation pays on EVERY frame in the roster', () => {
        const b = getStatusBehavior('Burn');
        for (const hp of [58, 66, 75, 80, 95, 99, 120]) {
            expect(b.onApply([burn(4)], 1, target(hp)).immediateDamage).toBeGreaterThan(0);
        }
    });

    it('ticks at the live tiers and decays one stack a turn', () => {
        const b = getStatusBehavior('Burn');
        const e = target(1000);
        expect(b.endTurn(burn(4), e).damage).toBe(80);
        expect(b.endTurn(burn(4), e).defenseShred).toBe(5);
        expect(b.endTurn(burn(4), e).updatedInstance?.stacks).toBe(3);
        expect(b.endTurn(burn(3), e).damage).toBe(50);
        expect(b.endTurn(burn(2), e).damage).toBe(30);
        expect(b.endTurn(burn(1), e).damage).toBe(15);
        expect(b.endTurn(burn(1), e).updatedInstance).toBeNull();
    });
});

describe('DETONATE at cap 3 (ticket 62 grid — measured, not shipped)', () => {
    const D = { shape: 'DETONATE' as const, maxStacks: 3, overflowPercent: 0.06 };

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

describe('VENT shape (ticket 62 grid — the historical design, not shipped)', () => {
    it('every excess stack pays and the pile holds at the cap', () => {
        withConfig({ shape: 'VENT', maxStacks: 3, overflowPercent: 0.06 }, () => {
            const r = getStatusBehavior('Burn').onApply([burn(3)], 4, target(100));
            expect(r.updatedEffects.find(s => s.type === 'Burn')?.stacks).toBe(3);
            expect(r.immediateDamage).toBe(24);
        });
    });

    it('pays 4x what DETONATE pays on the same 3 + 4 application — the rate difference the grid measures', () => {
        const vent = withConfig({ shape: 'VENT', maxStacks: 3, overflowPercent: 0.06 }, () =>
            getStatusBehavior('Burn').onApply([burn(3)], 4, target(100)).immediateDamage);
        const det = withConfig({ shape: 'DETONATE', maxStacks: 3, overflowPercent: 0.06 }, () =>
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
        expect(BURN_CONFIG.maxStacks).toBe(4);
        expect(BURN_CONFIG.shape).toBe('DETONATE');
    });
});
