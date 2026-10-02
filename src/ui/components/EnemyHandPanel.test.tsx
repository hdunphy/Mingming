// @vitest-environment jsdom
/**
 * THE PANEL, RENDERED — ticket 159b's UI test.
 *
 * §5: *"a UI test that the panel lists N rows in cost order, greys by affordability, and shows the
 * tile on row hover"*. The arithmetic is checked in `enemyHand.test.ts`; what is checked here is
 * that the markup actually carries it — the 155 lesson, where three defects shipped past 201 green
 * UI tests because every one of them was about what the markup CARRIES rather than what it
 * computes.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, useState } from 'react';

import EnemyHandPanel from './EnemyHandPanel';
import type { IBattleEntity, IBattleState, ProgramEntity } from '../../engine/types';

declare global {
    var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const card = (dataId: string, n = 1): ProgramEntity[] =>
    Array.from({ length: n }, (_, i) => ({
        id: `${dataId}-${i}`, dataId, currentCost: 1, isPlayable: true,
    } as ProgramEntity));

const foe = (id: string, energy: number, hp = 100): IBattleEntity =>
    ({
        id, name: id, currentEnergy: energy, maxEnergy: energy, currentHp: hp, cardDraw: 3,
        statusEffects: [], daemons: [],
    } as unknown as IBattleEntity);

/** Their own turn: cards in hand, which is the source the panel prefers. */
function board(hand: ProgramEntity[], enemies: IBattleEntity[] = [foe('e1', 9)]): IBattleState {
    return {
        enemyMode: 'CARDS',
        enemyParty: enemies,
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand, discard: [], exhaust: [] },
    } as unknown as IBattleState;
}

/** The player's turn: the enemy hand is empty and the panel falls to the drawpile preview. */
function previewBoard(
    drawpile: ProgramEntity[],
    discard: ProgramEntity[] = [],
    enemies: IBattleEntity[] = [foe('e1', 9)],
): IBattleState {
    return {
        enemyMode: 'CARDS',
        enemyParty: enemies,
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile, hand: [], discard, exhaust: [] },
    } as unknown as IBattleState;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

/**
 * TICKET 167g: the panel is CONTROLLED (`BattleStage` owns whether it is open, so the state survives
 * the panel unmounting and the enemies can slide to match it). This wrapper is the stage's part, so a
 * test can click the tab and see the panel answer.
 */
function Controlled({ state }: { state: IBattleState | null }) {
    const [open, setOpen] = useState(false);
    return <EnemyHandPanel battleState={state} open={open} onToggle={() => setOpen((o) => !o)} />;
}
const render = (state: IBattleState | null) => act(() => root.render(<Controlled state={state} />));
const tabButton = () => container.querySelector('.ehp-tab') as HTMLButtonElement;
const panelRoot = () => container.querySelector('[data-testid="enemy-hand"]') as HTMLElement;
const rows = () => [...container.querySelectorAll('.rs-row')];

describe('159b — the enemy hand panel', () => {
    it('lists one row per unique card, in cost order, with the count on the tab', () => {
        render(board([...card('ignite', 3), ...card('molten_core')]));

        expect(rows()).toHaveLength(2);
        // The TAB carries the real hand size — four cards, two rows.
        expect(container.querySelector('.ehp-tab')!.textContent).toContain('4');
        const costs = rows().map(r => Number(r.querySelector('.rs-g')!.textContent));
        expect([...costs].sort((a, b) => a - b)).toEqual(costs);
        // Duplicates stack rather than repeating.
        expect(container.textContent).toContain('×3');
    });

    it('greys what the side cannot afford, and says why', () => {
        // One living enemy with no Energy: nothing in hand is castable this turn.
        render(board(card('molten_core'), [foe('e1', 0)]));

        expect(rows()[0].className).toContain('ehp-poor');
        expect(rows()[0].textContent).toContain('no EP');

        // Give it the Energy and the row comes back.
        render(board(card('molten_core'), [foe('e1', 9)]));
        expect(rows()[0].className).not.toContain('ehp-poor');
        expect(rows()[0].textContent).not.toContain('no EP');
    });

    it('is absent entirely for a MOVES enemy, which has no deck', () => {
        /*
         * Absent rather than empty. A tab reading "ENEMY HAND · 0" in every MOVES fight teaches
         * the player that the feature is broken. TICKET 167g narrowed the rule to exactly this: a
         * CARDS enemy that has run out of cards keeps its tab (see the next test), because a panel
         * that vanishes as the enemy plays out its hand loses the open state inside it.
         */
        render({ enemyMode: 'MOVES', enemyParty: [foe('e1', 9)], enemyDeck: board([]).enemyDeck } as unknown as IBattleState);
        expect(container.querySelector('.ehp-tab')).toBeNull();
        render(null);
        expect(container.querySelector('.ehp-tab')).toBeNull();
    });

    it('167g — a CARDS enemy with nothing in hand keeps its tab and says so', () => {
        render(board([]));
        expect(tabButton()).not.toBeNull();
        expect(tabButton().textContent).toContain('ENEMY HAND');
        expect(tabButton().textContent).toContain('0');
        // Not "ENEMY DRAWS 0": with nothing to preview there is no preview to label.
        expect(tabButton().textContent).not.toContain('DRAWS');
        expect(container.querySelector('.ehp-inner')!.textContent).toContain('Nothing in hand.');
        // The only row is the static message, not a card the player can peek at.
        expect(rows().filter(r => !r.classList.contains('ehp-empty'))).toHaveLength(0);
    });

    it('falls to the drawpile preview when their hand is empty, and labels it as one', () => {
        /*
         * The player's turn, which is when this panel is actually read. The enemy discarded its
         * hand at the end of its turn, so the top of its drawpile is the hand it is about to
         * play. One living member drawing 3: three cards, three rows if they are all different.
         */
        render(previewBoard([...card('ignite', 2), ...card('molten_core', 4)]));

        expect(container.querySelector('[data-testid="enemy-hand"]')!.getAttribute('data-source'))
            .toBe('PREVIEW');
        // The label changes with the source, so the player is never told they are looking at a
        // hand the enemy is not holding.
        expect(container.querySelector('.ehp-tab')!.textContent).toContain('ENEMY DRAWS');
        expect(container.querySelector('.ehp-tab')!.textContent).toContain('3');
        expect(rows()).toHaveLength(2);
        expect(container.textContent).toContain('×2');
    });

    it('prefers the hand over the preview, and says so', () => {
        render(board(card('ignite', 2), [foe('e1', 9)]));
        expect(container.querySelector('[data-testid="enemy-hand"]')!.getAttribute('data-source'))
            .toBe('HAND');
        expect(container.querySelector('.ehp-tab')!.textContent).toContain('ENEMY HAND');
    });

    it('counts the reshuffle tail into the tab, and names it as unknown in the list', () => {
        /*
         * The one thing a preview can get catastrophically wrong is claiming to know a card that
         * has not been shuffled yet. The tail is a count, never a card — and it still counts
         * toward the size of the turn coming at the player, which is why it is on the tab.
         */
        render(previewBoard(card('ignite', 1), card('growth', 5)));

        const unknown = container.querySelector('[data-testid="enemy-hand-unknown"]');
        expect(unknown).not.toBeNull();
        expect(unknown!.textContent).toContain('2');
        // Wants 3, knows 1, so the tab reads 3 — not 1.
        expect(container.querySelector('.ehp-tab')!.textContent).toContain('3');
        // And it does not deal the discard out as if it were known.
        expect(container.textContent).not.toContain('Growth');
        // It is not a button: there is no tile to peek at, and a dead control is worse than none.
        expect(unknown!.tagName).toBe('DIV');
    });

    it('greys a preview against the Energy they will have, not the tank they just emptied', () => {
        /*
         * A preview is read after the enemy has spent down, usually to zero. Measured against
         * `currentEnergy`, every row would grey out at exactly the moment the player is deciding.
         */
        const spent = foe('e1', 0);
        (spent as { maxEnergy: number }).maxEnergy = 9;
        render(previewBoard(card('molten_core', 3), [], [spent]));

        expect(rows()[0].className).not.toContain('ehp-poor');
    });

    it('shows the card tile beside the mouse on hover, outside the panel, and takes it back', () => {
        render(board(card('ignite')));
        const tile = () => document.body.querySelector<HTMLElement>('.card-peek');
        expect(tile()).toBeNull();
        const panel = container.querySelector('.ehp-inner') as HTMLElement;
        const before = { children: panel.childElementCount, html: panel.innerHTML };

        act(() => {
            rows()[0].dispatchEvent(new MouseEvent('mouseover', { bubbles: true, clientX: 200, clientY: 300 }));
        });
        // TICKET 167f: a tooltip drawn into <body>, not a block under the rows in the panel.
        expect(tile()).not.toBeNull();
        expect(tile()!.parentElement).toBe(document.body);
        expect(container.contains(tile())).toBe(false);
        // It must never eat the pointer, and it must not grow the panel under the mouse.
        expect(tile()!.getAttribute('aria-hidden')).toBe('true');
        expect(tile()!.style.pointerEvents).toBe('none');
        expect(panel.childElementCount).toBe(before.children);
        expect(panel.innerHTML).toBe(before.html);

        act(() => {
            rows()[0].dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        });
        expect(tile()).toBeNull();
    });

    it('167g — hovering does NOT open it; clicking the tab does, and clicking again closes it', () => {
        render(board(card('ignite')));
        expect(tabButton().getAttribute('aria-expanded')).toBe('false');

        // Hover and pointer-enter on the panel: nothing. (It used to open on hover.)
        act(() => { panelRoot().dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); });
        act(() => { panelRoot().dispatchEvent(new MouseEvent('mouseenter', { bubbles: false })); });
        expect(tabButton().getAttribute('aria-expanded')).toBe('false');
        expect(panelRoot().classList.contains('open')).toBe(false);

        act(() => { tabButton().click(); });
        expect(tabButton().getAttribute('aria-expanded')).toBe('true');
        expect(panelRoot().classList.contains('open')).toBe(true);

        // ...and leaving does not close it either: it stays open until the player closes it.
        act(() => { panelRoot().dispatchEvent(new MouseEvent('mouseout', { bubbles: true })); });
        act(() => { panelRoot().dispatchEvent(new MouseEvent('mouseleave', { bubbles: false })); });
        expect(tabButton().getAttribute('aria-expanded')).toBe('true');

        act(() => { tabButton().click(); });
        expect(tabButton().getAttribute('aria-expanded')).toBe('false');
    });

    it('167g — focusing the tab does not open it either; the tab is a real button for Enter and Space', () => {
        render(board(card('ignite')));
        expect(tabButton().tagName).toBe('BUTTON');
        act(() => { tabButton().focus(); });
        expect(tabButton().getAttribute('aria-expanded')).toBe('false');
    });

    it('167g — an open panel stays open when the enemy plays out its hand', () => {
        render(board(card('ignite', 2)));
        act(() => { tabButton().click(); });
        expect(tabButton().getAttribute('aria-expanded')).toBe('true');

        // The enemy's turn plays the hand out: same panel, nothing left to show.
        render(board([]));
        expect(tabButton(), 'the tab must not vanish mid-fight').not.toBeNull();
        expect(tabButton().getAttribute('aria-expanded')).toBe('true');
        expect(panelRoot().classList.contains('open')).toBe(true);
        expect(container.querySelector('.ehp-inner')!.textContent).toContain('Nothing in hand.');
    });

    it('167g — it stays open when the label flips between HAND and DRAWS', () => {
        render(board(card('ignite')));
        act(() => { tabButton().click(); });
        render(previewBoard(card('ignite', 2)));
        expect(tabButton().textContent).toContain('ENEMY DRAWS');
        expect(tabButton().getAttribute('aria-expanded')).toBe('true');
    });

    it('predicts nothing — no target, no order, no damage', () => {
        /*
         * The line the whole ticket rests on. An intent is authored information that lies the
         * moment the player changes the board; a hand is true regardless. If a future edit adds
         * "→ Rat" or "38 dmg" to a row, this fails, and it should.
         */
        render(board([...card('ignite'), ...card('molten_core')], [foe('e1', 9), foe('e2', 4)]));
        const text = container.querySelector('.ehp-inner')!.textContent ?? '';

        expect(text).not.toMatch(/→/);
        expect(text).not.toMatch(/\bwill\b/i);
        expect(text).not.toMatch(/\bdmg\b/i);
        expect(text).not.toMatch(/\btarget/i);
    });
});

describe('183b — the closed tab draws the hand as card backs (D6)', () => {
    const backs = () => [...container.querySelectorAll('.ehp-tab .ehp-back')] as HTMLElement[];

    it('shows one back per card in the hand, coloured by its element', () => {
        render(board([...card('ignite'), ...card('growth'), ...card('ignite')]));
        const els = backs().map((b) => b.style.getPropertyValue('--k-el'));
        expect(els).toHaveLength(3);
        // Two copies of one card and one of another: two colours, one of them twice.
        const counts = Object.values(els.reduce<Record<string, number>>((m, e) => ({ ...m, [e]: (m[e] ?? 0) + 1 }), {}));
        expect(counts.sort()).toEqual([1, 2]);
        for (const e of els) expect(e).toMatch(/^var\(--el-(fire|water|nature|none)\)$/);
    });

    it('draws a Neutral back for a card whose identity is not known yet, so the backs add up to the count', () => {
        render(previewBoard(card('ignite', 1), card('growth', 4)));
        const label = container.querySelector('.ehp-tab-label')!.textContent!;
        const total = Number(label.match(/(\d+)\s*$/)![1]);
        expect(backs()).toHaveLength(total);
    });

    it('caps the backs at eight, and the number on the tab is still the whole count', () => {
        render(board(card('ignite', 11)));
        expect(backs()).toHaveLength(8);
        expect(container.querySelector('.ehp-tab')!.textContent).toContain('11');
    });

    it('draws no backs for an empty hand', () => {
        render(board([]));
        expect(backs()).toHaveLength(0);
    });
});
