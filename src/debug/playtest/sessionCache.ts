/**
 * TICKET 195m — A SNAPSHOT OF THE WORLD BESIDE `session.json`, so a call does not replay the whole run.
 *
 * Every command rebuilds the run from move 0. That is cheap until the gym: a full party's three gauntlet
 * fights are the game's AI playing 3 against 3, 8 to 87 seconds each on the nights' slow sessions, and
 * every `state` paid for them again. The world after the last move is saved as `snapshot.json` and the
 * next call starts from it and plays only the moves made since.
 *
 * A snapshot is used only when it can be trusted to equal a replay: the code stamp is the one it was
 * written under (the newest change to `src` and how many files it has), its saved key matches the
 * session's header and the moves it covers, and it does not stop mid-way through a `moves` list. Anything
 * else (a missing, unreadable, stale or hand-edited file) falls back to the full replay, so a cache can
 * make a call faster and never make it different. Never written by `replay`, which only reads.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { playMoves, replaySession } from './playMoves';
import { secondRunHeader } from './secondRun';
import { sessionPath } from './sessionFile';
import type { LoggedMove, SecondRun, SessionFile, SessionHeader, World } from './types';
import { restoreWorld } from './world';

const VERSION = 1;

const snapshotPath = (root: string, name: string): string => join(dirname(sessionPath(root, name)), 'snapshot.json');

/** The newest change under `src` and the number of files: any edit to the game or the tool changes it. Once a process. */
let stamp: string | null = null;
export function codeStamp(): string {
    if (stamp !== null) return stamp;
    let newest = 0;
    let files = 0;
    const walk = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) walk(path);
            else { files += 1; newest = Math.max(newest, statSync(path).mtimeMs); }
        }
    };
    walk(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
    stamp = `${VERSION}:${files}:${newest}`;
    return stamp;
}

const headerOf = (session: SessionFile): SessionHeader => ({
    seed: session.seed, starter: session.starter, gymIndex: session.gymIndex, mode: session.mode, tier: session.tier,
    modifiers: session.modifiers, ...(session.budget === undefined ? {} : { budget: session.budget }),
    ...(session.twoRuns === true ? { twoRuns: true as const } : {}),
});

/** What a snapshot's key is made of. A session with a second run adds it, so a snapshot older than `again` is never trusted after it. */
const keyFor = (header: SessionHeader, moves: ReadonlyArray<LoggedMove>, run2?: SecondRun): string =>
    createHash('sha1').update(JSON.stringify(run2 === undefined ? { header, moves } : { header, moves, run2 })).digest('hex');

export function saveSnapshot(root: string, name: string, session: SessionFile, world: World): void {
    try {
        const header = headerOf(session);
        const state = world.store.getState();
        const body = JSON.stringify({
            stamp: codeStamp(), count: session.moves.length, key: keyFor(header, session.moves, session.run2),
            game: state.game, run: state.run.run, view: world.view, findings: world.findings, lastPlay: world.lastPlay,
            runNumber: world.runNumber,
        });
        const path = snapshotPath(root, name);
        writeFileSync(`${path}.tmp`, body, 'utf8');
        renameSync(`${path}.tmp`, path);
    } catch {
        // A snapshot is only ever a shortcut: failing to write one leaves the next call to replay.
    }
}

interface Saved { stamp: string; count: number; key: string; game: never; run: never; view: never; findings: never; lastPlay: never; runNumber?: 1 | 2 }

function fromSnapshot(root: string, name: string, session: SessionFile, upTo: number): { world: World; from: number } | null {
    try {
        const path = snapshotPath(root, name);
        if (!existsSync(path)) return null;
        const saved = JSON.parse(readFileSync(path, 'utf8')) as Saved;
        const header = headerOf(session);
        if (saved.stamp !== codeStamp() || !Number.isInteger(saved.count) || saved.count < 1 || saved.count > upTo) return null;
        if (session.moves[saved.count]?.chained === true) return null;
        if (saved.key !== keyFor(header, session.moves.slice(0, saved.count), session.run2)) return null;
        const { run2 } = session;
        const runNumber = saved.runNumber ?? 1;
        if (runNumber === 2) {
            // 202c: a run-2 snapshot is only the start for a look that is in run 2. `replay --to <the boundary>` of a session
            // that has gone on past it shows run 1 as it ended, so that look starts again from move 0.
            if (run2 === undefined || saved.count < run2.atMove || (upTo === run2.atMove && session.moves.length > upTo)) return null;
        }
        const worldHeader = runNumber === 2 ? secondRunHeader(header, run2!) : header;
        return {
            world: restoreWorld(worldHeader, {
                game: saved.game, run: saved.run, view: saved.view, log: session.moves.slice(0, saved.count), findings: saved.findings, lastPlay: saved.lastPlay,
                runNumber, runStart: runNumber === 2 ? run2!.atMove : 0,
            }),
            from: saved.count,
        };
    } catch {
        return null;
    }
}

export interface Loaded {
    readonly world: World;
    /** How many moves had to be played to get here: all of them on a full replay, only the new ones from a snapshot. */
    readonly replayed: number;
}

/** The world after the session's first `upTo` moves (all of them by default), from a snapshot when one can be trusted. */
export function loadWorld(root: string, name: string, session: SessionFile, upTo: number = session.moves.length): Loaded {
    const start = fromSnapshot(root, name, session, upTo);
    if (start === null) return { world: replaySession(session, upTo), replayed: upTo };
    const { world, from } = start;
    return { world: playMoves(world, session.run2, session.moves, from, upTo, session.moves.length), replayed: upTo - from };
}
