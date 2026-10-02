/** TICKET 180 — helpers for the playtester's tests. Not a test file, so vitest does not run it. */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { currentScreen } from './screen';
import { applyMove, createWorld } from './world';
import type { Screen, SessionHeader, World } from './types';
import { eaStarters } from '../balance/runWalker';

export const tempRoot = (): string => mkdtempSync(join(tmpdir(), 'playtest-'));

export const starter = (index = 0): string => eaStarters()[index];

export const headerFor = (over: Partial<SessionHeader> = {}): SessionHeader => ({
    seed: 'ps1', starter: starter(), gymIndex: 0, mode: 'run', tier: 0, modifiers: [], ...over,
});

/** Which move a policy takes from a screen. Keys are the playtester's own, never on-screen wording. */
export type Policy = (screen: Screen, world: World) => number;

/** Prefer taking a card into the deck, then walking onto a fight, then the first move. */
export const hungry: Policy = (screen) => {
    const take = screen.moves.findIndex((m) => m.key.includes(':take:0') || m.key.startsWith('card:') && m.key.endsWith(':take:0'));
    if (take >= 0) return take;
    const fight = screen.moves.findIndex((m) => m.key.startsWith('enter:'));
    return fight >= 0 ? fight : 0;
};

export function play(world: World, count: number, policy: Policy = hungry): number {
    let made = 0;
    while (made < count) {
        const screen = currentScreen(world);
        if (screen.moves.length === 0) break;
        const move = screen.moves[policy(screen, world)] ?? screen.moves[0];
        applyMove(world, { key: move.key, why: 'test' });
        made += 1;
    }
    return made;
}

export const freshWorld = (over: Partial<SessionHeader> = {}): World => createWorld(headerFor(over));
