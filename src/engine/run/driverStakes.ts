/**
 * DRIVER STAKES — which Driver a fight node pays, decided at run creation. Steam-release ticket 17.
 *
 * `economy-session.md`: *"Elites redefined: ONE harder fight, the Driver visible as the stakes."*
 * Ticket 17's deliverable puts it on the map: *"the Driver reward visible on the map node before you
 * commit."* Henry, 2026-09-12, widened it to the ambush — *"ambushes should also offer a driver since
 * right now it is harder than the elites, but it's 'bonus' content"* — and deferred the alpha's
 * "overtuned" frame. So the two node kinds that pay a Driver are `elite` and `ambush`, and they pay
 * it the same way.
 *
 * # DECIDED AT CREATION, NOT AT THE WIN
 *
 * The stake has to be readable on the map before the player routes toward it, which means it has
 * to exist before the fight does. It is rolled once, off the run seed, and stored on the node
 * (`IRegionNode.driverStake`) — the same shape as the scout flag, and for the same reason: a fact
 * about a node that the map must show and the save must carry. Rolling it lazily at victory would
 * give the player a Driver they could not have planned around, which is the whole thing the ruling
 * is against.
 *
 * # THE POOL
 *
 * The seven named Drivers, plus the Element Drivers of the elements this run's biomes actually
 * field. A Dark Driver in a Fire/Water/Nature run is a dead node — the same reasoning ticket 69
 * applied to the pick pool (*"the pick pool is your ELEMENTS"*). The gym Drivers are never in it
 * (ticket 68 ruling 4). Nodes take from a seeded shuffle without repeats, so two elites in one run
 * do not pay the same Driver and `addDriver`'s dedupe never silently swallows a reward; a run with
 * more paying nodes than the pool has Drivers wraps around, which at 7 + 3 = 10 for the launch
 * triangle would take a graph no generator parameter produces.
 *
 * # A SEPARATE FORK, SO NO EXISTING GRAPH MOVES
 *
 * Forked off a fresh `SeedStream(seed)` rather than the graph's own stream — the scout and the
 * rivals do the same — so adding this roll changes not one node id, edge or kind of any run that
 * existed before it. Every graph test that pins a layout keeps passing for that reason alone.
 */

import { SeedStream } from '../core/SeedStream';
import {
    DRIVER_ANTIVENOM, DRIVER_BULWARK_REFLEX, DRIVER_DEEP_CACHE, DRIVER_FIRST_BLOOD,
    DRIVER_OVERKILL_RECOVERY, DRIVER_STATIC_FIELD, DRIVER_TENTH_STRIKE, elementDriverId,
} from '../data/driverRegistry';
import type { Element } from '../types';
import type { IBiome, IRegionNode, NodeKind } from '../runTypes';

/** The node kinds that pay a Driver on a win. The alpha pays a blueprint instead (ticket 12). */
export const DRIVER_STAKE_KINDS: ReadonlyArray<NodeKind> = ['elite', 'ambush'];

export function paysDriver(kind: NodeKind): boolean {
    return DRIVER_STAKE_KINDS.includes(kind);
}

/** The seven named Drivers, in a stable order. */
export const NAMED_DRIVER_IDS: ReadonlyArray<string> = [
    DRIVER_FIRST_BLOOD, DRIVER_TENTH_STRIKE, DRIVER_STATIC_FIELD, DRIVER_ANTIVENOM,
    DRIVER_OVERKILL_RECOVERY, DRIVER_BULWARK_REFLEX, DRIVER_DEEP_CACHE,
];

/** The pool a run draws its stakes from: the named seven plus this run's own Element Drivers. */
export function driverStakePool(biomes: ReadonlyArray<IBiome>): string[] {
    const elements = new Set<Element>();
    for (const biome of biomes) for (const element of biome.elements) elements.add(element as Element);
    const elemental = [...elements]
        .filter((e): e is Exclude<Element, 'None'> => e !== 'None')
        .map(elementDriverId);
    return [...NAMED_DRIVER_IDS, ...elemental];
}

/**
 * Stamp a `driverStake` onto every elite and ambush node. Pure: returns new node objects, leaves
 * every other node untouched (no `driverStake: undefined` — it would serialise as a null on every
 * node of every save for the sake of a flag most nodes do not carry, the scout's reason).
 */
export function assignDriverStakes(
    nodes: ReadonlyArray<IRegionNode>,
    biomes: ReadonlyArray<IBiome>,
    seed: string,
): IRegionNode[] {
    const stream = new SeedStream(new SeedStream(seed).fork('driver-stakes'));
    const pool = stream.shuffle(driverStakePool(biomes));
    if (pool.length === 0) return [...nodes];
    let next = 0;
    return nodes.map((node) => {
        if (!paysDriver(node.kind)) return node;
        const driverStake = pool[next % pool.length];
        next += 1;
        return { ...node, driverStake };
    });
}
