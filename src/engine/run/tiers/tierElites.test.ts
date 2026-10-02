/**
 * TICKET 169b — Tier 2 (Elite Territory) puts one more elite in every biome.
 *
 * Three claims can be false without anything crashing, so each one is pinned:
 * - **Tier 0 is today's map, node for node.** A tier feature that nudges the base game is a bug.
 * - **Tier 2 adds exactly one elite per biome**, converted from a plain wild, never from another
 *   kind, and never the scripted opening fight.
 * - **The new elites are real elites**: they carry a Driver stake like every other one.
 */

import { describe, expect, it } from 'vitest';

import { GetMingmingData } from '../../data/mingmingRegistry';
import type { IBiome, IRegionNode } from '../../runTypes';
import type { IMingmingState } from '../../types';
import { createRun } from '../createRun';
import { GYM_REGISTRY, type IGymOffer } from '../gyms';
import { assignDriverStakes } from '../driverStakes';
import { generateRegionGraph, REGION_PARAMS } from '../regionGraph';
import { addTierElites } from './tierElites';

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

const runOf = (seed: string, tier?: number) =>
    createRun({ seed, offer: OFFER, party: [KRAKEN], startedAt: 0, ...(tier === undefined ? {} : { tier }) });

const seeds = (count: number) => Array.from({ length: count }, (_, i) => `tier-elites-${i}`);

const elitesIn = (nodes: ReadonlyArray<IRegionNode>, biomeIndex: number) =>
    nodes.filter((n) => n.biomeIndex === biomeIndex && n.kind === 'elite');

describe('tier 0 is the map the game has today', () => {
    it('createRun at tier 0, and with tier omitted, is the untouched graph plus stakes — node for node', () => {
        for (const seed of seeds(20)) {
            const today = assignDriverStakes(generateRegionGraph(seed).nodes, OFFER.biomes, seed);
            expect(runOf(seed, 0).nodes).toEqual(today);
            expect(runOf(seed).nodes).toEqual(today);
            expect(runOf(seed, 1).nodes).toEqual(today);
        }
    });

    it('addTierElites with perBiome 0 returns the very same array', () => {
        const nodes = generateRegionGraph('anything').nodes;
        expect(addTierElites(nodes, 'anything', 0)).toBe(nodes);
    });
});

describe('tier 2 adds one elite per biome', () => {
    /** The nodes 169b is allowed to convert: a plain middle wild, off the pocket, not the scripted opener. */
    const candidatesIn = (nodes: ReadonlyArray<IRegionNode>, biomeIndex: number) =>
        nodes.filter(
            (n) =>
                n.biomeIndex === biomeIndex &&
                n.kind === 'wild' &&
                !n.pocket &&
                n.layer >= 1 &&
                n.layer <= 3 &&
                !(biomeIndex === 0 && n.layer === REGION_PARAMS.scriptedOpeningLayer),
        );

    it('adds exactly one elite to every biome that has a plain middle wild to convert, over 200 seeds', () => {
        for (const seed of seeds(200)) {
            const base = runOf(seed, 0);
            const tiered = runOf(seed, 2);
            for (let biomeIndex = 0; biomeIndex < REGION_PARAMS.biomesPerRun; biomeIndex += 1) {
                const candidates = candidatesIn(base.nodes, biomeIndex).length;
                const before = elitesIn(base.nodes, biomeIndex).length;
                const after = elitesIn(tiered.nodes, biomeIndex).length;
                expect(after, `${seed} biome ${biomeIndex}`).toBe(before + Math.min(1, candidates));
            }
        }
    });

    it('REPORTED TO HENRY: some maps have a biome with no wild to convert, so it gets no extra elite', () => {
        /*
         * Ticket 169b asked for this count to be 0 and to be reported if it is not. It is not: the
         * generator fills each biome's middle from a mixed pool (wild 60, event 14, elite 10, plus
         * the guaranteed market and workshop, and the rivals that ticket 142a takes out of the wilds),
         * and biome 0's whole first layer is the scripted opening wild, which this row must not
         * convert. So a biome's layers 2 and 3 sometimes hold no plain wild at all. Measured over
         * these 200 seeds: 56 have at least one such biome (biome 0 in 48 of them).
         *
         * Nothing here tunes it. The number is pinned so that a change to the generator or to the
         * candidate rule is noticed, and Henry decides whether a rival may be converted too.
         */
        let seedsWithAShortBiome = 0;
        for (const seed of seeds(200)) {
            const base = runOf(seed, 0);
            const short = [0, 1, 2].some((biomeIndex) => candidatesIn(base.nodes, biomeIndex).length === 0);
            if (short) seedsWithAShortBiome += 1;
        }
        expect(seedsWithAShortBiome).toBe(56);
    });

    it('only ever turns a plain middle wild into an elite, and changes nothing else about the node', () => {
        for (const seed of seeds(50)) {
            const base = runOf(seed, 0).nodes;
            const tiered = runOf(seed, 2).nodes;
            expect(tiered).toHaveLength(base.length);
            tiered.forEach((node, i) => {
                const before = base[i];
                if (node.kind === before.kind) return;
                expect(before.kind).toBe('wild');
                expect(node.kind).toBe('elite');
                expect(before.pocket).toBe(false);
                expect(before.layer).toBeGreaterThanOrEqual(1);
                expect(before.layer).toBeLessThanOrEqual(3);
                expect({ ...node, kind: 'wild', driverStake: undefined }).toEqual({
                    ...before,
                    driverStake: undefined,
                });
            });
        }
    });

    it('never touches the scripted opening layer of biome 0, at any tier', () => {
        for (const seed of seeds(100)) {
            for (const tier of [0, 1, 2, 3]) {
                const opening = runOf(seed, tier).nodes.filter(
                    (n) => n.biomeIndex === 0 && n.layer === REGION_PARAMS.scriptedOpeningLayer && !n.pocket,
                );
                expect(opening.length).toBeGreaterThan(0);
                for (const node of opening) expect(node.kind).toBe('wild');
            }
        }
    });

    it('gives every elite at tier 2 a Driver stake, the new ones included', () => {
        for (const seed of seeds(50)) {
            const elites = runOf(seed, 2).nodes.filter((n) => n.kind === 'elite');
            expect(elites.length).toBeGreaterThan(0);
            for (const node of elites) expect(node.driverStake, `${seed} ${node.id}`).toBeTruthy();
        }
    });

    it('is deterministic in the seed, and does not mutate its input', () => {
        const nodes = generateRegionGraph('det').nodes;
        const frozen = JSON.stringify(nodes);
        const a = addTierElites(nodes, 'det', 1);
        const b = addTierElites(nodes, 'det', 1);
        expect(a).toEqual(b);
        expect(JSON.stringify(nodes)).toBe(frozen);
    });

    it('converts what there is when a biome has fewer candidates than asked', () => {
        const nodes = generateRegionGraph('many').nodes;
        const converted = addTierElites(nodes, 'many', 1000);
        for (let biomeIndex = 0; biomeIndex < REGION_PARAMS.biomesPerRun; biomeIndex += 1) {
            const stillPlainWilds = converted.filter(
                (n) => n.biomeIndex === biomeIndex && n.kind === 'wild' && !n.pocket && n.layer >= 1 && n.layer <= 3,
            );
            // Only the scripted opening layer's wilds are left standing.
            for (const n of stillPlainWilds) {
                expect(biomeIndex === 0 && n.layer === REGION_PARAMS.scriptedOpeningLayer).toBe(true);
            }
        }
    });
});
