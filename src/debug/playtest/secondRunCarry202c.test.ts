/**
 * TICKET 202c, decision D2 (confirmed by Henry 2026-10-08) — what run 2 carries.
 *
 * "Exactly what the game's save carries into the next run." The expected value here is built through the
 * game's own path: the ended run goes through `teardownRun` (the single path every ending takes in the
 * game, `ui/store/runTeardown.ts`) on a store of its own, and the ranch that comes out is what run 2
 * must start from. Nothing is listed by hand except the facts that make the case worth running.
 */
import { describe, expect, it } from 'vitest';

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { codexSeenFrom } from '../../engine/run/runSummary';
import { markTraceHintShown } from '../../ui/store/gameSlice';
import { endRun } from '../../ui/store/runSlice';
import { teardownRun } from '../../ui/store/runTeardown';
import { secondRunFor, beginSecondRun } from './secondRun';
import { freshWorld } from './testKit';
import { giveBlueprint, setScrap, standAt } from './walkKit';
import { buildStore, applyMove } from './world';
import type { World } from './types';
import { runOf } from './types';

const otherSpecies = (world: World): string[] => {
    const mine = world.store.getState().game.roster.map((m) => m.definitionId);
    return Object.keys(MingmingRegistry).filter((id) => !mine.includes(id) && MingmingRegistry[id].availableOS.length > 0);
};

/** Run 1 at a Den: one Trace spent on a second member, one Trace kept, the first-Trace line shown. */
function endedWorld(outcome: 'victory' | 'defeat'): World {
    const world = freshWorld({ seed: 'pt2026-10-04:5' });
    const [first, second] = otherSpecies(world);
    giveBlueprint(world, first);
    giveBlueprint(world, second);
    standAt(world, 'workshop');
    setScrap(world, 500);
    applyMove(world, { key: `workshop:assemble:${first}:${MingmingRegistry[first].availableOS[0]}:party`, why: 'a second member' });
    world.store.dispatch(markTraceHintShown());
    world.store.dispatch(endRun(outcome));
    return world;
}

/** The ranch the game's own run end leaves, built on a separate store. */
function gameRanchAfter(world: World) {
    const state = world.store.getState();
    const store = buildStore(state.game, state.run.run);
    teardownRun({ run: state.run.run!, dispatch: store.dispatch });
    return store.getState().game;
}

describe.each(['defeat', 'victory'] as const)('202c D2 — a run that ended in %s', (outcome) => {
    it('starts run 2 on the ranch the game\'s own run end gives: roster, Traces, codex and the first-Trace line', () => {
        const world = endedWorld(outcome);
        const expected = gameRanchAfter(world);
        const seen = [...codexSeenFrom(runOf(world).deck)];
        const run2 = secondRunFor(world);
        const second = beginSecondRun(world, run2);

        expect(second.store.getState().game).toEqual(expected);
        // and the facts that make this case worth running, read off the same ranch
        expect(expected.roster).toHaveLength(2);
        expect(Object.values(expected.blueprints).reduce((n, c) => n + c, 0)).toBe(1);
        expect(expected.traceHintShown).toBe(true);
        expect(expected.codex.seen).toEqual(expect.arrayContaining(seen));
        expect(expected.codex.assembled.length).toBeGreaterThan(0);
    });

    it('keeps the whole roster, a lost run\'s and a won run\'s alike, and starts the party from the starter alone', () => {
        const world = endedWorld(outcome);
        const roster = world.store.getState().game.roster;
        const second = beginSecondRun(world, secondRunFor(world));
        expect(second.store.getState().game.roster).toEqual(roster);
        expect(runOf(second).partyIds).toEqual(['mm1']);
    });

    it('carries nothing of the run itself: a new map, a new deck, the new run\'s own purse', () => {
        const world = endedWorld(outcome);
        const old = runOf(world);
        const second = beginSecondRun(world, secondRunFor(world));
        const fresh = runOf(second);
        expect(fresh.seed).toBe('pt2026-10-04:5:2');
        expect(fresh.phase).not.toBe('ended');
        expect(fresh.fightsResolved).toBe(0);
        expect(fresh.scrap).not.toBe(old.scrap);
        expect(fresh.partyIds).toHaveLength(1);
        expect(fresh.gymId).toBe(old.gymId);
        expect(second.log).toBe(world.log);
        expect(second.findings).toEqual([]);
    });
});
