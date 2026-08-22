/**
 * Smoke coverage for the scenario launcher panel, in the shape `SnapshotPanel.test.tsx`
 * established: the repo has no `@testing-library/react` and the default vitest environment is
 * `node`, so this renders to static markup rather than mounting. That proves the panel's
 * imports resolve (no cycle back through `DebugRoot`), that it boots off the live save and
 * the live registries, and that the destination-slot warning and the ticket-23 amendments are
 * actually on screen.
 *
 * The behaviour that matters — compose -> `buildScenarioState` -> dispatch — is covered
 * headlessly in `src/debug/scenarios/composeScenario.test.ts`.
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

import { renameSlot } from '../../engine/SaveSlots';
import type { IRanchState } from '../../engine/runTypes';
import battleReducer from '../../ui/store/battleSlice';
import gameReducer, { createEmptyRanch } from '../../ui/store/gameSlice';
import runReducer from '../../ui/store/runSlice';
import { DebugUIContext, setActivePanel, setLastScenarioName, setOpen, toggleOpen } from '../debugUI';
import type { DebugPresentation, DebugUIContextValue } from '../debugUI';
import ScenarioLauncherPanel from './ScenarioLauncherPanel';

// Ticket 11: the panel reads `state.run.run` as well as `state.game`, so the throwaway store needs
// the run slice. `run: null` is the normal state — you are at the ranch.
function render(presentation: DebugPresentation = 'docked', ranch?: Partial<IRanchState>): string {
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer },
        preloadedState: ranch ? { game: { ...createEmptyRanch(), ...ranch } } : undefined,
        middleware: (getDefaultMiddleware) => getDefaultMiddleware({ serializableCheck: false }),
    });

    const debugUI: DebugUIContextValue = {
        isOpen: true,
        activePanel: 'launcher',
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
                <ScenarioLauncherPanel presentation={presentation} />
            </DebugUIContext.Provider>
        </Provider>,
    );
}

describe('ScenarioLauncherPanel', () => {
    it('names the save slot the battle will end into, next to Launch', () => {
        renameSlot('slot_1', 'Real Save');
        const markup = render();

        expect(markup).toContain('This battle will end into your &quot;Real Save&quot; save (slot_1).');
        // Ticket 11 split the destination in two, and the banner has to say both halves: the
        // ranch takes the blueprints and the gym clears, the run takes the scrap and the cards.
        expect(markup).toContain('writes blueprints and gym clears into that save');
        expect(markup).toContain('into whatever run is in progress');
        expect(markup).toContain('LAUNCH BATTLE INTO REAL SAVE');
    });

    it('lets you retarget the slot without leaving the panel', () => {
        renameSlot('slot_1', 'Real Save');
        const markup = render();

        // The gap this closes: the banner used to name a slot and then send you elsewhere to
        // change it, which is the one moment you actually want the control to hand.
        expect(markup).toContain('launch into');
        expect(markup).toContain('aria-label="destination save slot"');
        expect(markup).toContain('+ new scratch slot');
        expect(markup).toContain('Real Save (slot_1)');
        // Destructive slot management deliberately stays in one place.
        expect(markup).toContain('Branch / rename / delete live in the');
    });

    it('shows the three columns with the JSON pane visible by default', () => {
        const markup = render();

        expect(markup).toContain('PLAYER');
        expect(markup).toContain('ENEMIES');
        expect(markup).toContain('ComposedSetup');
        // Ticket 23 amendment: the JSON column is collapsible, and starts open.
        expect(markup).toContain('hide');
        expect(markup).toContain('&quot;enemyMode&quot;: &quot;MOVES&quot;');
    });

    it('offers base decks and saved deck only — ad-hoc mode is cut', () => {
        const markup = render();

        expect(markup).toContain('Base decks');
        // Ticket 11 renamed the second mode: it reads `IRunState.deck` now, and DeckTerminal —
        // the screen the old label pointed at — no longer exists.
        expect(markup).toContain('Run deck');
        expect(markup).not.toContain('Ad-hoc');
        expect(markup).not.toContain('DeckTerminal');
    });

    it('keeps relics, and says they override game state', () => {
        const markup = render();

        expect(markup).toContain('RELICS');
        expect(markup).toContain('Expansion Slot');
        expect(markup).toContain('is never read from game state');
    });

    it('boots mirrored off the ranch roster with one enemy, using live registry pickers', () => {
        // Ticket 11: with no run in progress there is no party to mirror, so `mirrorSaveParty`
        // falls back to the head of the roster — which is what this store has.
        const markup = render('docked', {
            roster: [
                {
                    id: 'r1',
                    definitionId: 'kraken',
                    attackIV: 31,
                    defenseIV: 31,
                    hpIV: 31,
                    activeOS: 'kraken_v2',
                },
            ],
        });

        expect(markup).toContain('&quot;definitionId&quot;: &quot;kraken&quot;');
        // Enemy side defaults to one unit so the form is launchable immediately.
        expect(markup).toContain('&quot;definitionId&quot;: &quot;draugr&quot;');
        // The species select is the real registry, not the mockup's hardcoded list.
        expect(markup).toContain('Jormungandr');
        expect(markup).toContain('kraken_v2');
    });

    it('blocks launch, in words, when there is no party to launch with', () => {
        const markup = render();

        expect(markup).toContain('No player party members');
        expect(markup).toContain('disabled');
    });

    it('offers the seed, enemy mode, gauntlet and file controls', () => {
        const markup = render();

        expect(markup).toContain('blank = roll a random seed on launch');
        expect(markup).toContain('⟳ Roll');
        expect(markup).toContain('CARDS');
        expect(markup).toContain('GAUNTLET CONTEXT');
        expect(markup).toContain('.scenario.json');
        expect(markup).toContain('Save composition');
        expect(markup).toContain('type="file"');
    });

    it('renders in the floating presentation too', () => {
        expect(render('floating')).toContain('LAUNCH BATTLE INTO');
    });
});
