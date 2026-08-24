// @vitest-environment jsdom
/**
 * DECLINING A CARD — ruling 4 (Henry, playtest 2026-08-24): *"you should be able to skip rewards"*,
 * and, asked per-card or per-screen, *"skip per card."*
 *
 * A click-level test (ticket 58's harness), because the whole behaviour is a state machine driven
 * by clicks: three states per pick, a gate over all of them, and a button that has to un-skip as
 * cleanly as it skips. `renderToStaticMarkup` can see the SKIP button exists and nothing else.
 *
 * The assertion that matters is the LAST one in each case — what `onContinue` receives. A screen
 * that lets you press SKIP and then hands the card over anyway is worse than no skip at all.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import BattleReport from './BattleReport';
import type { IOwnedProgram, IRewardBundle } from '../../engine/gameTypes';
import type { IBattleEntity } from '../../engine/types';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const owned = (dataId: string, n: number): IOwnedProgram =>
    ({ instanceId: `${dataId}_${n}`, dataId } as IOwnedProgram);

/** Two picks, as a 2v2 win pays: one per defeated body. */
const BUNDLE: IRewardBundle = {
    scraps: 15,
    blueprints: [],
    cards: [],
    cardChoices: [
        { sourceEntityName: 'Draugr', options: [owned('water_slap', 1), owned('hydro_blast', 1), owned('nettle_sting', 1)] },
        { sourceEntityName: 'Control', options: [owned('water_slap', 2), owned('hydro_blast', 2), owned('nettle_sting', 2)] },
    ],
};

const WINNERS: ReadonlyArray<IBattleEntity> = [];

let host: HTMLDivElement;
let root: Root;
let onContinue: ReturnType<typeof vi.fn>;

beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    onContinue = vi.fn();
});

afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
});

async function mount(): Promise<void> {
    await act(async () => {
        root.render(<BattleReport bundle={BUNDLE} winners={WINNERS} onContinue={onContinue} />);
    });
}

const buttons = (): HTMLButtonElement[] => [...host.querySelectorAll('button')];
const skipButtons = (): HTMLButtonElement[] =>
    buttons().filter(b => (b.textContent ?? '').includes('SKIP'));
const continueButton = (): HTMLButtonElement =>
    buttons().find(b => (b.textContent ?? '').includes('CONTINUE SYNCHRONIZATION'))!;

async function click(el: Element): Promise<void> {
    await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

describe('skipping a card pick', () => {
    it('blocks CONTINUE while a pick is neither taken nor declined', async () => {
        await mount();
        expect(continueButton().disabled).toBe(true);
        expect(host.textContent).toContain('UNRESOLVED CHOICES REMAINING');
    });

    it('offers one SKIP per pick — the ruling was per card, not one button for the screen', async () => {
        await mount();
        expect(skipButtons()).toHaveLength(BUNDLE.cardChoices.length);
    });

    it('unblocks CONTINUE when every pick is declined, and takes nothing', async () => {
        await mount();
        for (const b of skipButtons()) await click(b);

        expect(continueButton().disabled).toBe(false);
        expect(host.textContent).not.toContain('UNRESOLVED CHOICES REMAINING');

        await click(continueButton());
        expect(onContinue).toHaveBeenCalledTimes(1);
        // The point of the whole ruling: a declined pick puts NO card in the deck.
        expect(onContinue.mock.calls[0][0]).toEqual([]);
    });

    it('a declined pick can be un-declined by pressing it again', async () => {
        await mount();
        const skip = skipButtons()[0];
        await click(skip);
        expect(skipButtons()[0].textContent).toContain('SKIPPED');

        await click(skipButtons()[0]);
        // Back to unresolved — not silently resolved-as-taken, which would put a card the player
        // never chose into the deck.
        expect(continueButton().disabled).toBe(true);
        expect(skipButtons()[0].textContent).toBe('SKIP');
    });

    it('mixes freely: take one, decline the other, and only the taken card is handed over', async () => {
        await mount();
        // Decline the SECOND pick, then take a card from the first.
        await click(skipButtons()[1]);

        // `RevealCard` refuses clicks until it has finished flipping (`revealDelayMs` plus the
        // stagger), so this waits the animation out rather than clicking into a gate. Real timers,
        // because framer-motion drives the flip — a faked clock would just leave it un-revealed and
        // hand this test a silent pass, which is the failure mode ticket 58 exists to stop.
        await act(async () => { await new Promise(r => setTimeout(r, 1400)); });

        const firstGroupCard = host.querySelector('.reward-card-row > *');
        expect(firstGroupCard).toBeTruthy();
        await click(firstGroupCard!);

        expect(continueButton().disabled).toBe(false);
        await click(continueButton());

        const chosen = onContinue.mock.calls[0][0] as IOwnedProgram[];
        // Exactly one card: the one taken. The declined group contributed nothing.
        expect(chosen).toHaveLength(1);
        expect(BUNDLE.cardChoices[0].options.some(o => o.instanceId === chosen[0].instanceId)).toBe(true);
        expect(BUNDLE.cardChoices[1].options.some(o => o.instanceId === chosen[0].instanceId)).toBe(false);
    });
});
