// @vitest-environment jsdom
/**
 * Ticket 183 follow-up (Henry's review): the Settings screen and the Codex and Vault tabs keep to
 * short copy. They carry many small notes (one per setting), so the one-paragraph rule of
 * `copyBudget.test.tsx` does not fit them; what holds is that no single paragraph is a wall.
 */
import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

import RanchScreen from '../screens/RanchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CodexScreen, { type CodexPage } from '../screens/CodexScreen';
import battleReducer from '../store/battleSlice';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import uiReducer from '../store/uiSlice';
import { MAX_PARAGRAPH_CHARS, readCopy } from './copyBudget';

function render(tree: ReactNode): string {
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        preloadedState: { game: createEmptyRanch() } as unknown as undefined,
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    return renderToStaticMarkup(<Provider store={store}>{tree}</Provider>);
}

function tooLong(markup: string): string[] {
    return readCopy(markup).paragraphs.filter((p) => p.length > MAX_PARAGRAPH_CHARS).map((p) => `${p.length}: ${p.slice(0, 60)}`);
}

describe('long-copy screens keep every paragraph short', () => {
    it('settings', () => {
        expect(tooLong(render(<SettingsScreen />))).toEqual([]);
    });

    it('the vault, empty', () => {
        expect(tooLong(render(<RanchScreen initialSection="vault" />))).toEqual([]);
    });

    for (const page of ['overview', 'cards', 'species', 'firmware', 'statuses'] as CodexPage[]) {
        it(`the codex, ${page} page`, () => {
            const codex = { seen: [], played: [], species: [], assembled: [], os: [] };
            expect(tooLong(render(<CodexScreen codex={codex} firedMilestones={[]} initialPage={page} />))).toEqual([]);
        });
    }
});
