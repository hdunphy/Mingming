/**
 * Smoke coverage for the snapshot panel.
 *
 * The repo has no `@testing-library/react` and the default vitest environment is `node`, so
 * this renders to static markup instead of mounting: enough to prove the panel's imports
 * resolve (no `DebugRoot` cycle), that it reads the battle out of Redux, and that the
 * export affordance disables itself when there is no battle to export. The behaviour that
 * actually matters — the export/import round trip — is covered headlessly in
 * `src/debug/snapshotIO.test.ts`.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import battleReducer from '../../ui/store/battleSlice';
import { DebugUIContext, setActivePanel, setLastScenarioName, setOpen, toggleOpen } from '../debugUI';
import type { DebugUIContextValue, DebugPresentation } from '../debugUI';
import { createSparseBattleState } from '../scenarios/scenarioTestSupport';
import SnapshotPanel from './SnapshotPanel';
import type { IBattleState } from '../../engine/types';

function renderPanel(battle: IBattleState | null, presentation: DebugPresentation = 'floating') {
    const store = configureStore({
        reducer: { battle: battleReducer },
        preloadedState: {
            battle: {
                battle,
                selectedSourceId: null,
                selectedTargetId: null,
                selectedCardId: null,
            },
        },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
    });

    const debugUI: DebugUIContextValue = {
        isOpen: true,
        activePanel: null,
        lastScenarioName: null,
        presentation,
        setOpen,
        toggleOpen,
        setActivePanel,
        setLastScenarioName,
    };

    return renderToStaticMarkup(
        <Provider store={store}>
            <DebugUIContext.Provider value={debugUI}>
                <SnapshotPanel presentation={presentation} />
            </DebugUIContext.Provider>
        </Provider>,
    );
}

describe('SnapshotPanel', () => {
    it('advertises the hotkey and the import affordance', () => {
        const markup = renderPanel(null);

        expect(markup).toContain('EXPORT SNAPSHOT');
        expect(markup).toContain('IMPORT SCENARIO');
        expect(markup).toContain('Ctrl+Shift+E');
        expect(markup).toContain('type="file"');
    });

    it('disables export when there is no battle to export', () => {
        expect(renderPanel(null)).toContain('disabled');
        expect(renderPanel(null)).toContain('current battle: none');
    });

    it('reads the live battle out of Redux', () => {
        const markup = renderPanel(createSparseBattleState({ turn: 9, seed: 'a3f9c02b' }));

        expect(markup).toContain('turn 9');
        expect(markup).toContain('a3f9c02b');
    });

    it('renders in the docked presentation too', () => {
        expect(renderPanel(createSparseBattleState(), 'docked')).toContain('EXPORT SNAPSHOT');
    });
});
