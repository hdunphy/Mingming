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
import type { IRanchMember, IRunCard, IRunState, RunOutcome } from '../../engine/runTypes';
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

const picked = (n: number): IRunCard[] => Array.from({ length: n }, (_, i) => ({
    instanceId: `bought-${i}`,
    dataId: `card_${i}`,
    ownerId: null,
}));

describe('RunSummary — the numbers match the run it is reporting', () => {
    it('prints the run clock against the 35–45 minute target', () => {
        const markup = render(ended('defeat'));
        expect(markup).toContain('42m 13s');
        expect(markup).toContain('35–45 min');
    });

    it('prints the fights resolved against the 10–13 target', () => {
        const markup = render(ended('victory', { fightsResolved: 11 }));
        expect(markup).toContain('>11<');
        expect(markup).toContain('10–13');
    });

    it('prints the deck against the 20–25 target, split into kit and picked', () => {
        // "Cards picked" IS the `ownerId: null` count — the deck-building track. The summary is the
        // one place the player learns what that track was for, so the target has to be beside it.
        const run = ended('victory', { deck: [...BASE.deck, ...picked(14)] });
        const markup = render(run);

        // Ticket 60 moved the kit half from 8 a member to 6 (4 tagged + 2 generics), so the same
        // 14 picks now land the deck on 20 rather than 22 — right on the floor of the target
        // instead of two inside it, which is the deck-building track working harder for the same
        // number of picks. The picked half is untouched, and that split is the whole screen.
        expect(markup).toContain('20 cards');
        expect(markup).toContain('20–25');
        expect(markup).toContain('>14<');       // picked
        expect(markup).toContain('+ 6 kit');    // the six the party walked in with
        expect(markup).toContain('runs open at 6/member');
    });

    it('calls the scrap figure a balance, never a spend', () => {
        // `IRunState` keeps a balance and no ledger, so a spend total would be a number this screen
        // invented. It says which one it is rather than letting the label imply the other.
        const markup = render(ended('defeat', { scrap: 37 }));
        expect(markup).toContain('>37<');
        expect(markup).toContain('balance at the end, not a spend total');
        expect(markup).not.toMatch(/scrap spent/i);
    });

    it('prints how far the run got, and the tier it was run at', () => {
        const inBiomeTwo = BASE.nodes.find((n) => n.biomeIndex === 1)!;
        const markup = render(ended('defeat', { currentNodeId: inBiomeTwo.id, tier: 2 }));

        expect(markup).toContain('biome 2 of 3');
        expect(markup).toContain(BASE.biomes[1].name);
        expect(markup).toContain('tier 2');
    });
});

describe('RunSummary — the receipt', () => {
    it('lists the blueprints this run banked, with counts', () => {
        const markup = render(ended('victory', {
            modifiers: ['reveal:biome:0', ...['kraken', 'kraken', 'fenrir'].map(blueprintBankedModifier)],
        }));

        expect(markup).toContain('×2');
        // Species names rather than ids — the ledger stores ids, the player reads names.
        expect(markup).toMatch(/Kraken|kraken/);
        expect(markup).toMatch(/Fenrir|fenrir/);
    });

    it('says "none this run" rather than showing an empty row', () => {
        expect(render(ended('defeat'))).toContain('none this run');
    });

    it('counts the codex entries the run is about to write', () => {
        const markup = render(ended('defeat'));
        const distinct = new Set(BASE.deck.map((c) => c.dataId)).size;
        expect(markup).toContain(`${distinct} card`);
        expect(markup).toContain('recorded as seen');
    });

    it('says the gym is unlocked on a victory and explicitly not on the other two', () => {
        const gymName = GYM_REGISTRY[BASE.gymId]?.name ?? BASE.gymId;

        expect(render(ended('victory', { tier: 1 }))).toContain(`${gymName} cleared`);
        expect(render(ended('defeat'))).toContain('nothing unlocked');
        expect(render(ended('abandoned'))).toContain('nothing unlocked');
    });
});
