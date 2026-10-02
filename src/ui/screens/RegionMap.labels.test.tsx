/**
 * TICKET 186c — two nodes you can step to never read the same.
 *
 * Neighbouring nodes in one column of one biome describe themselves with the same words ("Wild,
 * Nature, biome 1, layer 1"). The Travel list a keyboard or screen-reader player uses, and the hover
 * on each node, were then identical for two different places, and only their position told them
 * apart. Identical descriptions now say where each sits in its column.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import RegionMap from './RegionMap';
import { generateRegionGraph } from '../../engine/run/regionGraph';

const render = (seed: string, currentNodeId: string): string => {
    const graph = generateRegionGraph(seed);
    return renderToStaticMarkup(
        <RegionMap
            nodes={graph.nodes}
            currentNodeId={currentNodeId}
            biomeNames={['A', 'B', 'C']}
            biomeElements={['Fire', 'Water', 'Nature']}
            onTravel={() => {}}
        />,
    );
};

/** The text of each Travel list entry, in order. */
const travelTexts = (markup: string): string[] =>
    [...markup.matchAll(/<button type="button" class="rm-travel-button">(.*?)<\/button>/g)]
        .map((m) => m[1].replace(/<[^>]*>/g, '').trim());

describe('186c — the Travel list', () => {
    it('never lists two destinations with the same words, from any node of any of twenty maps', () => {
        let sawTwins = false;
        for (let i = 0; i < 20; i += 1) {
            const seed = `label-seed-${i}`;
            for (const node of generateRegionGraph(seed).nodes) {
                const texts = travelTexts(render(seed, node.id));
                expect(new Set(texts).size, `${seed} at ${node.id}: ${texts.join(' | ')}`).toBe(texts.length);
                if (node.edges.length > 1) sawTwins = true;
            }
        }
        expect(sawTwins).toBe(true);
    });

    it('adds a position word only where two nodes would read alike', () => {
        let plain = 0;
        let placed = 0;
        for (let i = 0; i < 20; i += 1) {
            const seed = `label-seed-${i}`;
            for (const node of generateRegionGraph(seed).nodes) {
                for (const text of travelTexts(render(seed, node.id))) {
                    if (/, (upper|lower|middle|\d+ from the top)$/.test(text)) placed += 1; else plain += 1;
                }
            }
        }
        expect(placed).toBeGreaterThan(0);
        expect(plain).toBeGreaterThan(0);
    });
});
