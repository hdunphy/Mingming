/**
 * TICKET 168c — the marketplace's sell list, for a junk card.
 *
 * Henry: *"Yes junk cards. Also you have to pay to remove them instead of selling them for scrap at
 * the shop."* A junk row says what removing it costs instead of what it sells for, and it stays
 * pressable at the deck floor because junk never counts toward the floor.
 */
import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import MarketplaceNode from './MarketplaceNode';
import runReducer from '../store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { JUNK_REMOVAL_PRICE } from '../../engine/run/marketplace';
import { JUNK_CARD_ID } from '../../engine/run/junk';
import type { IMingmingState } from '../../engine/types';
import type { IRunState } from '../../engine/runTypes';

const PARTY: IMingmingState[] = [
    { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
];

function makeRun(scrap: number, withJunk: boolean): IRunState {
    const run = createRun({
        seed: 'market-junk-seed',
        offer: offerGyms('offer-seed')[0],
        party: PARTY,
        startedAt: 1_700_000_000_000,
    });
    const market = run.nodes.find((n) => n.kind === 'marketplace')!;
    return {
        ...run,
        scrap,
        currentNodeId: market.id,
        nodes: run.nodes.map((n) => (n.id === market.id ? { ...n, visited: n.visited + 1 } : n)),
        deck: withJunk ? [...run.deck, { instanceId: 'junk-1', dataId: JUNK_CARD_ID, ownerId: null }] : run.deck,
    };
}

/** Only the sell panel, so a price elsewhere on the stall cannot satisfy an assertion about it. */
function sellPanel(run: IRunState): string {
    const store = configureStore({
        reducer: { run: runReducer },
        preloadedState: { run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
    const markup = renderToStaticMarkup(
        <Provider store={store}>
            <MarketplaceNode
                run={run}
                node={node}
                party={[{ definitionId: 'kraken', activeOS: 'kraken_v1' }]}
                onEditLoadout={() => undefined}
                onLeave={() => undefined}
            />
        </Provider>,
    );
    return markup.slice(markup.indexOf('mk-sell'));
}

describe('MarketplaceNode — junk in the sell list (168c)', () => {
    it('shows a Remove row with the removal price, not a sell price', () => {
        const panel = sellPanel(makeRun(200, true));
        expect(panel).toContain('mk-remove');
        expect(panel).toContain(`Remove — ${JUNK_REMOVAL_PRICE}`);
        expect(panel).toContain('Corrupted Data');
    });

    it('shows no Remove row when the deck holds no junk', () => {
        expect(sellPanel(makeRun(200, false))).not.toContain('mk-remove');
    });

    it('greys the Remove row when the run cannot pay for it', () => {
        const poor = sellPanel(makeRun(JUNK_REMOVAL_PRICE - 5, true));
        const row = poor.slice(0, poor.indexOf('mk-remove'));
        expect(row.slice(row.lastIndexOf('<button'))).toContain('disabled');
    });

    it('leaves the Remove row pressable when the run can pay', () => {
        const rich = sellPanel(makeRun(JUNK_REMOVAL_PRICE, true));
        const row = rich.slice(0, rich.indexOf('mk-remove'));
        expect(row.slice(row.lastIndexOf('<button'))).not.toContain('disabled');
    });
});
