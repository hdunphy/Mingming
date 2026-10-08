/**
 * TICKET 202c — the night with two runs a session: the resume guard (202e) and the stall watch (202h).
 *
 * The guard compares a session's seed, starter and gym with tonight's plan. A session that has started run 2
 * keeps the plan's seed and gym in its own fields (run 2's are in `run2`), so it still matches its plan, and a
 * session written before this ticket (no `run2`) matches as it always did. A stall in run 2 ends the driver,
 * and the retry resumes from the session file, which still holds run 1.
 */
import { describe, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { parseArgs } from './args';
import { COMMANDS, starterFirmwares } from './commands';
import { planNight, type NightEntry } from './night/plan';
import { tempRoot } from './testKit';

const DATE = '2026-10-04-two';
const SEED_DATE = '2026-10-04';

interface Guard {
    resumeMatchesPlan(session: Record<string, unknown>, entry: NightEntry): boolean;
    resumeRefusal(session: Record<string, unknown>, entry: NightEntry, folder: string): string;
}
interface Night {
    runNight(options: Record<string, unknown>, deps: Deps, root: string): Promise<Array<Record<string, unknown>>>;
}
interface Result { exitCode: number; timedOut: boolean; minutes: number; stdout: string; stalled?: boolean }
interface Deps {
    plan(): NightEntry[];
    newSession(entry: NightEntry): void;
    runDriver(spec: { stdin: string; args: string[]; sessionFile?: string }): Promise<Result>;
}
const load = async <T>(file: string): Promise<T> => (await import(/* @vite-ignore */ resolve(__dirname, '../../../scripts', file))) as T;

const entries = (): NightEntry[] => planNight(DATE, starterFirmwares(), { runs: 3, seedDate: SEED_DATE });
const sessionCmd = (root: string, line: string) => {
    const args = parseArgs([...line.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]));
    return COMMANDS[args.command!](join(root, DATE), args);
};

/** r01 as the real tool leaves it: started for the plan's entry, run 1 over, run 2 begun. */
function sessionWithRun2(root: string, entry: NightEntry): string {
    expect(sessionCmd(root, `new --session ${entry.session} --seed ${entry.seed} --starter ${entry.starter} --gym ${entry.gym} --mode ${entry.mode} --budget 1`).code).toBe(0);
    expect(sessionCmd(root, `move --session ${entry.session} 1 --why "one decision"`).code).toBe(0);
    expect(sessionCmd(root, `again --session ${entry.session}`).code).toBe(0);
    return join(root, DATE, entry.session, 'session.json');
}

const dryDeps = (root: string, started: string[], driven: string[] = []): Deps => ({
    plan: entries,
    newSession: (entry) => {
        started.push(entry.session);
        const folder = join(root, DATE, entry.session);
        mkdirSync(folder, { recursive: true });
        writeFileSync(join(folder, 'session.json'), JSON.stringify({ seed: entry.seed, starter: entry.starter, gymIndex: entry.gym }));
    },
    runDriver: async (spec) => {
        driven.push(spec.sessionFile ?? '');
        return { exitCode: 0, timedOut: false, minutes: 1, stdout: JSON.stringify({ type: 'result', num_turns: 3 }) };
    },
});

const options = (root: string) => {
    const briefPath = join(root, 'brief.md');
    writeFileSync(briefPath, 'BRIEF');
    return { date: DATE, runs: 3, model: 'haiku', minutes: 80, maxTurns: 50, dryRun: false, briefPath };
};

describe('202c — the resume guard with a second run', () => {
    const entry: NightEntry = { index: 1, session: 'r01', seed: 'pt2026-10-04:1', starter: 'fenrir_v1', gym: 1, mode: 'run', tier: 0 };
    const plain = { seed: entry.seed, starter: entry.starter, gymIndex: entry.gym, moves: [] };
    const withRun2 = { ...plain, run2: { seed: `${entry.seed}:2`, gymIndex: 2, atMove: 12 } };

    it('accepts a session that has started run 2, and still accepts one written before this ticket', async () => {
        const { resumeMatchesPlan } = await load<Guard>('resumeGuard.mjs');
        expect(resumeMatchesPlan(withRun2, entry)).toBe(true);
        expect(resumeMatchesPlan(plain, entry)).toBe(true);
    });

    it('still refuses a mismatched session, with or without run 2', async () => {
        const { resumeMatchesPlan, resumeRefusal } = await load<Guard>('resumeGuard.mjs');
        for (const base of [plain, withRun2]) {
            expect(resumeMatchesPlan({ ...base, seed: 'pt2026-10-04:2' }, entry)).toBe(false);
            expect(resumeMatchesPlan({ ...base, starter: 'kraken_v1' }, entry)).toBe(false);
            expect(resumeMatchesPlan({ ...base, gymIndex: 0 }, entry)).toBe(false);
        }
        expect(resumeRefusal({ ...withRun2, starter: 'kraken_v1', gymIndex: 0 }, entry, 'results/playtest/x/r01'))
            .toContain(`r01 was started with kraken_v1 / gym 0 but tonight's plan says fenrir_v1 / gym 1`);
    });

    it('a night resumes a real session that has a second run, without starting it again', async () => {
        const root = tempRoot();
        const [first] = entries();
        const file = sessionWithRun2(root, first);
        const before = readFileSync(file, 'utf8');
        expect(JSON.parse(before).run2).toBeDefined();
        const started: string[] = [];
        const driven: string[] = [];
        const { runNight } = await load<Night>('playtest-night.mjs');
        await runNight(options(root), dryDeps(root, started, driven), root);
        expect(started).toEqual(['r02', 'r03']);
        expect(driven).toHaveLength(3);
        expect(readFileSync(file, 'utf8')).toBe(before);
    });

    it('a night stops, before any driver starts, for a real session with a second run that belongs to another plan', async () => {
        const root = tempRoot();
        const [first] = entries();
        sessionWithRun2(root, first);
        const other = starterFirmwares().find((s) => s !== first.starter)!;
        const { runNight } = await load<Night>('playtest-night.mjs');
        const driven: string[] = [];
        const deps = { ...dryDeps(root, [], driven), plan: () => entries().map((e, i) => (i === 0 ? { ...e, starter: other } : e)) };
        await expect(runNight(options(root), deps, root)).rejects.toThrow(`r01 was started with ${first.starter}`);
        expect(driven).toEqual([]);
    });
});

describe('202c — a stall in run 2', () => {
    it('is retried from the session file, which still holds run 1 and the start of run 2', async () => {
        const root = tempRoot();
        const [first] = entries();
        const file = sessionWithRun2(root, first);
        const before = readFileSync(file, 'utf8');
        const answers: Result[] = [
            { exitCode: 1, timedOut: false, minutes: 12, stdout: '', stalled: true },
            { exitCode: 0, timedOut: false, minutes: 1, stdout: '' },
            { exitCode: 0, timedOut: false, minutes: 1, stdout: '' },
            { exitCode: 0, timedOut: false, minutes: 4, stdout: JSON.stringify({ type: 'result', num_turns: 3 }) },
        ];
        const deps: Deps = { ...dryDeps(root, []), runDriver: async () => answers.shift()! };
        const { runNight } = await load<Night>('playtest-night.mjs');
        await runNight(options(root), deps, root);

        const saved = JSON.parse(readFileSync(file, 'utf8')) as { moves: unknown[]; run2: { atMove: number } };
        expect(readFileSync(file, 'utf8')).toBe(before);
        expect(saved.moves).toHaveLength(saved.run2.atMove);
        const record = JSON.parse(readFileSync(join(root, DATE, 'r01', 'driver.json'), 'utf8'));
        expect(record).toMatchObject({ minutes: 4, firstAttempt: { stalled: true } });
    });
});
