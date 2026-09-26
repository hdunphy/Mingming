// @vitest-environment jsdom
/**
 * Ticket 165a — Card peek on row hover in UpgradeBench and MarketplaceNode sell panel.
 *
 * Henry: "From the screenshot I need to be able to see the full card on hover.
 * For the upgrades it should show what my upgraded card looks like."
 */
import { describe, expect, it } from 'vitest';
import { act } from 'react';

import { UpgradeBench } from './UpgradeBench';
import MarketplaceNode from './MarketplaceNode';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { makeStore, mount, fire, flush } from '../../testing/interaction';
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

describe('Ticket 165a — row hover card peek', () => {
    it('1. Hovering an upgrade row shows the + card\'s name and its changed number marked', async () => {
        const store = makeStore();
        const run = makeRun(500);
        const host = await mount(store, <UpgradeBench run={run} heading="UPGRADE" benchKey="n1:1" />);

        expect(host.querySelector('.card-peek')).toBeNull();

        // Find the upgrade row for undertow or whirlpool
        const row = host.querySelector('.rs-row');
        expect(row, 'Upgrade bench should render at least one row').not.toBeNull();

        await fire(row!, 'mouseover');
        await flush();

        const peek = host.querySelector('.card-peek');
        expect(peek, 'Hovering an upgrade row should display .card-peek').not.toBeNull();
        expect(peek!.querySelector('.rs-cnm')?.textContent).toContain('+');
        expect(peek!.querySelector('.rs-upn'), 'Changed numbers must be marked with .rs-upn').not.toBeNull();
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
        expect(sellPanel!.querySelector('.card-peek')).toBeNull();

        const sellRow = sellPanel!.querySelector('.rs-row');
        expect(sellRow, 'Sell panel should have sell rows').not.toBeNull();

        await fire(sellRow!, 'mouseover');
        await flush();

        const peek = sellPanel!.querySelector('.card-peek');
        expect(peek, 'Hovering a sell row should show .card-peek').not.toBeNull();
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
        expect(upgHost.querySelector('.card-peek'), 'Greyed upgrade row should show peek on hover').not.toBeNull();

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
        expect(mktSell.querySelector('.card-peek'), 'Greyed sell row should show peek on hover').not.toBeNull();
    });

    it('4. Moving off the row hides it', async () => {
        const store = makeStore();
        const run = makeRun(500);
        const host = await mount(store, <UpgradeBench run={run} heading="UPGRADE" benchKey="n1:1" />);

        const row = host.querySelector('.rs-row')!;
        await fire(row, 'mouseover');
        await flush();
        expect(host.querySelector('.card-peek')).not.toBeNull();

        await fire(row, 'mouseout');
        await flush();
        expect(host.querySelector('.card-peek')).toBeNull();
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
        expect(host.querySelector('.card-peek')).not.toBeNull();

        await act(async () => {
            row.blur();
        });
        await flush();
        expect(host.querySelector('.card-peek')).toBeNull();
    });
});
