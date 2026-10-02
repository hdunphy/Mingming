// @vitest-environment jsdom
/**
 * TICKET 169i — the draft screen, mounted and clicked.
 *
 * One member: five picks from three offers each, and the run that comes out has exactly those cards.
 * Two members: the second drafts after the first, and nothing finishes until both have. Back throws
 * the draft away. And through `RunStart`: Launch with Draft Start on opens the draft instead of
 * starting the run, and finishing it starts a run on the seed the draft used.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import DraftStart from './DraftStart';
import RunStart from './RunStart';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { GENERIC_HIT } from '../../engine/data/mingmingRegistry';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import { STARTER_GENERICS, createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { DRAFT_PICKS, draftOffer, draftPool, takePick } from '../../engine/run/modifiers/draftStart';
import type { IMingmingState } from '../../engine/types';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const KRAKEN: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1',
    blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};
const FENRIR: IMingmingState = {
    id: 'mm2', definitionId: 'fenrir', activeOS: 'fenrir_v1',
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

const header = (): string => host.querySelector('h2')!.textContent!;
const cards = (): HTMLElement[] => [...host.querySelectorAll<HTMLElement>('.draft-card')];
const pickedNames = (): string[] => [...host.querySelectorAll('.draft-picked li')].map((li) => li.textContent!);
async function click(el: Element): Promise<void> {
    await act(async () => { (el as HTMLElement).click(); });
}

describe('DraftStart', () => {
    it('opens on "Draft: {name}, pick 1 of 5" with three cards and nothing picked', async () => {
        await act(async () => {
            root.render(<DraftStart seed="ds-seed" party={[KRAKEN]} onDone={() => undefined} onBack={() => undefined} />);
        });

        expect(header()).toBe('Draft: Kraken, pick 1 of 5');
        expect(cards()).toHaveLength(3);
        expect(pickedNames()).toEqual([]);
    });

    it('offers exactly the cards draftOffer says, drawn as card faces', async () => {
        await act(async () => {
            root.render(<DraftStart seed="ds-seed" party={[KRAKEN]} onDone={() => undefined} onBack={() => undefined} />);
        });

        const offered = draftOffer('ds-seed', 0, 0, draftPool(KRAKEN));
        expect(cards().map((c) => c.querySelector('.rs-cnm')!.textContent))
            .toEqual(offered.map((id) => ProgramRegistry[id].name));
    });

    it('a one-member draft: five clicks finish it, and the deck is the picks plus the generics', async () => {
        const onDone = vi.fn();
        await act(async () => {
            root.render(<DraftStart seed="ds-seed" party={[KRAKEN]} onDone={onDone} onBack={() => undefined} />);
        });

        // Click the FIRST offered card every time, and track what that must be.
        let remaining = draftPool(KRAKEN);
        const expected: string[] = [];
        for (let pick = 0; pick < DRAFT_PICKS; pick++) {
            expect(header()).toBe(`Draft: Kraken, pick ${pick + 1} of 5`);
            expect(onDone).not.toHaveBeenCalled();
            const first = draftOffer('ds-seed', 0, pick, remaining)[0];
            expected.push(first);
            remaining = takePick(remaining, first);
            await click(cards()[0]);
            if (pick < DRAFT_PICKS - 1) expect(pickedNames()).toEqual(expected.map((id) => ProgramRegistry[id].name));
        }

        expect(onDone).toHaveBeenCalledTimes(1);
        expect(onDone).toHaveBeenCalledWith({ mm1: expected });

        const run = createRun({
            seed: 'ds-seed', offer: offerGyms('offer-seed')[0], party: [KRAKEN], startedAt: 0,
            modifiers: ['draft_start'], startKitOverrides: onDone.mock.calls[0][0],
        });
        expect(run.deck.map((c) => c.dataId)).toEqual([...expected, ...Array(STARTER_GENERICS).fill(GENERIC_HIT)]);
    });

    it('a two-member draft: the second drafts after the first, and it finishes only after both', async () => {
        const onDone = vi.fn();
        await act(async () => {
            root.render(<DraftStart seed="ds-seed" party={[KRAKEN, FENRIR]} onDone={onDone} onBack={() => undefined} />);
        });

        for (let pick = 0; pick < DRAFT_PICKS; pick++) await click(cards()[0]);
        expect(onDone).not.toHaveBeenCalled();
        expect(header()).toBe('Draft: Fenrir, pick 1 of 5');
        expect(pickedNames()).toEqual([]);

        for (let pick = 0; pick < DRAFT_PICKS; pick++) await click(cards()[0]);
        expect(onDone).toHaveBeenCalledTimes(1);
        const kits = onDone.mock.calls[0][0] as Record<string, string[]>;
        expect(Object.keys(kits).sort()).toEqual(['mm1', 'mm2']);
        expect(kits.mm1).toHaveLength(DRAFT_PICKS);
        expect(kits.mm2).toHaveLength(DRAFT_PICKS);
    });

    it('Back calls onBack and starts nothing', async () => {
        const onDone = vi.fn();
        const onBack = vi.fn();
        await act(async () => {
            root.render(<DraftStart seed="ds-seed" party={[KRAKEN]} onDone={onDone} onBack={onBack} />);
        });
        await click(cards()[0]);
        await click([...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Back'))!);

        expect(onBack).toHaveBeenCalledTimes(1);
        expect(onDone).not.toHaveBeenCalled();
    });
});

describe('Draft Start through RunStart', () => {
    function makeStore() {
        return configureStore({
            reducer: { game: gameReducer, run: runReducer },
            preloadedState: {
                game: {
                    ...createEmptyRanch(),
                    roster: [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 }],
                    gymsCleared: ['gym_emberfall'],
                },
                run: { run: null },
            },
            middleware: (getDefault) => getDefault({ serializableCheck: false }),
        });
    }

    const button = (text: string): HTMLButtonElement =>
        [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

    async function toDraft(store: ReturnType<typeof makeStore>): Promise<void> {
        await act(async () => { root.render(<Provider store={store}><RunStart /></Provider>); });
        await click(host.querySelector('.ranch-offer')!);
        await click(host.querySelector('.ranch-roster-grid button')!);
        await click(button('Draft Start'));
        await click(button('Begin run'));
    }

    it('Launch with Draft Start on opens the draft and starts no run', async () => {
        const store = makeStore();
        await toDraft(store);

        expect(header()).toBe('Draft: Kraken, pick 1 of 5');
        expect(store.getState().run.run).toBeNull();
    });

    it('Back returns to the party screen and throws the draft away', async () => {
        const store = makeStore();
        await toDraft(store);
        await click(cards()[0]);
        await click(button('Back'));

        expect(store.getState().run.run).toBeNull();
        expect(button('Begin run')).toBeTruthy();
        // A second launch opens a fresh draft at pick 1.
        await click(button('Begin run'));
        expect(header()).toBe('Draft: Kraken, pick 1 of 5');
    });

    it('finishing the draft starts the run with the drafted kit, the modifier, and the seed the offers used', async () => {
        const store = makeStore();
        await toDraft(store);

        // The offers came from the run's own seed, so the first card on screen must be the first
        // card of `draftOffer` for the seed the run ends up with.
        const firstShown = cards()[0].querySelector('.rs-cnm')!.textContent;
        for (let pick = 0; pick < DRAFT_PICKS; pick++) await click(cards()[0]);

        const run = store.getState().run.run!;
        expect(run.modifiers).toContain('mod:draft_start');
        expect(run.deck).toHaveLength(DRAFT_PICKS + STARTER_GENERICS);
        const pool = draftPool(KRAKEN);
        const firstPick = draftOffer(run.seed, 0, 0, pool)[0];
        expect(ProgramRegistry[firstPick].name).toBe(firstShown);
        expect(run.deck[0].dataId).toBe(firstPick);
    });
});
