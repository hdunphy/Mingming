/**
 * Region map layout — ticket 10 (and, since ticket 176d, no fog).
 *
 * Layout is a pure function precisely so it can be tested without a DOM (ticket 06 removed `x`/`y`
 * from the save so position stays derivable).
 */

import { describe, expect, it } from 'vitest';

import { generateRegionGraph } from '../../engine/run/regionGraph';
import type { IRegionNode } from '../../engine/runTypes';
import { COLUMNS_PER_BIOME, columnOf, layoutRegion, wanderFor } from './regionLayout';

const node = (over: Partial<IRegionNode> & { id: string }): IRegionNode => ({
    kind: 'wild',
    biomeIndex: 0,
    layer: 0,
    detour: false,
    edges: [],
    visited: 0,
    ...over,
});

describe('columnOf', () => {
    it('lays three biomes end to end, left to right', () => {
        expect(columnOf(node({ id: 'a', biomeIndex: 0, layer: 0 }))).toBe(0);
        expect(columnOf(node({ id: 'b', biomeIndex: 0, layer: 4 }))).toBe(4);
        expect(columnOf(node({ id: 'c', biomeIndex: 1, layer: 0 }))).toBe(COLUMNS_PER_BIOME);
        expect(columnOf(node({ id: 'd', biomeIndex: 2, layer: 4 }))).toBe(14);
    });
});

describe('layoutRegion — ordering', () => {
    it('puts detours last in their column so the main route reads as a spine', () => {
        const nodes = [
            node({ id: 'pocket', layer: 2, detour: true }),
            node({ id: 'b', layer: 2 }),
            node({ id: 'a', layer: 2 }),
        ];
        const laid = layoutRegion(nodes, 'a').nodes.filter((n) => n.column === 2);
        expect(laid.map((n) => n.node.id)).toEqual(['a', 'b', 'pocket']);
    });

    it('is stable — the same graph always lays out the same way', () => {
        const graph = generateRegionGraph('layout-stability');
        const first = layoutRegion(graph.nodes, graph.entryNodeId).nodes.map((n) => n.node.id);
        const second = layoutRegion([...graph.nodes].reverse(), graph.entryNodeId).nodes.map((n) => n.node.id);
        // A map that reshuffles when the node array happens to arrive in a different order is
        // unreadable, and the array order is not something the save guarantees.
        expect(second).toEqual(first);
    });
});

describe('layoutRegion — no fog (ticket 176d)', () => {
    const graph = generateRegionGraph('fog-seed');

    it('lays out every node from the first step, however far ahead it is', () => {
        const layout = layoutRegion(graph.nodes, graph.entryNodeId);
        expect(layout.nodes).toHaveLength(graph.nodes.length);
        expect(layout.byId.size).toBe(graph.nodes.length);
    });

    it('carries no fog flag: a node is drawn with its kind whatever its distance', () => {
        const layout = layoutRegion(graph.nodes, graph.entryNodeId);
        for (const laid of layout.nodes) expect(laid).not.toHaveProperty('revealed');
    });

    it('is the same layout wherever the player stands (nothing depends on the current column)', () => {
        const first = layoutRegion(graph.nodes, graph.entryNodeId).nodes.map((n) => [n.node.id, n.column, n.row]);
        const later = layoutRegion(graph.nodes, graph.nodes[5].id).nodes.map((n) => [n.node.id, n.column, n.row]);
        expect(later).toEqual(first);
    });
});

describe('layoutRegion — reachability and position', () => {
    const graph = generateRegionGraph('reach-seed');
    const layout = layoutRegion(graph.nodes, graph.entryNodeId);
    const start = graph.nodes.find((n) => n.id === graph.entryNodeId)!;

    it('marks exactly the current node`s neighbours reachable', () => {
        const reachable = layout.nodes.filter((n) => n.reachable).map((n) => n.node.id).sort();
        expect(reachable).toEqual([...start.edges].sort());
    });

    it('marks the current node, and only it', () => {
        expect(layout.nodes.filter((n) => n.isCurrent).map((n) => n.node.id)).toEqual([graph.entryNodeId]);
    });

    it('never marks the current node reachable — you are already standing on it', () => {
        expect(layout.byId.get(graph.entryNodeId)?.reachable).toBe(false);
    });

    it('reports a row count per column that a renderer can centre with', () => {
        for (const laid of layout.nodes) {
            const inColumn = layout.nodes.filter((n) => n.column === laid.column);
            expect(laid.rowsInColumn).toBe(inColumn.length);
            expect(laid.row).toBeLessThan(laid.rowsInColumn);
        }
        expect(layout.maxRows).toBe(Math.max(...layout.nodes.map((n) => n.rowsInColumn)));
    });

    it('spans fifteen columns — three biomes of five layers', () => {
        expect(layout.columnCount).toBe(15);
    });
});

/**
 * TICKET 34 part two — the wander.
 *
 * Ticket 06 kept `x`/`y` out of `IRegionNode` so that layout stays derivable and a save never
 * freezes a UI decision. The wander has to honour that: it may make the map look hand-drawn, but it
 * must be a pure function of the node id, or a re-render moves the map under the player's cursor and
 * a resumed save draws a different region from the one they left.
 */
describe('the wander (ticket 34 part two)', () => {
    const graph = generateRegionGraph('wander-graph');

    it('is stable for an id, and independent between x and y', () => {
        expect(wanderFor('b1l2n0')).toEqual(wanderFor('b1l2n0'));
        const { x, y } = wanderFor('b1l2n0');
        // Both halves of the hash are used; deriving y from x would put every node on a diagonal.
        expect(x).not.toBe(y);
    });

    it('stays inside [-1, 1] for every id a graph can produce', () => {
        for (const node of graph.nodes) {
            const { x, y } = wanderFor(node.id);
            expect(x).toBeGreaterThanOrEqual(-1);
            expect(x).toBeLessThanOrEqual(1);
            expect(y).toBeGreaterThanOrEqual(-1);
            expect(y).toBeLessThanOrEqual(1);
        }
    });

    it('separates ADJACENT ids — the case a weak hash would fail', () => {
        // `b1l2n0` and `b1l2n1` share a column and are drawn as neighbours. A hash that mapped them
        // to nearly the same offset would leave the two nodes stacked, which is the exact thing the
        // wander exists to prevent.
        const a = wanderFor('b1l2n0');
        const b = wanderFor('b1l2n1');
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(0.2);
    });

    it('reaches the laid-out nodes, so the renderer has something to lean on', () => {
        const laid = layoutRegion(graph.nodes, graph.entryNodeId);
        for (const node of laid.nodes) {
            expect(node.wanderX).toBe(wanderFor(node.node.id).x);
            expect(node.wanderY).toBe(wanderFor(node.node.id).y);
        }
        // Not all zero — a wander that never moves anything is a wander nobody would notice.
        expect(laid.nodes.some((n) => Math.abs(n.wanderX) > 0.2)).toBe(true);
    });
});
