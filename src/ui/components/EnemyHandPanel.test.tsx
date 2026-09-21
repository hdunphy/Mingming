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
import { act } from 'react';

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

const render = (state: IBattleState | null) => act(() => root.render(<EnemyHandPanel battleState={state} />));
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

    it('is absent entirely when there is nothing to show — a MOVES enemy has no deck', () => {
        /*
         * Absent rather than empty. A tab reading "ENEMY HAND · 0" in every MOVES fight teaches
         * the player that the feature is broken.
         */
        render(board([]));
        expect(container.querySelector('.ehp-tab')).toBeNull();
        render(null);
        expect(container.querySelector('.ehp-tab')).toBeNull();
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

    it('shows the card tile under the rows on hover, and takes it back', () => {
        render(board(card('ignite')));
        expect(container.querySelector('.ehp-peek')).toBeNull();

        act(() => {
            rows()[0].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        });
        const peek = container.querySelector('.ehp-peek');
        expect(peek).not.toBeNull();
        // It must never eat the pointer — it sits over the rows that opened it.
        expect(peek!.getAttribute('aria-hidden')).toBe('true');

        act(() => {
            rows()[0].dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
        });
        expect(container.querySelector('.ehp-peek')).toBeNull();
    });

    it('opens from the keyboard, not only from a pointer', () => {
        // §5 asks for it, and a hover-only telegraph is a telegraph half the players cannot read.
        render(board(card('ignite')));
        const tab = container.querySelector('.ehp-tab') as HTMLButtonElement;

        expect(tab.getAttribute('aria-expanded')).toBe('false');
        // `.focus()` rather than a synthetic FocusEvent: React delegates on `focusin`, so a
        // hand-built `focus` event never reaches the handler and the test would pass or fail for
        // a reason that has nothing to do with the component.
        act(() => { tab.focus(); });
        expect(tab.getAttribute('aria-expanded')).toBe('true');
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
