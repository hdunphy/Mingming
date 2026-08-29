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
import { ALL_TIP_IDS } from '../../engine/tips';
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

/**
 * `seenTips` defaults to "already taught" so that ticket 24's map callout is opt-in per test: every
 * assertion in this file predates it and is about the node, not the tutorial. The two tests that
 * ARE about the tutorial pass `[]` explicitly.
 */
function render(run: IRunState, seenTips: ReadonlyArray<string> = ALL_TIP_IDS): string {
    const store = configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer },
        preloadedState: {
            game: { ...createEmptyRanch(), roster: ROSTER, seenTips: [...seenTips] },
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
    it('gives the marketplace the WHOLE screen, map chrome and all (tickets 13, 63)', () => {
        /*
         * Two rulings stacked here, and the second reversed the first.
         *
         * Ticket 13 made the shop a PANEL over the map, on the argument that *"a market is not a
         * mode you are trapped in, it is a thing at the place you are standing"* — so it had no
         * LEAVE button, because there was nothing to leave. Ticket 63's ruled mockup
         * (`market_G_stall.html`) is a full frame with its own top bar, an always-visible sell
         * column and a LEAVE, and it has to be: a stall that wide does not fit beside a map.
         *
         * So the assertion is inverted rather than dropped. The map's own chrome — the seed line,
         * the canvas, the abandon control — must be ABSENT, which is the half a well-meant "keep
         * the header for context" patch would break, and is the whole difference between the two
         * rulings.
         */
        const markup = render(standingOn('marketplace'));

        expect(markup).not.toContain('nothing here yet');
        expect(markup).toContain('MARKETPLACE');
        expect(markup).toContain('STOCK');
        expect(markup).toContain('LEAVE');
        // Ticket 61 §3: the stall is one of the four doors to the shared editor.
        expect(markup).toContain('EDIT LOADOUT');
        // The map is not underneath it any more.
        expect(markup).not.toContain('rm-canvas');
        expect(markup).not.toContain('Abandon run');
        // Ticket 61 §5 replaced the 20-25 TARGET with an enforced floor, and printing an aspiration
        // beside a minimum invites the player to read the aspiration as the rule.
        expect(markup).not.toContain('target 20');
        expect(markup).toContain('floor');
    });

    it('does NOT open the shop on any other kind of node', () => {
        // The route into the stall is one `isMarketNode` call, and it is worth pinning that the
        // bay next door does not answer to it.
        expect(render(standingOn('workshop'))).not.toContain('REROLL');
    });

    it('gives the workshop the whole screen too (tickets 14, 65)', () => {
        // Same inversion as the stall above, for the same reason: `workshop_I_bay.html` is three
        // columns around a lit assembly stage and does not fit beside a map either.
        const markup = render(standingOn('workshop'));

        expect(markup).not.toContain('nothing here yet');
        expect(markup).not.toContain('ticket 14');
        expect(markup).toContain('WORKSHOP');
        expect(markup).toContain('BLUEPRINTS');
        expect(markup).toContain('LEAVE');
        expect(markup).toContain('EDIT LOADOUT');
        expect(markup).not.toContain('rm-canvas');
        // The one thing this node must say that no other node can: the party grows here and only
        // here (ticket 06), with the count beside it.
        expect(markup).toContain('PARTY 1/3');
        expect(markup).toContain('only place the party grows');
    });

    it('does NOT open the workshop on any other kind of node', () => {
        expect(render(standingOn('marketplace'))).not.toContain('BLUEPRINTS');
    });

    it('says nothing of the kind on a fight node', () => {
        // A wild's contents are not pending — they are a battle, and `App` swaps this screen for
        // `BattleArena` while it runs.
        const markup = render(standingOn('wild'));
        expect(markup).not.toContain('nothing here yet');
    });

    it('shows the map, the party and the run’s seed while on the map', () => {
        // A plain node, now that the stall and the bay take the whole screen. `event` is the one
        // kind still in `PENDING_NODE_TICKET`, so it is the map's own chrome and nothing else.
        const markup = render(standingOn('event'));
        expect(markup).toContain('run-screen-seed');
        expect(markup).toContain('fights');
        expect(markup).toContain('rm-canvas');
    });

    it('offers the way back into a stall the player closed with LEAVE', () => {
        /*
         * LEAVE is what ticket 63's full-screen stall costs, and this button is what keeps ticket
         * 13's argument true anyway: *"there is nothing to leave"* — the node is not spent, you are
         * still standing on it, and the map offers a way straight back in. Without this the LEAVE
         * button would be a one-way door out of a node the player has not finished with, which is
         * the opposite of what ticket 07 makes a market.
         *
         * Rendered by clicking LEAVE, which `renderToStaticMarkup` cannot do — so this asserts the
         * copy exists in the module rather than the state, and `RunScreen`'s `closedNodeId` is what
         * routes to it. Flagged as the one branch here that a click test (ticket 58's jsdom shape)
         * should take over.
         */
        const markup = render(standingOn('marketplace'));
        // The stall is open, so the way back in is NOT on screen — it is the closed state's copy.
        expect(markup).not.toContain('Back to the stall');
        expect(markup).toContain('LEAVE');
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
        // ...and an ordinary node still does. `event` rather than `marketplace` since ticket 63:
        // the stall takes the whole screen too now, so it is no longer the control case for "the
        // map is still there" — see the stall's own test for the inversion.
        expect(render(standingOn('event'))).toContain('rm-canvas');
    });
});

/**
 * THE RUN END — ticket 19.
 *
 * `runTeardown.test.ts` proves what *leaving* this screen does to the ranch and `runSummary.test.ts`
 * proves the arithmetic. What is left, and is a different failure, is whether **all three endings
 * reach the summary at all** and whether the placeholder ticket 11 left is gone rather than merely
 * accompanied — a screen that shows both is a screen nobody updated.
 */
describe('RunScreen — the run is over', () => {
    const ended = (outcome: RunOutcome, over: Partial<IRunState> = {}): IRunState =>
        standingOn('wild', { phase: 'ended', outcome, ...over });

    for (const outcome of ['victory', 'defeat', 'abandoned'] as const) {
        it(`routes a ${outcome} to the summary, with one way out`, () => {
            const markup = render(ended(outcome));

            expect(markup).toContain('Return to the ranch');
            expect(markup).toContain('Banked at the ranch');
            expect(markup).not.toContain('The full run summary is ticket 19');
        });
    }

    it('names each ending in its own words', () => {
        expect(render(ended('victory'))).toContain('Gym cleared');
        expect(render(ended('defeat'))).toContain('Run over');
        expect(render(ended('abandoned'))).toContain('Run abandoned');
    });

    it('never repeats the wipe the defeat screen used to promise', () => {
        // Ticket 11 removed the `deleteSave()` this screen's predecessor promised. The promise had
        // to go with it: a defeat costs the run and never the ranch.
        const markup = render(ended('defeat'));
        expect(markup).not.toMatch(/DATA WIPED/i);
        expect(markup).toContain('separate save');
    });

    it('says the blueprints were banked as they dropped, not by this screen', () => {
        // The point of that sentence: a player who reads "you earned 3 blueprints" and then loses
        // them to a crash here would be right to be angry, and they cannot be, because ticket 12
        // paid them at drop time. Only the screen can tell them so.
        expect(render(ended('defeat'))).toContain('banked as they dropped, not now');
    });

    it('does not draw the map or the abandon button once the run has ended', () => {
        const markup = render(ended('defeat'));
        expect(markup).not.toContain('Abandon run');
        expect(markup).not.toContain('rm-canvas');
    });
});

describe('RunScreen — abandoning is a two-step, not a native dialog', () => {
    it('shows the first step on the map', () => {
        // `window.confirm` is gone (ticket 19): a native modal in a game that draws its own UI,
        // unstyleable, unreachable by gamepad (ticket 38), and untestable. The first step is what
        // stands between one stray click and forty minutes.
        //
        // On a plain node, because the stall and the bay take the whole screen since tickets 63 and
        // 65 and neither of their ruled top bars carries an abandon. Quitting is still always
        // allowed — it is LEAVE and then this button, one click further away than it was.
        const markup = render(standingOn('event'));
        expect(markup).toContain('Abandon run');
        // The second step's wording appears only after that click, so a confirm that ships both
        // states at once is not a confirm.
        expect(markup).not.toContain('the run is lost');
    });

    it('keeps the way out available inside the gauntlet too', () => {
        // Quitting is always allowed; the gauntlet being a node you cannot walk *out of* is a
        // different thing from a run you cannot quit.
        const markup = render(standingOn('gym', {
            phase: 'gauntlet',
            gauntlet: { fightIndex: 0, totalFights: 3, persistedHp: {}, downedMemberIds: [] },
        }));
        expect(markup).toContain('Abandon run');
    });
});

describe('RunScreen — onboarding on the map (ticket 24)', () => {
    it('teaches the map before the gym, one tip at a time', () => {
        const fresh = render(BASE, []);
        expect(fresh).toContain('The map tells you first');
        // One at a time: the gym tip is next in line and must NOT also be on screen.
        expect(fresh).not.toContain('The gym is the run');
        expect(fresh).toContain('Skip tips');

        const next = render(BASE, ['map:types']);
        expect(next).toContain('The gym is the run');
        expect(next).not.toContain('The map tells you first');
    });

    it('says nothing once the player has been taught, or has skipped', () => {
        const markup = render(BASE, ALL_TIP_IDS);
        expect(markup).not.toContain('The map tells you first');
        expect(markup).not.toContain('Skip tips');
        // The map itself is untouched.
        expect(markup).toContain('Travel');
    });
});
