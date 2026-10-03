/**
 * TICKET 176e — the map's layout for towns joined by branching routes.
 *
 * One column per row of the graph (16), a detour hung half a column to the right of the node it
 * leaves, nothing drawn on top of anything else, and the path walked told apart from the branches
 * that are gone. Pure layout, so no DOM.
 */

import { describe, expect, it } from 'vitest';

import { generateRegionGraph } from '../../engine/run/regionGraph';
import type { IRegionNode } from '../../engine/runTypes';
import {
    BOTTOM_ROOM,
    DETOUR_LIFT,
    ROW_H,
    WANDER_Y_FRACTION,
    canvasHeight,
    canvasWidth,
    centreOf,
    layoutRegion,
    shapeOf,
    type LaidOutNode,
} from './regionLayout';

const SEEDS = Array.from({ length: 200 }, (_, i) => `map-176e-${i}`);

/** Distance between two nodes' drawn shapes (negative when they overlap). */
function gap(a: LaidOutNode, b: LaidOutNode): number {
    const pa = centreOf(a);
    const pb = centreOf(b);
    const sa = shapeOf(a.node);
    const sb = shapeOf(b.node);
    if (sa.kind === 'disc' && sb.kind === 'disc') return Math.hypot(pa.x - pb.x, pa.y - pb.y) - sa.r - sb.r;
    if (sa.kind === 'box' && sb.kind === 'box') {
        return Math.max(Math.abs(pa.x - pb.x) - (sa.w + sb.w) / 2, Math.abs(pa.y - pb.y) - (sa.h + sb.h) / 2);
    }
    const [box, disc, pbox, pdisc] = sa.kind === 'box' ? [sa, sb, pa, pb] : [sb, sa, pb, pa];
    if (box.kind !== 'box' || disc.kind !== 'disc') throw new Error('unreachable');
    // Closest point of the box to the disc's centre.
    const nx = Math.max(pbox.x - box.w / 2, Math.min(pdisc.x, pbox.x + box.w / 2));
    const ny = Math.max(pbox.y - box.h / 2, Math.min(pdisc.y, pbox.y + box.h / 2));
    return Math.hypot(pdisc.x - nx, pdisc.y - ny) - disc.r;
}

describe('176e — sixteen columns, one per row of the graph', () => {
    it('lays every generated map in 16 columns, none of them empty', () => {
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            const layout = layoutRegion(graph.nodes, graph.entryNodeId);
            expect(layout.columnCount).toBe(16);
            const used = new Set(layout.nodes.map((n) => n.column));
            expect([...used].sort((a, b) => a - b), seed).toEqual(Array.from({ length: 16 }, (_, i) => i));
        }
    });

    it('puts a link\'s target one column to the right of where it starts, never back', () => {
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            const layout = layoutRegion(graph.nodes, graph.entryNodeId);
            for (const laid of layout.nodes) {
                for (const id of laid.node.edges) {
                    const target = layout.byId.get(id)!;
                    expect(target.x, `${seed} ${laid.node.id}>${id}`).toBeGreaterThan(laid.x);
                }
            }
        }
    });

    it('stacks a route in generation order, top to bottom, and keeps a town alone in its column', () => {
        for (const seed of SEEDS.slice(0, 40)) {
            const graph = generateRegionGraph(seed);
            const layout = layoutRegion(graph.nodes, graph.entryNodeId);
            const towns = layout.nodes.filter((n) => n.node.kind === 'town');
            expect(towns).toHaveLength(3);
            for (const town of towns) expect(town.rowsInColumn).toBe(1);
            for (const column of new Set(layout.nodes.map((n) => n.column))) {
                const stack = layout.nodes.filter((n) => n.column === column && !n.node.detour);
                const slots = stack.map((n) => n.slot);
                expect(slots).toEqual([...slots].sort((a, b) => a - b));
                expect(stack.map((n) => Number(/n(\d+)$/.exec(n.node.id)![1]))).toEqual(
                    stack.map((n) => Number(/n(\d+)$/.exec(n.node.id)![1])).sort((a, b) => a - b),
                );
            }
        }
    });
});

describe('176e — a detour hangs half a column to the right of its host, outside the route', () => {
    it('does so for every detour of 200 maps', () => {
        let seen = 0;
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            const layout = layoutRegion(graph.nodes, graph.entryNodeId);
            for (const laid of layout.nodes.filter((n) => n.node.detour)) {
                seen += 1;
                const host = layout.byId.get(laid.hostId!)!;
                expect(host.node.edges, seed).toContain(laid.node.id);
                expect(laid.x, seed).toBe(host.x + 0.5);
                expect(laid.column).toBe(host.column);
                // Above the top slot or below the bottom one, never between route rows.
                if (laid.side === 'up') expect(laid.slot).toBe(-DETOUR_LIFT);
                else expect(laid.slot).toBe(layout.slotCount - 1 + DETOUR_LIFT);
                // And on the side its host sits: the top node of a stack hangs it above.
                const route = layout.nodes.filter((n) => n.column === laid.column && !n.node.detour);
                if (route.length > 1) expect(laid.side).toBe(route.indexOf(host) === 0 ? 'up' : 'down');
            }
        }
        expect(seen).toBeGreaterThanOrEqual(150);
    });
});

describe('176e — nothing overlaps', () => {
    it('keeps every pair of nodes apart on 200 maps, wander included', () => {
        for (const seed of SEEDS) {
            const graph = generateRegionGraph(seed);
            const layout = layoutRegion(graph.nodes, graph.entryNodeId);
            for (let i = 0; i < layout.nodes.length; i += 1) {
                for (let j = i + 1; j < layout.nodes.length; j += 1) {
                    const a = layout.nodes[i];
                    const b = layout.nodes[j];
                    expect(gap(a, b), `${seed}: ${a.node.id} / ${b.node.id}`).toBeGreaterThan(4);
                }
            }
        }
    });

    it('keeps every node inside the picture', () => {
        for (const seed of SEEDS.slice(0, 60)) {
            const graph = generateRegionGraph(seed);
            const layout = layoutRegion(graph.nodes, graph.entryNodeId);
            for (const laid of layout.nodes) {
                const { x, y } = centreOf(laid);
                const shape = shapeOf(laid.node);
                const halfW = shape.kind === 'box' ? shape.w / 2 : shape.r;
                const halfH = shape.kind === 'box' ? shape.h / 2 : shape.r;
                expect(x - halfW, laid.node.id).toBeGreaterThan(0);
                expect(x + halfW).toBeLessThan(canvasWidth(layout));
                expect(y - halfH).toBeGreaterThan(0);
                // Room is left under the lowest node for its name and the Route labels.
                expect(y + halfH + BOTTOM_ROOM / 2).toBeLessThan(canvasHeight(layout));
            }
        }
    });

    it('wanders vertically only, by at most 12% of a row', () => {
        const graph = generateRegionGraph('wander-176e');
        const layout = layoutRegion(graph.nodes, graph.entryNodeId);
        expect(WANDER_Y_FRACTION).toBeLessThanOrEqual(0.12);
        for (const laid of layout.nodes) {
            const { x, y } = centreOf(laid);
            expect(x).toBe(centreOf({ ...laid, wanderY: 0 }).x);
            expect(Math.abs(y - centreOf({ ...laid, wanderY: 0 }).y)).toBeLessThanOrEqual(ROW_H * 0.12 + 1e-9);
        }
    });

    it('draws a town as a wide box and a gate or the gym as a bigger disc than a route node', () => {
        const graph = generateRegionGraph('shapes-176e');
        const byKind = (pick: (n: IRegionNode) => boolean) => graph.nodes.filter(pick).map((n) => shapeOf(n));
        for (const shape of byKind((n) => n.kind === 'town')) expect(shape.kind).toBe('box');
        const gym = shapeOf(graph.nodes.find((n) => n.kind === 'gym')!);
        const route = shapeOf(graph.nodes.find((n) => n.kind === 'wild' && !n.detour && n.layer === 1 && n.biomeIndex === 1)!);
        if (gym.kind !== 'disc' || route.kind !== 'disc') throw new Error('expected discs');
        expect(gym.r).toBeGreaterThan(route.r);
        const gate = graph.nodes.find((n) => n.biomeIndex === 0 && n.layer === 6)!;
        const gateShape = shapeOf(gate);
        if (gateShape.kind !== 'disc') throw new Error('expected a disc');
        expect(gateShape.r).toBeGreaterThan(route.r);
    });
});

describe('176e — the path walked, and the branches that are gone', () => {
    it('marks the walked nodes taken and the forks you left passed, and nothing ahead passed', () => {
        let forks = 0;
        for (const seed of SEEDS.slice(0, 60)) {
            const graph = generateRegionGraph(seed);
            const byId = new Map(graph.nodes.map((n) => [n.id, n]));
            // Walk the first road each time until a node with a choice, take the LAST option.
            let path: IRegionNode[] = [byId.get(graph.entryNodeId)!];
            for (;;) {
                const here = path[path.length - 1];
                if (here.edges.length === 0) break;
                const next = byId.get(here.edges[here.edges.length - 1])!;
                path = [...path, next];
                if (here.edges.length > 1) break;
            }
            const walked = new Set(path.map((n) => n.id));
            const nodes = graph.nodes.map((n) => (walked.has(n.id) ? { ...n, visited: 1 } : n));
            const current = path[path.length - 1];
            const layout = layoutRegion(nodes, current.id);

            for (const laid of layout.nodes) {
                expect(laid.taken, `${seed} ${laid.node.id}`).toBe(walked.has(laid.node.id));
            }
            // Everything reachable from here by walking forward is not passed.
            const queue = [...current.edges];
            const ahead = new Set<string>();
            while (queue.length > 0) {
                const id = queue.pop()!;
                if (ahead.has(id)) continue;
                ahead.add(id);
                queue.push(...byId.get(id)!.edges);
            }
            for (const laid of layout.nodes) {
                if (ahead.has(laid.node.id)) expect(laid.passed, laid.node.id).toBe(false);
                if (walked.has(laid.node.id)) expect(laid.passed).toBe(false);
                else if (!ahead.has(laid.node.id)) expect(laid.passed, laid.node.id).toBe(true);
            }
            const before = path[path.length - 2];
            if (before && before.edges.length > 1) {
                forks += 1;
                // The branch not taken at the fork is passed, unless the road you took still reaches it.
                for (const id of before.edges) {
                    if (id !== current.id && !ahead.has(id)) expect(layout.byId.get(id)!.passed).toBe(true);
                }
            }
        }
        expect(forks).toBeGreaterThan(10);
    });

    it('labels the five routes along the bottom, in order, each over its own columns', () => {
        const graph = generateRegionGraph('routes-176e');
        const layout = layoutRegion(graph.nodes, graph.entryNodeId);
        expect(layout.routes.map((r) => r.route)).toEqual([1, 2, 3, 4, 5]);
        for (const route of layout.routes) expect(route.firstColumn).toBeLessThanOrEqual(route.lastColumn);
        for (let i = 1; i < layout.routes.length; i += 1) {
            expect(layout.routes[i].firstColumn).toBeGreaterThan(layout.routes[i - 1].lastColumn);
        }
    });
});
