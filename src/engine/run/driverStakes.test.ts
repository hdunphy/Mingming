/**
 * The Driver stakes — steam-release ticket 17. Three claims: every elite and ambush carries one and
 * nothing else does; the pool is this run's elements, never a gym Driver; and the stamp is a
 * separate fork, so no pre-existing graph moved.
 */
import { describe, expect, it } from 'vitest';

import { createRun } from './createRun';
import { generateRegionGraph } from './regionGraph';
import { GYM_REGISTRY } from './gyms';
import { assignDriverStakes, driverStakePool, paysDriver, DRIVER_STAKE_KINDS, partyElementsOf, resolveDriverStake } from './driverStakes';
import { GYM_DRIVER_IDS, PLAYER_DRIVER_IDS, elementDriverId } from '../data/driverRegistry';
import { RunStateSchema, type IBiome } from '../runTypes';
import type { IMingmingState } from '../types';

const BIOMES: ReadonlyArray<IBiome> = [
    { id: 'biome_fire', name: 'Fire', elements: ['Fire'] },
    { id: 'biome_water', name: 'Water', elements: ['Water'] },
    { id: 'biome_nature', name: 'Nature', elements: ['Nature'] },
];
const MEMBER: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', nickname: 'Inky', activeOS: 'kraken_v1',
    blueprintsCollected: 0, hpIV: 10, attackIV: 10, defenseIV: 10,
};
const runFor = (seed: string) => createRun({
    seed, offer: { gym: GYM_REGISTRY.gym_emberfall, biomes: BIOMES }, party: [MEMBER], startedAt: 0,
});

describe('which nodes pay a Driver', () => {
    it('elites and ambushes, and nothing else — the alpha pays a blueprint (Henry, 2026-09-12)', () => {
        expect(DRIVER_STAKE_KINDS).toEqual(['elite', 'ambush']);
        expect(paysDriver('alpha')).toBe(false);
        expect(paysDriver('wild')).toBe(false);
        expect(paysDriver('gym')).toBe(false);
    });

    it('every elite and ambush in a created run carries a stake, and no other node does', () => {
        for (const seed of ['stakes-a', 'stakes-b', 'stakes-c']) {
            const run = runFor(seed);
            const paying = run.nodes.filter((n) => paysDriver(n.kind));
            expect(paying.length).toBeGreaterThan(0);
            for (const node of paying) expect(node.driverStake, `${seed} ${node.id}`).toBeDefined();
            for (const node of run.nodes.filter((n) => !paysDriver(n.kind))) {
                expect(node, `${seed} ${node.id}`).not.toHaveProperty('driverStake');
            }
        }
    });

    it('no two paying nodes in a run share a Driver while the pool lasts', () => {
        const run = runFor('stakes-distinct');
        const stakes = run.nodes.filter((n) => n.driverStake).map((n) => n.driverStake!);
        const pool = driverStakePool(BIOMES);
        expect(new Set(stakes).size).toBe(Math.min(stakes.length, pool.length));
    });
});

describe('the pool', () => {
    it('is the named seven plus THIS run\'s Element Drivers, never a gym Driver', () => {
        const pool = driverStakePool(BIOMES);
        expect(pool).toHaveLength(7 + 3);
        expect(pool).toContain(elementDriverId('Fire'));
        expect(pool).toContain(elementDriverId('Water'));
        expect(pool).toContain(elementDriverId('Nature'));
        expect(pool).not.toContain(elementDriverId('Dark'));
        for (const id of pool) expect(PLAYER_DRIVER_IDS).toContain(id);
        for (const gym of GYM_DRIVER_IDS) expect(pool).not.toContain(gym);
    });

    it('dedupes a repeated element and ignores None', () => {
        const pool = driverStakePool([
            { id: 'a', name: 'A', elements: ['Fire'] },
            { id: 'b', name: 'B', elements: ['Fire', 'None'] },
        ] as unknown as ReadonlyArray<IBiome>);
        expect(pool.filter((id) => id === elementDriverId('Fire'))).toHaveLength(1);
        expect(pool).toHaveLength(8);
    });
});

describe('determinism and the save', () => {
    it('is a pure function of the seed — the same run rolls the same stakes', () => {
        const a = runFor('stakes-same').nodes.map((n) => n.driverStake ?? null);
        const b = runFor('stakes-same').nodes.map((n) => n.driverStake ?? null);
        expect(a).toEqual(b);
        expect(a).not.toEqual(runFor('stakes-other').nodes.map((n) => n.driverStake ?? null));
    });

    it('leaves the graph itself untouched — ids, kinds and edges are the generator\'s', () => {
        const graph = generateRegionGraph('stakes-graph');
        const stamped = assignDriverStakes(graph.nodes, BIOMES, 'stakes-graph');
        expect(stamped.map(({ driverStake: _s, ...rest }) => rest)).toEqual(graph.nodes);
    });

    it('survives the v4 parse, and a save without stakes still loads', () => {
        const run = runFor('stakes-save');
        const parsed = RunStateSchema.parse(JSON.parse(JSON.stringify(run)));
        expect(parsed.nodes.filter((n) => n.driverStake).length).toBeGreaterThan(0);
        const legacy = { ...run, nodes: run.nodes.map(({ driverStake: _s, ...rest }) => rest) };
        expect(() => RunStateSchema.parse(JSON.parse(JSON.stringify(legacy)))).not.toThrow();
    });
});

describe('172 — an Element Driver pays for an element you field', () => {
    // Henry, 2026-09-30: "I got a Nature Driver on my run with no nature mingmings."
    it('keeps a named Driver, and an Element Driver the party fields', () => {
        expect(resolveDriverStake('driver_first_blood', ['Water'])).toBe('driver_first_blood');
        expect(resolveDriverStake('driver_element_water', ['Fire', 'Water'])).toBe('driver_element_water');
    });

    it('swaps an unfielded Element Driver for the first member\'s element', () => {
        const party = partyElementsOf([
            { primaryElement: 'Water', secondaryElement: 'None' },
            { primaryElement: 'Fire', secondaryElement: 'None' },
        ]);
        expect(party).toEqual(['Water', 'Fire']);
        expect(resolveDriverStake('driver_element_nature', party)).toBe('driver_element_water');
    });

    it('leaves the stake alone for an empty party rather than inventing one', () => {
        expect(resolveDriverStake('driver_element_nature', [])).toBe('driver_element_nature');
    });
});
