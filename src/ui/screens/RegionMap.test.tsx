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

const graph = generateRegionGraph('map-render-seed-0');
const BIOME_NAMES = ['Emberglass Flats', 'Brinehollow', 'Rootmire'];
const BIOME_ELEMENTS = ['Fire', 'Water', 'Nature'];

/**
 * TICKET 142c: what a rival fields in each biome, off-biome element first. The fixture mirrors a
 * Rootfall run's shape — path Fire+Nature against biomes Fire / Water / Nature — so biome 0's
 * rival leads with Nature (Fire is the biome's own) and biome 2's leads with Fire.
 */
const RIVAL_ELEMENTS = [['Nature', 'Fire'], ['Fire', 'Nature'], ['Fire', 'Nature']];

function render(
    currentNodeId = graph.entryNodeId,
    nodes = graph.nodes,
    rivalElements: ReadonlyArray<ReadonlyArray<string>> | undefined = undefined,
): string {
    return renderToStaticMarkup(
        <RegionMap
            nodes={nodes}
            currentNodeId={currentNodeId}
            biomeNames={BIOME_NAMES}
            biomeElements={BIOME_ELEMENTS}
            rivalElements={rivalElements}
            onTravel={() => {}}
        />,
    );
}

describe('142c — a rival and a scout say what they are', () => {
    /*
     * Henry, after the first Rootfall playtest: *"I thought I would see nature in the workshop
     * somehow but I was seeing dual element wild encounters in the fire biome."* He had found the
     * rival by walking into it. Every fight node took its colour and its label from
     * `biomeElements[biomeIndex]`, so the ONE node kind that deliberately ignores its biome was the
     * one node labelled with the wrong element — and `node.scout` was read by no UI file at all.
     */
    const rival = graph.nodes.find((n) => n.kind === 'rival')!;
    const scout = graph.nodes.find((n) => n.scout)!;
    /** Standing next to it, so it is revealed — the fog shows shape, not kind. */
    const beside = (id: string) => graph.nodes.find((n) => n.edges.includes(id))!.id;

    it('names BOTH of a rival elements, off-biome first', () => {
        // Henry's ruling: show both. The pair IS the information — one element alone on a rival is
        // exactly the label that hid it, whichever of the two you pick.
        const markup = render(beside(rival.id), graph.nodes, RIVAL_ELEMENTS);
        const pair = RIVAL_ELEMENTS[rival.biomeIndex];
        expect(markup).toContain(`Rival, ${pair[0]} + ${pair[1]}`);
    });

    it('leaves an ordinary fight on its own biome element', () => {
        // A wild with a road into it: the run's own entry node has none, so nothing stands "beside" it.
    const wild = graph.nodes.find((n) => n.kind === 'wild' && graph.nodes.some((m) => m.edges.includes(n.id)))!;
        const markup = render(beside(wild.id), graph.nodes, RIVAL_ELEMENTS);
        expect(markup).toContain(`Wild, ${BIOME_ELEMENTS[wild.biomeIndex]}`);
    });

    it('falls back to the biome when no pair is supplied — a caller with no run still draws', () => {
        const markup = render(beside(rival.id), graph.nodes, undefined);
        expect(markup).toContain(`Rival, ${BIOME_ELEMENTS[rival.biomeIndex]}`);
        expect(markup).not.toContain('rm-legend-rival');
    });

    it('marks the scout, which is a FLAG on an ordinary fight rather than a kind', () => {
        const markup = render(beside(scout.id), graph.nodes, RIVAL_ELEMENTS);
        expect(markup).toContain('Scout ');
        expect(markup).toContain('rm-node-scout-ring');
    });

    it('explains the rival on its own hover (182a: the legend line is gone)', () => {
        const markup = render(beside(rival.id), graph.nodes, RIVAL_ELEMENTS);
        expect(markup).not.toContain('rm-legend-rival');
        expect(markup).toMatch(/<title>[^<]*rival[^<]*fields the elements this road needs/i);
    });
});
describe('17 — the stakes are said before the player commits', () => {
    /*
     * `economy-session.md`: *"ONE harder fight, the Driver visible as the stakes."* The map is
     * where "visible" happens. The graph fixture carries no stakes (they are stamped by `createRun`,
     * not the generator), so they are planted here; the claim is that a planted stake reaches the
     * label, the ring and the legend — and that the fog keeps it.
     */
    const elite = graph.nodes.find((n) => n.kind === 'elite' && !n.scout)!;
    const ambush = graph.nodes.find((n) => n.kind === 'ambush')!;
    const beside = (id: string) => graph.nodes.find((n) => n.edges.includes(id))!.id;
    const staked = graph.nodes.map((n) => (
        n.id === elite.id ? { ...n, driverStake: 'driver_first_blood' }
            : n.id === ambush.id ? { ...n, driverStake: 'driver_antivenom' } : n));

    it('names the Totem on an elite, and rings the node', () => {
        const markup = render(beside(elite.id), staked, RIVAL_ELEMENTS);
        expect(markup).toContain('stakes: FIRST BLOOD');
        expect(markup).toContain('rm-node-stake-ring');
        expect(markup).toContain('Totem at stake: FIRST BLOOD');
        expect(markup).toContain('rm-legend-stakes');
    });

    it('marks the ambush HIGH RISK and calls its Driver a bonus (Henry, 2026-09-12)', () => {
        const markup = render(beside(ambush.id), staked, RIVAL_ELEMENTS);
        expect(markup).toContain('HIGH RISK');
        expect(markup).toContain('bonus: ANTIVENOM');
        expect(markup).toMatch(/rm-node[^"]* risk/);
    });

    it('keeps the stake behind the fog — a node you cannot see the kind of does not show its prize', () => {
        // Standing at the entry, an exit elite two or more layers away is fogged.
        const far = staked.find((n) => n.driverStake && n.layer >= 3)!;
        const markup = render(graph.entryNodeId, staked, RIVAL_ELEMENTS);
        const name = far.driverStake === 'driver_first_blood' ? 'FIRST BLOOD' : 'ANTIVENOM';
        // The other planted node may be revealed; assert on the far one's absence only if it is
        // the only carrier of that name.
        if (!staked.some((n) => n.id !== far.id && n.driverStake === far.driverStake)) {
            expect(markup).not.toContain(name);
        }
    });

    it('says nothing about stakes when no node has one', () => {
        const markup = render(graph.entryNodeId, graph.nodes, RIVAL_ELEMENTS);
        expect(markup).not.toContain('rm-legend-stakes');
        expect(markup).not.toContain('rm-node-stake-ring');
    });
});

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
        // Edges are forward links only since ticket 176: each is stored once, on the node it leaves,
        // so drawing straight from the arrays paints every road exactly once.
        const edges = graph.nodes.reduce((sum, n) => sum + n.edges.length, 0);
        expect(lines).toBe(edges);
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

    it('names the three biomes on the map itself and marks the one you are standing in (182a)', () => {
        const markup = render();
        // The tab strip is gone; each band is labelled with its biome name and nothing else.
        expect(markup).not.toContain('rm-biome-strip');
        const labels = [...markup.matchAll(/<text class="rm-band-label[^"]*"[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);
        expect(labels).toEqual(BIOME_NAMES);
        expect(markup).toContain('rm-band-label here');
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

    it('has no "You are here" sentence (182a); the where-you-are words live on the node hover', () => {
        const markup = render();
        expect(markup).not.toContain('You are here');
        expect(markup).toMatch(/<title>Start, /);
    });

    it('offers nothing to travel to from a node with no edges, without crashing', () => {
        const lonely = { ...graph.nodes[0], id: 'lonely', edges: [] };
        const markup = render('lonely', [...graph.nodes, lonely]);
        expect(markup).toContain('Nowhere to go from here');
    });
});

describe('2026-09-25 playtest — the start node, and a key for the icons', () => {
    it('calls the node the run starts on Start, and says walking back in is a fight', () => {
        // Henry: "I start on node one, but never encounter a fight." It wore the wild's blade.
        const markup = render(graph.entryNodeId);
        // 182a: the sentence is gone; the same words are the start node's hover.
        expect(markup).toContain('<title>Start, Fire, walking back in is a Wild fight');
    });

    it('has no key line under the map (182a); the icons keep their hover', () => {
        const markup = render(graph.entryNodeId);
        expect(markup).not.toContain('rm-legend-key');
        expect(markup).not.toContain('Map key');
        // One layer of visibility from the start: the layer-1 nodes are revealed, and biome 0's
        // layer 1 is always a fight (ticket 24), so a Wild hover is on the map.
        expect(markup).toMatch(/<title>Wild, /);
        // The gym is several biomes away and fogged: its hover says Unknown, never Gym.
        expect(markup).not.toMatch(/<title>Gym/);
    });
});
