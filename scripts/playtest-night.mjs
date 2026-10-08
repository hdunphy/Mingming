#!/usr/bin/env node
/**
 * `npm run playtest:night` — ticket 180f: one night of agent playtests, run one after another.
 *
 * WHAT IT DOES. Asks the playtester for the night's plan (`playtest -- plan`: seeds `pt<date>:<i>`,
 * the twelve starters in rotation, each starter against the gym its element beats (195k), `run` mode for most sessions and one `card`
 * session for surprises), starts each session (`playtest -- new`), and hands it to a driver: a
 * headless Claude Code session (A1) whose only allowed command is the playtest tool, given the brief
 * in docs/playtest/agent-player.md. Each session has a wall-clock limit. Whatever the driver reports
 * about tokens, cost and turns is written beside the session as `driver.json`. Raw sessions and
 * logs go to `results/playtest/<date>/` (not committed). At the end it writes the morning report,
 * `docs/playtest/agent-runs/<date>.md` (`npm run playtest:report -- <date>`).
 *
 * TWO RUNS A SESSION (202c). The brief tells the agent to start a second run on the same save (`playtest -- again`)
 * when the first ends, so one session is two runs, in one session file and one driver conversation. `--runs` still
 * counts sessions. The wall-clock limit (80 minutes) is for the whole session; the stall limit (202h) is for each run,
 * because `again` and every move write the session file. A stall in run 2 ends the driver and the retry resumes from a
 * session file that still holds run 1.
 *
 * RESUMABLE. A session with a `driver.json` is finished and skipped; a session folder without one
 * was interrupted, and is picked up where it stopped (the session file holds every move so far).
 * 202e: but only if it was started for the same seed, starter and gym as tonight's plan says; otherwise
 * the night stops, before any driver starts, and says which folder to delete or which flags to repeat.
 *
 * Node rather than shell, like the other scripts here, because Henry is on Windows.
 *
 * Usage:
 *   npm run playtest:night                        ten sessions, tonight's date, the small model
 *   npm run playtest:night -- --runs 2 --minutes 15
 *   npm run playtest:night -- --model sonnet       another model (A3's pilot compares them)
 *   npm run playtest:night -- --starter kraken_v1  every session plays this starter (default: all twelve in turn)
 *   npm run playtest:night -- --max-usd 1          a dollar cap per session (default 10)
 *   npm run playtest:night -- --date 2026-10-02    resume or redo a particular night
 *   npm run playtest:night -- --brief docs/playtest/other.md   give the driver another brief (193i)
 *   npm run playtest:night -- --date 2026-10-06 --seed-date 2026-10-04   a new night on 10-04's seeds (193k)
 *   npm run playtest:night -- --dry-run            print the plan and each driver command, run nothing
 *   npm run playtest:night -- --no-report          skip the morning report at the end
 *   npm run playtest:night -- --card-runs 1 --turn-runs 0   how many sessions are card / turn mode
 *   npm run playtest:night -- --stall-minutes 8    end a session with no move for this long, retry it at the end (202h; 0 = off)
 *
 * 202h: every session leaves `driver.log` beside it, the driver's stream with the time on every line,
 * and `driver.json` says how the driver ended (`subtype`, `isError`) and whether it `stalled`.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDriverLog } from './night/driverLog.mjs';
import { readOutcome } from './night/driverOutcome.mjs';
import { findResult } from './night/resultRecord.mjs';
import { shouldRetry } from './night/retryPolicy.mjs';
import { createStallWatch } from './night/stallWatch.mjs';
import { ResumeMismatchError, resumeMatchesPlan, resumeRefusal } from './resumeGuard.mjs';

export const DEFAULTS = Object.freeze({
    runs: 10,
    model: 'haiku',
    /** 202c: a session plays two runs, so the limit is 80 minutes (it was 35 for one run). */
    minutes: 80,
    maxTurns: 600,
    /** A dollar cap for one session, so a first night cannot run away. */
    maxUsd: 10,
    /** 202h: a session with no move for this many minutes is ended as stalled and retried once at the end. */
    stallMinutes: 8,
    cardRuns: 1,
    turnRuns: 0,
    briefPath: path.join('docs', 'playtest', 'agent-player.md'),
    resultsRoot: path.join('results', 'playtest'),
});

const todayLocal = () => {
    const d = new Date();
    const two = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};

/** `--flag value` and bare `--flag`, as the other scripts read them. */
export function parseNightArgs(argv, today = todayLocal()) {
    const flags = {};
    for (let i = 0; i < argv.length; i += 1) {
        if (!argv[i].startsWith('--')) continue;
        const name = argv[i].slice(2);
        const next = argv[i + 1];
        if (next === undefined || next.startsWith('--')) flags[name] = true;
        else { flags[name] = next; i += 1; }
    }
    const number = (name, fallback) => {
        if (flags[name] === undefined) return fallback;
        const value = Number(flags[name]);
        if (!Number.isFinite(value) || value < 0) throw new Error(`--${name} must be a number, 0 or more`);
        return value;
    };
    const runs = number('runs', DEFAULTS.runs);
    return {
        date: typeof flags.date === 'string' ? flags.date : today,
        runs,
        model: typeof flags.model === 'string' ? flags.model : DEFAULTS.model,
        minutes: number('minutes', DEFAULTS.minutes),
        maxTurns: number('max-turns', DEFAULTS.maxTurns),
        maxUsd: number('max-usd', DEFAULTS.maxUsd),
        stallMinutes: number('stall-minutes', DEFAULTS.stallMinutes),
        starter: typeof flags.starter === 'string' ? flags.starter : undefined,
        // 193i: another brief for the driver (the default is docs/playtest/agent-player.md)
        briefPath: typeof flags.brief === 'string' ? flags.brief : undefined,
        // 193k: name the seeds after another night's date, to play that night's worlds again in a new folder
        seedDate: typeof flags['seed-date'] === 'string' ? flags['seed-date'] : undefined,
        // one session is a trial: play it in run mode, the cheap one, unless card mode is asked for
        cardRuns: number('card-runs', runs > 1 ? DEFAULTS.cardRuns : 0),
        turnRuns: number('turn-runs', DEFAULTS.turnRuns),
        dryRun: flags['dry-run'] === true,
        report: flags['no-report'] !== true,
    };
}

/**
 * The driver's command line (A1): a headless Claude Code run whose only allowed command is the
 * playtest tool (A4: it cannot read src/, the data, the tickets or the balance docs). The prompt
 * goes in on stdin, so it never has to survive a shell's quoting. The exact flags are the ones
 * Claude Code documents for headless use; the pilot (180g) is where they are first run for real.
 */
export function driverCommand(entry, options) {
    return {
        command: 'claude',
        args: [
            '-p',
            // 202h: one JSON object per line, so the session leaves a transcript (`driver.log`); the
            // result record is still the last line. stream-json needs --verbose in a headless run.
            '--output-format', 'stream-json',
            '--verbose',
            '--model', options.model,
            '--max-turns', String(options.maxTurns),
            '--max-budget-usd', String(options.maxUsd),
            // A4. Read, Glob and Grep need no permission in a headless run, so allowing one command is not
            // enough: the built-in tools are cut to Bash, and anything off the allow list is refused.
            '--tools', 'Bash',
            '--permission-mode', 'dontAsk',
            '--allowedTools', 'Bash(npm run playtest -- *)',
        ],
        stdin: promptFor(entry, options.brief, path.join(DEFAULTS.resultsRoot, options.date)),
    };
}

/** The brief, then the one thing that is different about this session. */
export function promptFor(entry, brief, resultsDirectory) {
    // 195j: the agent's Bash is Git Bash, which drops an unquoted backslash, so the folder is named with forward slashes.
    const resultsDir = resultsDirectory.replace(/\\/g, '/');
    return [
        brief.trimEnd(),
        '',
        '---',
        `Your session is named ${entry.session} and is already started (mode: ${entry.mode}).`,
        `Every command you run must end with: --results ${resultsDir}`,
        `Begin with: npm run playtest -- state --session ${entry.session} --results ${resultsDir}`,
        '',
    ].join('\n');
}

/** What a driver's JSON result says about tokens, cost and turns. Anything missing is left out. */
export function readUsage(stdout) {
    const record = findResult(stdout);
    if (!record) return {};
    const usage = record.usage ?? {};
    const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const tokens = n(usage.input_tokens) + n(usage.output_tokens) + n(usage.cache_creation_input_tokens) + n(usage.cache_read_input_tokens);
    return {
        ...(tokens > 0 ? { tokens } : {}),
        ...(typeof record.total_cost_usd === 'number' ? { costUsd: record.total_cost_usd } : {}),
        ...(typeof record.num_turns === 'number' ? { turns: record.num_turns } : {}),
    };
}

const onWindows = process.platform === 'win32';
/** On Windows the shims (npm, claude) are .cmd files, which only a shell can start; quote what needs it. */
const shellQuote = (arg) => (onWindows && /[\s()*]/.test(arg) ? `"${arg}"` : arg);

function killTree(child) {
    if (onWindows) spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f']);
    else child.kill('SIGKILL');
}

/**
 * Run the driver with a wall-clock limit. Resolves with what happened; never rejects.
 * 202h: `spec.logPath` gets the timestamped transcript, and `spec.sessionFile` is watched: no move
 * for `stallMinutes` ends the driver and the result says `stalled`.
 */
function runDriverProcess(spec, minutes, stallMinutes = 0) {
    return new Promise((resolve) => {
        const started = Date.now();
        let timedOut = false;
        let stalled = false;
        let stdout = '';
        let child;
        const log = spec.logPath ? createDriverLog(spec.logPath) : undefined;
        try {
            child = spawn(spec.command, spec.args.map(shellQuote), { shell: onWindows, stdio: ['pipe', 'pipe', 'pipe'] });
        } catch (error) {
            resolve({ exitCode: -1, timedOut: false, minutes: 0, stdout: '', error: String(error) });
            return;
        }
        const timer = setTimeout(() => { timedOut = true; log?.note(`hit the ${minutes}-minute limit`); killTree(child); }, minutes * 60_000);
        const watch = spec.sessionFile
            ? createStallWatch({ sessionFile: spec.sessionFile, stallMinutes, onStall: () => { stalled = true; log?.note(`no move for ${stallMinutes} minutes: ending the session as stalled`); killTree(child); } })
            : { close: () => {} };
        const finish = (result) => { clearTimeout(timer); watch.close(); log?.flush(); resolve({ ...result, ...(stalled ? { stalled: true } : {}) }); };
        child.stdout.on('data', (chunk) => { stdout += chunk; log?.out(chunk); });
        child.stderr.on('data', (chunk) => { process.stderr.write(chunk); log?.err(chunk); });
        child.on('error', (error) => finish({ exitCode: -1, timedOut, minutes: (Date.now() - started) / 60_000, stdout, error: String(error) }));
        child.on('close', (code) => finish({ exitCode: code ?? -1, timedOut, minutes: (Date.now() - started) / 60_000, stdout }));
        child.stdin.on('error', () => {});
        child.stdin.end(spec.stdin);
    });
}

/** The playtest tool, as a child process (it is TypeScript, run by vite-node through the npm script). */
function playtest(args) {
    const result = spawnSync('npm', ['run', '--silent', 'playtest', '--', ...args.map(shellQuote)], {
        encoding: 'utf8', shell: onWindows,
    });
    return { code: result.status ?? 1, out: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** The `plan` command's arguments for these options (193k adds `--seed-date`). */
export const planArgs = (options) => [
    'plan', '--date', options.date, '--runs', String(options.runs), '--card-runs', String(options.cardRuns), '--turn-runs', String(options.turnRuns),
    ...(options.starter ? ['--starter', options.starter] : []),
    ...(options.seedDate ? ['--seed-date', options.seedDate] : []),
];

export const realDeps = (options) => ({
    plan: () => {
        const result = playtest(planArgs(options));
        if (result.code !== 0) throw new Error(`could not plan the night: ${result.out}`);
        return JSON.parse(result.out);
    },
    newSession: (entry) => {
        const result = playtest(
            ['new', '--session', entry.session, '--seed', entry.seed, '--starter', entry.starter, '--gym', String(entry.gym), '--mode', entry.mode, '--tier', String(entry.tier), '--results', path.join(DEFAULTS.resultsRoot, options.date)],
        );
        if (result.code !== 0) throw new Error(`could not start ${entry.session}: ${result.out}`);
    },
    runDriver: (spec) => runDriverProcess(spec, options.minutes, options.stallMinutes),
});

/**
 * 202e: every interrupted session in the plan must have been started for the entry it sits in. Checked for the
 * whole night up front, so a mismatch at r05 stops the night before r01 spends anything.
 */
function assertResumable(entries, options, nightDir) {
    for (const entry of entries) {
        const folder = path.join(nightDir, entry.session);
        const sessionPath = path.join(folder, 'session.json');
        if (fs.existsSync(path.join(folder, 'driver.json')) || !fs.existsSync(sessionPath)) continue;
        let session;
        try { session = JSON.parse(fs.readFileSync(sessionPath, 'utf8')); } catch { session = {}; }
        if (!resumeMatchesPlan(session, entry)) {
            throw new ResumeMismatchError(resumeRefusal(session, entry, path.posix.join('results', 'playtest', options.date, entry.session)));
        }
    }
}

/**
 * One night. `deps` is the seam the tests use: `plan()`, `newSession(entry)`, `runDriver(spec)` and
 * the folder the night lives in. Returns what it did, session by session.
 */
export async function runNight(options, deps, root = DEFAULTS.resultsRoot) {
    const nightDir = path.join(root, options.date);
    const brief = fs.readFileSync(options.briefPath ?? DEFAULTS.briefPath, 'utf8');
    const entries = deps.plan();
    assertResumable(entries, options, nightDir);
    const done = [];
    const driven = [];
    for (const entry of entries) {
        const folder = path.join(nightDir, entry.session);
        const recordPath = path.join(folder, 'driver.json');
        if (fs.existsSync(recordPath)) { done.push({ session: entry.session, skipped: true }); continue; }
        const spec = driverCommand(entry, { ...options, brief });
        if (!options.dryRun && !fs.existsSync(path.join(folder, 'session.json'))) deps.newSession(entry);
        if (options.dryRun) {
            done.push({ session: entry.session, dryRun: true, command: [spec.command, ...spec.args].join(' ') });
            continue;
        }
        const record = await driveSession(entry, spec, folder, options, deps);
        done.push(record);
        driven.push({ entry, spec, folder, index: done.length - 1 });
    }
    // 202h: a session that stalled, or whose driver failed before its time was up, is played once
    // more at the end. The session file holds every move, so this resumes rather than restarts.
    for (const { entry, spec, folder, index } of driven) {
        const first = done[index];
        if (!shouldRetry(first)) continue;
        const { session: _s, index: _i, mode: _m, model: _model, ...firstAttempt } = first;
        done[index] = await driveSession(entry, spec, folder, options, deps, firstAttempt);
    }
    return done;
}

/** Drive one session once and write its `driver.json`. `firstAttempt` marks a retry. */
async function driveSession(entry, spec, folder, options, deps, firstAttempt) {
    fs.mkdirSync(folder, { recursive: true });
    const watched = { ...spec, sessionFile: path.join(folder, 'session.json'), logPath: path.join(folder, 'driver.log') };
    const result = await deps.runDriver(watched);
    const record = {
        session: entry.session, index: entry.index, mode: entry.mode, model: options.model,
        minutes: Math.round(result.minutes * 100) / 100, exitCode: result.exitCode, timedOut: result.timedOut,
        ...(result.stalled ? { stalled: true } : {}),
        ...readUsage(result.stdout ?? ''),
        ...readOutcome(result.stdout ?? ''),
        ...(result.error ? { error: result.error } : {}),
        ...(firstAttempt ? { firstAttempt } : {}),
    };
    fs.writeFileSync(path.join(folder, 'driver.json'), `${JSON.stringify(record, null, 2)}\n`);
    return record;
}

/**
 * What the night prints, one line each. 193i: when EVERY planned session was already finished, the
 * first line says so and how to get a fresh night, because a column of "already done" lines does not.
 */
export function summaryLines(done, options) {
    const lines = done.map((d) => `${d.session}: ${d.skipped ? 'already done' : d.dryRun ? d.command : `${d.minutes} min${d.timedOut ? ' (hit the time limit)' : ''}${d.stalled ? ' (stalled)' : ''}${d.firstAttempt ? ` (retried; first try ${d.firstAttempt.minutes} min${d.firstAttempt.stalled ? ', stalled' : ''})` : ''}${d.tokens ? `, ${d.tokens} tokens` : ''}`}`);
    if (done.length > 0 && done.every((d) => d.skipped)) {
        const folder = path.posix.join('results', 'playtest', options.date);
        lines.unshift(`Every session for ${options.date} is already finished; use --date <new date> for a fresh night, or delete ${folder}.`);
    }
    return lines;
}

async function main() {
    const options = parseNightArgs(process.argv.slice(2));
    const deps = realDeps(options);
    if (options.dryRun) {
        const plan = deps.plan();
        process.stdout.write(`${plan.map((e) => `${e.session}: seed ${e.seed}, ${e.starter}, gym ${e.gym}, ${e.mode} mode`).join('\n')}\n`);
    }
    const done = await runNight(options, deps);
    process.stdout.write(summaryLines(done, options).map((line) => `${line}\n`).join(''));
    if (options.report && !options.dryRun) {
        const result = spawnSync('npm', ['run', '--silent', 'playtest:report', '--', options.date], { encoding: 'utf8', shell: onWindows });
        process.stdout.write(result.stdout ?? '');
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    main().catch((error) => { process.stderr.write(`${error instanceof ResumeMismatchError ? error.message : error.stack ?? error}\n`); process.exit(1); });
}

