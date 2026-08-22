/**
 * The run shell, rendered — ticket 11, part 2.
 *
 * `encounter.test.ts` covers what is in a node and `runSlice.test.ts` covers what entering one does
 * to the run. What is left, and is a different failure, is whether the screen **says** any of it. A
 * node that fired and drew nothing is indistinguishable from a node that failed to fire, and a
 * defeat screen that still promised to wipe the save would be a lie the code no longer tells.
 *
 * Rendered to static markup, the shape the panel tests established: the repo has no
 * `@testing-library/react`, and `renderToStaticMarkup` runs no effects — which is why the battle
 * trigger itself is asserted through the reducer rather than through a click here.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';

import RunScreen from './RunScreen';
import battleReducer from '../store/battleSlice';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import type { IGauntletProgress, IRanchMember, IRunState, NodeKind, RunOutcome } from '../../engine/runTypes';
import type { IMingmingState } from '../../engine/types';

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
    id: MEMBER.id,
    definitionId: MEMBER.definitionId,
    activeOS: 'kraken_v1',
    attackIV: 10,
    defenseIV: 10,
    hpIV: 10,
}];

const BASE = createRun({
    seed: 'run-screen-seed',
    offer: offerGyms('offer-seed')[0],
    party: [MEMBER],
    startedAt: 1_700_000_000_000,
});

function render(run: IRunState): string {
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer },
        preloadedState: {
            game: { ...createEmptyRanch(), roster: ROSTER },
            run: { run },
        },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
    return renderToStaticMarkup(
        <Provider store={store}>
            <RunScreen />
        </Provider>,
    );
}

/** Stand the player on the first node of a given kind, as `enterNode` would leave them. */
function standingOn(kind: NodeKind, over: Partial<IRunState> = {}): IRunState {
    const target = BASE.nodes.find((n) => n.kind === kind && n.id !== BASE.currentNodeId)!;
    return {
        ...BASE,
        currentNodeId: target.id,
        nodes: BASE.nodes.map((n) => (n.id === target.id ? { ...n, visited: n.visited + 1 } : n)),
        ...over,
    };
}

describe('RunScreen — a node that fired says so', () => {
    it('opens the shop on a marketplace instead of an apology (ticket 13)', () => {
        // Until ticket 13 this node printed "nothing here yet (ticket 13)". It now has all three
        // verbs, so the placeholder has to be gone rather than merely accompanied — a screen that
        // says both is a screen nobody updated.
        const markup = render(standingOn('marketplace'));

        expect(markup).not.toContain('nothing here yet');
        expect(markup).toContain('Marketplace');
        expect(markup).toContain('Stock');
        // The Done-when: the deck count is on screen with its target beside it.
        expect(markup).toContain('deck:');
        expect(markup).toContain('target 20');
    });

    it('does NOT open the shop on any other kind of node', () => {
        // The marketplace is a panel on the run screen rather than a route, so the guard that keeps
        // it off a workshop is one `isMarketNode` call and worth pinning.
        expect(render(standingOn('workshop'))).not.toContain('Reroll');
    });

    it('opens the workshop on a workshop instead of an apology (ticket 14)', () => {
        // Until ticket 14 this node printed "nothing here yet (ticket 14)". It has a bench now, so
        // the placeholder has to be GONE rather than merely accompanied — a screen that says both is
        // a screen nobody updated.
        const markup = render(standingOn('workshop'));

        expect(markup).not.toContain('nothing here yet');
        expect(markup).not.toContain('ticket 14');
        expect(markup).toContain('Workshop');
        expect(markup).toContain('Assemble');
        // The one thing this node must say that no other node can: the party grows here and only
        // here (ticket 06), with the count beside it.
        expect(markup).toContain('party: 1/3');
        expect(markup).toContain('only place the party grows');
    });

    it('does NOT open the workshop on any other kind of node', () => {
        expect(render(standingOn('marketplace'))).not.toContain('Reflash firmware');
    });

    it('says nothing of the kind on a fight node', () => {
        // A wild's contents are not pending — they are a battle, and `App` swaps this screen for
        // `BattleArena` while it runs.
        const markup = render(standingOn('wild'));
        expect(markup).not.toContain('nothing here yet');
    });

    it('shows the map, the party and the run’s seed while on the map', () => {
        const markup = render(standingOn('marketplace'));
        expect(markup).toContain('run-screen-seed');
        expect(markup).toContain('fights');
    });
});

/**
 * THE PIT STOP — ticket 18.
 *
 * `runSlice.gauntlet.test.ts` proves the chain and `engine/run/gauntlet.test.ts` proves who is in
 * each fight. What is left, and is a different failure, is whether the between-fights screen shows
 * the three things the ticket asks for — **HP, macros, and the next opponent's visible types** —
 * because those three are the terms of the only decision on offer here, and a screen that shows two
 * of them is a screen where the decision cannot be made.
 *
 * Effects do not run under `renderToStaticMarkup`, so the run arrives already in `phase: 'gauntlet'`
 * — which is exactly the state `beginGauntlet` writes, and the state an app close resumes into.
 */
describe('RunScreen — the gauntlet takes the screen', () => {
    const inGauntlet = (
        over: Partial<IRunState> = {},
        gauntlet: Partial<IGauntletProgress> = {},
    ): IRunState => standingOn('gym', {
        phase: 'gauntlet',
        gauntlet: {
            fightIndex: 0,
            totalFights: 3,
            persistedHp: {},
            downedMemberIds: [],
            ...gauntlet,
        },
        ...over,
    });

    it('shows which fight it is, and that nothing heals between them', () => {
        const markup = render(inGauntlet());

        expect(markup).toContain('fight 1 of 3');
        expect(markup).toContain('No healing between these three fights');
        expect(markup).toContain('Begin fight 1 of 3');
    });

    it('shows the party’s HP as the resource being managed', () => {
        const markup = render(inGauntlet({}, { fightIndex: 1, persistedHp: { mm1: 12 } }));

        expect(markup).toContain('HP carries between fights');
        expect(markup).toContain('12/');
    });

    it('calls a downed member out as revivable rather than hiding them', () => {
        // `economy-session.md`: "revivable, never gone-for-gauntlet". A member the screen drops is a
        // member the player has already written off.
        const markup = render(inGauntlet({}, { fightIndex: 1, persistedHp: { mm1: 0 }, downedMemberIds: ['mm1'] }));

        expect(markup).toContain('Down');
        expect(markup).toContain('revivable');
    });

    it('shows the macro rack, and says which macros can fire here', () => {
        const markup = render(inGauntlet({ macros: ['revive', 'ping_sweep', null] }));

        expect(markup).toContain('Revive');
        expect(markup).toContain('fires in the fight');
        // The map-reveal is the one macro that cannot fire inside the gauntlet, and its row says so
        // rather than vanishing (ticket 20's precedent: a dead affordance explains itself).
        expect(markup).toContain('fires on the map');
    });

    it('shows the next opponent as TYPES — never a species list', () => {
        // `exploration-map.md`'s visibility rule does not lapse at the last node: a roster would hand
        // over the counter-pick the run was supposed to have already made.
        const run = inGauntlet({}, { fightIndex: 2 });
        const markup = render(run);

        for (const biome of run.biomes) {
            expect(markup).toContain(biome.elements[0]);
        }
        expect(markup).toContain('signature firmware');
    });

    it('does NOT draw the region map — there is no walking out of the exam', () => {
        expect(render(inGauntlet())).not.toContain('rm-canvas');
        // ...and an ordinary node still does.
        expect(render(standingOn('marketplace'))).toContain('rm-canvas');
    });
});

describe('RunScreen — the run is over', () => {
    const ended = (outcome: RunOutcome): IRunState => standingOn('wild', { phase: 'ended', outcome });

    it('offers an honest way back to the ranch after a defeat', () => {
        const markup = render(ended('defeat'));

        expect(markup).toContain('Run over');
        expect(markup).toContain('Return to the ranch');
        // Ticket 11 removed the `deleteSave()` this screen's predecessor promised. The promise had
        // to go with it: a defeat costs the run and never the ranch.
        expect(markup).not.toMatch(/DATA WIPED/i);
        expect(markup).toContain('untouched');
    });

    it('says the gym was cleared after a victory, and points at ticket 19', () => {
        const markup = render(ended('victory'));

        expect(markup).toContain('Gym cleared');
        expect(markup).toContain('ticket 19');
    });

    it('does not draw the map or the abandon button once the run has ended', () => {
        const markup = render(ended('defeat'));
        expect(markup).not.toContain('Abandon run');
    });
});
