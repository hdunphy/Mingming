/**
 * TICKET 195m — a snapshot beside `session.json`, so a call does not replay the finished fights.
 *
 * On the nights' slow sessions a single `state` took 88 to 160 seconds, almost all of it the gym's
 * three fights, replayed from move 0 on every call. The rule here is the instrument's: a snapshot may
 * make a call faster and never different, so every case compares what a call prints with the snapshot
 * to what it prints with none.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseArgs } from './args';
import { COMMANDS } from './commands';
import { renderScreen } from './render';
import { loadWorld } from './sessionCache';
import { readSession, sessionPath, writeSession } from './sessionFile';
import { freshWorld, play, tempRoot } from './testKit';
import type { SessionFile, World } from './types';
import { applyMove, replayWorld, stateHash } from './world';
import { currentScreen } from './screen';

const cmd = (root: string, line: string) => {
    const args = parseArgs(line.split(' '));
    return COMMANDS[args.command!](root, args);
};
const snapshotFile = (root: string): string => join(root, 's1', 'snapshot.json');

/** A session on disk, made by playing `count` moves in `mode`. */
function sessionOf(mode: 'run' | 'turn', count: number): { root: string; world: World } {
    const root = tempRoot();
    const world = freshWorld({ mode, seed: 'ps1' });
    play(world, count);
    writeSession(root, 's1', { ...world.header, moves: world.log, notes: [] });
    return { root, world };
}

// 206: the biome order changed, and seed ps1's turn session has left its battle by move 45; 35 is
// still mid-battle, which is what the turn case is for.
describe.each([['run', 60], ['turn', 35]] as const)('195m — %s mode, %i moves', (mode, count) => {
    it('state prints the same text from a snapshot as from a full replay, and the second call replays nothing', () => {
        const { root } = sessionOf(mode, count);
        const first = cmd(root, 'state --session s1');
        expect(existsSync(snapshotFile(root))).toBe(true);

        const session = readSession(root, 's1');
        expect(loadWorld(root, 's1', session).replayed).toBe(0);
        const second = cmd(root, 'state --session s1');
        const json = cmd(root, 'state --session s1 --json');

        rmSync(snapshotFile(root));
        expect(loadWorld(root, 's1', session).replayed).toBe(session.moves.length);
        expect(cmd(root, 'state --session s1').out).toBe(first.out);
        rmSync(snapshotFile(root));
        expect(cmd(root, 'state --session s1 --json').out).toBe(json.out);
        expect(second.out).toBe(first.out);
    });

    it('the restored world is the replayed world: same hash, and still the same after more moves', () => {
        const { root, world } = sessionOf(mode, count);
        cmd(root, 'state --session s1');
        const session = readSession(root, 's1');
        const restored = loadWorld(root, 's1', session).world;
        expect(stateHash(restored)).toBe(stateHash(world));
        expect(renderScreen(restored)).toBe(renderScreen(world));
        // Play on from both: the same moves must give the same worlds.
        for (let n = 0; n < 12; n += 1) {
            const screen = currentScreen(world);
            if (screen.moves.length === 0) break;
            const move = { key: screen.moves[0].key, why: 'on' };
            applyMove(world, move);
            applyMove(restored, move);
            expect(stateHash(restored)).toBe(stateHash(world));
        }
    });

    it('a move call leaves a snapshot too, and replay --to is the same with or without it', () => {
        const { root } = sessionOf(mode, count);
        cmd(root, 'state --session s1');
        cmd(root, 'move --session s1 1 --why next');
        expect(loadWorld(root, 's1', readSession(root, 's1')).replayed).toBe(0);
        const full = readSession(root, 's1').moves.length;
        const withCache = [full, full - 1, Math.floor(full / 2), 0].map((n) => cmd(root, `replay --session s1 --to ${n}`).out);
        rmSync(snapshotFile(root));
        const without = [full, full - 1, Math.floor(full / 2), 0].map((n) => cmd(root, `replay --session s1 --to ${n}`).out);
        expect(withCache).toEqual(without);
    });
});

describe('195m — a snapshot is used only when it can be trusted', () => {
    const fresh = (session: SessionFile, root: string): string => {
        rmSync(snapshotFile(root), { force: true });
        return renderScreen(replayWorld(session, session.moves));
    };

    it('moves added after the snapshot are played on top of it, and only those', () => {
        const { root, world } = sessionOf('run', 40);
        cmd(root, 'state --session s1');
        play(world, 5);
        writeSession(root, 's1', { ...world.header, moves: world.log, notes: [] });
        const session = readSession(root, 's1');
        const loaded = loadWorld(root, 's1', session);
        expect(loaded.replayed).toBe(5);
        expect(renderScreen(loaded.world)).toBe(fresh(session, root));
    });

    it('a session whose moves were changed falls back to the full replay', () => {
        const { root } = sessionOf('run', 40);
        cmd(root, 'state --session s1');
        const session = readSession(root, 's1');
        const edited = { ...session, moves: session.moves.map((m, i) => (i === 3 ? { ...m, why: 'edited' } : m)) };
        writeFileSync(sessionPath(root, 's1'), JSON.stringify(edited), 'utf8');
        expect(loadWorld(root, 's1', edited).replayed).toBe(edited.moves.length);
    });

    it('a snapshot from other code, an unreadable one and one ahead of --to are all ignored', () => {
        const { root } = sessionOf('run', 40);
        cmd(root, 'state --session s1');
        const session = readSession(root, 's1');
        const text = readFileSync(snapshotFile(root), 'utf8');

        writeFileSync(snapshotFile(root), text.replace(/"stamp":"[^"]*"/, '"stamp":"other"'), 'utf8');
        expect(loadWorld(root, 's1', session).replayed).toBe(40);

        writeFileSync(snapshotFile(root), '{ not json', 'utf8');
        expect(loadWorld(root, 's1', session).replayed).toBe(40);

        writeFileSync(snapshotFile(root), text, 'utf8');
        expect(loadWorld(root, 's1', session, 10).replayed).toBe(10);
        expect(loadWorld(root, 's1', session).replayed).toBe(0);
    });

    it('a snapshot that cannot be written does not fail the call', () => {
        const { root } = sessionOf('run', 20);
        // A folder where the snapshot file should go: the rename fails, the call does not.
        mkdirSync(snapshotFile(root));
        const result = cmd(root, 'state --session s1');
        expect(result.code).toBe(0);
        expect(result.out).toBe(renderScreen(replayWorld(readSession(root, 's1'), readSession(root, 's1').moves)));
    });
});

describe('195m — the sessions above are not trivial', () => {
    it('the turn session is in the middle of a battle and the run session has fought a few fights', () => {
        const turn = sessionOf('turn', 35).world;
        // 207: asserting "mid-battle at exactly move N" broke twice in one day (the biome order, then
        // the leader cards joining the reward pools), each time for a seed reason and not a cache one.
        // What the cache tests need is a session that has played battle moves, so that is the claim.
        expect(turn.log.some((move) => move.key.startsWith('battle:'))).toBe(true);
        const run = sessionOf('run', 60).world;
        expect(run.log.length).toBe(60);
        expect(run.store.getState().run.run!.fightsResolved).toBeGreaterThan(2);
    });
});
