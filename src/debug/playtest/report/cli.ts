/**
 * TICKET 180f — `npm run playtest:report -- <date>`.
 *
 * Reads every session under `results/playtest/<date>/` (replaying each), and writes
 * `docs/playtest/agent-runs/<date>.md` with LF line endings. `--results <folder>` and `--out <folder>`
 * point it elsewhere.
 */
import { parseArgs } from '../args';
import { DEFAULT_ROOT } from '../sessionFile';
import { REPORT_DIR, writeReport } from './write';

const args = parseArgs(process.argv.slice(2));
const date = args.command;
if (!date) {
    process.stdout.write('Usage: npm run playtest:report -- <date>   (the folder name under results/playtest/)\n');
    process.exit(1);
}
try {
    const resultsRoot = typeof args.flags.results === 'string' ? args.flags.results : DEFAULT_ROOT;
    const outDir = typeof args.flags.out === 'string' ? args.flags.out : REPORT_DIR;
    const { path, runs } = writeReport(date, resultsRoot, outDir);
    process.stdout.write(`Wrote ${path} from ${runs} session${runs === 1 ? '' : 's'}.\n`);
} catch (error) {
    process.stdout.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
}
