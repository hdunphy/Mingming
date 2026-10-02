// @vitest-environment jsdom
/**
 * TICKET 184a — the draw pile opens like the discard. Henry, 2026-10-01: *"You need to be able to
 * see the draw cards like discard cards."* Sorted and stacked, never in draw order (ruled the same
 * day), so the list cannot tell the player their next draw.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import DrawPileViewer from './DrawPileViewer';
import DiscardPileViewer from './DiscardPileViewer';
import { drawPileRows } from './drawPile';
import type { ProgramEntity } from '../../engine/types';

const card = (id: string, dataId: string): ProgramEntity =>
    ({ id, dataId, currentCost: 0, isPlayable: true }) as ProgramEntity;

const PILE = [
    card('a', 'cinder_lance'), card('b', 'tackle'), card('c', 'ember_jab'),
    card('d', 'tackle'), card('e', 'ignite'), card('f', 'ember_jab'),
];

describe('drawPileRows', () => {
    it('stacks copies into one row with a count', () => {
        const rows = drawPileRows(PILE);
        expect(rows.find((r) => r.dataId === 'tackle')?.count).toBe(2);
        expect(rows.find((r) => r.dataId === 'ember_jab')?.count).toBe(2);
        expect(rows.find((r) => r.dataId === 'ignite')?.count).toBe(1);
        expect(rows).toHaveLength(4);
    });

    it('sorts by cost, then name', () => {
        const rows = drawPileRows(PILE);
        for (let i = 1; i < rows.length; i++) {
            const [a, b] = [rows[i - 1], rows[i]];
            expect(a.cost < b.cost || (a.cost === b.cost && a.name.localeCompare(b.name) <= 0)).toBe(true);
        }
    });

    it('gives the same rows whatever order the pile is in — the list never leaks the next draw', () => {
        const reference = drawPileRows(PILE);
        const orders = [
            [...PILE].reverse(),
            [PILE[3], PILE[0], PILE[5], PILE[1], PILE[4], PILE[2]],
            [PILE[2], PILE[4], PILE[1], PILE[5], PILE[0], PILE[3]],
        ];
        for (const order of orders) expect(drawPileRows(order)).toEqual(reference);
    });

    it('does not reorder the pile it was handed', () => {
        const pile = [...PILE];
        drawPileRows(pile);
        expect(pile.map((c) => c.id)).toEqual(PILE.map((c) => c.id));
    });

    it('is empty for an empty pile', () => {
        expect(drawPileRows([])).toEqual([]);
    });
});

describe('DrawPileViewer', () => {
    it('wraps the pile face in a button, starts closed, and keeps the draw formula as its hover text', () => {
        const markup = renderToStaticMarkup(
            <DrawPileViewer drawpile={PILE} toggleTitle="Draws 5 a turn">
                <span className="pile-stack">6</span>
            </DrawPileViewer>,
        );
        expect(markup).toContain('dpv-toggle');
        expect(markup).toContain('aria-expanded="false"');
        expect(markup).toContain('aria-controls="draw-pile-list"');
        expect(markup).toContain('title="Draws 5 a turn"');
        expect(markup).not.toContain('dpv-list');
    });
});

describe('the two piles in one console', () => {
    async function mount() {
        const { act } = await import('react');
        const { createRoot } = await import('react-dom/client');
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        const host = document.createElement('div');
        document.body.appendChild(host);
        const root = createRoot(host);
        await act(async () => {
            root.render(
                <div>
                    <DrawPileViewer drawpile={PILE} toggleTitle="draw"><span>draw</span></DrawPileViewer>
                    <DiscardPileViewer discard={[card('z', 'ignite')]}><span>discard</span></DiscardPileViewer>
                </div>,
            );
        });
        const toggles = host.querySelectorAll<HTMLButtonElement>('.dpv-toggle');
        return { act, host, root, draw: toggles[0], discard: toggles[1] };
    }

    /** What a real click does: a pointer-down on the element, then the click. */
    const press = (el: HTMLElement) => {
        el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
        el.click();
    };

    it('opens the draw list with every card, stacked, and its total in the heading', async () => {
        const { act, host, root, draw } = await mount();
        await act(async () => { press(draw); });
        const list = host.querySelector('#draw-pile-list')!;
        expect(list).not.toBeNull();
        expect(list.classList.contains('dpv-list-left')).toBe(true);
        expect(list.querySelector('h2')!.textContent).toBe('DRAW · 6');
        expect(list.querySelectorAll('.dpv-row')).toHaveLength(4);
        expect(list.textContent).toContain('×2');
        await act(async () => { root.unmount(); });
        host.remove();
    });

    it('keeps ONE list open: opening the other pile closes the first', async () => {
        const { act, host, root, draw, discard } = await mount();
        await act(async () => { press(draw); });
        expect(host.querySelector('#draw-pile-list')).not.toBeNull();
        await act(async () => { press(discard); });
        expect(host.querySelector('#draw-pile-list')).toBeNull();
        expect(host.querySelector('#discard-pile-list')).not.toBeNull();
        await act(async () => { press(draw); });
        expect(host.querySelector('#discard-pile-list')).toBeNull();
        expect(host.querySelector('#draw-pile-list')).not.toBeNull();
        await act(async () => { root.unmount(); });
        host.remove();
    });

    it('says so when the draw pile is empty', async () => {
        const { act } = await import('react');
        const { createRoot } = await import('react-dom/client');
        const host = document.createElement('div');
        document.body.appendChild(host);
        const root = createRoot(host);
        await act(async () => {
            root.render(<DrawPileViewer drawpile={[]} toggleTitle="draw"><span>draw</span></DrawPileViewer>);
        });
        await act(async () => { host.querySelector<HTMLButtonElement>('.dpv-toggle')!.click(); });
        expect(host.querySelector('.dpv-empty')!.textContent).toContain('shuffles back in');
        await act(async () => { root.unmount(); });
        host.remove();
    });
});
