/**
 * TICKET 169a — **A TIER NEVER SCALES A STAT.** Steam-release ticket 29's "Done when", and the law
 * behind it (`vision.md`, ticket 21): harder means DIFFERENT CONTENT — firmware, AI, more elites,
 * Drivers — never bigger HP, damage or IVs.
 *
 * For one fixed seed and party, build the same wild, the same elite and each of the three gauntlet
 * fights at every tier, and demand that every enemy's stats and IVs are equal across all four.
 * Firmware, decks and Drivers may differ, because those are content. Stats may not.
 */

import { describe, expect, it } from 'vitest';

import { GetMingmingData } from '../../data/mingmingRegistry';
import type { IBiome, IRegionNode, IRunState } from '../../runTypes';
import type { IBattleEntity, IMingmingState } from '../../types';
import { rollEncounter } from '../encounter';
import { createRun } from '../createRun';
import { GAUNTLET_FIGHTS, rollGauntletFight } from '../gauntlet';
import { GYM_REGISTRY, type IGymOffer } from '../gyms';
import { MAX_TIER } from './tierRegistry';

const member = (id: string, definitionId: string): IMingmingState => ({
    id,
    definitionId,
    activeOS: GetMingmingData(definitionId).availableOS[0],
    blueprintsCollected: 0,
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
});

const PARTY = [member('mm1', 'kraken'), member('mm2', 'fenrir'), member('mm3', 'ratatoskr')];

const biome = (element: string, index: number): IBiome => ({
    id: `biome_${element.toLowerCase()}_${index}`,
    name: `${element} ${index}`,
    elements: [element],
});

/** An ordinary mid-run state (`fightsResolved: 1`, so the scripted opening fight does not apply). */
function runAtTier(gymId: keyof typeof GYM_REGISTRY, tier: number): IRunState {
    const offer: IGymOffer = {
        gym: GYM_REGISTRY[gymId],
        biomes: [biome('Fire', 0), biome('Water', 1), biome('Nature', 2)],
    };
    return { ...createRun({ seed: 'no-stat-scaling', offer, party: PARTY, startedAt: 0 }), tier, fightsResolved: 1 };
}

const node = (kind: 'wild' | 'elite', over: Partial<IRegionNode> = {}): IRegionNode => ({
    id: 'b1l2n0',
    kind,
    biomeIndex: 1,
    layer: 2,
    pocket: false,
    edges: [],
    visited: 1,
    ...over,
});

/** Every number an enemy fights with. Firmware and decks are content and are deliberately absent. */
const statsOf = (entity: IBattleEntity) => ({
    definitionId: entity.definitionId,
    hpIV: entity.hpIV,
    attackIV: entity.attackIV,
    defenseIV: entity.defenseIV,
    maxHp: entity.maxHp,
    attack: entity.attack,
    defense: entity.defense,
    maxEnergy: entity.maxEnergy,
    cardDraw: entity.cardDraw,
});

const TIER_LIST = Array.from({ length: MAX_TIER + 1 }, (_, tier) => tier);

describe('a tier never scales a stat (ticket 29, ticket 21)', () => {
    for (const kind of ['wild', 'elite'] as const) {
        it(`a ${kind} has identical stats and IVs at every tier`, () => {
            const rolls = TIER_LIST.map((tier) =>
                rollEncounter({ run: runAtTier('gym_emberfall', tier), node: node(kind), party: PARTY }),
            );
            const baseline = rolls[0].enemyParty.map(statsOf);
            expect(baseline.length).toBeGreaterThan(0);
            for (const roll of rolls) expect(roll.enemyParty.map(statsOf)).toEqual(baseline);
        });
    }

    for (const gymId of Object.keys(GYM_REGISTRY) as Array<keyof typeof GYM_REGISTRY>) {
        for (let fightIndex = 0; fightIndex < GAUNTLET_FIGHTS; fightIndex += 1) {
            it(`${gymId} gauntlet fight ${fightIndex + 1} has identical stats and IVs at every tier`, () => {
                const rolls = TIER_LIST.map((tier) => {
                    const run = runAtTier(gymId, tier);
                    const gym = run.nodes.find((n) => n.kind === 'gym') as IRegionNode;
                    return rollGauntletFight({ run, node: { ...gym, visited: gym.visited + 1 }, fightIndex });
                });
                const baseline = rolls[0].enemyParty.map(statsOf);
                expect(baseline.length).toBeGreaterThan(0);
                for (const roll of rolls) expect(roll.enemyParty.map(statsOf)).toEqual(baseline);
            });
        }
    }
});
