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
    it('is Night A (haiku) then Night B (sonnet), nine Kraken sessions each, on the 2026-10-04 seeds', async () => {
        const { parseOvernightArgs, nightArgs } = await load();
        const options = parseOvernightArgs([], '2026-10-06');
        expect(options).toMatchObject({ date: '2026-10-06', seedDate: '2026-10-04', models: ['haiku', 'sonnet'], runs: 9, starter: 'kraken_v1', cardRuns: 0, minutes: 35, maxUsd: 3, dryRun: false });
        expect(nightArgs(options, 'haiku')).toEqual([
            '--date', '2026-10-06-haiku', '--seed-date', '2026-10-04', '--runs', '9', '--card-runs', '0',
            '--model', 'haiku', '--minutes', '35', '--max-usd', '3', '--starter', 'kraken_v1',
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

    it('recognises the run forecast on a first screen', async () => {
        const { hasForecast } = await load();
        expect(hasForecast('x\nRUN FORECAST\ny')).toBe(true);
        expect(hasForecast('no such block')).toBe(false);
    });
});

describe('overnight — the session limit (ticket 195l)', () => {
    it('is 35 minutes in both scripts, so a full-party gym session is not stopped by the clock', async () => {
        const { parseOvernightArgs } = await load();
        expect(parseOvernightArgs([]).minutes).toBe(35);
        const night = (await import(/* @vite-ignore */ resolve(__dirname, '../../../scripts/playtest-night.mjs'))) as { DEFAULTS: { minutes: number } };
        expect(night.DEFAULTS.minutes).toBe(35);
    });

    it('the usage text says 35 and what it costs: 36 sessions of 35 minutes is 21 hours a model', () => {
        const usage = readFileSync(scriptPath, 'utf8');
        expect(usage).toContain('(35)');
        expect(usage).not.toContain('(25)');
        expect(usage).toContain('21 hours');
    });
});

describe('overnight — the whole script, as a dry run', () => {
    it('passes its checks in every mode, plans the nine sessions of each night, and spends nothing', () => {
        const date = '2099-01-01';
        const log = resolve(__dirname, '../../../results/playtest', `overnight-${date}.log`);
        rmSync(log, { force: true });
        const result = spawnSync(process.execPath, [scriptPath, '--dry-run', '--date', date], { cwd: resolve(__dirname, '../../..'), encoding: 'utf8' });
        const out = `${result.stdout}${result.stderr}`;
        expect(result.status, out).toBe(0);
        for (const mode of ['run', 'turn', 'card']) expect(out).toContain(`${mode}: ok`);
        expect(out).toContain('9 sessions planned');
        expect(out).toContain(`${date}-haiku`);
        expect(out).toContain(`${date}-sonnet`);
        expect(existsSync(log)).toBe(true);
        expect(readFileSync(log, 'utf8')).toContain('done. Reports');
        rmSync(log, { force: true });
    }, 180_000);
});
