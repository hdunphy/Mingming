/**
 * TICKET 181c — where the "Tell Henry how it went" button shows, and where it does not.
 *
 * Static markup, the house pattern for screens. The template comes from `VITE_FEEDBACK_FORM_URL`,
 * which the deploy workflow sets; it is stubbed here, and a run with it unset is a local or dev
 * build, which must show no button on either screen.
 */
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import RunSummary from '../screens/RunSummary';
import SettingsScreen from '../screens/SettingsScreen';
import battleReducer from '../store/battleSlice';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import uiReducer from '../store/uiSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import type { IRunState, RunOutcome } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';

const TEMPLATE = 'https://example.test/form?b={build}&s={starter}&r={reached}&n={run}&m={minutes}';
const BUTTON = 'Tell Henry how it went';
const STARTED_AT = 1_700_000_000_000;

const MEMBER: IMingmingState = {
    id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
};
const BASE = createRun({ seed: 'feedback-button-seed', offer: offerGyms('offer-seed')[0], party: [MEMBER], startedAt: STARTED_AT });

function ended(outcome: RunOutcome): IRunState {
    return { ...BASE, phase: 'ended', outcome };
}

function store(run: IRunState | null) {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        preloadedState: {
            game: {
                ...createEmptyRanch(),
                roster: [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 }],
                runsCompleted: 2,
            },
            run: { run },
        },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
}

function summary(outcome: RunOutcome): string {
    const run = ended(outcome);
    return renderToStaticMarkup(
        <Provider store={store(run)}><RunSummary run={run} endedAt={STARTED_AT + 30 * 60_000} /></Provider>,
    );
}

function settings(): string {
    return renderToStaticMarkup(<Provider store={store(null)}><SettingsScreen /></Provider>);
}

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('no template: no button', () => {
    it('shows no feedback button on the run summary or in Settings', () => {
        vi.stubEnv('VITE_FEEDBACK_FORM_URL', '');
        expect(summary('defeat')).not.toContain(BUTTON);
        expect(summary('victory')).not.toContain(BUTTON);
        expect(settings()).not.toContain(BUTTON);
    });
});

describe('with the template', () => {
    it('the run summary shows the button for a win and for a loss, beside the leave button', () => {
        vi.stubEnv('VITE_FEEDBACK_FORM_URL', TEMPLATE);
        for (const outcome of ['victory', 'defeat'] as const) {
            const markup = summary(outcome);
            expect(markup, outcome).toContain(BUTTON);
            expect(markup, outcome).toContain('Back to ranch');
        }
    });

    it('Settings shows the same button', () => {
        vi.stubEnv('VITE_FEEDBACK_FORM_URL', TEMPLATE);
        expect(settings()).toContain(BUTTON);
    });
});
