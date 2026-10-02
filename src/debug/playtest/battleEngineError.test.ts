/**
 * TICKET 180d — a game bug that throws while the agent plays a card does not lose the session.
 *
 * As in `engineError.test.ts` the throw is injected, so the test does not depend on an engine bug
 * staying unfixed. The run is cut short as abandoned, the message is kept for the report, the battle
 * is closed, and the session still replays to the same state.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('./battleSim', async (importOriginal) => {
    const real = await importOriginal<typeof import('./battleSim')>();
    return {
        ...real,
        step: (state: Parameters<typeof real.step>[0], action: Parameters<typeof real.step>[1]) => {
            if (action.type === 'PLAY_PROGRAM') throw new TypeError('boom from a card');
            return real.step(state, action);
        },
    };
});

import { currentScreen } from './screen';
import { freshWorld } from './testKit';
import { applyMove, replayWorld, stateHash } from './world';
import { runOf } from './types';

const playOneCard = () => {
    const world = freshWorld({ mode: 'turn' });
    applyMove(world, { key: currentScreen(world).moves[0].key, why: 'test' });
    expect(currentScreen(world).id).toBe('battle');
    const play = currentScreen(world).moves.find((m) => m.key.startsWith('battle:play:'))!;
    applyMove(world, { key: play.key, why: 'test' });
    return world;
};

describe('180d — an engine error mid-battle', () => {
    it('ends the run as abandoned, closes the battle, keeps the message, and the end screen says so', () => {
        const world = playOneCard();
        expect(world.view.battle).toBeNull();
        expect(runOf(world).outcome).toBe('abandoned');
        expect(world.view.engineError).toContain('boom from a card');
        expect(currentScreen(world).body.join('\n')).toContain('boom from a card');
    });

    it('the session still replays to the same state', () => {
        const world = playOneCard();
        expect(stateHash(replayWorld(world.header, world.log))).toBe(stateHash(world));
    });
});
