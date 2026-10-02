/**
 * TICKET 180c — a game bug that throws inside a fight does not lose the session.
 *
 * The fight engine is the game's own code. When it throws (seed ps2 does, today: a status tick hands
 * a stub card to a Driver's hook condition), the playtester cuts the run short, keeps the error for
 * the report, and the session file still replays. The throw is injected here so the test does not
 * depend on that particular bug staying unfixed.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('./battleSim', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./battleSim')>()),
    autoPlay: () => { throw new TypeError('boom from the engine'); },
}));

import { currentScreen } from './screen';
import { freshWorld } from './testKit';
import { replayWorld, stateHash, applyMove } from './world';
import { runOf } from './types';

describe('180c — an engine error mid-fight', () => {
    it('ends the run as abandoned, keeps the message, and the end screen says so', () => {
        const world = freshWorld();
        applyMove(world, { key: currentScreen(world).moves[0].key, why: 'test' });
        expect(runOf(world).phase).toBe('ended');
        expect(runOf(world).outcome).toBe('abandoned');
        expect(world.view.engineError).toContain('boom from the engine');
        const screen = currentScreen(world);
        expect(screen.id).toBe('end');
        expect(screen.body.join('\n')).toContain('boom from the engine');
    });

    it('the session still replays to the same state', () => {
        const world = freshWorld();
        applyMove(world, { key: currentScreen(world).moves[0].key, why: 'test' });
        expect(stateHash(replayWorld(world.header, world.log))).toBe(stateHash(world));
    });
});
