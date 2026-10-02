/**
 * TICKET 169b — Tier 2 (Elite Territory): one more elite in every biome.
 *
 * The extra elite is made by CONVERTING a plain middle wild, not by adding a node, so the map keeps
 * its shape and only its contents get harder: same graph, one fight in each biome that is now an
 * elite. It is a pure function of the run seed, so a resumed run rebuilds the same map.
 */

import { SeedStream } from '../../core/SeedStream';
import type { IRegionNode } from '../../runTypes';
import { REGION_PARAMS } from '../regionGraph';

/** The middle layers (1 to 3), where a wild can become an elite without touching an entry or exit. */
const FIRST_MIDDLE_LAYER = 1;
const LAST_MIDDLE_LAYER = 3;

/**
 * Whether `node` may be converted. A plain wild on the main road, in a middle layer, and never the
 * scripted opening fight of biome 0 (the first step out of the entry stays a wild, ticket 24).
 */
function canBecomeElite(node: IRegionNode): boolean {
    if (node.kind !== 'wild' || node.pocket) return false;
    if (node.layer < FIRST_MIDDLE_LAYER || node.layer > LAST_MIDDLE_LAYER) return false;
    if (node.biomeIndex === 0 && node.layer === REGION_PARAMS.scriptedOpeningLayer) return false;
    return true;
}

/**
 * Convert up to `perBiome` candidate wilds in each biome into elites.
 *
 * Returns new node objects and never mutates its input; with `perBiome === 0` it returns the input
 * array itself, so tier 0 and tier 1 keep today's graph exactly. A biome with fewer candidates than
 * `perBiome` converts what it has, and no other kind of node is ever converted.
 */
export function addTierElites(
    nodes: ReadonlyArray<IRegionNode>,
    seed: string,
    perBiome: number,
): ReadonlyArray<IRegionNode> {
    if (perBiome <= 0) return nodes;

    const converted = new Set<string>();
    const biomeCount = nodes.reduce((most, node) => Math.max(most, node.biomeIndex + 1), 0);
    for (let biomeIndex = 0; biomeIndex < biomeCount; biomeIndex += 1) {
        const candidates = nodes.filter((node) => node.biomeIndex === biomeIndex && canBecomeElite(node));
        const stream = new SeedStream(new SeedStream(seed).fork(`tier-elites:${biomeIndex}`));
        for (const node of stream.shuffle(candidates).slice(0, perBiome)) converted.add(node.id);
    }

    return nodes.map((node) => (converted.has(node.id) ? { ...node, kind: 'elite' as const } : node));
}
