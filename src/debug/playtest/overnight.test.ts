/**
 * TICKET 193 follow-up — `npm run overnight` (scripts/overnight.mjs), the one command for the nightly run.
 *
 * It is plain Node (it replaced a bash script that did not start on Henry's Windows machine), so it is
 * loaded by a variable path. The pure parts are pinned here, and one test runs the whole script with
 * `--dry-run`: the checks play real moves through the tool's command line and the night is only planned,
 * so no Claude session starts and no token is spent.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

interface Options {
    date: string; seedDate: string; models: string[]; runs: number; starter: string; cardRuns: number;
    minutes: number; maxUsd: number; brief: string; dryRun: boolean; allowApiKey: boolean;
}
interface Script {
    parseOvernightArgs: (argv: string[], today?: string) => Options;
    nightArgs: (options: Options, model: string) => string[];
    planCheckArgs: (options: Options) => string[];
    hasForecast: (text: string) => boolean;
}

const scriptPath = resolve(__dirname, '../../../scripts/overnight.mjs');
const load = async (): Promise<Script> => (await import(/* @vite-ignore */ scriptPath)) as Script;

describe('overnight — the recipe', () => {
    it('is Night A (haiku) then Night B (sonnet), every starter twice and one card session each, on the 2026-10-04 seeds (202g)', async () => {
        const { parseOvernightArgs, nightArgs } = await load();
        const options = parseOvernightArgs([], '2026-10-06');
        expect(options).toMatchObject({ date: '2026-10-06', seedDate: '2026-10-04', models: ['haiku', 'sonnet'], runs: 24, starter: 'all', cardRuns: 1, minutes: 80, maxUsd: 10, dryRun: false });
        expect(nightArgs(options, 'haiku')).toEqual([
            '--date', '2026-10-06-haiku', '--seed-date', '2026-10-04', '--runs', '24', '--card-runs', '1',
            '--model', 'haiku', '--minutes', '80', '--max-usd', '10',
        ]);
        expect(nightArgs(options, 'sonnet')).toContain('2026-10-06-sonnet');
    });

    it('takes flags, not environment variables, so it reads the same in PowerShell, cmd and Git Bash', async () => {
        const { parseOvernightArgs, nightArgs } = await load();
        const options = parseOvernightArgs(['--models', 'haiku', '--seed-date', 'fresh', '--starter', 'all', '--runs', '3', '--card-runs', '1', '--brief', 'docs/x.md', '--dry-run'], '2026-10-06');
        expect(options.models).toEqual(['haiku']);
        expect(options.seedDate).toBe('2026-10-06');
        const args = nightArgs(options, 'haiku');
        expect(args).not.toContain('--starter');
        expect(args).toEqual(expect.arrayContaining(['--runs', '3', '--card-runs', '1', '--brief', 'docs/x.md', '--dry-run']));
    });

    it('accepts models separated by commas or spaces', async () => {
        const { parseOvernightArgs } = await load();
        expect(parseOvernightArgs(['--models', 'haiku,sonnet,opus']).models).toEqual(['haiku', 'sonnet', 'opus']);
    });

    it('the plan check is a dry run under its own name, with no limits and no model choice to make', async () => {
        const { parseOvernightArgs, planCheckArgs } = await load();
        const args = planCheckArgs(parseOvernightArgs([], '2026-10-06'));
        expect(args).toContain('--dry-run');
        expect(args).toEqual(expect.arrayContaining(['--date', '2026-10-06-check']));
        expect(args).not.toContain('--minutes');
        expect(args).not.toContain('--max-usd');
    });

    it('202g, 202c: no flags is the full night: all twelve starters, 24 sessions a model, one card session, 80 minutes and $10 a session (two runs each)', async () => {
        const { parseOvernightArgs } = await load();
        expect(parseOvernightArgs([])).toMatchObject({ starter: 'all', runs: 24, cardRuns: 1, minutes: 80, maxUsd: 10 });
    });

    it('202c: the night script\'s own defaults are the same 80 minutes and $10, with its own sessions, card runs and stall limit unchanged', async () => {
        const { parseNightArgs } = (await import(/* @vite-ignore */ resolve(__dirname, '../../../scripts/playtest-night.mjs'))) as {
            parseNightArgs: (argv: string[], today?: string) => Record<string, unknown>;
        };
        expect(parseNightArgs([], '2026-10-08')).toMatchObject({ minutes: 80, maxUsd: 10, runs: 10, cardRuns: 1, turnRuns: 0, stallMinutes: 8 });
    });

    it('202c: --runs still counts sessions, and the limits can still be set', async () => {
        const { parseOvernightArgs, nightArgs } = await load();
        const options = parseOvernightArgs(['--runs', '6', '--minutes', '45', '--max-usd', '4'], '2026-10-08');
        expect(options).toMatchObject({ runs: 6, minutes: 45, maxUsd: 4 });
        expect(nightArgs(options, 'haiku')).toEqual(expect.arrayContaining(['--runs', '6', '--minutes', '45', '--max-usd', '4']));
    });

    it('recognises the run forecast on a first screen', async () => {
        const { hasForecast } = await load();
        expect(hasForecast('x\nRUN FORECAST\ny')).toBe(true);
        expect(hasForecast('no such block')).toBe(false);
    });
});

describe('overnight — the session limit (ticket 195l)', () => {
    it('is 80 minutes in both scripts (202c: a session plays two runs), so a two-run session is not stopped by the clock', async () => {
        const { parseOvernightArgs } = await load();
        expect(parseOvernightArgs([]).minutes).toBe(80);
        const night = (await import(/* @vite-ignore */ resolve(__dirname, '../../../scripts/playtest-night.mjs'))) as { DEFAULTS: { minutes: number; maxUsd: number } };
        expect(night.DEFAULTS.minutes).toBe(80);
        expect(night.DEFAULTS.maxUsd).toBe(10);
    });

    it('the usage text says 80 and $10 and what it costs at worst: 24 sessions of 80 minutes is 32 hours a model, 64 hours for both', () => {
        const usage = readFileSync(scriptPath, 'utf8');
        expect(usage).toContain('(80)');
        expect(usage).toContain('(10)');
        expect(usage).not.toContain('(35)');
        expect(usage).not.toContain('14 hours');
        expect(usage).toContain('32 hours');
        expect(usage).toContain('64 hours');
    });

    it('the night script\'s usage says $10 a session, not $3', () => {
        const usage = readFileSync(resolve(__dirname, '../../../scripts/playtest-night.mjs'), 'utf8');
        expect(usage).toContain('default 10');
        expect(usage).not.toContain('default 3');
    });
});

describe('overnight — the whole script, as a dry run', () => {
    it('passes its checks in every mode, plans the 24 sessions of each night, and spends nothing', () => {
        const date = '2099-01-01';
        const log = resolve(__dirname, '../../../results/playtest', `overnight-${date}.log`);
        rmSync(log, { force: true });
        const result = spawnSync(process.execPath, [scriptPath, '--dry-run', '--date', date], { cwd: resolve(__dirname, '../../..'), encoding: 'utf8' });
        const out = `${result.stdout}${result.stderr}`;
        expect(result.status, out).toBe(0);
        for (const mode of ['run', 'turn', 'card']) expect(out).toContain(`${mode}: ok`);
        expect(out).toContain('24 sessions planned');
        expect(out).toContain(`${date}-haiku`);
        expect(out).toContain(`${date}-sonnet`);
        expect(existsSync(log)).toBe(true);
        expect(readFileSync(log, 'utf8')).toContain('done. Reports');
        rmSync(log, { force: true });
    }, 180_000);
});
