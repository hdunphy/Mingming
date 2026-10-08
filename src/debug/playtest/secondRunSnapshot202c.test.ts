/**
 * TICKET 202c — the snapshot (195m) and the instrument rule, with a second run in the session.
 *
 * Henry's rule for the instrument: a session with no second run prints exactly what it printed before this
 * ticket, and a snapshot may make a call faster and never different. And 195m's speed fix must hold: run 2 is
 * rebuilt from the run-1 end state by playing only run 2's moves, never run 1 again.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseArgs } from './args';
import { COMMANDS } from './commands';
import { renderScreen, screenJson } from './render';
import { loadWorld } from './sessionCache';
import { readSession, sessionPath, writeSession } from './sessionFile';
import { currentScreen } from './screen';
import { freshWorld, play, starter, tempRoot } from './testKit';
import type { World } from './types';
import { replayWorld } from './world';

const cmd = (root: string, line: string) => {
    const tokens = [...line.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
    const args = parseArgs(tokens);
    return COMMANDS[args.command!](root, args);
};
const snapshotFile = (root: string): string => join(root, 's1', 'snapshot.json');

/** A session whose run 1 ended after 3 decisions and whose run 2 has made 2 moves. */
function twoRunSession(): { root: string; boundary: number } {
    const root = tempRoot();
    cmd(root, `new --session s1 --seed pt2026-10-04:3 --starter ${starter()} --gym 1 --mode run --budget 3`);
    for (let i = 0; i < 3; i += 1) expect(cmd(root, 'move --session s1 1 --why "walk on"').code).toBe(0);
    const boundary = readSession(root, 's1').moves.length;
    expect(cmd(root, 'again --session s1').code).toBe(0);
    for (let i = 0; i < 2; i += 1) expect(cmd(root, 'move --session s1 1 --why "walk on"').code).toBe(0);
    return { root, boundary };
}

describe('202c — a snapshot of a session with a second run', () => {
    it('prints the same state, JSON and replays from a snapshot as from a full replay, and the second call replays nothing', () => {
        const { root, boundary } = twoRunSession();
        expect(existsSync(snapshotFile(root))).toBe(true);
        const session = readSession(root, 's1');
        expect(loadWorld(root, 's1', session).replayed).toBe(0);

        const printed = {
            state: cmd(root, 'state --session s1').out,
            json: cmd(root, 'state --session s1 --json').out,
            atBoundary: cmd(root, `replay --session s1 --to ${boundary}`).out,
            inRun1: cmd(root, `replay --session s1 --to ${boundary - 1}`).out,
            inRun2: cmd(root, `replay --session s1 --to ${boundary + 1}`).out,
        };
        rmSync(snapshotFile(root));
        expect(loadWorld(root, 's1', session).replayed).toBe(session.moves.length);
        expect(cmd(root, 'state --session s1').out).toBe(printed.state);
        rmSync(snapshotFile(root));
        expect(cmd(root, 'state --session s1 --json').out).toBe(printed.json);
        expect(cmd(root, `replay --session s1 --to ${boundary}`).out).toBe(printed.atBoundary);
        expect(cmd(root, `replay --session s1 --to ${boundary - 1}`).out).toBe(printed.inRun1);
        expect(cmd(root, `replay --session s1 --to ${boundary + 1}`).out).toBe(printed.inRun2);

        expect(printed.state).toContain('run 2 of 2');
        expect(printed.atBoundary).toContain('RUN OVER');
        expect(printed.inRun1).not.toContain('run 2 of 2');
    });

    it('rebuilds run 2 by playing only run 2\'s moves from the snapshot, never run 1 again', () => {
        const { root, boundary } = twoRunSession();
        // The snapshot `again` left (run 2's first screen), then two more moves made by hand into the file.
        const session = readSession(root, 's1');
        const tail = session.moves.slice(boundary);
        writeSession(root, 's1', { ...session, moves: session.moves.slice(0, boundary) });
        rmSync(snapshotFile(root));
        cmd(root, 'state --session s1');
        const atStart = readFileSync(snapshotFile(root), 'utf8');
        expect(JSON.parse(atStart).count).toBe(boundary);

        writeSession(root, 's1', session);
        writeFileSync(snapshotFile(root), atStart);
        const loaded = loadWorld(root, 's1', readSession(root, 's1'));
        expect(loaded.replayed).toBe(tail.length);
        expect(loaded.world.runNumber).toBe(2);
        rmSync(snapshotFile(root));
        const full = loadWorld(root, 's1', readSession(root, 's1'));
        expect(renderScreen(loaded.world)).toBe(renderScreen(full.world));
    });

    it('a snapshot taken in run 2 is not used to show run 1\'s end', () => {
        const { root, boundary } = twoRunSession();
        cmd(root, 'state --session s1');
        const withSnapshot = cmd(root, `replay --session s1 --to ${boundary}`).out;
        expect(withSnapshot).toContain('RUN OVER');
        expect(withSnapshot).not.toContain('run 2 of 2');
    });

    it('a snapshot from before the session had a second run is not trusted after it has one', () => {
        const root = tempRoot();
        cmd(root, `new --session s1 --seed pt2026-10-04:3 --starter ${starter()} --gym 1 --mode run --budget 1`);
        cmd(root, 'move --session s1 1 --why "end it"');
        expect(existsSync(snapshotFile(root))).toBe(true);
        const stale = readFileSync(snapshotFile(root), 'utf8');
        cmd(root, 'again --session s1');
        writeFileSync(snapshotFile(root), stale);
        const state = cmd(root, 'state --session s1').out;
        expect(state).toContain('run 2 of 2');
        expect(loadWorld(root, 's1', readSession(root, 's1')).world.runNumber).toBe(2);
    });
});

/** The pre-202c way a world was read from a session: every move played into one world from move 0. */
const legacyWorld = (session: ReturnType<typeof readSession>, upTo = session.moves.length): World =>
    replayWorld(session, session.moves.slice(0, upTo));

describe.each([['run', 40], ['turn', 30]] as const)('202c — a %s-mode session with no second run prints what it always printed', (mode, count) => {
    function singleRun(): string {
        const root = tempRoot();
        const world = freshWorld({ mode, seed: 'ps1' });
        play(world, count);
        writeSession(root, 's1', { ...world.header, moves: world.log, notes: [] });
        return root;
    }

    it('state, state --json and replay equal the single-world replay, with and without a snapshot', () => {
        const root = singleRun();
        const session = readSession(root, 's1');
        const half = Math.floor(session.moves.length / 2);
        const expected = {
            state: renderScreen(legacyWorld(session)),
            json: JSON.stringify(screenJson(legacyWorld(session), currentScreen(legacyWorld(session))), null, 2),
            half: renderScreen(legacyWorld(session, half)),
        };
        for (const withSnapshot of [false, true, true]) {
            if (!withSnapshot && existsSync(snapshotFile(root))) rmSync(snapshotFile(root));
            expect(cmd(root, 'state --session s1').out).toBe(expected.state);
            expect(cmd(root, 'state --session s1 --json').out).toBe(expected.json);
            expect(cmd(root, `replay --session s1 --to ${half}`).out).toBe(expected.half);
        }
        expect(existsSync(snapshotFile(root))).toBe(true);
    });

    it('says nothing about runs, and keeps no run-2 field in the file', () => {
        const root = singleRun();
        const shown = cmd(root, 'state --session s1').out;
        expect(shown).not.toMatch(/run [12] of 2/);
        expect(shown).not.toContain('Run 1 is over');
        const saved = JSON.parse(readFileSync(sessionPath(root, 's1'), 'utf8')) as Record<string, unknown>;
        expect(saved).not.toHaveProperty('run2');
        expect(saved).not.toHaveProperty('twoRuns');
    });
});
