// @vitest-environment jsdom
/**
 * TICKET 174c — TWO UPGRADES PER VISIT at the market and the workshop.
 *
 * Henry, 2026-09-30: *"At the end I'm almost exclusively looking for upgrades"*, and *"Two per
 * visit"* when 174 asked how many. The reducer has honoured an `allowance` since 168c; what these
 * cases hold down is the part a reducer test cannot reach: that the two venues PASS it, that the
 * bench says so, that a fresh visit is a fresh allowance, and that the venues which keep their own
 * allowance (the gym gate's one free upgrade) did not move.
 *
 * Driven through the interaction harness — real nodes, real store, real clicks — because the bug
 * this ticket could ship is a venue that forgot to pass the prop, and a render cannot click a
 * second time.
 */
import { describe, expect, it } from 'vitest';
import { act, type ReactNode } from 'react';
import { useSelector } from 'react-redux';

import MarketplaceNode from './MarketplaceNode';
import WorkshopNode from './WorkshopNode';
import { UpgradeBench } from './UpgradeBench';
import { createEmptyRanch } from '../store/gameSlice';
import { startRun } from '../store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { UPGRADES_PER_VISIT } from '../../engine/run/marketplace';
import { click, makeStore, mount, type TestStore } from '../../testing/interaction';
import type { IRegionNode, IRunState } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

/** A run standing in the first node of `kind`, on its first visit, holding plenty of scrap. */
function runAt(kind: 'marketplace' | 'workshop'): IRunState {
    const run = createRun({
        seed: `upgrades-per-visit-${kind}`,
        offer: offerGyms('offer-seed')[0],
        party: [KRAKEN],
        startedAt: 1_700_000_000_000,
    });
    const node = run.nodes.find((n) => n.kind === kind)!;
    return {
        ...run,
        scrap: 1000,
        currentNodeId: node.id,
        nodes: run.nodes.map((n) => (n.id === node.id ? { ...n, visited: n.visited + 1 } : n)),
    };
}

/** Re-renders from the store, so the screen sees each upgrade land the way the game does. */
function Connected({ children }: { children: (run: IRunState, node: IRegionNode) => ReactNode }) {
    const run = useSelector((state: ReturnType<TestStore['getState']>) => state.run.run) as IRunState;
    const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
    return <>{children(run, node)}</>;
}

const marketScreen = (run: IRunState, node: IRegionNode) => (
    <MarketplaceNode
        run={run}
        node={node}
        party={[{ definitionId: 'kraken', activeOS: 'kraken_v1' }]}
        onEditLoadout={() => undefined}
        onLeave={() => undefined}
    />
);

const workshopScreen = (run: IRunState, node: IRegionNode) => (
    <WorkshopNode
        run={run}
        node={node}
        ranch={{ ...createEmptyRanch(), roster: [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 }] }}
        onEditLoadout={() => undefined}
        onLeave={() => undefined}
    />
);

/** The first upgrade row that can still be pressed, or null when the bench is shut. */
const openRow = (host: HTMLElement): HTMLButtonElement | null =>
    [...host.querySelectorAll<HTMLButtonElement>('.mk-upgrade .rs-row')].find((row) => !row.disabled) ?? null;

const upgraded = (store: TestStore): number =>
    store.getState().run.run!.deck.filter((card) => card.upgraded === true).length;

/** Press the bench `times` times, stopping early if it shuts. Returns how many presses landed. */
async function pressBench(host: HTMLElement, store: TestStore, times: number): Promise<number> {
    const before = upgraded(store);
    for (let i = 0; i < times; i += 1) {
        const row = openRow(host);
        if (row) await click(row);
    }
    return upgraded(store) - before;
}

describe('174c — the constant', () => {
    it('is two, Henry\'s ruling', () => {
        // A literal here on purpose: this one IS the ruling, and the venue tests below read the constant.
        expect(UPGRADES_PER_VISIT).toBe(2);
    });
});

describe.each([
    ['the market stall', 'marketplace' as const, marketScreen],
    ['the workshop', 'workshop' as const, workshopScreen],
])('174c — %s', (_name, kind, screen) => {
    it('allows UPGRADES_PER_VISIT paid upgrades on a visit, and refuses the next', async () => {
        const store = makeStore();
        store.dispatch(startRun(runAt(kind)));
        const host = await mount(store, <Connected>{screen}</Connected>);
        const scrapBefore = store.getState().run.run!.scrap;

        expect(await pressBench(host, store, UPGRADES_PER_VISIT + 1)).toBe(UPGRADES_PER_VISIT);
        expect(openRow(host), 'the bench should be shut after the allowance is spent').toBeNull();
        // Paid, not free: the scrap actually left.
        expect(store.getState().run.run!.scrap).toBeLessThan(scrapBefore);
    });

    it('says how many are allowed and how many are left', async () => {
        const store = makeStore();
        store.dispatch(startRun(runAt(kind)));
        const host = await mount(store, <Connected>{screen}</Connected>);
        const bench = (): string => host.querySelector('.mk-upgrade h2')!.textContent!;

        expect(bench()).toContain(`${UPGRADES_PER_VISIT} per visit`);
        expect(bench()).not.toContain('left');
        expect(bench()).not.toContain('ONE CARD');
        await pressBench(host, store, 1);
        expect(bench()).toContain(`${UPGRADES_PER_VISIT - 1} left`);
    });

    it('opens a fresh allowance when the node is walked back into', async () => {
        const store = makeStore();
        store.dispatch(startRun(runAt(kind)));
        const host = await mount(store, <Connected>{screen}</Connected>);

        expect(await pressBench(host, store, UPGRADES_PER_VISIT)).toBe(UPGRADES_PER_VISIT);
        expect(openRow(host)).toBeNull();

        // Walking back in is a new visit: `visited` ticks up, so the bench key changes.
        const run = store.getState().run.run!;
        await act(async () => {
            store.dispatch(startRun({
                ...run,
                nodes: run.nodes.map((n) => (n.id === run.currentNodeId ? { ...n, visited: n.visited + 1 } : n)),
            }));
        });
        expect(await pressBench(host, store, UPGRADES_PER_VISIT)).toBe(UPGRADES_PER_VISIT);
    });
});

describe('174c — the venues that keep their own allowance did not move', () => {
    it('the gym gate\'s bench still spends exactly one free upgrade', async () => {
        const store = makeStore();
        const run = runAt('marketplace');
        store.dispatch(startRun({ ...run, scrap: 0 }));
        const host = await mount(
            store,
            <Connected>{(r) => <UpgradeBench run={r} benchKey="gate:1" free heading="THE GATE — ONE FREE UPGRADE" />}</Connected>,
        );
        expect(await pressBench(host, store, 3)).toBe(1);
        expect(store.getState().run.run!.scrap).toBe(0);
        expect(host.querySelector('.mk-upgrade h2')!.textContent).toContain('free, once');
    });

    it('a bench given no allowance still means one per visit, so an unlisted venue is not widened', async () => {
        const store = makeStore();
        store.dispatch(startRun(runAt('marketplace')));
        const host = await mount(
            store,
            <Connected>{(r) => <UpgradeBench run={r} benchKey="unlisted:1" heading="SOMEWHERE ELSE" />}</Connected>,
        );
        expect(host.querySelector('.mk-upgrade h2')!.textContent).toContain('one per visit');
        expect(await pressBench(host, store, 3)).toBe(1);
    });
});
