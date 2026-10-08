/**
 * TICKET 202h — the night keeps a timestamped transcript of every session, says how each driver
 * ended, ends a session that has stopped moving, and retries it once at the end of the night.
 *
 * Why: on 2026-10-07 r26-r29 sat for up to 27 minutes without a move and ran into the 35-minute
 * limit. Their saved screens replay in about 11 s, so the tool was not the cause, and the night kept
 * nothing that said where the time went.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { planNight, type NightEntry } from './night/plan';
import { tempRoot } from './testKit';

const scripts = resolve(__dirname, '../../../scripts');
const load = async <T>(file: string): Promise<T> => (await import(/* @vite-ignore */ join(scripts, file))) as T;

interface StallWatchModule {
    createStallWatch(o: {
        sessionFile: string; stallMinutes: number; onStall: () => void; now: () => number;
        mtimeOf: (f: string) => number | undefined; every: (fn: () => void, ms: number) => unknown; stop: (h: unknown) => void;
    }): { check: () => boolean; close: () => void };
}
interface DriverResult { exitCode: number; timedOut: boolean; minutes: number; stdout: string; stalled?: boolean; error?: string }
interface Spec { stdin: string; args: string[]; sessionFile?: string; logPath?: string }
interface NightScript {
    DEFAULTS: { stallMinutes: number };
    parseNightArgs(argv: string[], today?: string): { stallMinutes: number };
    driverCommand(entry: NightEntry, options: Record<string, unknown>): Spec;
    readUsage(stdout: string): { tokens?: number; costUsd?: number; turns?: number };
    runNight(options: Record<string, unknown>, deps: Record<string, unknown>, root: string): Promise<Array<Record<string, unknown>>>;
    summaryLines(done: Array<Record<string, unknown>>, options: { date: string }): string[];
}

const DATE = '2026-10-07';
const STARTERS = Array.from({ length: 12 }, (_, i) => `starter_${i}`);
const result = (over: Record<string, unknown> = {}) => JSON.stringify({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.25, num_turns: 7, usage: { input_tokens: 100, output_tokens: 20 }, ...over });
const stream = (...records: string[]) => [JSON.stringify({ type: 'system', subtype: 'init' }), ...records].join('\n');

describe('202h — the stall watch', () => {
    const rig = (stallMinutes: number) => {
        let t = 0;
        let mtime = 1;
        let fired = 0;
        const { createStallWatch } = stallModule!;
        const watch = createStallWatch({
            sessionFile: 'session.json', stallMinutes, onStall: () => { fired += 1; },
            now: () => t, mtimeOf: () => mtime, every: () => 0, stop: () => {},
        });
        return { watch, tick: (min: number) => { t += min * 60_000; }, move: () => { mtime += 1; }, fired: () => fired };
    };
    let stallModule: StallWatchModule | undefined;

    it('fires once when the session file has not changed for the limit, and not before', async () => {
        stallModule = await load<StallWatchModule>('night/stallWatch.mjs');
        const r = rig(8);
        r.tick(7.9); expect(r.watch.check()).toBe(false);
        r.tick(0.2); expect(r.watch.check()).toBe(true);
        r.tick(5); r.watch.check();
        expect(r.fired()).toBe(1);
    });

    it('a move resets the clock', async () => {
        stallModule = await load<StallWatchModule>('night/stallWatch.mjs');
        const r = rig(8);
        r.tick(7); r.move(); expect(r.watch.check()).toBe(false);
        r.tick(7); expect(r.watch.check()).toBe(false);
        r.tick(2); expect(r.watch.check()).toBe(true);
    });

    it('0 turns it off', async () => {
        stallModule = await load<StallWatchModule>('night/stallWatch.mjs');
        const r = rig(0);
        r.tick(600); expect(r.watch.check()).toBe(false);
        expect(r.fired()).toBe(0);
    });
});

describe('202h — how the driver ended', () => {
    it('reads the result off a stream of JSON lines, as well as off one document', async () => {
        const { readUsage } = await load<NightScript>('playtest-night.mjs');
        const { readOutcome } = await load<{ readOutcome(s: string): Record<string, unknown> }>('night/driverOutcome.mjs');
        expect(readUsage(stream(JSON.stringify({ type: 'assistant' }), result()))).toEqual({ tokens: 120, costUsd: 0.25, turns: 7 });
        expect(readOutcome(stream(result()))).toEqual({ subtype: 'success', isError: false });
        expect(readOutcome(result({ subtype: 'error_during_execution', is_error: true, result: 'API Error: 529 overloaded' })))
            .toEqual({ subtype: 'error_during_execution', isError: true, errorText: 'API Error: 529 overloaded' });
        expect(readOutcome('')).toEqual({});
        expect(readUsage('not json\nnor this')).toEqual({});
    });

    it('the driver streams JSON lines, so the session leaves a transcript', async () => {
        const { driverCommand } = await load<NightScript>('playtest-night.mjs');
        const entry = planNight(DATE, STARTERS, { runs: 1 })[0];
        const args = driverCommand(entry, { model: 'haiku', maxTurns: 10, maxUsd: 1, date: DATE, brief: 'B' }).args;
        expect(args[args.indexOf('--output-format') + 1]).toBe('stream-json');
        expect(args).toContain('--verbose');
    });

    it('the transcript has the time on every line, and holds a partial line until it ends', async () => {
        const { createDriverLog } = await load<{ createDriverLog(p: string, o: Record<string, unknown>): { out(c: string): void; err(c: string): void; note(t: string): void; flush(): void } }>('night/driverLog.mjs');
        const written: string[] = [];
        const log = createDriverLog('x', { now: () => new Date('2026-10-07T13:44:00Z'), append: (_f: string, text: string) => written.push(text) });
        log.out('{"a":1}\n{"b"');
        log.out(':2}\n');
        log.err('boom\r\n');
        log.note('no move for 8 minutes');
        log.out('tail');
        log.flush();
        expect(written.join('')).toBe([
            '2026-10-07T13:44:00.000Z {"a":1}',
            '2026-10-07T13:44:00.000Z {"b":2}',
            '2026-10-07T13:44:00.000Z [stderr] boom',
            '2026-10-07T13:44:00.000Z [night] no move for 8 minutes',
            '2026-10-07T13:44:00.000Z tail',
            '',
        ].join('\n'));
    });
});

describe('202h — which sessions are retried', () => {
    it('a stalled one and one that failed early; not one that hit the time limit, finished, or was already retried', async () => {
        const { shouldRetry } = await load<{ shouldRetry(r: Record<string, unknown>): boolean }>('night/retryPolicy.mjs');
        expect(shouldRetry({ exitCode: 1, timedOut: true, stalled: true })).toBe(true);
        expect(shouldRetry({ exitCode: 1, timedOut: false })).toBe(true);
        expect(shouldRetry({ exitCode: 1, timedOut: true })).toBe(false);
        expect(shouldRetry({ exitCode: 0, timedOut: false })).toBe(false);
        expect(shouldRetry({ exitCode: 1, timedOut: false, firstAttempt: { minutes: 3 } })).toBe(false);
        expect(shouldRetry({ skipped: true })).toBe(false);
    });
});

describe('202h — the night', () => {
    const options = { date: DATE, runs: 3, model: 'haiku', minutes: 35, maxTurns: 50, dryRun: false };

    const deps = (root: string, answers: DriverResult[], seen: Spec[]) => ({
        plan: () => planNight(DATE, STARTERS, { runs: 3 }),
        newSession: (entry: NightEntry) => {
            const folder = join(root, DATE, entry.session);
            mkdirSync(folder, { recursive: true });
            writeFileSync(join(folder, 'session.json'), '{}');
        },
        runDriver: async (spec: Spec) => { seen.push(spec); return answers.shift() ?? { exitCode: 0, timedOut: false, minutes: 1, stdout: result() }; },
    });

    it('defaults to an 8-minute stall limit, and --stall-minutes changes it', async () => {
        const { DEFAULTS, parseNightArgs } = await load<NightScript>('playtest-night.mjs');
        expect(DEFAULTS.stallMinutes).toBe(8);
        expect(parseNightArgs([], DATE).stallMinutes).toBe(8);
        expect(parseNightArgs(['--stall-minutes', '0'], DATE).stallMinutes).toBe(0);
    });

    it('hands the driver the session file to watch and the log to write, beside the session', async () => {
        const root = tempRoot();
        const brief = join(root, 'brief.md'); writeFileSync(brief, 'BRIEF');
        const seen: Spec[] = [];
        const { runNight } = await load<NightScript>('playtest-night.mjs');
        await runNight({ ...options, briefPath: brief }, deps(root, [], seen), root);
        expect(seen[0].sessionFile).toBe(join(root, DATE, 'r01', 'session.json'));
        expect(seen[0].logPath).toBe(join(root, DATE, 'r01', 'driver.log'));
    });

    it('retries a stalled session once, after the rest of the night, and keeps the first try in driver.json', async () => {
        const root = tempRoot();
        const brief = join(root, 'brief.md'); writeFileSync(brief, 'BRIEF');
        const seen: Spec[] = [];
        const answers: DriverResult[] = [
            { exitCode: 1, timedOut: false, minutes: 12, stdout: '', stalled: true }, // r01 stalls
            { exitCode: 0, timedOut: false, minutes: 2, stdout: result() },           // r02
            { exitCode: 1, timedOut: true, minutes: 35, stdout: '' },                 // r03 hits the limit: not retried
            { exitCode: 0, timedOut: false, minutes: 4, stdout: result() },           // r01, the retry
        ];
        const { runNight, summaryLines } = await load<NightScript>('playtest-night.mjs');
        const done = await runNight({ ...options, briefPath: brief }, deps(root, answers, seen), root);
        expect(seen.map((s) => s.sessionFile?.split(/[\\/]/).slice(-2)[0])).toEqual(['r01', 'r02', 'r03', 'r01']);
        const r01 = JSON.parse(readFileSync(join(root, DATE, 'r01', 'driver.json'), 'utf8'));
        expect(r01).toMatchObject({ session: 'r01', minutes: 4, exitCode: 0, subtype: 'success', firstAttempt: { minutes: 12, stalled: true } });
        expect(r01.stalled).toBeUndefined();
        expect(done[2]).toMatchObject({ timedOut: true });
        expect(done[2].firstAttempt).toBeUndefined();
        expect(summaryLines(done, { date: DATE })[0]).toBe('r01: 4 min (retried; first try 12 min, stalled), 120 tokens');
    });
});
