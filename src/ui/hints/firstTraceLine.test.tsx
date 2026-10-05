// @vitest-environment jsdom
/**
 * TICKET 195b — "Summon it in the Den." under the first Trace a save ever gains.
 *
 * Henry (2026-10-05): when you get the first one, a line says "summon in the den"; once a save. The flag is
 * `traceHintShown` on the ranch. These tests mount the real screens that grant a Trace and read what they
 * print: the fight's reward, the Wild Tracks event, the shop, and the gym payout's summary. The line is the
 * first Trace on a fresh save, never a later one, and never a first Trace on a save that has shown it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { configureStore } from '@reduxjs/toolkit';
import { Provider, useSelector } from 'react-redux';

import EventNode from '../screens/EventNode';
import MarketplaceNode from '../screens/MarketplaceNode';
import RunSummary from '../screens/RunSummary';
import BattleReport from '../components/BattleReport';
import gameReducer, { addBlueprint, addToRoster, createEmptyRanch, markTraceHintShown } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { FIRST_TRACE_LINE, traceHintDue } from './firstTraceHint';
import { useFirstTraceLine } from '../hooks/useFirstTraceLine';
import { SeedStream } from '../../engine/core/SeedStream';
import { createRanchMember } from '../../engine/gameTypes';
import { createRun } from '../../engine/run/createRun';
import { BUILT_EVENTS } from '../../engine/run/events/eventDraw';
import { offerGyms } from '../../engine/run/gyms';
import { rollBlueprintOffer } from '../../engine/run/marketplace';
import { blueprintBankedModifier } from '../../engine/run/runSummary';
import { RanchStateSchema } from '../../engine/runTypes';
import type { IRunState } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';
import type { IRewardBundle } from '../../engine/gameTypes';
import { plainShop } from '../../testing/plainShop';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});
afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
});

const buttons = (): HTMLButtonElement[] => [...host.querySelectorAll('button')];
const byText = (text: string): HTMLButtonElement | undefined => buttons().find((b) => b.textContent?.includes(text));
async function click(button: Element | null | undefined): Promise<void> {
    expect(button, 'button to click').toBeTruthy();
    await act(async () => { (button as HTMLButtonElement).click(); });
}
const lineCount = (): number => host.textContent!.split(FIRST_TRACE_LINE).length - 1;

function newStore(run: IRunState, ranch: Partial<ReturnType<typeof createEmptyRanch>> = {}) {
    const store = configureStore({
        reducer: { run: runReducer, game: gameReducer },
        preloadedState: { run: { run }, game: { ...createEmptyRanch(), ...ranch } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    store.dispatch(addToRoster({ ...createRanchMember('kraken', 'kraken_v1', new SeedStream('mm1-roll')), id: 'mm1' }));
    return store;
}
type Store = ReturnType<typeof newStore>;
const shown = (store: Store): boolean | undefined => store.getState().game.traceHintShown;

describe('195b — the flag and the sentence', () => {
    it('the sentence is Henry’s', () => {
        expect(FIRST_TRACE_LINE).toBe('Summon it in the Den.');
    });

    it('a new save has not shown the line, and marking it sets it for good', () => {
        const store = newStore(createRun({ seed: 's', offer: offerGyms('o')[0], party: [KRAKEN], startedAt: 1 }));
        expect(shown(store)).toBe(false);
        expect(traceHintDue(store.getState().game)).toBe(true);
        store.dispatch(markTraceHintShown());
        store.dispatch(markTraceHintShown());
        expect(shown(store)).toBe(true);
        expect(traceHintDue(store.getState().game)).toBe(false);
    });

    it('a save written before the field parses as not shown (no version bump)', () => {
        const parsed = RanchStateSchema.parse({ roster: [] });
        expect(parsed.traceHintShown).toBe(false);
        expect(traceHintDue({})).toBe(true);
    });

    it('gaining a Trace does not by itself mark the save: only showing the line does', () => {
        const store = newStore(createRun({ seed: 's', offer: offerGyms('o')[0], party: [KRAKEN], startedAt: 1 }));
        store.dispatch(addBlueprint('fenrir'));
        expect(shown(store)).toBe(false);
    });
});

describe('195b — the hook', () => {
    function Probe({ gained }: { gained: boolean }): ReactNode {
        const line = useFirstTraceLine(gained);
        const flag = useSelector((s: { game: { traceHintShown?: boolean } }) => s.game.traceHintShown);
        return <p data-testid="probe">{`${line ?? 'none'}|${String(flag)}`}</p>;
    }
    const probe = (): string => host.querySelector('[data-testid="probe"]')!.textContent!;
    const run = () => createRun({ seed: 's', offer: offerGyms('o')[0], party: [KRAKEN], startedAt: 1 });

    it('prints nothing until a Trace is gained, and does not mark the save', async () => {
        const store = newStore(run());
        await act(async () => { root.render(<Provider store={store}><Probe gained={false} /></Provider>); });
        expect(probe()).toBe('none|false');
    });

    it('prints the line when the first Trace is gained, marks the save, and keeps printing it on that screen', async () => {
        const store = newStore(run());
        await act(async () => { root.render(<Provider store={store}><Probe gained={false} /></Provider>); });
        await act(async () => { root.render(<Provider store={store}><Probe gained /></Provider>); });
        expect(probe()).toBe(`${FIRST_TRACE_LINE}|true`);
        await act(async () => { root.render(<Provider store={store}><Probe gained /></Provider>); });
        expect(probe()).toBe(`${FIRST_TRACE_LINE}|true`);
    });

    it('a later screen, or a later Trace, on the same save prints nothing', async () => {
        const store = newStore(run());
        await act(async () => { root.render(<Provider store={store}><Probe gained /></Provider>); });
        await act(async () => { root.unmount(); });
        root = createRoot(host);
        await act(async () => { root.render(<Provider store={store}><Probe gained /></Provider>); });
        expect(probe()).toBe('none|true');
    });

    it('a save that has already shown it prints nothing for its first Trace', async () => {
        const store = newStore(run(), { traceHintShown: true });
        await act(async () => { root.render(<Provider store={store}><Probe gained /></Provider>); });
        expect(probe()).toBe('none|true');
    });
});

describe('195b — the fight reward', () => {
    const bundle = (blueprints: string[]): IRewardBundle => ({
        scraps: 12, blueprints, cardChoices: [], driver: undefined,
    } as unknown as IRewardBundle);

    it('prints the line directly under the Trace when the container passes one', async () => {
        await act(async () => { root.render(<BattleReport bundle={bundle(['fenrir'])} winners={[]} onContinue={vi.fn()} firstTraceLine={FIRST_TRACE_LINE} />); });
        const text = host.textContent!;
        expect(text).toContain('Fenrir Trace');
        expect(text.indexOf(FIRST_TRACE_LINE)).toBeGreaterThan(text.indexOf('Fenrir Trace'));
        expect(lineCount()).toBe(1);
    });

    it('prints no line when none is passed, and none without a Trace', async () => {
        await act(async () => { root.render(<BattleReport bundle={bundle(['fenrir'])} winners={[]} onContinue={vi.fn()} />); });
        expect(lineCount()).toBe(0);
        await act(async () => { root.render(<BattleReport bundle={bundle([])} winners={[]} onContinue={vi.fn()} firstTraceLine={FIRST_TRACE_LINE} />); });
        expect(lineCount()).toBe(0);
    });
});

describe('195b — Wild Tracks', () => {
    function eventRun(): IRunState {
        const run = createRun({ seed: 'pick-screen', offer: offerGyms('pick-offer')[0], party: [KRAKEN], startedAt: 1 });
        const target = run.nodes.find((node) => node.id !== run.currentNodeId)!;
        return {
            ...run,
            currentNodeId: target.id,
            nodes: run.nodes.map((node) => (node.id === target.id ? { ...node, visited: 1 } : node)),
            eventHistory: [...BUILT_EVENTS].filter((id) => id !== 'wild_tracks').map((eventId, i) => (
                { nodeId: `other${i}`, eventId, choiceId: 'leave', grants: [] }
            )),
        };
    }
    function Harness(): ReactNode {
        const run = useSelector((s: { run: { run: IRunState } }) => s.run.run);
        const ranch = useSelector((s: { game: ReturnType<typeof createEmptyRanch> }) => s.game);
        const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
        return <EventNode run={run} node={node} ranch={ranch} biomeName="Test Biome" onLeave={() => {}} />;
    }
    async function takeATrace(store: Store): Promise<void> {
        await act(async () => { root.render(<Provider store={store}><Harness /></Provider>); });
        await click(byText('Pick 1 of 3 traces'));
        await click(host.querySelector('.ev-choice'));
        await click(byText('TAKE TRACE'));
    }

    it('the first Trace of a save says to summon it in the Den, under the line that says it was banked', async () => {
        const store = newStore(eventRun());
        await takeATrace(store);
        const text = host.textContent!;
        expect(text).toContain('trace banked to the ranch');
        expect(lineCount()).toBe(1);
        expect(text.indexOf(FIRST_TRACE_LINE)).toBeGreaterThan(text.indexOf('trace banked to the ranch'));
        expect(shown(store)).toBe(true);
    });

    it('a save that has shown the line does not show it again', async () => {
        const store = newStore(eventRun(), { traceHintShown: true });
        await takeATrace(store);
        expect(host.textContent).toContain('trace banked to the ranch');
        expect(lineCount()).toBe(0);
    });

    it('picking nothing, backing out, leaves the save unmarked', async () => {
        const store = newStore(eventRun());
        await act(async () => { root.render(<Provider store={store}><Harness /></Provider>); });
        await click(byText('Pick 1 of 3 traces'));
        await click(byText('BACK'));
        expect(lineCount()).toBe(0);
        expect(shown(store)).toBe(false);
    });
});

describe('195b — the shop', () => {
    function shopRun(): IRunState {
        const base = createRun({ seed: 'market-render-seed', offer: offerGyms('offer-seed')[0], party: [KRAKEN], startedAt: 1 });
        const market = plainShop(base, 'marketplace');
        return {
            ...base, scrap: 500, currentNodeId: market.id,
            nodes: base.nodes.map((n) => (n.id === market.id ? { ...n, visited: n.visited + 1 } : n)),
        };
    }
    function ShopHarness(): ReactNode {
        const run = useSelector((s: { run: { run: IRunState } }) => s.run.run);
        const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
        return <MarketplaceNode run={run} node={node} party={[{ definitionId: 'kraken', activeOS: 'kraken_v1' }]} onEditLoadout={() => {}} onLeave={() => {}} />;
    }
    const traceTile = (): HTMLButtonElement | null => host.querySelector('.mk-bp');

    it('buying the shop’s Trace says to summon it in the Den, the first time only', async () => {
        const run = shopRun();
        expect(rollBlueprintOffer(run, run.nodes.find((n) => n.id === run.currentNodeId)!), 'the fixture shop sells a Trace').toBeTruthy();
        const store = newStore(run);
        await act(async () => { root.render(<Provider store={store}><ShopHarness /></Provider>); });
        expect(lineCount()).toBe(0);
        await click(traceTile());
        expect(Object.values(store.getState().game.blueprints).reduce((a, b) => a + b, 0)).toBe(1);
        expect(lineCount()).toBe(1);
        expect(shown(store)).toBe(true);
    });

    it('on a save that has shown it, buying a Trace prints no line', async () => {
        const store = newStore(shopRun(), { traceHintShown: true });
        await act(async () => { root.render(<Provider store={store}><ShopHarness /></Provider>); });
        await click(traceTile());
        expect(lineCount()).toBe(0);
    });
});

describe('195b — the gym payout, on the run summary', () => {
    const ended = (modifiers: string[]): IRunState => ({
        ...createRun({ seed: 'summary-screen-seed', offer: offerGyms('offer-seed')[0], party: [KRAKEN], startedAt: 1 }),
        phase: 'ended', outcome: 'victory', modifiers,
    });

    it('prints the line when the payout is a save’s first Trace, and not when nothing was kept', async () => {
        const store = newStore(ended(['kraken', 'fenrir'].map(blueprintBankedModifier)));
        await act(async () => { root.render(<Provider store={store}><RunSummary run={store.getState().run.run!} endedAt={1000} /></Provider>); });
        expect(host.textContent).toContain('You kept: Kraken trace, Fenrir trace');
        expect(lineCount()).toBe(1);

        await act(async () => { root.unmount(); });
        root = createRoot(host);
        const empty = newStore(ended([]));
        await act(async () => { root.render(<Provider store={empty}><RunSummary run={empty.getState().run.run!} endedAt={1000} /></Provider>); });
        expect(lineCount()).toBe(0);
        expect(shown(empty)).toBe(false);
    });
});
