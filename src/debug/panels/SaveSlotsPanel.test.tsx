/**
 * Smoke coverage for the slots panel, in the shape `SnapshotPanel.test.tsx` established:
 * the repo has no `@testing-library/react` and the default vitest environment is `node`, so
 * this renders to static markup rather than mounting. That is enough to prove the panel's
 * imports resolve (no cycle back through `DebugRoot`), that it reads the active slot out of
 * storage, and that the destructive affordances stay out of the mid-battle floating layer.
 *
 * The behaviour that actually matters — switching without cross-writing, and clearing a live
 * battle first — is covered headlessly in `src/debug/saveSlots.test.ts`.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

const backing: Record<string, string> = {};
vi.stubGlobal('localStorage', {
    getItem: (key: string) => backing[key] ?? null,
    setItem: (key: string, value: string) => {
        backing[key] = value;
    },
    removeItem: (key: string) => {
        delete backing[key];
    },
    clear: () => {
        Object.keys(backing).forEach((k) => delete backing[k]);
    },
    get length() {
        return Object.keys(backing).length;
    },
    key: (i: number) => Object.keys(backing)[i] ?? null,
});

import battleReducer from '../../ui/store/battleSlice';
import gameReducer from '../../ui/store/gameSlice';
import { createSlot, renameSlot } from '../../engine/SaveSlots';
import type { DebugPresentation } from '../debugUI';
import SaveSlotsPanel from './SaveSlotsPanel';

function render(presentation: DebugPresentation): string {
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
    });
    return renderToStaticMarkup(
        <Provider store={store}>
            <SaveSlotsPanel presentation={presentation} />
        </Provider>,
    );
}

describe('SaveSlotsPanel', () => {
    it('renders the active slot and its storage key', () => {
        renameSlot('slot_1', 'Real Save');
        const markup = render('docked');

        expect(markup).toContain('ACTIVE SLOT: slot_1');
        expect(markup).toContain('mingming_save__slot_1');
        expect(markup).toContain('Real Save');
    });

    it('offers a switch button for every non-active slot', () => {
        createSlot('scratch');
        const markup = render('docked');

        expect(markup).toContain('scratch');
        expect(markup.match(/switch/g)?.length).toBeGreaterThan(0);
        expect(markup).toContain('branch this run');
    });

    it('keeps create/branch/rename/delete out of the floating layer', () => {
        createSlot('scratch');
        const markup = render('floating');

        expect(markup).toContain('ACTIVE SLOT');
        expect(markup).not.toContain('branch this run');
        expect(markup).not.toContain('confirm delete');
        expect(markup).toContain('docked-only');
    });
});
