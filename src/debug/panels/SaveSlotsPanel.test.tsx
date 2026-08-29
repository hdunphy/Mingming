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
    it('renders the active slot and BOTH of its storage keys', () => {
        // Ticket 23: a slot is two keys now — the ranch that persists and the run in progress.
        renameSlot('slot_1', 'Real Save');
        const markup = render('docked');

        expect(markup).toContain('ACTIVE SLOT: slot_1');
        expect(markup).toContain('mingming_ranch__slot_1');
        expect(markup).toContain('mingming_run__slot_1');
        expect(markup).toContain('Real Save');
    });

    it('offers a switch button for every non-active slot', () => {
        createSlot('scratch');
        const markup = render('docked');

        expect(markup).toContain('scratch');
        expect(markup.match(/switch/g)?.length).toBeGreaterThan(0);
        expect(markup).toContain('Copy current save');
    });

    it('labels the create controls as what they do, not as jargon', () => {
        const markup = render('docked');

        // These were `new slot` / `create empty` / `branch this run`, which read as reference
        // documentation rather than buttons — the panel was twice searched and twice missed.
        expect(markup).toContain('+ new save slot');
        expect(markup).toContain('Create fresh save');
        expect(markup).toContain('Copy current save');
    });

    it('offers slot creation in the floating layer too', () => {
        createSlot('scratch');
        const markup = render('floating');

        expect(markup).toContain('ACTIVE SLOT');
        // A control that exists or vanishes depending on how the layer was opened is its own
        // confusion, so creating is available from both presentations.
        expect(markup).toContain('Create fresh save');
        expect(markup).toContain('Copy current save');
    });

    it('still keeps rename and delete docked-only', () => {
        createSlot('scratch');
        const markup = render('floating');

        expect(markup).not.toContain('confirm delete');
        expect(markup).not.toContain('new name');
        expect(markup).toContain('docked-only');
    });
});
