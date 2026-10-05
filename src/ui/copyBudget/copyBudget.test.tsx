// @vitest-environment jsdom
/**
 * TICKET 182a — THE COPY BUDGET TEST.
 *
 * Renders each main screen in a new-player state (one starter, nothing else held) and fails if a
 * `<p>` is longer than 140 characters or a screen has more than one `<p>`. Henry, 2026-10-01: *"The
 * game currently looks like a generic Claude web app and is AI sloppy because of all the heavy
 * text."* This test is what stops the paragraphs coming back.
 *
 * Hover text and screen-reader-only text do not count (see `copyBudget.ts`). Each screen is added by
 * the row of 182a that cut its copy, so a screen listed here has already been cut.
 */

import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';

import MainMenuView from '../components/MainMenuView';
import RanchScreen from '../screens/RanchScreen';
import RunScreen from '../screens/RunScreen';
import MarketplaceNode from '../screens/MarketplaceNode';
import WorkshopNode from '../screens/WorkshopNode';
import EventNode from '../screens/EventNode';
import GauntletNode from '../screens/GauntletNode';
import RunSummary from '../screens/RunSummary';
import RunStart from '../screens/RunStart';
import { runForecast } from '../../engine/run/runForecast';
import { gymSignatures } from '../../engine/run/gauntlet';
import { plain } from '../labels/labels';
import { createRun } from '../../engine/run/createRun';
import { offerGyms } from '../../engine/run/gyms';
import { ALL_TIP_IDS } from '../../engine/tips';
import { createRanchMember } from '../../engine/gameTypes';
import battleReducer from '../store/battleSlice';
import gameReducer, { createEmptyRanch } from '../store/gameSlice';
import runReducer from '../store/runSlice';
import uiReducer from '../store/uiSlice';
import { budgetProblem, readCopy } from './copyBudget';

function storeFor(game = createEmptyRanch()) {
    return configureStore({
        reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
        preloadedState: { game },
        middleware: (getDefault) => getDefault({ serializableCheck: false }),
    });
}

function render(tree: ReactNode, game = createEmptyRanch()): string {
    return renderToStaticMarkup(<Provider store={storeFor(game)}>{tree}</Provider>);
}

/** The new-player state: one starter assembled, nothing else held. */
function oneStarter() {
    return { ...createEmptyRanch(), roster: [createRanchMember('kraken', 'kraken_v1')] };
}

describe('the copy budget', () => {
    it('the starter screen is inside it', () => {
        const report = readCopy(render(<MainMenuView />));
        expect(budgetProblem(report)).toBeNull();
    });

    it('the ranch (Expedition) is inside it', () => {
        const report = readCopy(render(<RanchScreen initialSection="expedition" />, oneStarter()));
        expect(budgetProblem(report)).toBeNull();
    });

    it('the map is inside it', () => {
        const run = createRun({
            seed: 'budget-seed',
            offer: offerGyms('budget-offer')[0],
            party: [{
                id: 'm1', definitionId: 'kraken', activeOS: 'kraken_v1', blueprintsCollected: 0,
                attackIV: 10, defenseIV: 10, hpIV: 10,
            }],
            startedAt: 1,
        });
        const game = { ...oneStarter(), seenTips: [...ALL_TIP_IDS] };
        game.roster = [{ ...game.roster[0], id: 'm1' }];
        const store = configureStore({
            reducer: { battle: battleReducer, game: gameReducer, run: runReducer, ui: uiReducer },
            preloadedState: { game, run: { run } },
            middleware: (getDefault) => getDefault({ serializableCheck: false }),
        });
        const markup = renderToStaticMarkup(<Provider store={store}><RunScreen /></Provider>);
        expect(budgetProblem(readCopy(markup))).toBeNull();
    });

    it('the measurement itself: two paragraphs, or one that runs long, is over budget', () => {
        expect(budgetProblem(readCopy('<p>One.</p><p>Two.</p>'))).toMatch(/2 paragraphs/);
        expect(budgetProblem(readCopy(`<p>${'x'.repeat(141)}</p>`))).toMatch(/141 characters/);
        expect(budgetProblem(readCopy('<p>One short line.</p>'))).toBeNull();
        // Screen-reader-only text and hover text are not on screen.
        expect(budgetProblem(readCopy('<p>Seen.</p><p class="sr-only">Heard.</p><div title="a hover that is long"></div>'))).toBeNull();
    });
});

/*
 * The shops, the workshop, an event, the gym gate and the run summary (182a, last row).
 *
 * One starter, one spare Fenrir blueprint, 100 scrap: the state a new player is in the first time
 * they reach each of these nodes.
 */
describe('the copy budget - shops, den, event, gym gate, run summary', () => {
    const starter = createRanchMember('kraken', 'kraken_v1');
    const ranch = { ...createEmptyRanch(), roster: [starter], blueprints: { fenrir: 1 } };
    const member = {
        id: starter.id, definitionId: 'kraken', activeOS: 'kraken_v1',
        blueprintsCollected: 0, attackIV: 10, defenseIV: 10, hpIV: 10,
    };
    const base = createRun({ seed: 'shops-182a', offer: offerGyms('offer-seed')[0], party: [member], startedAt: 1 });

    /** The run standing on a node of the given kind, one visit in, with 100 scrap. */
    function standingOn(kind: string) {
        const node = base.nodes.find((n) => n.kind === kind) ?? base.nodes.find((n) => n.id !== base.currentNodeId)!;
        const run = {
            ...base, scrap: 100, currentNodeId: node.id,
            nodes: base.nodes.map((n) => (n.id === node.id ? { ...n, visited: n.visited + 1 } : n)),
        };
        return { run, node: run.nodes.find((n) => n.id === node.id)! };
    }

    const problem = (tree: ReactNode) => budgetProblem(readCopy(render(tree, ranch)));

    it('the market', () => {
        const { run, node } = standingOn('marketplace');
        expect(problem(
            <MarketplaceNode run={run} node={node} party={[{ definitionId: 'kraken', activeOS: 'kraken_v1' }]}
                onEditLoadout={() => undefined} onLeave={() => undefined} />,
        )).toBeNull();
    });

    it('the den, with nothing picked', () => {
        const { run, node } = standingOn('workshop');
        const markup = render(<WorkshopNode run={run} node={node} ranch={ranch} onEditLoadout={() => {}} onLeave={() => {}} />, ranch);
        expect(budgetProblem(readCopy(markup))).toBeNull();
        expect(markup).toContain('Add a Mingming to your team.');
    });

    it('the den, with a trace picked', () => {
        const { run, node } = standingOn('workshop');
        expect(problem(
            <WorkshopNode run={run} node={node} ranch={ranch} initialSpeciesId="fenrir" onEditLoadout={() => {}} onLeave={() => {}} />,
        )).toBeNull();
    });

    it('the den, retraining a member', () => {
        const { run, node } = standingOn('workshop');
        const markup = render(
            <WorkshopNode run={run} node={node} ranch={ranch} initialReflash={{ memberId: starter.id, targetOS: 'kraken_v2' }}
                onEditLoadout={() => {}} onLeave={() => {}} />, ranch);
        expect(markup).toContain('RETRAIN');
        expect(budgetProblem(readCopy(markup))).toBeNull();
    });

    it('an event', () => {
        const { run, node } = standingOn('event');
        expect(problem(
            <EventNode run={run} node={node} ranch={{ roster: [{ id: starter.id, definitionId: 'kraken' }], blueprints: {} }} onLeave={() => {}} />,
        )).toBeNull();
    });

    it('a spent event node', () => {
        const { run, node } = standingOn('event');
        const spent = { ...run, eventHistory: [{ nodeId: node.id, eventId: 'scrap_cache', choiceId: 'leave', grants: [] }] };
        expect(problem(
            <EventNode run={spent} node={node} ranch={{ roster: [{ id: starter.id, definitionId: 'kraken' }], blueprints: {} }} onLeave={() => {}} />,
        )).toBeNull();
    });

    it('the gym gate: one short note, and the rune offer says one: "Free rune: pick one" (194q)', () => {
        const { run, node } = standingOn('gym');
        const gate = {
            ...run, phase: 'gauntlet' as const,
            gauntlet: { fightIndex: 0, totalFights: 3, persistedHp: {}, downedMemberIds: [] },
        };
        const markup = render(<GauntletNode run={gate} node={node} ranch={ranch} onEditLoadout={() => {}} />, ranch);
        expect(budgetProblem(readCopy(markup))).toBeNull();
        expect(markup).toContain('Free rune: pick one');
        expect(markup).not.toMatch(/choice of two|Pick a bonus/i);
        expect(markup).not.toMatch(/<h2>[^<]*PATCH/i);
    });

    for (const outcome of ['victory', 'defeat', 'abandoned'] as const) {
        it(`the run summary after a ${outcome}`, () => {
            const run = { ...base, phase: 'ended' as const, outcome };
            expect(problem(<RunSummary run={run} endedAt={1} />)).toBeNull();
        });
    }
});

/*
 * TICKET 193j — the run-start screen's one paragraph is the run forecast, and each gym card's hover
 * carries the forecast's detail lines, boss rule included.
 */
describe('the copy budget - the run-start screen (193j)', () => {
    const markup = render(<RunStart />, { ...createEmptyRanch(), roster: [createRanchMember('kraken', 'kraken_v1')] });
    const forecast = runForecast(offerGyms('any-seed')[0].biomes, 'gym_emberfall');

    it('is inside the budget', () => {
        expect(budgetProblem(readCopy(markup))).toBeNull();
    });

    it('its one paragraph is the forecast, not the old one-liner', () => {
        expect(readCopy(markup).paragraphs).toEqual([forecast.sentence]);
        expect(markup).not.toContain('Beat the gym leader at the end of the road.');
    });

    it('each gym card\'s hover has the gauntlet shape and that gym\'s boss rule', () => {
        const hovers = [...markup.matchAll(/title="([^"]*)"/g)].map((m) => m[1].replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"'));
        for (const offer of offerGyms('any-seed')) {
            const [signature] = gymSignatures(offer.gym.id, offer.biomes);
            const line = plain(`Boss rule, ${signature.name}: ${signature.description}`);
            expect(hovers.some((h) => h.includes(line) && /fights in a row/.test(h)), offer.gym.id).toBe(true);
        }
    });
});
