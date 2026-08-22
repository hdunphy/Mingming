/**
 * Region map layout and the fog rule — ticket 10.
 *
 * Layout is a pure function precisely so it can be tested without a DOM (ticket 06 removed `x`/`y`
 * from the save so position stays derivable), and the fog rule is the part worth pinning: it is a
 * *design* rule with three clauses, and each one has a plausible-looking wrong version.
 */

import { describe, expect, it } from 'vitest';

import { generateRegionGraph } from '../../engine/run/regionGraph';
import type { IRegionNode } from '../../engine/runTypes';
import { COLUMNS_PER_BIOME, VISIBILITY_LAYERS, columnOf, layoutRegion } from './regionLayout';

const node = (over: Partial<IRegionNode> & { id: string }): IRegionNode => ({
    kind: 'wild',
    biomeIndex: 0,
    layer: 0,
    pocket: false,
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
    it('puts pockets last in their column so the main route reads as a spine', () => {
        const nodes = [
            node({ id: 'pocket', layer: 2, pocket: true }),
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

describe('layoutRegion — the fog rule', () => {
    const graph = generateRegionGraph('fog-seed');

    it('reveals exactly one layer ahead of the player', () => {
        const start = graph.nodes.find((n) => n.id === graph.entryNodeId)!;
        const layout = layoutRegion(graph.nodes, graph.entryNodeId);
        const playerColumn = columnOf(start);

        for (const laid of layout.nodes) {
            if (laid.node.visited > 0) continue; // separately ruled, tested below
            expect(laid.revealed).toBe(laid.column <= playerColumn + VISIBILITY_LAYERS);
        }
    });

    it('keeps somewhere you have already stood revealed, however far behind it is', () => {
        // Fog that forgets where you walked is not fog, it is amnesia — and it would make the map
        // useless for the backtracking ticket 07 explicitly allows.
        const far = graph.nodes.find((n) => columnOf(n) >= 10)!;
        const walked = graph.nodes.map((n) => (n.id === far.id ? { ...n, visited: 2 } : n));
        const layout = layoutRegion(walked, graph.entryNodeId);
        expect(layout.byId.get(far.id)?.revealed).toBe(true);
    });

    it('fogs the KIND, never the node — the graph shape is public', () => {
        // "Types visible, contents hidden" one step further out. You can see a fork exists four
        // layers away; you cannot see what is on it. Routing is only a decision if the shape shows.
        const layout = layoutRegion(graph.nodes, graph.entryNodeId);
        expect(layout.nodes).toHaveLength(graph.nodes.length);
        expect(layout.nodes.some((n) => !n.revealed)).toBe(true);
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
