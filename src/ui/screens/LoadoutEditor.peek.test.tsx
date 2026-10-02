// @vitest-environment jsdom
/**
 * THE DECK-ROW PEEK — the one interaction test the repo rule asks of a changed clickable screen.
 *
 * Henry, 2026-09-11: *"on hover of the Edit Loadout screen you should see what the active deck
 * cards look like. I need to see the full card that I would see from the shop or card collection
 * when I hover."*
 *
 * Its own file because it needs jsdom: `LoadoutEditor.test.tsx` renders to static markup in node,
 * and hover state is invisible to that. The fixtures are IMPORTED from it rather than rebuilt, so
 * the two files cannot come to describe different decks.
 *
 * The assertion that earns its place is the third: that the tile is the collection's own
 * `CardTileFace` and not a second rendering of the same card. A copy-pasted face would satisfy
 * "something appeared" forever, and drift from the grid the first time either one changed.
 */
import { describe, expect, it } from 'vitest';

import LoadoutEditor from './LoadoutEditor';
import { makeRun, makeRanch } from './LoadoutEditor.test';
import { makeStore, mount, fire, flush } from '../../testing/interaction';
import { fireAt } from '../../testing/pointer';

/** 167f: the tile is a tooltip drawn into <body>, so it is found there and not inside the editor. */
const peekTile = (): HTMLElement | null => document.body.querySelector<HTMLElement>('.card-peek');

async function openEditor(): Promise<HTMLElement> {
    return mount(
        makeStore(),
        <LoadoutEditor run={makeRun()} ranch={makeRanch()} context="WORKSHOP" onClose={() => undefined} />,
    );
}

describe('LoadoutEditor — hovering a deck row shows the collection card', () => {
    it('draws no peek until a row is hovered', async () => {
        await openEditor();
        expect(peekTile()).toBeNull();
    });

    it('hovering a deck row opens the tile, and leaving closes it', async () => {
        const host = await openEditor();
        const row = host.querySelector('.rs-row');
        expect(row, 'the active deck should render rows').not.toBeNull();

        await fire(row!, 'mouseover');
        await flush();
        expect(peekTile(), 'hover should open a peek').not.toBeNull();
        // 167f: a child of the page body, outside every container.
        expect(peekTile()!.parentElement).toBe(document.body);
        expect(host.contains(peekTile())).toBe(false);

        await fire(row!, 'mouseout');
        await flush();
        expect(peekTile()).toBeNull();
    });

    it('the peek IS the collection tile — the four things a 27px row cannot carry', async () => {
        const host = await openEditor();
        await fire(host.querySelector('.rs-row')!, 'mouseover');
        await flush();

        const peek = peekTile()!;
        expect(peek.classList.contains('rs-card')).toBe(true);
        expect(peek.querySelector('.rs-desc'), 'the description is the point').not.toBeNull();
        expect(peek.querySelector('.rs-art'), 'the art block').not.toBeNull();
        expect(peek.querySelector('.rs-pips'), 'cost as pips, not a numeral').not.toBeNull();
        expect(peek.querySelector('.rs-cnm')?.textContent).toBeTruthy();
    });

    it('is inert — it hangs over the column it describes and must not eat the click', async () => {
        const host = await openEditor();
        await fire(host.querySelector('.rs-row')!, 'mouseover');
        await flush();
        expect(peekTile()!.getAttribute('aria-hidden')).toBe('true');
        expect(peekTile()!.style.pointerEvents).toBe('none');
    });

    it('hovering does not change the deck column: nothing is added to it (167f)', async () => {
        const host = await openEditor();
        const column = host.querySelector('.led-deck') as HTMLElement;
        const before = { children: column.childElementCount, html: column.innerHTML };

        await fireAt(host.querySelector('.rs-row')!, 'mouseover', 300, 200);
        await flush();

        expect(peekTile()).not.toBeNull();
        expect(column.childElementCount).toBe(before.children);
        expect(column.innerHTML).toBe(before.html);
    });
});
