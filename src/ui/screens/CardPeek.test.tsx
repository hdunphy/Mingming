// @vitest-environment jsdom
/**
 * Ticket 165a — Card peek on row hover in UpgradeBench and MarketplaceNode sell panel.
 *
 * Henry: "From the screenshot I need to be able to see the full card on hover.
 * For the upgrades it should show what my upgraded card looks like."
 *
 * TICKET 167f — the preview is a tooltip beside the mouse, drawn into <body>, not a block inside
 * the panel. Henry, 2026-09-27: *"Hovering over upgrades in the Workshop spazzes out"* and *"The card
 * should be static so it hovers next to the mouse and it should be outside of any containers. Like
 * a tooltip."* So every lookup below is on `document.body`, and the layout-shift and pointer-events
 * tests at the bottom are the two that fail if it ever goes back in the panel.
 */
import { describe, expect, it } from 'vitest';
import { act } from 'react';

import { UpgradeBench } from './UpgradeBench';
import MarketplaceNode from './MarketplaceNode';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { makeStore, mount, fire, flush } from '../../testing/interaction';
import { fireAt } from '../../testing/pointer';
import { placePeek } from './peekPlacement';
import { stageScale } from '../components/stageGeometry';
import type { IRegionNode, IRunState } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';

const PARTY: IMingmingState[] = [
    { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
];

function makeRun(scrap: number, over: Partial<IRunState> = {}): IRunState {
    const run = createRun({
        seed: 'peek-test-seed',
        offer: offerGyms('offer-seed')[0],
        party: PARTY,
        startedAt: 1_700_000_000_000,
    });
    return { ...run, scrap, ...over };
}

function makeMarketRun(scrap: number, over: Partial<IRunState> = {}): { run: IRunState; node: IRegionNode } {
    const run = makeRun(scrap, over);
    const market = run.nodes.find((n) => n.kind === 'marketplace')!;
    const runWithNode: IRunState = {
        ...run,
        currentNodeId: market.id,
        nodes: run.nodes.map((n) => (n.id === market.id ? { ...n, visited: n.visited + 1 } : n)),
    };
    return { run: runWithNode, node: market };
}

/** The tooltip, wherever it is: it lives in <body>, so nothing scoped to a panel can find it. */
const peekTile = (): HTMLElement | null => document.body.querySelector<HTMLElement>('.card-peek');

describe('Ticket 165a — row hover card peek', () => {
    it('1. Hovering an upgrade row shows the + card\'s name and its changed number marked', async () => {
        const store = makeStore();
        const run = makeRun(500);
        const host = await mount(store, <UpgradeBench run={run} heading="UPGRADE" benchKey="n1:1" />);

        expect(peekTile()).toBeNull();

        // Find the upgrade row for undertow or whirlpool
        const row = host.querySelector('.rs-row');
        expect(row, 'Upgrade bench should render at least one row').not.toBeNull();

        await fire(row!, 'mouseover');
        await flush();

        const peek = peekTile();
        expect(peek, 'Hovering an upgrade row should display .card-peek').not.toBeNull();
        // 167f: outside every container, as a child of the page body.
        expect(peek!.parentElement).toBe(document.body);
        expect(host.contains(peek)).toBe(false);
        // TICKET 183c (D2): the upgrade preview is TWO full cards, now → upgraded.
        const tiles = peek!.querySelectorAll('.rs-card');
        expect(tiles.length, 'the upgrade preview draws now and upgraded side by side').toBe(2);
        expect(tiles[0].querySelector('.rs-cnm')?.textContent).not.toContain('+');
        expect(tiles[1].querySelector('.rs-cnm')?.textContent).toContain('+');
        expect(peek!.querySelector('.card-peek-arrow'), 'an arrow between them').not.toBeNull();
        expect(tiles[1].querySelector('.rs-upn'), 'Changed numbers must be marked with .rs-upn').not.toBeNull();
        expect(tiles[0].querySelector('.rs-upn'), 'the "now" card marks nothing').toBeNull();
    });

    it('2. Hovering a sell row shows that card', async () => {
        const store = makeStore();
        const { run, node } = makeMarketRun(500);
        const host = await mount(
            store,
            <MarketplaceNode
                run={run}
                node={node}
                party={[{ definitionId: 'kraken', activeOS: 'kraken_v1' }]}
                onEditLoadout={() => undefined}
                onLeave={() => undefined}
            />,
        );

        const sellPanel = host.querySelector('.mk-sell');
        expect(sellPanel, 'MarketplaceNode should render sell panel').not.toBeNull();
        expect(peekTile()).toBeNull();

        const sellRow = sellPanel!.querySelector('.rs-row');
        expect(sellRow, 'Sell panel should have sell rows').not.toBeNull();

        await fire(sellRow!, 'mouseover');
        await flush();

        const peek = peekTile();
        expect(peek, 'Hovering a sell row should show .card-peek').not.toBeNull();
        expect(peek!.parentElement).toBe(document.body);
        expect(sellPanel!.contains(peek)).toBe(false);
        expect(peek!.querySelectorAll('.rs-card')).toHaveLength(1);
        expect(peek!.querySelector('.rs-cnm')?.textContent).toBeTruthy();
        expect(peek!.querySelector('.rs-desc')?.textContent).toBeTruthy();
    });

    it('3. Hovering or focusing a greyed row still shows it', async () => {
        const store = makeStore();

        // 3a: Greyed upgrade row (unaffordable scrap: 0)
        const unRun = makeRun(0);
        const upgHost = await mount(store, <UpgradeBench run={unRun} heading="UPGRADE" benchKey="n1:1" />);
        const upgRow = upgHost.querySelector('.rs-row');
        expect(upgRow).not.toBeNull();

        await fire(upgRow!, 'mouseover');
        await flush();
        expect(peekTile(), 'Greyed upgrade row should show peek on hover').not.toBeNull();
        await fire(upgRow!, 'mouseout');
        await flush();
        expect(peekTile()).toBeNull();

        // 3b: Greyed sell row (at floor, deck cards disabled)
        const { run: floorRun, node: floorNode } = makeMarketRun(500);
        const mktHost = await mount(
            store,
            <MarketplaceNode
                run={floorRun}
                node={floorNode}
                party={[{ definitionId: 'kraken', activeOS: 'kraken_v1' }]}
                onEditLoadout={() => undefined}
                onLeave={() => undefined}
            />,
        );
        const mktSell = mktHost.querySelector('.mk-sell')!;
        const greyedSellRow = mktSell.querySelector('.rs-row:disabled, .rs-row[aria-disabled="true"], .rs-wrap');
        expect(greyedSellRow).not.toBeNull();

        await fire(greyedSellRow!, 'mouseover');
        await flush();
        expect(peekTile(), 'Greyed sell row should show peek on hover').not.toBeNull();
    });

    it('4. Moving off the row hides it', async () => {
        const store = makeStore();
        const run = makeRun(500);
        const host = await mount(store, <UpgradeBench run={run} heading="UPGRADE" benchKey="n1:1" />);

        const row = host.querySelector('.rs-row')!;
        await fire(row, 'mouseover');
        await flush();
        expect(peekTile()).not.toBeNull();

        await fire(row, 'mouseout');
        await flush();
        expect(peekTile()).toBeNull();
    });

    it('5. Keyboard focus shows it too', async () => {
        const store = makeStore();
        const run = makeRun(500);
        const host = await mount(store, <UpgradeBench run={run} heading="UPGRADE" benchKey="n1:1" />);

        const row = host.querySelector<HTMLElement>('.rs-row')!;
        await act(async () => {
            row.focus();
        });
        await flush();
        expect(peekTile()).not.toBeNull();

        await act(async () => {
            row.blur();
        });
        await flush();
        expect(peekTile()).toBeNull();
    });
});

/**
 * THE LAYOUT-SHIFT REGRESSION (167f). The old block grew the panel, the list moved under the mouse,
 * the hover landed on another row and it repeated. jsdom has no layout, so "the panel did not grow"
 * is asserted as what growing looks like in markup: the panel gained no child and no text.
 */
describe('Ticket 167f — the preview is a tooltip, not a block in the panel', () => {
    it('hovering does not add anything to the panel it is hovered in', async () => {
        const store = makeStore();
        const host = await mount(store, <UpgradeBench run={makeRun(500)} heading="UPGRADE" benchKey="n1:1" />);
        const panel = host.querySelector('.mk-upgrade') as HTMLElement;
        const before = { children: panel.childElementCount, html: panel.innerHTML };

        await fireAt(panel.querySelector('.rs-row')!, 'mouseover', 300, 200);
        await flush();

        expect(peekTile()).not.toBeNull();
        expect(panel.childElementCount).toBe(before.children);
        expect(panel.innerHTML).toBe(before.html);
    });

    it('the same holds for the sell list', async () => {
        const { run, node } = makeMarketRun(500);
        const host = await mount(
            makeStore(),
            <MarketplaceNode
                run={run}
                node={node}
                party={[{ definitionId: 'kraken', activeOS: 'kraken_v1' }]}
                onEditLoadout={() => undefined}
                onLeave={() => undefined}
            />,
        );
        const panel = host.querySelector('.mk-sell') as HTMLElement;
        const before = panel.innerHTML;

        await fireAt(panel.querySelector('.rs-row')!, 'mouseover', 300, 200);
        await flush();

        expect(peekTile()).not.toBeNull();
        expect(panel.innerHTML).toBe(before);
    });

    it('takes no pointer events, so it can never take the hover away from the row', async () => {
        const host = await mount(makeStore(), <UpgradeBench run={makeRun(500)} heading="UPGRADE" benchKey="n1:1" />);
        await fireAt(host.querySelector('.rs-row')!, 'mouseover', 300, 200);
        await flush();
        expect(peekTile()!.style.pointerEvents).toBe('none');
    });

    it('is drawn beside the pointer, at the position `placePeek` gives', async () => {
        const host = await mount(makeStore(), <UpgradeBench run={makeRun(500)} heading="UPGRADE" benchKey="n1:1" />);
        const row = host.querySelector('.rs-row')!;

        await fireAt(row, 'mouseover', 300, 200);
        await flush();

        const scale = stageScale(window.innerWidth, window.innerHeight);
        const want = placePeek({ x: 300, y: 200 }, window.innerWidth, window.innerHeight, scale);
        const tile = peekTile()!;
        expect(tile.style.left).toBe(`${want.left}px`);
        expect(tile.style.top).toBe(`${want.top}px`);
        expect(want.flipped).toBe(false);
        expect(tile.style.transform).toBe(`scale(${scale})`);
    });

    it('flips to the left of the pointer near the right edge of the window', async () => {
        const host = await mount(makeStore(), <UpgradeBench run={makeRun(500)} heading="UPGRADE" benchKey="n1:1" />);

        await fireAt(host.querySelector('.rs-row')!, 'mouseover', window.innerWidth - 20, 200);
        await flush();

        const tile = peekTile()!;
        expect(parseFloat(tile.style.left)).toBeLessThan(window.innerWidth - 20);
    });

    it('follows the mouse: a move repositions it within a frame, and leaving cancels a pending move', async () => {
        const host = await mount(makeStore(), <UpgradeBench run={makeRun(500)} heading="UPGRADE" benchKey="n1:1" />);
        const row = host.querySelector('.rs-row')!;
        const frame = () => act(async () => { await new Promise((resolve) => requestAnimationFrame(() => resolve(null))); });

        await fireAt(row, 'mouseover', 300, 200);
        const startLeft = peekTile()!.style.left;

        await fireAt(row, 'mousemove', 420, 260);
        await frame();
        expect(peekTile()!.style.left).not.toBe(startLeft);

        // A move queued and then a mouseout: the late frame must not bring the tile back.
        await fireAt(row, 'mousemove', 500, 300);
        await fire(row, 'mouseout');
        await frame();
        expect(peekTile()).toBeNull();
    });
});
