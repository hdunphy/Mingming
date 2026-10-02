/**
 * THE RUN SUMMARY, RENDERED — ticket 19.
 *
 * `runSummary.test.ts` proves the arithmetic and `runTeardown.test.ts` proves what the button does.
 * What is left is the failure neither can catch: **numbers that do not match the run they claim to
 * describe.** A summary showing the right figures for the wrong run is worse than one showing none,
 * because a playtester writes them down and ticket 25 believes them.
 *
 * Rendered to static markup, the shape every panel test in this repo uses: there is no
 * `@testing-library/react`, and `renderToStaticMarkup` runs no effects — which is fine here and
 * pointed out rather than worked around, because the one effect on this screen is the telemetry
 * write, and `runTelemetry.test.ts` owns that against a fake `ISaveStorage`.
 *
 * `endedAt` is injected on every render below. That prop exists for exactly this: a duration read
 * from the wall clock is a duration no test can assert, which is the same reason `createRun` takes
 * `startedAt` rather than reading it.
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
import { GYM_REGISTRY } from '../../engine/run/gyms';
import { blueprintBankedModifier } from '../../engine/run/runSummary';
import type { IRanchMember, IRunState, RunOutcome } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';

const STARTED_AT = 1_700_000_000_000;

const MEMBER: IMingmingState = {
    id: 'mm1',
    definitionId: 'kraken',
    activeOS: 'kraken_v1',
    blueprintsCollected: 0,
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
};

const ROSTER: IRanchMember[] = [{
    id: 'mm1',
    definitionId: 'kraken',
    activeOS: 'kraken_v1',
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
}];

const BASE = createRun({
    seed: 'summary-screen-seed',
    offer: offerGyms('offer-seed')[0],
    party: [MEMBER],
    startedAt: STARTED_AT,
});

function ended(outcome: RunOutcome, over: Partial<IRunState> = {}): IRunState {
    return { ...BASE, phase: 'ended', outcome, ...over };
}

function render(run: IRunState, endedAt = STARTED_AT + 42 * 60_000 + 13_000): string {
    const store = configureStore({
        reducer: { game: gameReducer, run: runReducer },
        preloadedState: {
            game: { ...createEmptyRanch(), roster: ROSTER },
            run: { run },
        },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    return renderToStaticMarkup(
        <Provider store={store}>
            <RunSummary run={run} endedAt={endedAt} />
        </Provider>,
    );
}

/*
 * TICKET 182a — THE SUMMARY IS THREE LINES AND A BUTTON.
 *
 * The pacing grid (time, fights, deck and picked cards against their targets, the scrap balance) and
 * the two explanatory paragraphs are cut: the player wants what they kept, how far they got, and what
 * it unlocked. The run clock and the rest still reach the telemetry entry on mount - only the screen
 * stopped printing them.
 */
describe('RunSummary — three large lines, led by what you kept', () => {
    it('leads with the traces the run banked, with counts, as "You kept: ..."', () => {
        const markup = render(ended('victory', {
            modifiers: ['reveal:biome:0', ...['kraken', 'kraken', 'fenrir'].map(blueprintBankedModifier)],
        }));
        expect(markup).toContain('You kept: Kraken trace ×2, Fenrir trace');
        // The kept line is the first of the lines, ahead of the others.
        expect(markup.indexOf('You kept')).toBeLessThan(markup.indexOf('Reached biome'));
    });

    it('says "nothing this time" rather than showing an empty row', () => {
        expect(render(ended('defeat'))).toContain('You kept: nothing this time');
    });

    it('prints how far the run got and how many fights it took', () => {
        const inBiomeTwo = BASE.nodes.find((n) => n.biomeIndex === 1)!;
        const markup = render(ended('defeat', { currentNodeId: inBiomeTwo.id, fightsResolved: 11 }));
        expect(markup).toContain('Reached biome 2 of 3');
        expect(markup).toContain('11 fights');
    });

    it('says the gym is cleared on a victory and not cleared on the other two', () => {
        const gymName = GYM_REGISTRY[BASE.gymId]?.name ?? BASE.gymId;
        expect(render(ended('victory', { tier: 1 }))).toContain(`${gymName} cleared · tier 1 unlocked`);
        expect(render(ended('defeat'))).toContain(`${gymName} not cleared`);
        expect(render(ended('abandoned'))).toContain(`${gymName} not cleared`);
    });

    it('has exactly three lines, whatever the outcome', () => {
        for (const outcome of ['victory', 'defeat', 'abandoned'] as const) {
            expect(render(ended(outcome)).match(/class="rs-big-line[ "]/g)).toHaveLength(3);
        }
    });

    it('is one button, "Back to ranch", and no paragraphs at all', () => {
        const markup = render(ended('defeat'));
        expect(markup.match(/<button/g)).toHaveLength(1);
        expect(markup).toContain('Back to ranch');
        expect(markup).not.toMatch(/<p[ >]/);
    });

    it('does not print the pacing grid, the receipt heading or the two notes any more', () => {
        const markup = render(ended('victory', { fightsResolved: 11, scrap: 37 }));
        for (const gone of ['rs-grid', 'Cards picked', 'Scrap left', 'target ', 'Banked at the ranch',
            'What the run took with it', 'These were banked as they dropped', 'The deck, the scrap']) {
            expect(markup, gone).not.toContain(gone);
        }
    });
});

describe('RunSummary — the tier and modifiers appear only when there are some (ticket 169f, kept)', () => {
    it('names the tier and the modifiers on the "reached" line when there are any', () => {
        const markup = render(ended('defeat', { tier: 2, modifiers: ['mod:junk_start', 'mod:tight_budget'] }));
        expect(markup).toContain('tier 2');
        expect(markup).toContain('Junk Start, Tight Budget');
    });

    it('says nothing about a tier on a plain tier-0 run', () => {
        expect(render(ended('defeat'))).not.toMatch(/tier 0/);
    });
});
