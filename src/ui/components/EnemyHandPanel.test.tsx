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
    ({ id, currentEnergy: energy, currentHp: hp, statusEffects: [], daemons: [] } as unknown as IBattleEntity);

function board(hand: ProgramEntity[], enemies: IBattleEntity[] = [foe('e1', 9)]): IBattleState {
    return {
        enemyParty: enemies,
        enemyDeck: { ownerId: 'ENEMY', deck: [], drawpile: [], hand, discard: [], exhaust: [] },
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

    it('is absent entirely when there is no hand — a MOVES enemy has no deck', () => {
        /*
         * Absent rather than empty. A tab reading "ENEMY HAND · 0" in every MOVES fight teaches
         * the player that the feature is broken.
         */
        render(board([]));
        expect(container.querySelector('.ehp-tab')).toBeNull();
        render(null);
        expect(container.querySelector('.ehp-tab')).toBeNull();
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
