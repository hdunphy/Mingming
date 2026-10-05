/**
 * TICKET 180f — the night: which sessions it plays, and the script that plays them.
 *
 * The script (`scripts/playtest-night.mjs`) is plain Node, so it is loaded by a variable path, and its
 * driver and the tool are replaced by fakes: nothing here starts a real Claude session or spends a
 * token. No on-screen wording is pinned; the brief in these tests is a stand-in sentence.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { parseArgs } from './args';
import { offerGyms } from '../../engine/run/gyms';
import { cmdPlan, COMMANDS } from './commands';
import { gymOfferSeed } from './gymOfferSeed';
import { PREDICTION_KEYS } from './expect/prediction';
import { DEFAULT_NIGHT_RUNS, planNight, type NightEntry } from './night/plan';
import { tempRoot } from './testKit';

const STARTERS = Array.from({ length: 12 }, (_, i) => `starter_${i}`);
const DATE = '2026-10-02';

describe('180f — the night plan', () => {
    it('is ten sessions by default, named r01.., with seeds from the date', () => {
        const plan = planNight(DATE, STARTERS);
        expect(plan).toHaveLength(DEFAULT_NIGHT_RUNS);
        expect(plan[0].session).toBe('r01');
        expect(plan[9].session).toBe('r10');
        expect(plan.map((e) => e.seed)).toEqual(plan.map((_, i) => `pt${DATE}:${i + 1}`));
    });

    it('rotates the starters and the gyms so a night covers as much as it can', () => {
        const plan = planNight(DATE, STARTERS, { runs: 12 });
        expect(new Set(plan.map((e) => e.starter)).size).toBe(12);
        expect(plan.map((e) => e.gym).slice(0, 6)).toEqual([0, 1, 2, 0, 1, 2]);
        // more sessions than starters: wraps around
        expect(planNight(DATE, STARTERS.slice(0, 3), { runs: 4 })[3].starter).toBe(STARTERS[0]);
    });

    it('plays the last session in card mode, and the rest in run mode', () => {
        const plan = planNight(DATE, STARTERS);
        expect(plan.map((e) => e.mode)).toEqual([...Array(9).fill('run'), 'card']);
    });

    it('a single run gets no card mode; turn runs sit just before the card ones', () => {
        expect(planNight(DATE, STARTERS, { runs: 1 })[0].mode).toBe('run');
        const modes = planNight(DATE, STARTERS, { runs: 6, cardRuns: 1, turnRuns: 2 }).map((e) => e.mode);
        expect(modes).toEqual(['run', 'run', 'run', 'turn', 'turn', 'card']);
    });

    it('refuses a night with nothing in it', () => {
        expect(() => planNight(DATE, STARTERS, { runs: 0 })).toThrow();
        expect(() => planNight(DATE, [])).toThrow();
    });

    it('is the same every time it is asked', () => {
        expect(planNight(DATE, STARTERS)).toEqual(planNight(DATE, STARTERS));
    });
});

describe('180f — the plan command', () => {
    const run = (line: string) => cmdPlan('unused', parseArgs(line.split(' ')));

    it('prints the plan as JSON, with the game’s own starters', () => {
        const result = run(`plan --date ${DATE} --runs 4 --card-runs 0`);
        expect(result.code).toBe(0);
        const plan = JSON.parse(result.out) as NightEntry[];
        expect(plan).toHaveLength(4);
        expect(plan.every((e) => e.mode === 'run' && e.starter.length > 0)).toBe(true);
    });

    it('--starter plays every session with that one starter, and refuses one that is not a starter', () => {
        const plan = JSON.parse(run(`plan --date ${DATE} --runs 4 --starter kraken_v1`).out) as NightEntry[];
        expect(plan.map((e) => e.starter)).toEqual(Array(4).fill('kraken_v1'));
        // 195k: not a rotation any more; each session plays the gym its starter's element beats (kraken is Water, so Emberfall).
        expect(plan.map((e) => offerGyms(gymOfferSeed(e.seed))[e.gym].gym.id)).toEqual(Array(4).fill('gym_emberfall'));
        const bad = run(`plan --date ${DATE} --starter nobody`);
        expect(bad.code).toBe(1);
        expect(bad.out).toContain('kraken_v1');
    });

    it('refuses a missing date and a bad number', () => {
        expect(run('plan').code).toBe(1);
        expect(run(`plan --date ${DATE} --runs two`).code).toBe(1);
        expect(run(`plan --date ${DATE} --runs 0`).code).toBe(1);
    });
});

// ---------------------------------------------------------------------------------------------------

interface NightScript {
    DEFAULTS: { runs: number; model: string; maxUsd: number; resultsRoot: string };
    parseNightArgs(argv: string[], today?: string): Record<string, unknown> & { date: string; runs: number; model: string; minutes: number; maxUsd: number; starter?: string; dryRun: boolean; report: boolean; cardRuns: number; turnRuns: number };
    driverCommand(entry: NightEntry, options: Record<string, unknown>): { command: string; args: string[]; stdin: string };
    promptFor(entry: NightEntry, brief: string, resultsDir: string): string;
    readUsage(stdout: string): { tokens?: number; costUsd?: number; turns?: number };
    runNight(options: Record<string, unknown>, deps: Deps, root: string): Promise<Array<Record<string, unknown>>>;
}
interface Deps {
    plan(): NightEntry[];
    newSession(entry: NightEntry): void;
    runDriver(spec: { stdin: string; args: string[] }): Promise<{ exitCode: number; timedOut: boolean; minutes: number; stdout: string; error?: string }>;
}

const scriptPath = resolve(__dirname, '../../../scripts/playtest-night.mjs');
const loadScript = async (): Promise<NightScript> => (await import(/* @vite-ignore */ scriptPath)) as NightScript;

const entries = (): NightEntry[] => planNight(DATE, STARTERS, { runs: 3 });

/** Fakes: starting a session writes its `session.json`, the driver answers with a canned result. */
function fakeDeps(root: string, calls: { started: string[]; driven: string[] }): Deps {
    return {
        plan: entries,
        newSession: (entry) => {
            calls.started.push(entry.session);
            const folder = join(root, DATE, entry.session);
            mkdirSync(folder, { recursive: true });
            writeFileSync(join(folder, 'session.json'), '{}');
        },
        runDriver: async (spec) => {
            calls.driven.push(spec.stdin);
            return { exitCode: 0, timedOut: false, minutes: 1.5, stdout: JSON.stringify({ type: 'result', total_cost_usd: 0.25, num_turns: 7, usage: { input_tokens: 100, output_tokens: 20 } }) };
        },
    };
}

describe('180f — the night script: arguments and the driver command', () => {
    it('has defaults: ten runs, the small model, tonight’s date', async () => {
        const { parseNightArgs, DEFAULTS } = await loadScript();
        const options = parseNightArgs([], DATE);
        expect(options).toMatchObject({ date: DATE, runs: DEFAULTS.runs, model: DEFAULTS.model, dryRun: false, report: true, maxUsd: DEFAULTS.maxUsd });
    });

    it('a single-session trial is not played in card mode unless asked', async () => {
        const { parseNightArgs } = await loadScript();
        expect(parseNightArgs(['--runs', '1'], DATE).cardRuns).toBe(0);
        expect(parseNightArgs(['--runs', '1', '--card-runs', '1'], DATE).cardRuns).toBe(1);
        expect(parseNightArgs(['--runs', '4'], DATE).cardRuns).toBe(1);
    });

    it('--starter is passed along as a string, and absent by default', async () => {
        const { parseNightArgs } = await loadScript();
        expect(parseNightArgs([], DATE).starter).toBeUndefined();
        expect(parseNightArgs(['--starter', 'kraken_v1'], DATE).starter).toBe('kraken_v1');
    });

    it('reads the flags, and refuses a number that is not one', async () => {
        const { parseNightArgs } = await loadScript();
        const options = parseNightArgs(['--runs', '2', '--minutes', '15', '--model', 'sonnet', '--date', '2026-01-01', '--max-usd', '1.5', '--dry-run', '--no-report'], DATE);
        expect(options).toMatchObject({ runs: 2, minutes: 15, model: 'sonnet', date: '2026-01-01', maxUsd: 1.5, dryRun: true, report: false });
        expect(() => parseNightArgs(['--runs', 'many'], DATE)).toThrow(/runs/);
    });

    it('the driver may run the playtest tool and nothing else, and its results go to the night’s folder', async () => {
        const { driverCommand } = await loadScript();
        const spec = driverCommand(entries()[0], { model: 'haiku', maxTurns: 100, maxUsd: 2.5, date: DATE, brief: 'BRIEF' });
        expect(spec.command).toBe('claude');
        const allowed = spec.args[spec.args.indexOf('--allowedTools') + 1];
        expect(allowed).toBe('Bash(npm run playtest -- *)');
        // A4: read-only tools (Read, Glob, Grep) are allowed by default in a headless run, so the built-in
        // tool set is cut down to Bash, and anything not on the allow list is refused rather than asked about
        expect(spec.args[spec.args.indexOf('--tools') + 1]).toBe('Bash');
        expect(spec.args[spec.args.indexOf('--permission-mode') + 1]).toBe('dontAsk');
        // a dollar cap per session, so a first night cannot run away
        expect(spec.args[spec.args.indexOf('--max-budget-usd') + 1]).toBe('2.5');
        expect(spec.args).toContain('-p');
        // where the night lives is told to the agent (it adds `--results` to each command), not left to the environment
        // 195j: always forward slashes, even on Windows, where a backslash would be eaten by Git Bash
        expect(spec.stdin).toContain(`--results results/playtest/${DATE}`);
        expect(spec.stdin).not.toContain('\\');
        // the prompt goes in on stdin, not in the arguments
        expect(spec.stdin).toContain('BRIEF');
        expect(spec.args.join(' ')).not.toContain('BRIEF');
    });

    it('the prompt is the brief plus this session’s name and mode', async () => {
        const { promptFor } = await loadScript();
        const entry = entries()[2];
        const prompt = promptFor(entry, 'BRIEF\n', 'somewhere/night');
        expect(prompt.startsWith('BRIEF\n')).toBe(true);
        expect(prompt).toContain(entry.session);
        expect(prompt).toContain(entry.mode);
        expect(prompt).toContain('--results somewhere/night');
    });

    it('reads tokens, cost and turns off the driver’s result, and copes with anything else', async () => {
        const { readUsage } = await loadScript();
        expect(readUsage(JSON.stringify({ type: 'result', total_cost_usd: 0.5, num_turns: 3, usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 85 } }))).toEqual({ tokens: 100, costUsd: 0.5, turns: 3 });
        expect(readUsage(JSON.stringify([{ type: 'system' }, { type: 'result', num_turns: 2 }]))).toEqual({ turns: 2 });
        expect(readUsage('not json')).toEqual({});
        expect(readUsage('null')).toEqual({});
    });
});

describe('180f — the night script: running a night', () => {
    const options = (over: Record<string, unknown> = {}) => ({ date: DATE, runs: 3, model: 'haiku', minutes: 5, maxTurns: 50, dryRun: false, briefPath: undefined as string | undefined, ...over });

    const withBrief = (root: string): string => {
        const briefPath = join(root, 'brief.md');
        writeFileSync(briefPath, 'BRIEF');
        return briefPath;
    };

    it('starts and drives every session, and writes a driver.json beside each', async () => {
        const root = tempRoot();
        const calls = { started: [] as string[], driven: [] as string[] };
        const { runNight } = await loadScript();
        const done = await runNight(options({ briefPath: withBrief(root) }), fakeDeps(root, calls), root);
        expect(calls.started).toEqual(['r01', 'r02', 'r03']);
        expect(calls.driven).toHaveLength(3);
        expect(done).toHaveLength(3);
        const record = JSON.parse(readFileSync(join(root, DATE, 'r01', 'driver.json'), 'utf8'));
        expect(record).toMatchObject({ session: 'r01', model: 'haiku', exitCode: 0, timedOut: false, tokens: 120, costUsd: 0.25, turns: 7, minutes: 1.5 });
    });

    it('is resumable: a finished session is skipped, an interrupted one is driven again without a new start', async () => {
        const root = tempRoot();
        const { runNight } = await loadScript();
        const first = { started: [] as string[], driven: [] as string[] };
        await runNight(options({ briefPath: withBrief(root) }), fakeDeps(root, first), root);

        // r02 was interrupted: its driver.json is gone, its session file is still there
        const { rmSync } = await import('node:fs');
        rmSync(join(root, DATE, 'r02', 'driver.json'));
        const second = { started: [] as string[], driven: [] as string[] };
        const done = await runNight(options({ briefPath: withBrief(root) }), fakeDeps(root, second), root);
        expect(second.started).toEqual([]);
        expect(second.driven).toHaveLength(1);
        expect(done.filter((d) => d.skipped)).toHaveLength(2);
    });

    it('a dry run starts nothing, drives nothing and writes nothing', async () => {
        const root = tempRoot();
        const calls = { started: [] as string[], driven: [] as string[] };
        const { runNight } = await loadScript();
        const done = await runNight(options({ dryRun: true, briefPath: withBrief(root) }), fakeDeps(root, calls), root);
        expect(calls.started).toEqual([]);
        expect(calls.driven).toEqual([]);
        expect(done.every((d) => d.dryRun === true && typeof d.command === 'string')).toBe(true);
        expect(existsSync(join(root, DATE, 'r01', 'driver.json'))).toBe(false);
    });

    it('a driver that timed out or failed is recorded, not thrown', async () => {
        const root = tempRoot();
        const { runNight } = await loadScript();
        const deps: Deps = { ...fakeDeps(root, { started: [], driven: [] }), runDriver: async () => ({ exitCode: -1, timedOut: true, minutes: 5, stdout: '', error: 'boom' }) };
        const done = await runNight(options({ briefPath: withBrief(root) }), deps, root);
        expect(done[0]).toMatchObject({ exitCode: -1, timedOut: true, error: 'boom' });
        expect(existsSync(join(root, DATE, 'r01', 'driver.json'))).toBe(true);
    });
});

describe('180f — the player brief', () => {
    const brief = readFileSync(resolve(__dirname, '../../../docs/playtest/agent-player.md'), 'utf8');

    it('is LF, like everything under docs/playtest', () => {
        expect(brief).not.toContain('\r');
    });

    it('tells the agent every command it plays with, and every key it may predict', () => {
        for (const command of Object.keys(COMMANDS).filter((c) => c !== 'new' && c !== 'plan')) expect(brief).toContain(`\`${command} `);
        for (const key of PREDICTION_KEYS) expect(brief).toContain(`\`${key}\``);
    });

    it('says the instinct’s effects come through the combat log, not the card text', () => {
        expect(brief).toMatch(/instinct/);
        expect(brief).toMatch(/combat log/);
    });

    it('keeps the agent to the tool: no reading the code, the data, the tickets or the balance notes', () => {
        expect(brief).toMatch(/code, its data files, its tickets or its balance notes/);
    });
});

describe('180f — the results folder, as the real command line reads it', () => {
    // vite-node runs the CLI, and the repo's vite config empties `process.env` there, so the folder is a
    // flag. Checked through a real process, because that is where the difference shows.
    //
    // vite-node is started as `node <its .mjs entry>`, not through `node_modules/.bin/vite-node`: on
    // Windows that path is a shell script, which `spawnSync` cannot run (it needs the `.cmd` beside it),
    // and the test saw "no exit code" instead of the CLI's answer.
    const cli = (args: string[]) =>
        spawnSync(process.execPath, [resolve(__dirname, '../../../node_modules/vite-node/vite-node.mjs'), resolve(__dirname, 'cli.ts'), ...args], { encoding: 'utf8', cwd: resolve(__dirname, '../../..') });

    it('--results says where a session is kept', () => {
        const root = tempRoot();
        const starter = (JSON.parse(cmdPlan('unused', parseArgs(['plan', '--date', DATE, '--runs', '1'])).out) as NightEntry[])[0].starter;
        const made = cli(['new', '--session', 'e1', '--seed', 'ps1', '--starter', starter, '--results', root]);
        expect(made.status).toBe(0);
        expect(existsSync(join(root, 'e1', 'session.json'))).toBe(true);
        const shown = cli(['state', '--session', 'e1', '--results', root]);
        expect(shown.status).toBe(0);
    }, 60_000);
});
