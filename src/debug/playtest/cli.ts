/**
 * TICKET 180a — `npm run playtest -- <command>`.
 *
 *   new   --session s1 --seed ps1 --starter <firmware> --gym 0 --mode run|turn|card
 *   state --session s1 [--json]
 *   move  --session s1 <n> --why "<one sentence>" [--expect '<json>']
 *   moves --session s1 <n,n,n> --why "..."
 *   card  --session s1 <card name>
 *   note  --session s1 "<text>"
 *   plan  --date <YYYY-MM-DD> [--runs 10]   (the night's sessions as JSON; no --session)
 *   replay --session s1 --to <n>     (the screen after the first n moves; read-only)
 *
 * Sessions live under `results/playtest/` unless `--results <folder>` says otherwise (the nightly script points
 * each night at `results/playtest/<date>/`). Not an environment variable: the repo's vite config empties
 * `process.env` for everything vite-node runs, so one could never be read here.
 *
 * A thin shell over `commands.ts`: it parses argv, runs one command, prints, and sets the exit code.
 */
import { parseArgs } from './args';
import { COMMANDS } from './commands';
import { DEFAULT_ROOT } from './sessionFile';

const args = parseArgs(process.argv.slice(2));
const run = args.command ? COMMANDS[args.command] : undefined;

if (!run) {
    process.stdout.write(`Commands: ${Object.keys(COMMANDS).join(', ')}. Every one takes --session <name>.\n`);
    process.exit(args.command ? 1 : 0);
}

try {
    const result = run(typeof args.flags.results === 'string' ? args.flags.results : DEFAULT_ROOT, args);
    process.stdout.write(`${result.out}\n`);
    process.exit(result.code);
} catch (error) {
    process.stdout.write(`The playtester hit an error: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(2);
}
