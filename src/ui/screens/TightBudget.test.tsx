// @vitest-environment jsdom
/**
 * TICKET 169g — Tight Budget, at the screens and the reducer.
 *
 * `shopPrice.test.ts` proves the rule and the engine sites that quote a price. This proves the
 * places a price is shown AND charged from the UI: the stall refresh, junk removal, the upgrade
 * bench and its reducer, and the shop patch. Each is checked both ways: what the row says, and what
 * the scrap does when it is pressed. A row that says 35 and charges 25 is a lie the player finds by
 * reading their purse.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import MarketplaceNode from './MarketplaceNode';
import { PatchBench } from './PatchBench';
import { UpgradeBench } from './UpgradeBench';
import runReducer, { upgradeDeckCard } from '../store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { JUNK_CARD_ID } from '../../engine/run/junk';
import { upgradePrice } from '../../engine/run/marketplace';
import { shopPrice } from '../../engine/run/modifiers/shopPrice';
import { hasUpgrade } from '../../engine/data/plusRegistry';
import type { IMingmingState } from '../../engine/types';
import type { IRanchMember, IRanchState, IRunState } from '../../engine/runTypes';
import { plainShop } from '../../testing/plainShop';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PARTY: Array<IMingmingState & IRanchMember> = [
    { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 },
];

const RANCH: IRanchState = {
    roster: PARTY,
    blueprints: {},
    codex: { seen: [], played: [], species: [], assembled: [], os: [] },
    codexMilestones: [],
    gymsCleared: [],
    highestTierCleared: 0,
    tierClears: {},
    seenTips: [],
};

/** A run standing in its first marketplace, holding one Forge Slag. */
function makeRun(scrap: number, modifiers: string[]): IRunState {
    const run = createRun({
        seed: 'tight-budget-ui',
        offer: offerGyms('offer-seed')[0],
        party: PARTY,
        startedAt: 1_700_000_000_000,
        modifiers,
    });
    const market = plainShop(run, 'marketplace');
    return {
        ...run,
        scrap,
        currentNodeId: market.id,
        nodes: run.nodes.map((n) => (n.id === market.id ? { ...n, visited: n.visited + 1 } : n)),
        deck: [...run.deck, { instanceId: 'junk-1', dataId: JUNK_CARD_ID, ownerId: null }],
    };
}

describe('Tight Budget at the screens', () => {
    let host: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        host.remove();
    });

    const makeStore = (run: IRunState) =>
        configureStore({
            reducer: { run: runReducer },
            preloadedState: { run: { run } },
            middleware: (getDefault) => getDefault({ serializableCheck: false }),
        });

    const scrapOf = (store: ReturnType<typeof makeStore>): number => store.getState().run.run!.scrap;

    function renderMarket(run: IRunState) {
        const store = makeStore(run);
        const App = () => {
            const current = store.getState().run.run!;
            const node = current.nodes.find((n) => n.id === current.currentNodeId)!;
            return (
                <Provider store={store}>
                    <MarketplaceNode
                        run={current}
                        node={node}
                        party={[{ definitionId: 'kraken', activeOS: 'kraken_v1' }]}
                        onEditLoadout={() => undefined}
                        onLeave={() => undefined}
                    />
                </Provider>
            );
        };
        act(() => {
            root.render(<App />);
        });
        return { store, rerender: () => act(() => root.render(<App />)) };
    }

    const refreshButton = (): HTMLButtonElement =>
        Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.startsWith('REFRESH'))! as HTMLButtonElement;

    const removeRow = (): HTMLButtonElement =>
        host.querySelector('.mk-remove')!.closest('button') as HTMLButtonElement;

    it('the stall refresh says 65 and charges 65', () => {
        const { store } = renderMarket(makeRun(100, ['tight_budget']));
        expect(refreshButton().textContent).toBe('REFRESH STALL — 65 amber');
        act(() => refreshButton().click());
        expect(scrapOf(store)).toBe(100 - 65);
    });

    it('the stall refresh is short at 60 amber, and says by how much', () => {
        renderMarket(makeRun(60, ['tight_budget']));
        expect(refreshButton().disabled).toBe(true);
        expect(refreshButton().textContent).toBe('REFRESH 65 amber — 5 SHORT');
    });

    it('the stall refresh is unchanged without the modifier', () => {
        const { store } = renderMarket(makeRun(100, []));
        expect(refreshButton().textContent).toBe('REFRESH STALL — 50 amber');
        act(() => refreshButton().click());
        expect(scrapOf(store)).toBe(50);
    });

    it('junk removal says 35 and charges 35', () => {
        const { store } = renderMarket(makeRun(100, ['tight_budget']));
        expect(removeRow().textContent).toContain('Remove — 35');
        act(() => removeRow().click());
        expect(scrapOf(store)).toBe(100 - 35);
    });

    it('junk removal is greyed at 30 scrap', () => {
        renderMarket(makeRun(30, ['tight_budget']));
        expect(removeRow().disabled).toBe(true);
    });

    it('the shop patch says 60 and charges 60', () => {
        const run = makeRun(100, ['tight_budget']);
        const store = makeStore(run);
        act(() => {
            root.render(
                <Provider store={store}>
                    <PatchBench run={run} ranch={RANCH} venue="shop" />
                </Provider>,
            );
        });
        expect(host.textContent).toContain('60 amber');
        const row = host.querySelector('button.rs-row') as HTMLButtonElement;
        expect(row.textContent).toContain('−60');
        act(() => row.click());
        expect(scrapOf(store)).toBe(100 - 60);
    });

    it('the shop patch is greyed at 55 scrap', () => {
        const run = makeRun(55, ['tight_budget']);
        act(() => {
            root.render(
                <Provider store={makeStore(run)}>
                    <PatchBench run={run} ranch={RANCH} venue="shop" />
                </Provider>,
            );
        });
        expect((host.querySelector('button.rs-row') as HTMLButtonElement).disabled).toBe(true);
    });

    it('the shop patch is still 45 without the modifier', () => {
        const run = makeRun(100, []);
        const store = makeStore(run);
        act(() => {
            root.render(
                <Provider store={store}>
                    <PatchBench run={run} ranch={RANCH} venue="shop" />
                </Provider>,
            );
        });
        act(() => (host.querySelector('button.rs-row') as HTMLButtonElement).click());
        expect(scrapOf(store)).toBe(55);
    });

    it('the upgrade bench shows the raised price on every row', () => {
        const run = makeRun(500, ['tight_budget']);
        act(() => {
            root.render(
                <Provider store={makeStore(run)}>
                    <UpgradeBench run={run} heading="UPGRADE" benchKey="n1:1" />
                </Provider>,
            );
        });
        const rows = Array.from(host.querySelectorAll('button.rs-row'));
        expect(rows.length).toBeGreaterThan(0);
        const upgradable = [...new Set(run.deck.filter((c) => hasUpgrade(c.dataId)).map((c) => c.dataId))];
        const prices = new Set(upgradable.map((id) => shopPrice(run, upgradePrice(id))));
        for (const row of rows) {
            const shown = Number(row.querySelector('.rs-sellp')!.textContent!.replace(/[^0-9]/g, ''));
            expect(prices.has(shown)).toBe(true);
        }
        // And at least one row is not the plain price, so this fails if the bench ignores the rule.
        const plain = new Set(upgradable.map((id) => upgradePrice(id)));
        for (const row of rows) {
            const shown = Number(row.querySelector('.rs-sellp')!.textContent!.replace(/[^0-9]/g, ''));
            expect(plain.has(shown)).toBe(false);
        }
    });

    it('the upgrade reducer charges the raised price, and refuses when the purse is short of it', () => {
        const rich = makeRun(500, ['tight_budget']);
        const card = rich.deck.find((c) => hasUpgrade(c.dataId))!;
        const raised = shopPrice(rich, upgradePrice(card.dataId));
        expect(raised).toBeGreaterThan(upgradePrice(card.dataId));

        const store = makeStore(rich);
        store.dispatch(upgradeDeckCard({ instanceId: card.instanceId, benchKey: 'n1:1' }));
        expect(scrapOf(store)).toBe(500 - raised);

        // Enough for the plain price but not the raised one: refused, scrap untouched.
        const poor = makeRun(raised - 5, ['tight_budget']);
        const poorStore = makeStore(poor);
        poorStore.dispatch(upgradeDeckCard({ instanceId: card.instanceId, benchKey: 'n1:1' }));
        expect(scrapOf(poorStore)).toBe(raised - 5);
        expect(poorStore.getState().run.run!.deck.find((c) => c.instanceId === card.instanceId)!.upgraded).toBeUndefined();
    });

    it('a free upgrade stays free under Tight Budget', () => {
        const run = makeRun(0, ['tight_budget']);
        const card = run.deck.find((c) => hasUpgrade(c.dataId))!;
        const store = makeStore(run);
        store.dispatch(upgradeDeckCard({ instanceId: card.instanceId, benchKey: 'gate:1', free: true }));
        expect(scrapOf(store)).toBe(0);
        expect(store.getState().run.run!.deck.find((c) => c.instanceId === card.instanceId)!.upgraded).toBe(true);
    });
});
