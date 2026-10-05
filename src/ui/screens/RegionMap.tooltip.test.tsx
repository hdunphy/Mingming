// @vitest-environment jsdom
/**
 * TICKET 194m — the map's node hover is a styled plate, not the browser's own SVG `<title>`.
 *
 * Mounted in jsdom (the SSR renders in `RegionMap.test.tsx` run no events). React's `onMouseEnter`
 * listens to `mouseover`, so that is what is dispatched.
 */
import { describe, expect, it } from 'vitest';

import RegionMap from './RegionMap';
import { generateRegionGraph } from '../../engine/run/regionGraph';
import { fire, flush, makeStore, mount } from '../../testing/interaction';
import { placeTip, TIP_WIDTH_PX } from '../components/tipPlacement';

const graph = generateRegionGraph('map-render-seed-0');
const rival = graph.nodes.find((n) => n.kind === 'rival')!;
const elite = graph.nodes.find((n) => n.kind === 'elite' && !n.scout)!;
const beside = (id: string): string => graph.nodes.find((n) => n.edges.includes(id))!.id;
const staked = graph.nodes.map((n) => (n.id === elite.id ? { ...n, driverStake: 'driver_first_blood' } : n));

async function open(currentNodeId: string, nodes = graph.nodes): Promise<HTMLElement> {
    return mount(makeStore(), (
        <RegionMap
            nodes={nodes}
            currentNodeId={currentNodeId}
            biomeNames={['Emberglass Flats', 'Brinehollow', 'Rootmire']}
            biomeElements={['Fire', 'Water', 'Nature']}
            rivalElements={[['Nature', 'Fire'], ['Fire', 'Nature'], ['Fire', 'Nature']]}
            onTravel={() => {}}
        />
    ));
}

const node = (host: HTMLElement, id: string): Element => host.querySelector(`[data-node-id="${id}"]`)!;
const tip = (): Element | null => document.body.querySelector('.map-tip');

describe('194m — the map node tooltip', () => {
    it('draws no SVG <title>, so the browser\'s own tooltip never opens', async () => {
        const host = await open(beside(rival.id));
        expect(host.querySelectorAll('svg title')).toHaveLength(0);
    });

    it('keeps the node\'s words as its accessible name', async () => {
        const host = await open(beside(rival.id));
        expect(node(host, rival.id).getAttribute('aria-label')).toMatch(/rival/i);
    });

    it('opens on hover with the node\'s words, and closes on leave', async () => {
        const host = await open(beside(rival.id));
        expect(tip()).toBeNull();
        await fire(node(host, rival.id), 'mouseover');
        expect(tip()).not.toBeNull();
        expect(tip()!.textContent).toMatch(/rival/i);
        expect(tip()!.textContent).toMatch(/fields the elements this road needs/i);
        await fire(node(host, rival.id), 'mouseout');
        expect(tip()).toBeNull();
    });

    it('says the Totem at stake in the plate', async () => {
        const host = await open(beside(elite.id), staked);
        await fire(node(host, elite.id), 'mouseover');
        expect(tip()!.textContent).toContain('Totem at stake: FIRST BLOOD');
    });

    it('opens on keyboard focus of the node\'s Travel button, and closes on blur', async () => {
        const host = await open(beside(rival.id));
        const button = [...host.querySelectorAll<HTMLButtonElement>('.rm-travel-button')]
            .find((b) => /rival/i.test(b.textContent ?? ''))!;
        await fire(button, 'focusin');
        await flush();
        expect(tip()).not.toBeNull();
        await fire(button, 'focusout');
        expect(tip()).toBeNull();
    });
});

describe('194m — where the plate goes', () => {
    const rect = (left: number, top: number) => ({ left, right: left + 40, top, bottom: top + 40 });

    it('centres over the node, above it', () => {
        const at = placeTip(rect(600, 400), 1280);
        expect(at.left).toBe(620);
        expect(at.below).toBe(false);
        expect(at.top).toBeLessThan(400);
    });

    it('stays inside the window at either edge', () => {
        expect(placeTip(rect(0, 400), 1280).left).toBeGreaterThanOrEqual(TIP_WIDTH_PX / 2);
        expect(placeTip(rect(1260, 400), 1280).left).toBeLessThanOrEqual(1280 - TIP_WIDTH_PX / 2);
    });

    it('goes below a node near the top', () => {
        const at = placeTip(rect(600, 20), 1280);
        expect(at.below).toBe(true);
        expect(at.top).toBeGreaterThan(60);
    });
});
