/**
 * TICKET 202c — two runs a session: `again` starts a second run on the same save.
 *
 * Henry (2026-10-07): "Maybe we make each agent perform 2 runs? The second time they can try to use what
 * they learned." Confirmed 2026-10-08 (D2): the second run carries exactly what the game's own save carries.
 *
 * A session that ends in one decision (`--budget 1`) is the cheap way to get a finished run 1.
 * Nothing here pins on-screen wording beyond the ticket's own "run 2 of 2".
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseArgs } from './args';
import { COMMANDS } from './commands';
import { loadWorld } from './sessionCache';
import { readSession, sessionPath } from './sessionFile';
import { starter, tempRoot } from './testKit';
import { runOf } from './types';

const cmd = (root: string, line: string) => {
    const tokens = [...line.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
    const args = parseArgs(tokens);
    return COMMANDS[args.command!](root, args);
};

const SEED = 'pt2026-10-04:3';
const NEW = `new --session s1 --seed ${SEED} --starter ${starter()} --gym 1 --mode run --budget 1`;
const MOVE = 'move --session s1 1 --why "one decision ends the run"';

/** A session whose run 1 has ended (the one-decision budget ran out). */
function endedSession(): string {
    const root = tempRoot();
    expect(cmd(root, NEW).code).toBe(0);
    expect(cmd(root, MOVE).code).toBe(0);
    return root;
}

describe('202c — the again command', () => {
    it('is a command', () => {
        expect(Object.keys(COMMANDS)).toContain('again');
    });

    it('refuses while run 1 is still going, and changes nothing', () => {
        const root = tempRoot();
        cmd(root, NEW.replace('--budget 1', ''));
        const before = readFileSync(sessionPath(root, 's1'), 'utf8');
        const result = cmd(root, 'again --session s1');
        expect(result.code).toBe(1);
        expect(result.out).toMatch(/run 1/i);
        expect(readFileSync(sessionPath(root, 's1'), 'utf8')).toBe(before);
    });

    it('refuses without a session, and for a session that does not exist', () => {
        const root = tempRoot();
        expect(cmd(root, 'again').code).toBe(1);
        expect(cmd(root, 'again --session nope').code).toBe(1);
    });

    it('starts run 2 on the same session, with a fresh map on the seed family pt<date>:<i>:2', () => {
        const root = endedSession();
        const first = loadWorld(root, 's1', readSession(root, 's1')).world;
        const result = cmd(root, 'again --session s1');
        expect(result.code).toBe(0);
        expect(result.out).toContain('run 2 of 2');

        const session = readSession(root, 's1');
        expect(session.seed).toBe(SEED);
        expect(session.moves).toHaveLength(1);
        expect(session.run2).toMatchObject({ seed: `${SEED}:2`, atMove: 1 });

        const second = loadWorld(root, 's1', session).world;
        expect(second.runNumber).toBe(2);
        expect(second.header.seed).toBe(`${SEED}:2`);
        expect(runOf(second).seed).toBe(`${SEED}:2`);
        expect(runOf(second).phase).not.toBe('ended');
        expect(runOf(second).nodes.map((n) => n.id + n.kind)).not.toEqual(runOf(first).nodes.map((n) => n.id + n.kind));
        // the same starter, on the same gym (an index into the new seed's own offer is looked up by gym, not copied)
        expect(second.store.getState().game.roster.find((m) => m.id === runOf(second).partyIds[0])?.activeOS).toBe(starter());
        expect(runOf(second).gymId).toBe(runOf(first).gymId);
    });

    it('state says run 2 of 2, and run 1 of 2 while run 1 is going', () => {
        const root = tempRoot();
        cmd(root, NEW.replace('--budget 1', ''));
        expect(cmd(root, 'state --session s1').out).toContain('run 1 of 2');
        const ended = endedSession();
        cmd(ended, 'again --session s1');
        const state = cmd(ended, 'state --session s1');
        expect(state.out).toContain('run 2 of 2');
        expect(state.out).not.toContain('run 1 of 2');
    });

    it('a second again refuses, whether run 2 is going or has ended, and changes nothing', () => {
        const root = endedSession();
        cmd(root, 'again --session s1');
        const running = readFileSync(sessionPath(root, 's1'), 'utf8');
        const during = cmd(root, 'again --session s1');
        expect(during.code).toBe(1);
        expect(during.out).toMatch(/two runs/);
        expect(readFileSync(sessionPath(root, 's1'), 'utf8')).toBe(running);

        expect(cmd(root, MOVE).code).toBe(0);
        const after = cmd(root, 'again --session s1');
        expect(after.code).toBe(1);
        expect(after.out).toMatch(/two runs/);
    });

    it('run 2 is played and logged in the same session, and the decision budget counts per run', () => {
        const root = endedSession();
        cmd(root, 'again --session s1');
        const moved = cmd(root, MOVE);
        expect(moved.code).toBe(0);
        const session = readSession(root, 's1');
        expect(session.moves).toHaveLength(2);
        const world = loadWorld(root, 's1', session).world;
        expect(world.runNumber).toBe(2);
        // budget 1 decision a run: run 2 used its own decision, and so ended
        expect(runOf(world).phase).toBe('ended');
        expect(cmd(root, 'state --session s1').out).toContain('RUN OVER');
    });

    it('replay shows run 1 as it ended up to the boundary, and run 2 after it', () => {
        const root = endedSession();
        cmd(root, 'again --session s1');
        cmd(root, MOVE);
        const one = cmd(root, 'replay --session s1 --to 1');
        expect(one.out).toContain('RUN OVER');
        expect(one.out).not.toContain('run 2 of 2');
        expect(cmd(root, 'replay --session s1 --to 2').out).toContain('run 2 of 2');
        expect(cmd(root, 'replay --session s1 --to 0').out).not.toContain('run 2 of 2');
    });

    it('an old session (no two-run flag) can still be asked for a second run once its run has ended', () => {
        const root = endedSession();
        const path = sessionPath(root, 's1');
        const stripped = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        delete stripped.twoRuns;
        writeFileSync(path, `${JSON.stringify(stripped, null, 2)}\n`);
        expect(cmd(root, 'again --session s1').code).toBe(0);
    });
});
