/**
 * TICKET 180c — a whole `run`-mode session reaches the end of the run, and no screen is unknown.
 *
 * The policy is deliberately plain: take the first card on offer, walk the first road, look in
 * every stall once and leave, answer the first event choice, begin every gauntlet fight. What the
 * test asserts is the structure: every screen the run lands on is one the playtester has, every
 * screen before the end has a move, and the run ends (in victory or defeat) inside a move budget.
 */
import { describe, it, expect } from 'vitest';

import { currentScreen } from './screen';
import { freshWorld } from './testKit';
import { routineMove, walkTo } from './walkKit';
import { applyMove, replayWorld, stateHash } from './world';
import type { World } from './types';
import { runOf } from './types';

const KNOWN_SCREENS = new Set(['map', 'reward', 'end', 'town', 'market', 'workshop', 'event', 'gauntlet', 'boundary', 'loadout', 'battle']);
const MOVE_BUDGET = 3000;

function playToTheEnd(world: World): { screens: Set<string>; moves: number } {
    const screens = new Set<string>();
    const tried = new Set<string>();
    let moves = 0;
    while (runOf(world).phase !== 'ended' && moves < MOVE_BUDGET) {
        const screen = currentScreen(world);
        screens.add(screen.id);
        expect(KNOWN_SCREENS.has(screen.id), `unknown screen "${screen.id}"`).toBe(true);
        expect(screen.moves.length, `a "${screen.id}" screen with no legal move`).toBeGreaterThan(0);
        const key = routineMove(screen, tried, world);
        // A step that repeats itself (a stall that will not let us go) must not spin forever.
        if (screen.id === 'event' || screen.id === 'reward') tried.add(key);
        else tried.clear();
        applyMove(world, { key, why: 'test' });
        moves += 1;
    }
    return { screens, moves };
}

/** Look in a market, a workshop (both are a town now) and an event on the way, then on to the gym, as a thorough player would. */
const TOUR = ['marketplace', 'workshop', 'event', 'gym'] as const;

describe('180c — a whole run, start to end', () => {
    const seen = new Set<string>();

    for (const seed of ['ps22', 'ps26', 'ps3']) {
        it(`seed ${seed}: tours the stalls, reaches the end of the run, no unknown screen`, () => {
            const world = freshWorld({ seed });
            for (const kind of TOUR) {
                if (!walkTo(world, kind)) break;
                seen.add(currentScreen(world).id);
                // Step back out to the square: a town is the market and the workshop behind one door each.
                if (currentScreen(world).id === 'market') {
                    applyMove(world, { key: 'town:square', why: 'test' });
                    seen.add(currentScreen(world).id);
                }
            }
            const { screens, moves } = playToTheEnd(world);
            for (const id of screens) seen.add(id);
            expect(runOf(world).phase, `still going after ${moves} moves`).toBe('ended');
            expect(currentScreen(world).id).toBe('end');
        });
    }

    // 180d: the same walk with the agent in the fight (the game's own AI choosing the player's moves).
    for (const [mode, seed] of [['turn', 'ps22'], ['card', 'ps26']] as const) {
        it(`${mode} mode, seed ${seed}: plays its own battles to the end of the run, no unknown screen`, () => {
            const world = freshWorld({ seed, mode, budget: 100_000 });
            for (const kind of TOUR) {
                if (!walkTo(world, kind, 3000)) break;
            }
            const { screens, moves } = playToTheEnd(world);
            expect(screens.has('battle') || runOf(world).phase === 'ended').toBe(true);
            expect(runOf(world).phase, `still going after ${moves} moves`).toBe('ended');
            expect(currentScreen(world).id).toBe('end');
            // every battle move, its generated cards and its random ids included, replays to the same state
            expect(stateHash(replayWorld(world.header, world.log))).toBe(stateHash(world));
        });
    }

    it('between them the runs used every kind of screen the tool has', () => {
        // 176c: a town is the market and the workshop in one node, opening on a square with a door to each.
        for (const id of ['town', 'market', 'workshop', 'event', 'gauntlet']) expect(seen.has(id), id).toBe(true);
    });

    it('the same session replays to the same state', () => {
        const world = freshWorld({ seed: 'ps22' });
        for (const kind of TOUR) if (!walkTo(world, kind)) break;
        playToTheEnd(world);
        expect(stateHash(replayWorld(world.header, world.log))).toBe(stateHash(world));
    });
});
