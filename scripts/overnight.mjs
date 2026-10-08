#!/usr/bin/env node
/**
 * `npm run overnight` — one command for the nightly agent playtest (tickets 180 and 193).
 *
 *   npm run overnight                       the full night: Night A (haiku) then Night B (sonnet), on the 2026-10-04 seeds,
 *                                           all twelve starters twice and one card-by-card session each (4 to 6 hours, about $25)
 *   npm run overnight -- --dry-run          run the checks and print each night's plan; play nothing
 *   npm run overnight -- --models haiku     one model only
 *   npm run overnight -- --seed-date fresh  new worlds tonight (seeds named after tonight's date)
 *
 * It works the same from PowerShell, cmd or Git Bash. It is Node rather than shell, like the other scripts
 * here, because Henry is on Windows.
 *
 * What it does, in order, stopping at the first problem before anything costs tokens:
 *   1. checks: Claude Code is installed, no ANTHROPIC_API_KEY is set (that would bill that account instead of
 *      the plan), and the playtest tool plays a few real moves through its command line in every mode;
 *   2. for each model, plays the night (`npm run playtest:night`), one folder per model:
 *      results/playtest/<date>-<model>/ and the morning report docs/playtest/agent-runs/<date>-<model>.md;
 *   3. prints where everything is, and exits non-zero if any night failed.
 * Everything printed is also kept in results/playtest/overnight-<date>.log.
 *
 * Keep the PC awake and plugged in. Safe to run again the same day: finished sessions are skipped.
 *
 * Flags (the defaults are the Night A / Night B recipe from ticket 193, as the full night since ticket 202g):
 *   --date <d>        the night's name, fixed once at the start so a night past midnight keeps one folder   (today)
 *   --seed-date <d>   which night's worlds to play: a date, or "fresh" to use --date                        (2026-10-04)
 *   --models <list>   models in order, comma or space separated                                              (haiku,sonnet)
 *   --runs <n>        sessions per night; 24 is the twelve starters, twice each                              (24)
 *   --starter <id>    the starter every session plays, or "all" for the twelve in turn                       (all)
 *   --card-runs <n>   how many sessions play every card themselves                                           (1)
 *   --minutes <n>     wall-clock limit per session; 24 sessions of 35 minutes is 14 hours a model, worst case  (35)
 *   --max-usd <n>     Claude Code's own size estimate cap per session; a yardstick, not a bill               (3)
 *   --brief <path>    another brief for the driver                                                           (the default brief)
 *   --dry-run         checks and plans only
 *   --allow-api-key   go ahead even though ANTHROPIC_API_KEY is set
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const BASELINE_SEED_DATE = '2026-10-04';

const todayLocal = () => {
    const d = new Date();
    const two = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};

/** `--flag value` and bare `--flag`. */
export function parseOvernightArgs(argv, today = todayLocal()) {
    const flags = {};
    for (let i = 0; i < argv.length; i += 1) {
        if (!argv[i].startsWith('--')) continue;
        const name = argv[i].slice(2);
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) { flags[name] = next; i += 1; } else flags[name] = true;
    }
    const text = (name, fallback) => (typeof flags[name] === 'string' ? flags[name] : fallback);
    const count = (name, fallback) => {
        const n = Number(flags[name]);
        return flags[name] !== undefined && Number.isFinite(n) && n >= 0 ? n : fallback;
    };
    const date = text('date', today);
    const seed = text('seed-date', BASELINE_SEED_DATE);
    return {
        date,
        seedDate: seed === 'fresh' ? date : seed,
        models: text('models', 'haiku,sonnet').split(/[\s,]+/).filter(Boolean),
        runs: count('runs', 24),
        starter: text('starter', 'all'),
        cardRuns: count('card-runs', 1),
        minutes: count('minutes', 35),
        maxUsd: count('max-usd', 3),
        brief: text('brief', ''),
        dryRun: flags['dry-run'] === true,
        allowApiKey: flags['allow-api-key'] === true,
    };
}

/** The arguments of `npm run playtest:night --` for one model's night. */
export function nightArgs(options, model) {
    return [
        '--date', `${options.date}-${model}`,
        '--seed-date', options.seedDate,
        '--runs', String(options.runs),
        '--card-runs', String(options.cardRuns),
        '--model', model,
        '--minutes', String(options.minutes),
        '--max-usd', String(options.maxUsd),
        ...(options.starter !== 'all' ? ['--starter', options.starter] : []),
        ...(options.brief ? ['--brief', options.brief] : []),
        ...(options.dryRun ? ['--dry-run'] : []),
    ];
}

/** The throwaway plan the third check asks the night script for (a dry run: nothing is played). */
export function planCheckArgs(options) {
    return [
        '--date', `${options.date}-check`,
        '--seed-date', options.seedDate,
        '--runs', String(options.runs),
        '--card-runs', String(options.cardRuns),
        ...(options.starter !== 'all' ? ['--starter', options.starter] : []),
        '--dry-run',
    ];
}

/** The first screen of a session must carry the run forecast (ticket 193j). */
export const hasForecast = (screenText) => screenText.includes('RUN FORECAST');

// ---- the process side -----------------------------------------------------------------------------

const onWindows = process.platform === 'win32';
/** On Windows the shims (npm, claude) are .cmd files, which only a shell can start; quote what needs it. */
const shellQuote = (arg) => (onWindows && /[\s()*]/.test(arg) ? `"${arg}"` : arg);

function run(command, args) {
    const result = spawnSync(command, args.map(shellQuote), { encoding: 'utf8', shell: onWindows });
    return { code: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}
const npmRun = (args) => run('npm', ['run', '--silent', ...args]);

function main() {
    const options = parseOvernightArgs(process.argv.slice(2));
    const logPath = path.join('results', 'playtest', `overnight-${options.date}.log`);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const two = (n) => String(n).padStart(2, '0');
    const stamp = () => { const d = new Date(); return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`; };
    const say = (text) => { const line = `${stamp()} ${text}\n`; process.stdout.write(line); fs.appendFileSync(logPath, line); };
    const die = (text) => { say(`STOP: ${text}`); process.exit(1); };

    say(`overnight playtest for ${options.date}: models [${options.models.join(' ')}], ${options.runs} sessions each, starter ${options.starter}, seeds from ${options.seedDate}`);

    say('check 1/3: Claude Code');
    if (options.dryRun) say('  (dry run: not checked)');
    else {
        const version = run('claude', ['--version']);
        if (version.code !== 0) die("'claude' was not found. Open a new terminal and try 'claude --version'; sign in once by running 'claude'.");
        say(`  ${version.out.split('\n')[0]}`);
    }
    if (process.env.ANTHROPIC_API_KEY && !options.allowApiKey) {
        die('ANTHROPIC_API_KEY is set, so Claude Code would bill that account instead of using your plan. Remove it from this terminal ($env:ANTHROPIC_API_KEY=$null in PowerShell, unset ANTHROPIC_API_KEY in bash), or add --allow-api-key if you mean it.');
    }

    say('check 2/3: the playtest tool plays real moves through its command line, in every mode');
    const smoke = path.join('results', 'playtest', `.overnight-check-${process.pid}`);
    fs.mkdirSync(smoke, { recursive: true });
    const cleanUp = () => fs.rmSync(smoke, { recursive: true, force: true });
    process.on('exit', cleanUp);
    for (const mode of ['run', 'turn', 'card']) {
        const first = npmRun(['playtest', '--', 'new', '--results', smoke, '--session', mode, '--seed', 'overnight-check', '--starter', 'kraken_v1', '--gym', '2', '--mode', mode]);
        if (first.code !== 0) die(`the playtest tool could not start a ${mode} session: ${first.out}`);
        if (!hasForecast(first.out)) die(`the first screen of a ${mode} session has no run forecast (ticket 193j). Something changed in the tool.`);
        for (let i = 1; i <= 6; i += 1) {
            const move = npmRun(['playtest', '--', 'move', '--results', smoke, '--session', mode, '1', '--why', 'overnight check']);
            if (move.code !== 0) die(`move ${i} of a ${mode} session failed: ${move.out}`);
        }
        say(`  ${mode}: ok`);
    }

    say("check 3/3: the night's plan");
    const plan = npmRun(['playtest:night', '--', ...planCheckArgs(options)]);
    if (plan.code !== 0) die(`the night script could not plan the night: ${plan.out}`);
    say(`  ${plan.out.split('\n').filter((l) => /^r\d\d: seed/.test(l)).length} sessions planned; first: ${plan.out.split('\n')[0]}`);

    let failed = 0;
    const playNext = (index) => {
        if (index >= options.models.length) return finish();
        const model = options.models[index];
        const args = nightArgs(options, model);
        say(`night: ${model} -> results/playtest/${options.date}-${model}`);
        say(`  npm run playtest:night -- ${args.join(' ')}`);
        const child = spawn('npm', ['run', '--silent', 'playtest:night', '--', ...args.map(shellQuote)], { shell: onWindows, stdio: ['ignore', 'pipe', 'pipe'] });
        const forward = (chunk) => { process.stdout.write(chunk); fs.appendFileSync(logPath, chunk); };
        child.stdout.on('data', forward);
        child.stderr.on('data', forward);
        child.on('error', (error) => { say(`  the ${model} night could not start: ${error}`); failed = 1; playNext(index + 1); });
        child.on('close', (code) => {
            if (code !== 0) { say(`  the ${model} night stopped with an error (see above)`); failed = 1; }
            playNext(index + 1);
        });
        return undefined;
    };
    const finish = () => {
        say('done. Reports (read the table at the top first):');
        for (const model of options.models) say(`  docs/playtest/agent-runs/${options.date}-${model}.md   (sessions in results/playtest/${options.date}-${model}/)`);
        say(`log: ${logPath}`);
        process.exit(failed);
    };
    playNext(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
