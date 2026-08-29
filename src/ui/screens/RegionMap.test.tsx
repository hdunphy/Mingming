/**
 * The region map, rendered — ticket 10.
 *
 * `regionLayout.test.ts` covers the rules; this covers that the screen actually *shows* them, which
 * is a different failure. A map can compute fog correctly and still print the node's kind in its
 * accessible label, and a map can be perfectly navigable with a mouse and unusable without one.
 *
 * Rendered to static markup, the shape the panel tests established: the repo has no
 * `@testing-library/react`, and `renderToStaticMarkup` runs no effects.
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import RegionMap from './RegionMap';
import { generateRegionGraph } from '../../engine/run/regionGraph';
import { columnOf } from './regionLayout';

const graph = generateRegionGraph('map-render-seed');
const BIOME_NAMES = ['Emberglass Flats', 'Brinehollow', 'Rootmire'];
const BIOME_ELEMENTS = ['Fire', 'Water', 'Nature'];

function render(currentNodeId = graph.entryNodeId, nodes = graph.nodes): string {
    return renderToStaticMarkup(
        <RegionMap
            nodes={nodes}
            currentNodeId={currentNodeId}
            biomeNames={BIOME_NAMES}
            biomeElements={BIOME_ELEMENTS}
            onTravel={() => {}}
        />,
    );
}

describe('RegionMap', () => {
    it('draws every node and every undirected edge exactly once', () => {
        const markup = render();
        // `class="rm-node-disc"`, not every `<circle>`: ticket 34 part two gave a visited node a
        // second circle for its gold visit badge, and counting those would make "one disc per node"
        // fail for a reason it is not about.
        const circles = markup.match(/<circle[^>]*class="rm-node-disc"/g)?.length ?? 0;
        // `class="rm-edge"`, not every `<line>`: ticket 34 added the biome seams, which are also
        // lines and are decoration rather than graph. Counting all of them would make this test
        // fail for a reason it is not about.
        // `class="rm-edge"` may carry a ` faded` modifier since ticket 34 part two, so match the
        // prefix. Still not every `<line>`: the biome seams are decoration, not graph.
        const lines = markup.match(/<line[^>]*class="rm-edge/g)?.length ?? 0;

        expect(circles).toBe(graph.nodes.length);
        // Edges are stored on both endpoints (ticket 07: walkable both ways), so drawing straight
        // from the arrays would paint every line twice.
        const halfEdges = graph.nodes.reduce((sum, n) => sum + n.edges.length, 0);
        expect(lines).toBe(halfEdges / 2);
    });

    it('paints one backdrop band per biome, tinted by its element (ticket 34)', () => {
        const markup = render();
        // The map's routing information used to live only in the strip of labels above the picture.
        // One band per biome, each with its own gradient, is the picture carrying it too.
        expect(markup.match(/class="rm-biome-band"/g)?.length).toBe(BIOME_NAMES.length);
        for (let i = 0; i < BIOME_NAMES.length; i += 1) expect(markup).toContain(`id="rm-biome-${i}"`);
        // Seams sit BETWEEN biomes, so there is one fewer than there are bands.
        expect(markup.match(/class="rm-biome-seam"/g)?.length).toBe(BIOME_NAMES.length - 1);
    });

    it('shows the three biomes and marks the one you are standing in', () => {
        const markup = render();
        for (const name of BIOME_NAMES) expect(markup).toContain(name);
        expect(markup).toContain('rm-biome here');
    });

    it('gives every reachable node a real button, so the map works without a mouse', () => {
        // The SVG is aria-hidden and the button list is the control. Ticket 38 inherits a screen
        // that is already keyboard-operable rather than one that needs retrofitting.
        const start = graph.nodes.find((n) => n.id === graph.entryNodeId)!;
        const markup = render();

        expect(markup).toContain('aria-hidden="true"');
        expect(markup.match(/rm-travel-button/g)?.length).toBe(start.edges.length);
    });

    it('never names a fogged node’s kind — not in the picture, not in the button label', () => {
        const start = graph.nodes.find((n) => n.id === graph.entryNodeId)!;
        const playerColumn = columnOf(start);
        const fogged = graph.nodes.filter((n) => n.visited === 0 && columnOf(n) > playerColumn + 1);
        expect(fogged.length).toBeGreaterThan(0);

        const markup = render();
        // The gym sits in the last column, so on turn one its icon must not be on screen. This is
        // the specific leak worth guarding: an "always show the destination" convenience would
        // quietly hand the player the one node the fog is most interesting about.
        expect(markup).not.toContain('🏛');
        // Every fogged node draws the placeholder glyph and nothing that names it.
        expect(markup.match(/rm-node fogged/g)?.length).toBe(fogged.length);
        expect(markup.match(/rm-node-icon">·/g)?.length).toBe(fogged.length);
    });

    it('reveals a node you have already stood on, however far behind', () => {
        const far = graph.nodes.find((n) => columnOf(n) >= 10)!;
        const walked = graph.nodes.map((n) => (n.id === far.id ? { ...n, visited: 3 } : n));
        const markup = render(graph.entryNodeId, walked);
        // Revealed: it draws its real icon and its visit count, not the fog placeholder.
        // Ticket 34 part two: the count is a gold shoulder badge now, not a '×N' beside the node.
        expect(markup).toContain('rm-visit-count');
        expect(markup).toMatch(/rm-visit-count">3</);
        expect(markup.match(/rm-node fogged/g)?.length).toBe(
            graph.nodes.filter((n) => columnOf(n) > columnOf(graph.nodes.find((m) => m.id === graph.entryNodeId)!) + 1).length - 1,
        );
    });

    it('shows a visit COUNT rather than greying a node out', () => {
        // Ticket 07: entering a node triggers it again, always, and farming is fine. A map that
        // showed a cleared wild as spent would be telling the player the opposite.
        const start = graph.nodes.find((n) => n.id === graph.entryNodeId)!;
        const markup = render();
        expect(start.visited).toBe(1);
        expect(markup).toMatch(/rm-visit-count">1</);
        expect(markup).not.toMatch(/cleared|spent|exhausted/i);
    });

    it('says where you are in words, not only in pixels', () => {
        expect(render()).toContain('You are here');
    });

    it('offers nothing to travel to from a node with no edges, without crashing', () => {
        const lonely = { ...graph.nodes[0], id: 'lonely', edges: [] };
        const markup = render('lonely', [...graph.nodes, lonely]);
        expect(markup).toContain('Nowhere to go from here');
    });
});
