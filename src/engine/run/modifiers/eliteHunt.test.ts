/**
 * TICKET 169f — Elite Hunt: every rival is an elite.
 *
 * Default D6: rivals are removed entirely, so the path species (ticket 142a) can only be met at the
 * scout or recruited from blueprints. That is the modifier's cost, and it is Henry's.
 */

import { describe, expect, it } from 'vitest';

import { GetMingmingData } from '../../data/mingmingRegistry';
import type { IBiome } from '../../runTypes';
import type { IMingmingState } from '../../types';
import { createRun } from '../createRun';
import { GYM_REGISTRY, type IGymOffer } from '../gyms';
import { generateRegionGraph } from '../regionGraph';
import { assignDriverStakes } from '../driverStakes';
import { applyEliteHunt } from './eliteHunt';

const KRAKEN: IMingmingState = {
    id: 'mm1',
    definitionId: 'kraken',
    activeOS: GetMingmingData('kraken').availableOS[0],
    blueprintsCollected: 0,
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
};

const biome = (element: string, index: number): IBiome => ({
    id: `biome_${element.toLowerCase()}_${index}`,
    name: `${element} ${index}`,
    elements: [element],
});

const OFFER: IGymOffer = {
    gym: GYM_REGISTRY.gym_emberfall,
    biomes: [biome('Water', 0), biome('Nature', 1), biome('Fire', 2)],
};

const seeds = Array.from({ length: 50 }, (_, i) => `elite-hunt-${i}`);
const runOf = (seed: string, modifiers?: string[], tier?: number) =>
    createRun({ seed, offer: OFFER, party: [KRAKEN], startedAt: 0, ...(modifiers ? { modifiers } : {}), ...(tier === undefined ? {} : { tier }) });

describe('Elite Hunt', () => {
    it('leaves no rival on the map, and every former rival is an elite with a Driver stake', () => {
        let rivalsSeen = 0;
        for (const seed of seeds) {
            const before = runOf(seed).nodes;
            const after = runOf(seed, ['elite_hunt']).nodes;
            expect(after.some((n) => n.kind === 'rival'), seed).toBe(false);
            before.forEach((node, i) => {
                if (node.kind !== 'rival') return;
                rivalsSeen += 1;
                expect(after[i].kind).toBe('elite');
                expect(after[i].driverStake, `${seed} ${node.id}`).toBeTruthy();
            });
        }
        // The claim is only interesting if there were rivals to convert.
        expect(rivalsSeen).toBeGreaterThan(0);
    });

    it('changes only the kind of a rival: every other node is what it was', () => {
        for (const seed of seeds) {
            const before = runOf(seed).nodes;
            const after = runOf(seed, ['elite_hunt']).nodes;
            expect(after).toHaveLength(before.length);
            before.forEach((node, i) => {
                if (node.kind === 'rival') return;
                // A stake is dealt in node order, so an elite AFTER a converted rival can draw a
                // different Driver. Everything but the stake is identical.
                expect({ ...after[i], driverStake: undefined }).toEqual({ ...node, driverStake: undefined });
            });
        }
    });

    it('without the modifier the graph is unchanged', () => {
        for (const seed of seeds) {
            const today = assignDriverStakes(generateRegionGraph(seed).nodes, OFFER.biomes, seed);
            expect(runOf(seed).nodes).toEqual(today);
        }
    });

    it('does not touch the scout, which is already an elite', () => {
        for (const seed of seeds) {
            const scoutBefore = runOf(seed).nodes.filter((n) => n.scout);
            const scoutAfter = runOf(seed, ['elite_hunt']).nodes.filter((n) => n.scout);
            expect(scoutAfter.map((n) => n.id)).toEqual(scoutBefore.map((n) => n.id));
            for (const n of scoutAfter) expect(n.kind).toBe('elite');
        }
    });

    it('stacks with tier 2: the extra elites and the hunt both apply', () => {
        for (const seed of seeds.slice(0, 20)) {
            const hunted = runOf(seed, ['elite_hunt'], 2).nodes;
            expect(hunted.some((n) => n.kind === 'rival')).toBe(false);
            expect(hunted.filter((n) => n.kind === 'elite').length).toBeGreaterThanOrEqual(
                runOf(seed, ['elite_hunt'], 0).nodes.filter((n) => n.kind === 'elite').length,
            );
        }
    });

    it('applyEliteHunt is a pure function that returns new nodes', () => {
        const nodes = generateRegionGraph('pure').nodes;
        const frozen = JSON.stringify(nodes);
        const out = applyEliteHunt(nodes);
        expect(JSON.stringify(nodes)).toBe(frozen);
        expect(out.some((n) => n.kind === 'rival')).toBe(false);
    });
});
