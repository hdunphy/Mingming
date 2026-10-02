/**
 * TICKET 180a — a session is a seed plus a move log, and a replay is exact.
 */
import { describe, it, expect } from 'vitest';

import { currentScreen } from './screen';
import { replayWorld, stateHash } from './world';
import { freshWorld, headerFor, play } from './testKit';

describe('180a — sessions replay exactly', () => {
    it('replaying a 30-move session twice gives identical state hashes', () => {
        const live = freshWorld();
        const made = play(live, 30);
        expect(made).toBe(30);
        const header = headerFor();
        const first = replayWorld(header, live.log);
        const second = replayWorld(header, live.log);
        expect(stateHash(first)).toBe(stateHash(second));
        expect(stateHash(first)).toBe(stateHash(live));
    });

    it('a different seed is a different run', () => {
        const a = freshWorld({ seed: 'ps1' });
        const b = freshWorld({ seed: 'ps2' });
        expect(stateHash(a)).not.toBe(stateHash(b));
    });

    it('a replay lands on the same screen the live session was on', () => {
        const live = freshWorld();
        play(live, 8);
        const replayed = replayWorld(headerFor(), live.log);
        expect(currentScreen(replayed).moves.map((m) => m.key)).toEqual(currentScreen(live).moves.map((m) => m.key));
        expect(currentScreen(replayed).body).toEqual(currentScreen(live).body);
    });

    it('refuses a log that holds a move the screen does not offer', () => {
        expect(() => replayWorld(headerFor(), [{ key: 'enter:nowhere', why: 'x' }])).toThrow(/not a legal move/);
    });
});
