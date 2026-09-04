/**
 * THE PITY FLOOR — Henry's ruling of 2026-09-01, after a solo run went 13 fights without a
 * blueprint. Measured at the time: every one of those fights dropped on ~20% of its possible
 * endings, so the roll was honest and the tail was simply long. A memoryless roll has no worst
 * case; this gives it one.
 *
 * The rule: `BLUEPRINT_PITY_FIGHTS` won fights with no blueprint, and the next win pays.
 *
 * WHAT THESE TESTS ARE ACTUALLY PROTECTING. Three things, and the second is the one a later change
 * is most likely to break by accident:
 *
 *  1. the floor fires at the ruled number — not one fight early, not one late;
 *  2. it fires ONCE, on the first corpse, so a three-body fight cannot turn one drought into three
 *     blueprints — a floor that pays a windfall stops being a floor;
 *  3. it does not disturb the seed chain. The roll is taken and then overridden, so the pick-1-of-3
 *     a player is offered is the same whether or not the floor fired. Mercy that silently changed
 *     the cards on the table would be a second, invisible effect nobody ruled.
 */

import { describe, expect, it } from 'vitest';

import { BLUEPRINT_PITY_FIGHTS, rollDropTable } from './RewardSystem';
import { PRNG } from './core/PRNG';
import { createSparseEntity } from '../debug/scenarios/scenarioTestSupport';
import type { IBattleEntity } from './types';

const corpse = (id: string, definitionId: string): IBattleEntity =>
    createSparseEntity({ id, definitionId, name: definitionId, currentHp: 0 });

const PARTY = [createSparseEntity({ id: 'p1', definitionId: 'kraken', name: 'Kraken', activeOS: 'kraken_v1' })];

/** Seeds deep in the LCG chain, the shape a fight actually ends on. */
function seeds(count: number): string[] {
    const out: string[] = [];
    let seed = 'pity-chain:0';
    for (let i = 0; i < count; i++) {
        for (let roll = 0; roll < 250; roll++) seed = String(new PRNG(seed).next().nextSeed);
        out.push(seed);
    }
    return out;
}

/** A seed the solo wild rate does NOT pay on, so "it dropped" can only be the floor's doing. */
function drySeed(): string {
    for (const seed of seeds(200)) {
        const { blueprints } = rollDropTable({ defeated: [corpse('e0', 'fenrir')], nodeKind: 'wild', party: PARTY, seed });
        if (blueprints.length === 0) return seed;
    }
    throw new Error('no dry seed in 200 — the rate is not what this file thinks');
}

describe('the pity floor', () => {
    it('pays nothing extra until the drought reaches the ruled length', () => {
        const seed = drySeed();
        for (let dry = 0; dry < BLUEPRINT_PITY_FIGHTS; dry++) {
            const { blueprints } = rollDropTable({
                defeated: [corpse('e0', 'fenrir')], nodeKind: 'wild', party: PARTY, seed, dryFights: dry,
            });
            expect(blueprints, `${dry} dry fights should not force a drop`).toHaveLength(0);
        }
    });

    it('forces the drop on the fight after the ruled length', () => {
        const seed = drySeed();
        const { blueprints } = rollDropTable({
            defeated: [corpse('e0', 'fenrir')], nodeKind: 'wild', party: PARTY, seed,
            dryFights: BLUEPRINT_PITY_FIGHTS,
        });
        // And it is the species you actually beat, like every other drop.
        expect(blueprints).toEqual(['fenrir']);
    });

    it('stays a floor and not a windfall: one guaranteed blueprint, however many bodies', () => {
        const seed = drySeed();
        const { blueprints } = rollDropTable({
            defeated: [corpse('e0', 'fenrir'), corpse('e1', 'huldra'), corpse('e2', 'draugr')],
            nodeKind: 'wild', party: PARTY, seed, dryFights: BLUEPRINT_PITY_FIGHTS + 4,
        });
        // The first corpse is guaranteed; the other two roll normally, so this is 1 plus their luck
        // rather than 3. It can exceed 1 — that is two ordinary drops, not two guarantees.
        expect(blueprints.length).toBeGreaterThanOrEqual(1);
        expect(blueprints[0]).toBe('fenrir');
    });

    it('leaves the card offers untouched — the roll is taken either way', () => {
        const seed = drySeed();
        const without = rollDropTable({ defeated: [corpse('e0', 'fenrir')], nodeKind: 'wild', party: PARTY, seed, dryFights: 0 });
        const with_ = rollDropTable({ defeated: [corpse('e0', 'fenrir')], nodeKind: 'wild', party: PARTY, seed, dryFights: BLUEPRINT_PITY_FIGHTS });

        expect(without.blueprints).toHaveLength(0);
        expect(with_.blueprints).toHaveLength(1);
        // Everything else about the fight is byte-identical, instance ids included.
        expect(with_.cardChoices).toEqual(without.cardChoices);
        expect(with_.scraps).toBe(without.scraps);
    });

    it('is not owed by a caller that has no run — a debug scenario rolls plainly', () => {
        const seed = drySeed();
        const { blueprints } = rollDropTable({ defeated: [corpse('e0', 'fenrir')], nodeKind: 'wild', party: PARTY, seed });
        expect(blueprints).toHaveLength(0);
    });
});
