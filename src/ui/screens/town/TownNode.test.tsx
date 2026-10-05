// @vitest-environment jsdom
/**
 * TICKET 176c (M7) — the town screen: a square, four buildings, and the upgrade pool by biome.
 *
 * Driven through the interaction harness with a real store, because what these cases hold down is
 * routing and state that a render cannot click: which tab is open, that it is saved on the run, that
 * the shop mounts only when opened, and that the 2 / 3 / 4 allowance is the town's own.
 */
import { describe, expect, it } from 'vitest';
import { act, type ReactNode } from 'react';
import { useSelector } from 'react-redux';

import TownNode from './TownNode';
import WorkshopNode from '../WorkshopNode';
import { createEmptyRanch } from '../../store/gameSlice';
import { setRun, startRun } from '../../store/runSlice';
import { createRun } from '../../../engine/run/createRun';
import { offerGyms } from '../../../engine/run/gyms';
import { frozenMarketParty } from '../../../engine/run/marketParty';
import { sellPrice } from '../../../engine/run/marketplace';
import { click, clickText, fire, flush, makeStore, mount, type TestStore } from '../../../testing/interaction';
import type { IRanchMember, IRanchState, IRunState } from '../../../engine/runTypes';

const KRAKEN: IRanchMember = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    attackIV: 10, defenseIV: 10, hpIV: 10,
};
const SKOLL: IRanchMember = {
    id: 'mm2', definitionId: 'skoll', activeOS: 'skoll_v1',
    attackIV: 10, defenseIV: 10, hpIV: 10,
};

const THIRD: IRanchMember = {
    id: 'mm3', definitionId: 'kraken', activeOS: 'kraken_v2',
    attackIV: 10, defenseIV: 10, hpIV: 10,
};
const MEMBERS = [KRAKEN, SKOLL, THIRD];

const ranch = (): IRanchState => ({ ...createEmptyRanch(), roster: MEMBERS });

/** A run standing in the town of `biomeIndex`, on its first visit, holding plenty of scrap. */
function runAtTown(biomeIndex: number): IRunState {
    const run = createRun({
        seed: `town-screen-${biomeIndex}`,
        offer: offerGyms('offer-seed')[0],
        party: [{ ...KRAKEN, blueprintsCollected: 0 }],
        startedAt: 1_700_000_000_000,
    });
    const town = run.nodes.find((n) => n.kind === 'town' && n.biomeIndex === biomeIndex)!;
    return {
        ...run,
        scrap: 2000,
        currentNodeId: town.id,
        nodes: run.nodes.map((n) => (n.id === town.id ? { ...n, visited: 1 } : n)),
    };
}

/** The screen as RunScreen mounts it, re-rendering from the store so each action lands. */
function Connected({ onLeave = () => undefined }: { onLeave?: () => void }): ReactNode {
    const run = useSelector((state: ReturnType<TestStore['getState']>) => state.run.run) as IRunState;
    const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
    const party = run.partyIds
        .map((id) => MEMBERS.find((m) => m.id === id))
        .filter((m): m is IRanchMember => m !== undefined)
        .map((m) => ({ definitionId: m.definitionId, activeOS: m.activeOS }));
    return <TownNode run={run} node={node} party={party} ranch={ranch()} biomeName="Test" onLeave={onLeave} />;
}

async function openTown(biomeIndex = 0): Promise<{ store: TestStore; host: HTMLElement }> {
    const store = makeStore();
    store.dispatch(startRun(runAtTown(biomeIndex)));
    const host = await mount(store, <Connected />);
    return { store, host };
}

const tabOf = (store: TestStore): string | undefined => store.getState().run.run!.townTab?.tab;
const dock = (host: HTMLElement): Element | null => host.querySelector('.town-dock');

describe('176c — the town square and its buildings', () => {
    it('opens on the square, with one button per building', async () => {
        const { host } = await openTown();
        expect(host.querySelector('.town-square')).not.toBeNull();
        const names = [...host.querySelectorAll('.town-building-nm')].map((el) => el.textContent);
        expect(names).toEqual(['Shop', 'Upgrades', 'Den', 'Loadout']);
        // Nothing is mounted behind the square: the shelves roll only when the Shop is opened.
        expect(host.querySelector('.mk')).toBeNull();
        expect(host.querySelector('.ws')).toBeNull();
    });

    it.each([
        ['Shop', 'shop', '.mk-town'],
        ['Upgrades', 'upgrades', '.town-upgrades'],
        ['Den', 'workshop', '.ws-town'],
    ])('the %s building opens its tab, and "← Town square" returns', async (label, tab, selector) => {
        const { store, host } = await openTown();
        const building = [...host.querySelectorAll<HTMLElement>('.town-building')]
            .find((el) => el.querySelector('.town-building-nm')?.textContent === label)!;
        await click(building);

        expect(tabOf(store)).toBe(tab);
        expect(host.querySelector(selector), `the ${label} body`).not.toBeNull();
        expect(host.querySelector('.town-square')).toBeNull();

        await clickText(host, '← Town square');
        expect(tabOf(store)).toBe('square');
        expect(host.querySelector('.town-square')).not.toBeNull();
    });

    it('the Loadout building opens the loadout editor, and the dock is hidden there', async () => {
        const { store, host } = await openTown();
        expect(dock(host), 'the dock shows on the square').not.toBeNull();

        const building = host.querySelector<HTMLElement>('.town-building[data-tab="loadout"]')!;
        await click(building);

        expect(tabOf(store)).toBe('loadout');
        expect(document.body.querySelector('.led')).not.toBeNull();
        expect(dock(host), 'the dock is hidden on Loadout').toBeNull();
    });

    it('keeps the open tab on the run, so a reload reopens it', async () => {
        const { store, host } = await openTown();
        await click(host.querySelector<HTMLElement>('.town-building[data-tab="workshop"]')!);
        expect(store.getState().run.run!.townTab).toEqual({
            nodeId: store.getState().run.run!.currentNodeId, tab: 'workshop',
        });

        // A fresh mount over the same run (what a reload does) comes back on the Workshop.
        const reloaded = makeStore();
        reloaded.dispatch(startRun(store.getState().run.run!));
        const again = await mount(reloaded, <Connected />);
        expect(again.querySelector('.ws-town')).not.toBeNull();
        expect(again.querySelector('.town-square')).toBeNull();
    });

    it('LEAVE TOWN calls onLeave', async () => {
        const store = makeStore();
        store.dispatch(startRun(runAtTown(0)));
        let left = 0;
        const host = await mount(store, <Connected onLeave={() => { left += 1; }} />);
        await clickText(host, 'LEAVE TOWN');
        expect(left).toBe(1);
    });
});

describe('176c (M7) — one upgrade pool per town visit', () => {
    /** Press the first live upgrade row until the bench shuts. Returns how many landed. */
    async function spendUpgrades(store: TestStore, host: HTMLElement, tries: number): Promise<number> {
        const taken = (): number => store.getState().run.run!.deck.filter((c) => c.upgraded === true).length;
        const before = taken();
        for (let i = 0; i < tries; i += 1) {
            const row = [...host.querySelectorAll<HTMLButtonElement>('.mk-upgrade .rs-row')].find((r) => !r.disabled);
            if (row) await click(row);
        }
        return taken() - before;
    }

    it.each([[0, 2], [1, 3], [2, 4]])('a town in biome %i allows exactly %i upgrades, and refuses the next', async (biome, allowed) => {
        const { store, host } = await openTown(biome);
        await click(host.querySelector<HTMLElement>('.town-building[data-tab="upgrades"]')!);

        expect(await spendUpgrades(store, host, allowed + 2)).toBe(allowed);
        expect([...host.querySelectorAll<HTMLButtonElement>('.mk-upgrade .rs-row')].some((r) => !r.disabled)).toBe(false);
    });

    it('the square counts what is left', async () => {
        const { store, host } = await openTown(1);
        expect(host.querySelector('.town-building[data-tab="upgrades"] .town-building-st')!.textContent).toContain('3 of 3');
        await click(host.querySelector<HTMLElement>('.town-building[data-tab="upgrades"]')!);
        await spendUpgrades(store, host, 1);
        await clickText(host, '← Town square');
        expect(host.querySelector('.town-building[data-tab="upgrades"] .town-building-st')!.textContent).toContain('2 of 3');
    });
});

describe('176c — the Shop tab', () => {
    it('lists every deck and collection card as a sell tile with its sell price', async () => {
        const { store, host } = await openTown();
        const run = store.getState().run.run!;
        await click(host.querySelector<HTMLElement>('.town-building[data-tab="shop"]')!);

        const tiles = [...host.querySelectorAll('.mk-sell-tile')];
        const unique = new Set([
            ...run.deck.map((c) => `deck:${c.dataId}`),
            ...(run.collection ?? []).map((c) => `coll:${c.dataId}`),
        ]);
        expect(tiles).toHaveLength(unique.size);
        for (const tile of tiles) {
            const plate = tile.querySelector('.mk-sell-plate')!.textContent!;
            expect(plate).toMatch(/^(SELL \+|REMOVE — )\d+ amber$/);
        }
        const sample = run.deck.find((c) => !c.dataId.startsWith('junk'))!;
        expect(sellPrice(sample.dataId)).toBeGreaterThan(0);
    });

    it('does not mount the shelf until the Shop is opened, then freezes the team it was opened with', async () => {
        const { store, host } = await openTown();
        const nodeId = store.getState().run.run!.currentNodeId;
        expect(frozenMarketParty(store.getState().run.run!, nodeId)).toBeUndefined();

        // Recruit on the Workshop tab (the party grows to three), then open the Shop.
        await click(host.querySelector<HTMLElement>('.town-building[data-tab="workshop"]')!);
        await act(async () => { store.dispatch(setRun({ ...store.getState().run.run!, partyIds: ['mm1', 'mm2', 'mm3'] })); });
        expect(frozenMarketParty(store.getState().run.run!, nodeId), 'the workshop tab rolls no shelf').toBeUndefined();

        await clickText(host, '← Town square');
        await click(host.querySelector<HTMLElement>('.town-building[data-tab="shop"]')!);
        await flush();
        const frozen = frozenMarketParty(store.getState().run.run!, nodeId);
        expect(frozen, 'opening the Shop freezes the team').toBeDefined();
        expect(frozen).toHaveLength(3);
    });

    it('keeps a bought card bought when the shop is closed and reopened', async () => {
        const { store, host } = await openTown();
        await click(host.querySelector<HTMLElement>('.town-building[data-tab="shop"]')!);
        const firstOffer = (): HTMLButtonElement => host.querySelector<HTMLButtonElement>('.mk-grid .rs-card')!;
        const name = firstOffer().querySelector('.rs-cnm')?.textContent;
        await click(firstOffer());
        expect(firstOffer().classList.contains('sold')).toBe(true);

        await clickText(host, '← Town square');
        await click(host.querySelector<HTMLElement>('.town-building[data-tab="shop"]')!);
        expect(firstOffer().querySelector('.rs-cnm')?.textContent).toBe(name);
        expect(firstOffer().classList.contains('sold')).toBe(true);
        expect(store.getState().run.run!.deck.length).toBeGreaterThan(0);
    });

    it('shows the blueprint species\' two firmware under it, as peekable rows', async () => {
        // A seed whose route offers a trace; try a few before giving up.
        for (const biome of [0, 1, 2]) {
            const { host } = await openTown(biome);
            await click(host.querySelector<HTMLElement>('.town-building[data-tab="shop"]')!);
            const rows = host.querySelector('.mk-firmware');
            if (!rows) continue;
            expect(rows.querySelectorAll('.mk-fw')).toHaveLength(2);
            const row = rows.querySelector('.rs-row')!;
            await fire(row, 'mouseover');
            await flush();
            expect(document.body.querySelector('.card-peek')).not.toBeNull();
            return;
        }
        throw new Error('no biome offered a trace at the town; widen the seeds');
    });
});

describe('176c — the Den tab (the workshop)', () => {
    it('every engine row shows the card on hover', async () => {
        const store = makeStore();
        store.dispatch(startRun(runAtTown(0)));
        const state = (): IRunState => store.getState().run.run!;
        const host = await mount(
            store,
            <WorkshopNode
                inTown
                run={state()}
                node={state().nodes.find((n) => n.id === state().currentNodeId)!}
                ranch={{ ...ranch(), blueprints: { skoll: 1 } }}
                initialSpeciesId="skoll"
                onEditLoadout={() => undefined}
                onLeave={() => undefined}
            />,
        );
        const rows = [...host.querySelectorAll('.rs-cards .rs-row')];
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
            await fire(row, 'mouseover');
            await flush();
            expect(document.body.querySelector('.card-peek'), 'a peek for this row').not.toBeNull();
            await fire(row, 'mouseout');
            await flush();
        }
    });
});
