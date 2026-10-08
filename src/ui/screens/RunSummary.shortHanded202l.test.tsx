/**
 * TICKET 202l — the run summary prints the short-handed line after "Reached biome ...", and only then.
 * Same static-markup shape as `RunSummary.test.tsx`.
 */
import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import RunSummary from './RunSummary';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import type { IRunState, RunOutcome } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';

const MEMBER: IMingmingState = { id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10 };
const BASE = createRun({ seed: 'summary-204', offer: offerGyms('offer-204')[0], party: [MEMBER], startedAt: 1_700_000_000_000 });
const GYM = BASE.nodes.find((n) => n.kind === 'gym')!;

function render(outcome: RunOutcome, partyIds: string[]): string {
    const run: IRunState = { ...BASE, phase: 'ended', outcome, currentNodeId: GYM.id, partyIds };
    const store = configureStore({
        reducer: { game: gameReducer, run: runReducer },
        preloadedState: { game: { ...createEmptyRanch(), roster: [{ id: 'mm1', definitionId: 'kraken', activeOS: 'kraken_v1', attackIV: 10, defenseIV: 10, hpIV: 10 }] }, run: { run } },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    return renderToStaticMarkup(<Provider store={store}><RunSummary run={run} endedAt={1_700_000_600_000} /></Provider>);
}

describe('202l — RunSummary, short-handed at the gym', () => {
    it('a solo defeat at the gym says so, after how far the run got', () => {
        const markup = render('defeat', ['mm1']);
        expect(markup).toContain('data-testid="short-handed-line"');
        expect(markup).toContain('You fought the gym&#x27;s three with one.');
        expect(markup.indexOf('Reached biome')).toBeLessThan(markup.indexOf('short-handed-line'));
    });

    it('a full team, or a win, prints no such line', () => {
        expect(render('defeat', ['mm1', 'mm2', 'mm3'])).not.toContain('short-handed-line');
        expect(render('victory', ['mm1'])).not.toContain('short-handed-line');
    });
});
