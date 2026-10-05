// @vitest-environment jsdom
/**
 * TICKET 176e — the map screen as drawn: forward roads only, the detour said in words, the path
 * walked lit and the forks left faded, the Route labels, the town box, and the screen following the
 * player along the road.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';

import RegionMap from './RegionMap';
import { generateRegionGraph } from '../../engine/run/regionGraph';
import type { IRegionNode } from '../../engine/runTypes';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NAMES = ['Brinehollow', 'Rootmire', 'Cinderreach'];
const ELEMENTS = ['Water', 'Nature', 'Fire'];

const element = (nodes: ReadonlyArray<IRegionNode>, currentNodeId: string) => (
    <RegionMap
        nodes={nodes}
        currentNodeId={currentNodeId}
        biomeNames={NAMES}
        biomeElements={ELEMENTS}
        onTravel={() => {}}
    />
);

const travelTexts = (markup: string): string[] =>
    [...markup.matchAll(/<button type="button" class="rm-travel-button">(.*?)<\/button>/g)]
        .map((m) => m[1].replace(/<[^>]*>/g, '').trim());

describe('176e — the Travel list offers only the roads that lead forward', () => {
    it('lists exactly the current node\'s edges, from every node of ten maps', () => {
        for (let i = 0; i < 10; i += 1) {
            const graph = generateRegionGraph(`travel-176e-${i}`);
            for (const node of graph.nodes) {
                const markup = renderToStaticMarkup(element(graph.nodes, node.id));
                expect(travelTexts(markup), `${node.id}`).toHaveLength(node.edges.length);
            }
        }
    });

    it('reads a detour as "(detour, +1 fight)"', () => {
        const graph = generateRegionGraph('detour-176e');
        const detour = graph.nodes.find((n) => n.detour)!;
        const host = graph.nodes.find((n) => n.edges.includes(detour.id))!;
        const texts = travelTexts(renderToStaticMarkup(element(graph.nodes, host.id)));
        expect(texts.filter((t) => t.includes('(detour, +1 fight)'))).toHaveLength(1);
        expect(texts.some((t) => !t.includes('detour'))).toBe(true);
    });

    it('no longer says "layer" anywhere', () => {
        const graph = generateRegionGraph('words-176e');
        const markup = renderToStaticMarkup(element(graph.nodes, graph.entryNodeId));
        expect(markup).not.toMatch(/layer \d/);
    });
});

describe('176e — what the picture says', () => {
    const graph = generateRegionGraph('picture-176e');
    const markup = renderToStaticMarkup(element(graph.nodes, graph.entryNodeId));

    it('labels Route 1 to Route 5 along the bottom', () => {
        for (let route = 1; route <= 5; route += 1) expect(markup).toContain(`>Route ${route}<`);
        expect(markup).not.toContain('>Route 6<');
    });

    it('draws each town as a box with "Town" and its two doors', () => {
        expect(markup.match(/>Town</g)).toHaveLength(3);
        expect(markup.match(/>Market · Den</g)).toHaveLength(3);
        expect(markup).not.toContain('Workshop');
    });

    it('draws a detour\'s road dashed and captions it "+1 fight"', () => {
        const detours = graph.nodes.filter((n) => n.detour);
        expect(detours.length).toBeGreaterThan(0);
        expect(markup.match(/<line[^>]*class="rm-edge[^"]* detour"/g)).toHaveLength(detours.length * 2);
        expect(markup.match(/detour \+1 fight</g)).toHaveLength(detours.length);
    });

    it('draws the forks left behind faded and the road walked lit', () => {
        const byId = new Map(graph.nodes.map((n) => [n.id, n]));
        let path = [byId.get(graph.entryNodeId)!];
        while (path.length < 3) path = [...path, byId.get(path[path.length - 1].edges[0])!];
        const fork = path.find((n) => n.edges.length > 1)!;
        const taken = path[path.indexOf(fork) + 1];
        const walked = new Set(path.map((n) => n.id));
        const nodes = graph.nodes.map((n) => (walked.has(n.id) ? { ...n, visited: 1 } : n));
        const out = renderToStaticMarkup(element(nodes, taken.id));
        expect(out).toMatch(/class="rm-edge taken/);
        expect(out).toMatch(/class="rm-node[^"]* passed/);
        expect(out).toMatch(/class="rm-edge[^"]*faded/);
        // The start and the node stood on are never passed.
        expect(out).not.toMatch(/class="rm-node current[^"]* passed/);
    });
});

describe('176e — the map scrolls to keep the player in view', () => {
    let root: Root | null = null;
    afterEach(() => {
        if (root) act(() => root!.unmount());
        root = null;
        document.body.innerHTML = '';
    });

    it('moves right when the player does', async () => {
        const graph = generateRegionGraph('scroll-176e');
        const byId = new Map(graph.nodes.map((n) => [n.id, n]));
        const host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
        await act(async () => { root!.render(element(graph.nodes, graph.entryNodeId)); });
        const canvas = host.querySelector('.rm-canvas') as HTMLElement;
        Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: 400 });
        const startLeft = canvas.scrollLeft;

        // Stand on the gym: the far end of the map.
        const gym = graph.nodes.find((n) => n.kind === 'gym')!;
        expect(byId.get(gym.id)).toBeDefined();
        await act(async () => { root!.render(element(graph.nodes, gym.id)); });
        expect(canvas.scrollLeft).toBeGreaterThan(startLeft + 1000);
    });
});
