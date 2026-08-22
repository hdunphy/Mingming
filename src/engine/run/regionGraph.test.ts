/**
 * Tests for ticket 07's region generator. Each block below is one of the checks ticket 07 names in
 * its "implementation notes for the TS port", plus the schema conformance ticket 06 needs: this
 * graph is written straight into `IRunState.nodes`, so a node that fails `RegionNodeSchema` is a
 * save that fails to load.
 *
 * The three-offers-three-different-openings guarantee ticket 07 also names belongs to run start
 * (ticket 09), not to the generator — this module produces one region and knows nothing about
 * gym offers.
 */

import { describe, expect, it } from 'vitest';

import { RegionNodeSchema, RunStateSchema } from '../runTypes';
import type { IRegionNode, NodeKind } from '../runTypes';
import { REGION_PARAMS, generateRegionGraph } from './regionGraph';
import type { RegionGraph } from './regionGraph';

/** Ticket 07's fight kinds — everything else is a room you walk into, not a battle. */
const FIGHT_KINDS: ReadonlyArray<NodeKind> = ['wild', 'elite', 'alpha', 'ambush', 'gym'];

function isFight(node: IRegionNode): boolean {
    return FIGHT_KINDS.includes(node.kind);
}

function indexById(graph: RegionGraph): Map<string, IRegionNode> {
    return new Map(graph.nodes.map((n) => [n.id, n]));
}

function nodesInBiome(graph: RegionGraph, biomeIndex: number): IRegionNode[] {
    return graph.nodes.filter((n) => n.biomeIndex === biomeIndex);
}

function countKind(nodes: ReadonlyArray<IRegionNode>, kind: NodeKind): number {
    return nodes.filter((n) => n.kind === kind).length;
}

/** Plain BFS over `edges`, ignoring direction — which is the point of the reachability test. */
function reachableFrom(graph: RegionGraph, startId: string): Set<string> {
    const byId = indexById(graph);
    const seen = new Set<string>([startId]);
    const queue = [startId];
    while (queue.length > 0) {
        const current = byId.get(queue.shift()!)!;
        for (const next of current.edges) {
            if (!seen.has(next)) {
                seen.add(next);
                queue.push(next);
            }
        }
    }
    return seen;
}

/**
 * Cheapest route from the entry to the gym, counted in fights. The start node is not counted: biome
 * 0's entry is where the run begins standing, `visited: 1`, so it never triggers.
 *
 * Dijkstra rather than BFS because the cost of a step is the *destination's* kind — a marketplace
 * is a free hop and a wild is not — so hop count and fight count are different numbers.
 */
function minFightsToGym(graph: RegionGraph): number {
    const byId = indexById(graph);
    const cost = new Map<string, number>([[graph.entryNodeId, 0]]);
    const settled = new Set<string>();

    for (;;) {
        let currentId: string | null = null;
        let currentCost = Infinity;
        for (const [id, c] of cost) {
            if (!settled.has(id) && c < currentCost) {
                currentId = id;
                currentCost = c;
            }
        }
        if (currentId === null) break;
        settled.add(currentId);
        for (const nextId of byId.get(currentId)!.edges) {
            const next = currentCost + (isFight(byId.get(nextId)!) ? 1 : 0);
            if (next < (cost.get(nextId) ?? Infinity)) cost.set(nextId, next);
        }
    }

    return cost.get(graph.gymNodeId) ?? Infinity;
}

/**
 * The most fights a forward-moving player can take on the way to the gym.
 *
 * "Forward" means never stepping back to an earlier (biome, layer) — a player who backtracks to
 * farm can run the fight count up without limit, which is exactly the unbounded farming ticket 07
 * rules is fine, and therefore not a number any test can bound. The DFS below measures the
 * envelope of a *forward* run, which is what the prototype's ~14.6 measured.
 */
function maxFightsToGym(graph: RegionGraph): number {
    const byId = indexById(graph);
    const position = (n: IRegionNode) => n.biomeIndex * REGION_PARAMS.layersPerBiome + n.layer;
    const visited = new Set<string>();

    const walk = (node: IRegionNode): number => {
        if (node.id === graph.gymNodeId) return isFight(node) ? 1 : 0;
        visited.add(node.id);
        let best = -Infinity;
        for (const nextId of node.edges) {
            const next = byId.get(nextId)!;
            if (visited.has(nextId) || position(next) < position(node)) continue;
            const onwards = walk(next);
            if (onwards > best) best = onwards;
        }
        visited.delete(node.id);
        // The entry node is where the run starts standing; it never triggers, so it never counts.
        const own = node.id === graph.entryNodeId || !isFight(node) ? 0 : 1;
        return best === -Infinity ? -Infinity : best + own;
    };

    return walk(byId.get(graph.entryNodeId)!);
}

const SEED = 'seed-region-0001';

describe('generateRegionGraph — determinism', () => {
    it('produces an identical graph for the same seed', () => {
        expect(generateRegionGraph(SEED)).toEqual(generateRegionGraph(SEED));
    });

    it('produces a different graph for a different seed', () => {
        // Not a claim about quality — just that the seed is actually threaded through. A generator
        // that ignored its seed would pass every other test in this file.
        const variants = new Set(
            ['a', 'b', 'c', 'd', 'e'].map((s) => JSON.stringify(generateRegionGraph(s))),
        );
        expect(variants.size).toBe(5);
    });
});

describe('generateRegionGraph — shape (ticket 07 ruled parameters)', () => {
    const graph = generateRegionGraph(SEED);

    it('is three sequential biomes', () => {
        expect(new Set(graph.nodes.map((n) => n.biomeIndex))).toEqual(new Set([0, 1, 2]));
    });

    it('has all five layers present in every biome', () => {
        for (let b = 0; b < REGION_PARAMS.biomesPerRun; b += 1) {
            const layers = new Set(nodesInBiome(graph, b).map((n) => n.layer));
            expect(layers).toEqual(new Set([0, 1, 2, 3, 4]));
        }
    });

    it('has exactly one entry and one exit node per biome', () => {
        for (let b = 0; b < REGION_PARAMS.biomesPerRun; b += 1) {
            const biome = nodesInBiome(graph, b);
            expect(biome.filter((n) => n.layer === 0)).toHaveLength(1);
            expect(biome.filter((n) => n.layer === 4)).toHaveLength(1);
        }
    });

    it('has middle layers 2-3 wide, ignoring the pocket that hangs off one of them', () => {
        for (let b = 0; b < REGION_PARAMS.biomesPerRun; b += 1) {
            for (const layer of [1, 2, 3]) {
                const width = nodesInBiome(graph, b).filter((n) => n.layer === layer && !n.pocket).length;
                expect(width).toBeGreaterThanOrEqual(REGION_PARAMS.minMiddleWidth);
                expect(width).toBeLessThanOrEqual(REGION_PARAMS.maxMiddleWidth);
            }
        }
    });

    it('exits biomes 0 and 1 with an elite and biome 2 with the gym', () => {
        const byId = indexById(graph);
        const exitOf = (b: number) => nodesInBiome(graph, b).find((n) => n.layer === 4)!;
        expect(exitOf(0).kind).toBe('elite');
        expect(exitOf(1).kind).toBe('elite');
        expect(exitOf(2).kind).toBe('gym');
        expect(byId.get(graph.gymNodeId)).toBe(exitOf(2));
        // Exactly one gym in the whole region — the run has one final exam.
        expect(countKind(graph.nodes, 'gym')).toBe(1);
    });

    it('starts the player standing on biome 0 layer 0, already visited', () => {
        const byId = indexById(graph);
        const entry = byId.get(graph.entryNodeId)!;
        expect(entry.biomeIndex).toBe(0);
        expect(entry.layer).toBe(0);
        // No `'entry'` NodeKind exists, so the start node is a wild that must not trigger — hence
        // the visit count of 1 (the ratified fixture in runTypes.test.ts shows exactly this).
        expect(entry.kind).toBe('wild');
        expect(entry.visited).toBe(1);
        for (const node of graph.nodes) {
            expect(node.visited).toBe(node.id === graph.entryNodeId ? 1 : 0);
        }
    });

    it('connects each biome to the next through the previous biome exit', () => {
        for (let b = 1; b < REGION_PARAMS.biomesPerRun; b += 1) {
            const entry = nodesInBiome(graph, b).find((n) => n.layer === 0)!;
            const previousExit = nodesInBiome(graph, b - 1).find((n) => n.layer === 4)!;
            expect(entry.edges).toContain(previousExit.id);
            // Biomes 1 and 2 open with a wild the player actually fights through.
            expect(entry.kind).toBe('wild');
            expect(entry.visited).toBe(0);
        }
    });
});

describe('generateRegionGraph — the per-biome guarantees', () => {
    it('places exactly one marketplace and exactly one workshop in every biome', () => {
        // Ticket 07 rules these as guarantees, not as a mix outcome: a biome with no workshop is a
        // biome where the party cannot grow, and the run's whole arc is 1 -> 2 -> 3 members.
        for (const seed of ['g-1', 'g-2', 'g-3', 'g-4', 'g-5', 'g-6', 'g-7', 'g-8']) {
            const graph = generateRegionGraph(seed);
            for (let b = 0; b < REGION_PARAMS.biomesPerRun; b += 1) {
                const biome = nodesInBiome(graph, b);
                expect(countKind(biome, 'marketplace')).toBe(1);
                expect(countKind(biome, 'workshop')).toBe(1);
            }
        }
    });

    it('places exactly one pocket per biome, dead-ended off a middle node', () => {
        for (const seed of ['p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-7', 'p-8']) {
            const graph = generateRegionGraph(seed);
            const byId = indexById(graph);
            for (let b = 0; b < REGION_PARAMS.biomesPerRun; b += 1) {
                const pockets = nodesInBiome(graph, b).filter((n) => n.pocket);
                expect(pockets).toHaveLength(REGION_PARAMS.pocketsPerBiome);

                const pocket = pockets[0];
                expect(['wild', 'alpha', 'ambush']).toContain(pocket.kind);
                // A dead end is a dead end: one edge, back the way you came.
                expect(pocket.edges).toHaveLength(1);

                const host = byId.get(pocket.edges[0])!;
                expect(host.pocket).toBe(false);
                expect(host.biomeIndex).toBe(b);
                // A pocket sits BESIDE the route, not along it, so it shares its host's layer.
                expect(host.layer).toBe(pocket.layer);
                expect([1, 2, 3]).toContain(host.layer);
                // And the host knows about it, or the player could never walk in.
                expect(host.edges).toContain(pocket.id);
            }
        }
    });
});

describe('generateRegionGraph — connectivity', () => {
    it('lets every node reach the gym', () => {
        // Both-way edges make this close to trivial, which IS the point: it proves no node was
        // orphaned by the forward-edge roll, and an orphan is map the player can see and never
        // touch.
        for (const seed of ['c-1', 'c-2', 'c-3', 'c-4', 'c-5', 'c-6', 'c-7', 'c-8']) {
            const graph = generateRegionGraph(seed);
            for (const node of graph.nodes) {
                expect(reachableFrom(graph, node.id)).toContain(graph.gymNodeId);
            }
        }
    });

    it('leaves no isolated nodes', () => {
        for (const seed of ['i-1', 'i-2', 'i-3', 'i-4']) {
            for (const node of generateRegionGraph(seed).nodes) {
                expect(node.edges.length).toBeGreaterThan(0);
            }
        }
    });

    it('keeps every edge symmetric', () => {
        // Ticket 07: "edges are walkable in both directions; the graph is genuinely explorable, not
        // a frontier picker." A one-way edge would be a silent DAG.
        for (const seed of ['s-1', 's-2', 's-3', 's-4']) {
            const graph = generateRegionGraph(seed);
            const byId = indexById(graph);
            for (const node of graph.nodes) {
                expect(new Set(node.edges).size).toBe(node.edges.length); // no duplicates
                for (const otherId of node.edges) {
                    const other = byId.get(otherId);
                    expect(other, `${node.id} points at missing node ${otherId}`).toBeDefined();
                    expect(other!.edges).toContain(node.id);
                }
            }
        }
    });

    it('only ever links nodes within a biome, or across one biome seam', () => {
        const graph = generateRegionGraph(SEED);
        const byId = indexById(graph);
        for (const node of graph.nodes) {
            for (const other of node.edges.map((id) => byId.get(id)!)) {
                expect(Math.abs(other.biomeIndex - node.biomeIndex)).toBeLessThanOrEqual(1);
                if (other.biomeIndex !== node.biomeIndex) {
                    // The seam is exactly exit(b) <-> entry(b+1); nothing else crosses.
                    const [earlier, later] = other.biomeIndex > node.biomeIndex ? [node, other] : [other, node];
                    expect(earlier.layer).toBe(4);
                    expect(later.layer).toBe(0);
                }
            }
        }
    });
});

describe('generateRegionGraph — schema conformance', () => {
    it('produces nodes that all pass RegionNodeSchema', () => {
        for (const seed of ['v-1', 'v-2', 'v-3', 'v-4']) {
            for (const node of generateRegionGraph(seed).nodes) {
                const parsed = RegionNodeSchema.safeParse(node);
                expect(parsed.success, `${node.id}: ${JSON.stringify(parsed.error?.issues)}`).toBe(true);
            }
        }
    });

    it('drops into a RunState that parses, with entryNodeId as a real node', () => {
        // The structural rule RunStateSchema actually enforces about this graph is referential
        // integrity on `currentNodeId` — a run that opens on a node that does not exist is a black
        // map screen. So the run starts on `entryNodeId` and the schema is the thing that checks it.
        const graph = generateRegionGraph(SEED);
        expect(graph.nodes.some((n) => n.id === graph.entryNodeId)).toBe(true);
        expect(graph.nodes.some((n) => n.id === graph.gymNodeId)).toBe(true);
        expect(new Set(graph.nodes.map((n) => n.id)).size).toBe(graph.nodes.length);

        const parsed = RunStateSchema.safeParse({
            seed: SEED,
            gymId: 'gym_emberfall',
            biomes: [
                { id: 'b0', name: 'Biome 0', elements: ['Fire'] },
                { id: 'b1', name: 'Biome 1', elements: ['Water'] },
                { id: 'b2', name: 'Biome 2', elements: ['Nature'] },
            ],
            nodes: graph.nodes,
            currentNodeId: graph.entryNodeId,
            partyIds: ['m1'],
            deck: [],
            scrap: 0,
            macros: [null, null, null],
            drivers: [],
            tier: 0,
            modifiers: [],
            phase: 'map',
            gauntlet: null,
            outcome: null,
            fightsResolved: 0,
            startedAt: 1_787_000_000_000,
        });
        expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    });
});

describe('generateRegionGraph — fight envelope over 200 seeds', () => {
    it('stays inside a deliberately generous band', () => {
        // THIS IS A SMOKE ALARM, NOT A SPEC. Ticket 07 rules the fight envelope "LOOSE —
        // deliberately not floored or capped": an under-built rusher loses at the gym and a
        // farmer's run goes long, and the 8-10 battle target from exploration-map.md is the
        // TYPICAL run, not a generator constraint. The prototype measured ~6.7 fights on the
        // shortest path and ~14.6 on the longest over 200 seeds; the bands below are wide enough
        // that ordinary tuning of the mix or the widths will not trip them, and narrow enough that
        // a generator that stopped producing a walkable three-biome region would.
        const mins: number[] = [];
        const maxes: number[] = [];
        for (let i = 0; i < 200; i += 1) {
            const graph = generateRegionGraph(`envelope-${i}`);
            mins.push(minFightsToGym(graph));
            maxes.push(maxFightsToGym(graph));
        }
        const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

        expect(Math.min(...mins)).toBeGreaterThan(0);
        expect(mean(mins)).toBeGreaterThanOrEqual(4);
        expect(mean(mins)).toBeLessThanOrEqual(10);
        expect(mean(maxes)).toBeGreaterThanOrEqual(9);
        expect(mean(maxes)).toBeLessThanOrEqual(22);
        // The longest forward route can never be shorter than the cheapest one.
        for (let i = 0; i < mins.length; i += 1) expect(maxes[i]).toBeGreaterThanOrEqual(mins[i]);
    });
});
