/**
 * TICKET 176f - the walker's step on the one-way map.
 *
 * `chooseStep` reads only `nodes` and `currentNodeId`, so a map is walked here with no run, no
 * store and no fights: every step is taken, the node marked entered, and the next step asked for.
 */
import { describe, expect, it } from 'vitest';

import { generateRegionGraph } from '../../engine/run/regionGraph';
import type { IRegionNode, IRunState } from '../../engine/runTypes';
import { chooseStep } from './runWalker';

const SEEDS = Array.from({ length: 100 }, (_, i) => `choose-step-176f-${i}`);

/** Walk the whole map to the gym, returning the nodes stepped on, in order. */
function walk(seed: string, takeDetours: boolean): IRegionNode[] {
    const graph = generateRegionGraph(seed);
    const gym = graph.nodes.find((n) => n.kind === 'gym')!;
    let nodes = graph.nodes;
    let current = graph.entryNodeId;
    const stepped: IRegionNode[] = [];
    for (let guard = 0; guard < 60; guard += 1) {
        const run = { nodes, currentNodeId: current } as unknown as IRunState;
        const step = chooseStep(run, gym.id, false, takeDetours);
        if (!step) break;
        nodes = nodes.map((n) => (n.id === step.nodeId ? { ...n, visited: n.visited + 1 } : n));
        current = step.nodeId;
        stepped.push(nodes.find((n) => n.id === current)!);
    }
    return stepped;
}

describe('176f - chooseStep on forward links', () => {
    it('reaches the gym from the start on every map, only ever stepping forward', () => {
        for (const seed of SEEDS) {
            const stepped = walk(seed, false);
            expect(stepped[stepped.length - 1]?.kind, seed).toBe('gym');
            for (let i = 1; i < stepped.length; i += 1) {
                expect(stepped[i].biomeIndex * 10 + stepped[i].layer, seed).toBeGreaterThan(stepped[i - 1].biomeIndex * 10 + stepped[i - 1].layer);
            }
        }
    });

    it('never steps onto a detour unless takeDetours is set (M8)', () => {
        for (const seed of SEEDS) expect(walk(seed, false).filter((n) => n.detour), seed).toHaveLength(0);
    });

    it('with takeDetours, takes every detour it is offered, and still reaches the gym', () => {
        let taken = 0;
        for (const seed of SEEDS) {
            const stepped = walk(seed, true);
            expect(stepped[stepped.length - 1]?.kind, seed).toBe('gym');
            const graph = generateRegionGraph(seed);
            const byId = new Map(graph.nodes.map((n) => [n.id, n]));
            for (let i = 0; i < stepped.length - 1; i += 1) {
                const offeredDetour = byId.get(stepped[i].id)!.edges.some((id) => byId.get(id)!.detour);
                if (offeredDetour) {
                    expect(stepped[i + 1].detour, `${seed} at ${stepped[i].id}`).toBe(true);
                    taken += 1;
                }
            }
        }
        expect(taken).toBeGreaterThan(50);
    });

    it('walks 14 steps then the gym on a plain path: 11 route nodes and 3 towns', () => {
        for (const seed of SEEDS) {
            const stepped = walk(seed, false);
            expect(stepped.filter((n) => n.kind === 'town'), seed).toHaveLength(3);
            expect(stepped.filter((n) => n.kind !== 'town' && n.kind !== 'gym'), seed).toHaveLength(11);
        }
    });

    it('prefers a fight to an event when both are on the way', () => {
        let choices = 0;
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            const byId = new Map(graph.nodes.map((n) => [n.id, n]));
            for (const step of walk(seed, false).slice(0, -1)) {
                const options = byId.get(step.id)!.edges.map((id) => byId.get(id)!).filter((n) => !n.detour);
                const kinds = new Set(options.map((n) => n.kind));
                if (kinds.has('event') && options.some((n) => n.kind !== 'event' && n.kind !== 'town' && n.kind !== 'gym')) choices += 1;
            }
            const stepped = walk(seed, false);
            for (let i = 0; i < stepped.length - 1; i += 1) {
                const options = byId.get(stepped[i].id)!.edges.map((id) => byId.get(id)!).filter((n) => !n.detour);
                if (options.some((n) => n.kind === 'event') && options.some((n) => ['wild', 'rival', 'elite', 'alpha', 'ambush'].includes(n.kind))) {
                    expect(stepped[i + 1].kind, `${seed} at ${stepped[i].id}`).not.toBe('event');
                }
            }
        }
        expect(choices).toBeGreaterThan(20);
    });
});
