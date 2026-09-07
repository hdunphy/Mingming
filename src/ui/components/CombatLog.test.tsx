/**
 * TICKET 143c — the combat log opens collapsed, and the collapsed state still says what happened.
 *
 * Henry, playtest 2026-09-05: *"Log should start untoggled but show latest message still. Toggling
 * it shows a handful and lets you scroll."* The old component opened EXPANDED and rendered every
 * entry of the fight, so it grew into a wall over the top of the board — and the only way to stop
 * that was to collapse it, which hid the fight completely. Both states were wrong, which is why it
 * was always left open.
 *
 * WHAT IS AND IS NOT TESTED HERE. The repo has no `@testing-library/react` and a lockfile change is
 * out of scope, so component tests render through `renderToStaticMarkup`, which runs no effects and
 * has no layout: scrolling cannot be exercised from here. Rather than assert nothing about it, the
 * two decisions that scrolling rests on are pure exported functions — WHICH entries are shown, and
 * WHETHER the view should follow the newest one — and those are tested directly. What is left for
 * the eye is the animation and the ellipsis, which is what the screenshots in the write-back are
 * for.
 */
import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import CombatLog from './CombatLog';
import { visibleEntries, isPinnedToBottom, EXPANDED_ENTRY_COUNT } from './combatLogModel';
import battleSliceReducer from '../store/battleSlice';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import type { IBattleState } from '../../engine/types';

const entry = (n: number) => ({ key: `log-${n}`, text: `line ${n}`, isOS: false });

function renderWith(logs: string[]): string {
    const store = configureStore({
        reducer: { battle: battleSliceReducer, game: gameReducer, run: runReducer },
        preloadedState: {
            game: createEmptyRanch(),
            run: { run: null },
            battle: {
                battle: { logs, osLogs: [] } as unknown as IBattleState,
                selectedSourceId: null,
                selectedTargetId: null,
                selectedCardId: null,
            },
        },
    });
    return renderToStaticMarkup(<Provider store={store}><CombatLog /></Provider>);
}

describe('143c — the log opens collapsed and shows the newest line', () => {
    it('renders the strip, not the panel, on first mount', () => {
        const html = renderWith(['first thing', 'second thing', 'the newest thing']);
        expect(html).toContain('log-strip');
        expect(html).not.toContain('log-messages');
    });

    it('the strip carries the NEWEST entry and only that one', () => {
        const html = renderWith(['first thing', 'second thing', 'the newest thing']);
        expect(html).toContain('the newest thing');
        expect(html).not.toContain('first thing');
        expect(html).not.toContain('second thing');
    });

    it('says something rather than nothing before the first action', () => {
        // An empty strip is indistinguishable from a broken one, and a battle opens with no logs.
        const html = renderWith([]);
        expect(html).toContain('log-strip');
        expect(html).toContain('awaiting first action');
    });

    it('is collapsed for the ENEMY turn too — the state is per session, never persisted', () => {
        // Two independent mounts, because a persisted toggle would make the second one expanded.
        expect(renderWith(['a'])).toContain('log-strip');
        expect(renderWith(['a', 'b'])).toContain('log-strip');
    });
});

describe('143c — which entries the panel shows', () => {
    const many = Array.from({ length: 30 }, (_, i) => entry(i));

    it('collapsed: exactly the newest one', () => {
        expect(visibleEntries(many, true)).toEqual([entry(29)]);
    });

    it('expanded: the last 8, oldest first so the newest sits at the bottom', () => {
        const shown = visibleEntries(many, false);
        expect(shown).toHaveLength(EXPANDED_ENTRY_COUNT);
        expect(shown[0]).toEqual(entry(22));
        expect(shown[shown.length - 1]).toEqual(entry(29));
    });

    it('a short fight shows what there is, without padding', () => {
        expect(visibleEntries([entry(0), entry(1)], false)).toHaveLength(2);
    });

    it('an empty log is empty in both states', () => {
        expect(visibleEntries([], true)).toEqual([]);
        expect(visibleEntries([], false)).toEqual([]);
    });
});

describe('143c — the panel follows the fight, but does not yank a reader who scrolled back', () => {
    it('a view pinned to the bottom keeps following', () => {
        expect(isPinnedToBottom({ scrollTop: 200, clientHeight: 100, scrollHeight: 300 })).toBe(true);
    });

    it('sub-pixel slack still counts as pinned — this is why the test is not an equality', () => {
        expect(isPinnedToBottom({ scrollTop: 197.4, clientHeight: 100, scrollHeight: 300 })).toBe(true);
    });

    it('a reader who has scrolled back is left alone', () => {
        expect(isPinnedToBottom({ scrollTop: 40, clientHeight: 100, scrollHeight: 300 })).toBe(false);
    });

    it('an unscrollable panel is pinned by definition', () => {
        expect(isPinnedToBottom({ scrollTop: 0, clientHeight: 150, scrollHeight: 150 })).toBe(true);
        expect(isPinnedToBottom(null)).toBe(true);
    });
});
