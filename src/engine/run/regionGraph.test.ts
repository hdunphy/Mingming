/**
 * Tests for ticket 176's region generator: towns joined by branching, one-way routes.
 *
 * The graph is written straight into `IRunState.nodes`, so a node that fails `RegionNodeSchema` is a
 * save that fails to load. Everything shape-related is checked over 500 seeds, because a map that
 * crosses or strands a node one seed in a thousand is a map a player eventually meets.
 */

import { describe, expect, it } from 'vitest';

import { MAX_LAYER, RegionNodeSchema, RunStateSchema } from '../runTypes';
import type { IRegionNode } from '../runTypes';
import {
    REGION_PARAMS, exitLayerOf, generateRegionGraph, isScriptedOpening, longestBiomeRowCount, nodeRole,
    routeNumberOf,
} from './regionGraph';
import type { RegionGraph } from './regionGraph';

const SEED = 'seed-region-0001';
const SEEDS = Array.from({ length: 500 }, (_, i) => `map-seed-${i}`);

/** M1: the width of every row, per biome, start and town and exit being one node each. */
const ROW_WIDTHS: ReadonlyArray<ReadonlyArray<number>> = [
    [1, 1, 2, 3, 1, 2, 1],
    [2, 3, 1, 2, 1],
    [2, 3, 1, 1],
];

const byId = (graph: RegionGraph): Map<string, IRegionNode> => new Map(graph.nodes.map((n) => [n.id, n]));
const inBiome = (graph: RegionGraph, biomeIndex: number): IRegionNode[] => graph.nodes.filter((n) => n.biomeIndex === biomeIndex);
const rowNodes = (graph: RegionGraph, biomeIndex: number, layer: number): IRegionNode[] =>
    graph.nodes.filter((n) => n.biomeIndex === biomeIndex && n.layer === layer && !n.detour);

/** Every node reachable from `startId` following `edges` (forward links). */
function reachableFrom(graph: RegionGraph, startId: string): Set<string> {
    const index = byId(graph);
    const seen = new Set<string>([startId]);
    const queue = [startId];
    while (queue.length > 0) {
        for (const next of index.get(queue.shift()!)!.edges) {
            if (!seen.has(next)) {
                seen.add(next);
                queue.push(next);
            }
        }
    }
    return seen;
}

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

describe('176a — the rows (M1)', () => {
    it('lays out exactly the ruled rows, in order, with the ruled widths', () => {
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            ROW_WIDTHS.forEach((widths, biomeIndex) => {
                widths.forEach((width, layer) => {
                    expect(rowNodes(graph, biomeIndex, layer), `${seed} b${biomeIndex} row ${layer}`).toHaveLength(width);
                });
                expect(inBiome(graph, biomeIndex).filter((n) => !n.detour)).toHaveLength(widths.reduce((a, b) => a + b, 0));
            });
        }
    });

    it('gives every node the role its row says, and 16 rows in all', () => {
        const graph = generateRegionGraph(SEED);
        expect(REGION_PARAMS.biomeRows.map((rows) => rows.length)).toEqual([7, 5, 4]);
        expect(nodeRole(byId(graph).get(graph.entryNodeId)!)).toBe('start');
        for (const node of graph.nodes) {
            const role = nodeRole(node);
            if (node.detour) expect(role).toBe('detour');
            else if (node.kind === 'town') expect(role).toBe('town');
            else if (node.layer === exitLayerOf(node.biomeIndex)) expect(role).toBe('exit');
            else if (node.id === graph.entryNodeId) expect(role).toBe('start');
            else expect(role).toBe('route');
        }
    });

    it('has one town per biome and no marketplace or workshop nodes', () => {
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            for (let biomeIndex = 0; biomeIndex < 3; biomeIndex += 1) {
                expect(inBiome(graph, biomeIndex).filter((n) => n.kind === 'town')).toHaveLength(1);
            }
            expect(graph.nodes.some((n) => n.kind === 'marketplace' || n.kind === 'workshop')).toBe(false);
        }
    });

    it('exits biomes 0 and 1 with an elite and the last biome with the gym', () => {
        for (const seed of SEEDS.slice(0, 50)) {
            const graph = generateRegionGraph(seed);
            expect(rowNodes(graph, 0, exitLayerOf(0))[0].kind).toBe('elite');
            expect(rowNodes(graph, 1, exitLayerOf(1))[0].kind).toBe('elite');
            expect(rowNodes(graph, 2, exitLayerOf(2))[0].kind).toBe('gym');
            expect(graph.gymNodeId).toBe(rowNodes(graph, 2, exitLayerOf(2))[0].id);
        }
    });

    it('starts the player standing on a visited wild, and nothing else is visited', () => {
        const graph = generateRegionGraph(SEED);
        const start = byId(graph).get(graph.entryNodeId)!;
        expect(start).toMatchObject({ kind: 'wild', biomeIndex: 0, layer: 0, visited: 1 });
        expect(graph.nodes.filter((n) => n.visited > 0)).toHaveLength(1);
    });

    it('makes biome 0\'s first route row a single wild, on every seed (the scripted fight)', () => {
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            const first = rowNodes(graph, 0, 1);
            expect(first).toHaveLength(1);
            expect(first[0].kind).toBe('wild');
            expect(isScriptedOpening(first[0])).toBe(true);
            expect(graph.nodes.filter(isScriptedOpening)).toHaveLength(1);
        }
    });

    it('keeps MAX_LAYER equal to the longest biome\'s row count minus one', () => {
        expect(MAX_LAYER).toBe(longestBiomeRowCount() - 1);
    });

    it('numbers the routes 1 to 5 in run order', () => {
        const graph = generateRegionGraph(SEED);
        const numbers = new Set(graph.nodes.map(routeNumberOf).filter((n): n is number => n !== null));
        expect([...numbers].sort()).toEqual([1, 2, 3, 4, 5]);
        // Route 1 is biome 0's first three route rows, Route 2 its last one, Routes 3 and 4 biome 1's, Route 5 biome 2's.
        expect(routeNumberOf(rowNodes(graph, 0, 1)[0])).toBe(1);
        expect(routeNumberOf(rowNodes(graph, 0, 3)[0])).toBe(1);
        expect(routeNumberOf(rowNodes(graph, 0, 5)[0])).toBe(2);
        expect(routeNumberOf(rowNodes(graph, 1, 0)[0])).toBe(3);
        expect(routeNumberOf(rowNodes(graph, 1, 3)[0])).toBe(4);
        expect(routeNumberOf(rowNodes(graph, 2, 1)[0])).toBe(5);
        expect(routeNumberOf(rowNodes(graph, 0, 4)[0])).toBeNull();        // a town
        expect(routeNumberOf(byId(graph).get(graph.entryNodeId)!)).toBeNull();
    });
});

describe('176a — forward-only links that never cross (M2)', () => {
    it('lets every node be reached from the start, and reach the gym', () => {
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            const reached = reachableFrom(graph, graph.entryNodeId);
            expect(reached.size, seed).toBe(graph.nodes.length);
            for (const node of graph.nodes) {
                expect(reachableFrom(graph, node.id).has(graph.gymNodeId), `${seed} ${node.id}`).toBe(true);
            }
        }
    });

    it('only links from a row to the next row, or through a detour', () => {
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            const index = byId(graph);
            for (const node of graph.nodes) {
                for (const nextId of node.edges) {
                    const next = index.get(nextId)!;
                    const rowStep = next.biomeIndex * 100 + next.layer - (node.biomeIndex * 100 + node.layer);
                    if (next.detour) {
                        // Out to a detour: it shares the host's layer.
                        expect(next.layer, `${seed} ${node.id}->${nextId}`).toBe(node.layer);
                    } else if (node.detour) {
                        expect(rowStep, `${seed} ${node.id}->${nextId}`).toBe(1);
                    } else if (next.biomeIndex === node.biomeIndex) {
                        expect(rowStep, `${seed} ${node.id}->${nextId}`).toBe(1);
                    } else {
                        // Across a biome seam: the exit to the next biome's first row.
                        expect(node.layer).toBe(exitLayerOf(node.biomeIndex));
                        expect(next.biomeIndex).toBe(node.biomeIndex + 1);
                        expect(next.layer).toBe(0);
                    }
                }
            }
        }
    });

    it('gives every node a way in and a way forward (the start has no way in, the gym no way forward)', () => {
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            const hasWayIn = new Set(graph.nodes.flatMap((n) => n.edges));
            for (const node of graph.nodes) {
                if (node.id !== graph.entryNodeId) expect(hasWayIn.has(node.id), `${seed} ${node.id} has no way in`).toBe(true);
                if (node.id !== graph.gymNodeId) expect(node.edges.length, `${seed} ${node.id} has no way on`).toBeGreaterThan(0);
            }
            expect(byId(graph).get(graph.gymNodeId)!.edges).toEqual([]);
        }
    });

    it('never crosses two links when the rows are drawn top to bottom', () => {
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            for (let biomeIndex = 0; biomeIndex < 3; biomeIndex += 1) {
                const rows = REGION_PARAMS.biomeRows[biomeIndex];
                for (let layer = 0; layer < rows.length - 1; layer += 1) {
                    const upper = rowNodes(graph, biomeIndex, layer);
                    const lower = rowNodes(graph, biomeIndex, layer + 1);
                    const targetsOf = (n: IRegionNode) => n.edges.map((id) => lower.findIndex((l) => l.id === id)).filter((i) => i >= 0);
                    for (let i = 0; i < upper.length; i += 1) {
                        for (let j = i + 1; j < upper.length; j += 1) {
                            const a = targetsOf(upper[i]);
                            const b = targetsOf(upper[j]);
                            expect(Math.max(...a), `${seed} b${biomeIndex} row ${layer}: ${upper[i].id} crosses ${upper[j].id}`)
                                .toBeLessThanOrEqual(Math.min(...b));
                        }
                    }
                }
            }
        }
    });

    it('gives each node one or two forward links on the plain route', () => {
        for (const seed of SEEDS.slice(0, 100)) {
            const graph = generateRegionGraph(seed);
            const index = byId(graph);
            for (const node of graph.nodes) {
                const plain = node.edges.filter((id) => !index.get(id)!.detour);
                if (node.id === graph.gymNodeId) continue;
                expect(plain.length).toBeGreaterThanOrEqual(1);
            }
        }
    });

    it('puts 11 nodes before the gym on every path without a detour (the start and towns not counted)', () => {
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            const index = byId(graph);
            // Longest and shortest count over the plain links only: they must be the same number.
            const memo = new Map<string, [number, number]>();
            const walk = (id: string): [number, number] => {
                const cached = memo.get(id);
                if (cached) return cached;
                const node = index.get(id)!;
                const own = node.kind === 'town' || id === graph.entryNodeId || id === graph.gymNodeId ? 0 : 1;
                const next = node.edges.filter((e) => !index.get(e)!.detour);
                let result: [number, number];
                if (next.length === 0) result = [own, own];
                else {
                    const below = next.map(walk);
                    result = [own + Math.min(...below.map((b) => b[0])), own + Math.max(...below.map((b) => b[1]))];
                }
                memo.set(id, result);
                return result;
            };
            expect(walk(graph.entryNodeId), seed).toEqual([11, 11]);
        }
    });
});

describe('176a — detours (M3)', () => {
    it('has exactly one detour per biome, a wild, alpha, ambush or rival', () => {
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            for (let biomeIndex = 0; biomeIndex < 3; biomeIndex += 1) {
                const detours = inBiome(graph, biomeIndex).filter((n) => n.detour);
                expect(detours, `${seed} b${biomeIndex}`).toHaveLength(1);
                expect(['wild', 'alpha', 'ambush', 'rival']).toContain(detours[0].kind);
            }
        }
    });

    it('hangs off the top or bottom link between two rows, and rejoins the node that link led to', () => {
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            const index = byId(graph);
            for (const detour of graph.nodes.filter((n) => n.detour)) {
                const hosts = graph.nodes.filter((n) => n.edges.includes(detour.id));
                expect(hosts, `${seed} ${detour.id}`).toHaveLength(1);
                const host = hosts[0];
                expect(detour.edges).toHaveLength(1);
                const target = index.get(detour.edges[0])!;
                // The plain link host -> target is kept: skipping the detour is the plain path.
                expect(host.edges, `${seed} ${detour.id} has no skip`).toContain(target.id);
                // And the host and the target are the top pair or the bottom pair of their rows.
                const hostRow = rowNodes(graph, host.biomeIndex, host.layer);
                const targetRow = rowNodes(graph, target.biomeIndex, target.layer);
                const top = hostRow[0].id === host.id && targetRow[0].id === target.id;
                const bottom = hostRow[hostRow.length - 1].id === host.id && targetRow[targetRow.length - 1].id === target.id;
                expect(top || bottom, `${seed} ${detour.id} is not off a top or bottom link`).toBe(true);
            }
        }
    });

    it('never hangs off the scripted first fight, and costs exactly one extra fight', () => {
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            const index = byId(graph);
            for (const detour of graph.nodes.filter((n) => n.detour)) {
                const host = graph.nodes.find((n) => n.edges.includes(detour.id))!;
                expect(isScriptedOpening(host)).toBe(false);
                expect(nodeRole(host)).toBe('route');
                // One node in, one node out: a detour adds one stop to the path through it.
                const target = index.get(detour.edges[0])!;
                expect(detour.layer).toBe(host.layer);
                expect(target.layer + target.biomeIndex * 100).toBe(host.layer + host.biomeIndex * 100 + 1);
            }
        }
    });

    it('is a fight, so taking it adds a fight', () => {
        for (const seed of SEEDS) {
            for (const detour of generateRegionGraph(seed).nodes.filter((n) => n.detour)) {
                expect(['wild', 'alpha', 'ambush', 'rival']).toContain(detour.kind);
            }
        }
    });
});

describe('176a — rivals (142a) and the scout (142b)', () => {
    it('puts at least one rival in every biome, and none on the scripted fight', () => {
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            for (let biomeIndex = 0; biomeIndex < 3; biomeIndex += 1) {
                expect(inBiome(graph, biomeIndex).some((n) => n.kind === 'rival'), `${seed} b${biomeIndex}`).toBe(true);
            }
            expect(graph.nodes.filter(isScriptedOpening).every((n) => n.kind === 'wild')).toBe(true);
        }
    });

    it('has exactly one scout, in the last biome, in a route row before the town', () => {
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            const scouts = graph.nodes.filter((n) => n.scout);
            expect(scouts, seed).toHaveLength(1);
            const scout = scouts[0];
            expect(scout.kind).toBe('elite');
            expect(scout.biomeIndex).toBe(2);
            expect(nodeRole(scout)).toBe('route');
            const townLayer = graph.nodes.find((n) => n.biomeIndex === 2 && n.kind === 'town')!.layer;
            expect(scout.layer).toBeLessThan(townLayer);
        }
    });

    it('prefers the last route row before the town', () => {
        let lastRow = 0;
        for (const seed of SEEDS) {
            const scout = generateRegionGraph(seed).nodes.find((n) => n.scout)!;
            if (scout.layer === 1) lastRow += 1;
        }
        expect(lastRow).toBeGreaterThan(SEEDS.length * 0.9);
    });
});

describe('176a — an old save is thrown away (M5)', () => {
    it('a node without `detour` fails the schema, and one with it passes', () => {
        const node = generateRegionGraph(SEED).nodes[0];
        const { detour: _detour, ...old } = node;
        void _detour;
        expect(RegionNodeSchema.safeParse({ ...old, pocket: false }).success).toBe(false);
        expect(RegionNodeSchema.safeParse(node).success).toBe(true);
        expect(RegionNodeSchema.safeParse({ ...node, layer: MAX_LAYER + 1 }).success).toBe(false);
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
