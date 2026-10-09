/**
 * TICKET 180f — `npm run playtest:report -- <date>`.
 *
 * Reads every session under `results/playtest/<date>/` (replaying each), and writes
 * `docs/playtest/agent-runs/<date>.md` with LF line endings. `--results <folder>` and `--out <folder>`
 * point it elsewhere. It also writes `<date>-cards.csv`, every card's tallies (196a).
 *
 * TICKET 196a — `npm run playtest:report -- --cards <date> <date> ...` adds several nights' card tallies into one
 * table, `<date>+<date>...-cards.csv`, and writes no report.
 */
import { parseArgs } from '../args';
import { DEFAULT_ROOT } from '../sessionFile';
import { REPORT_DIR, writeCardsTable, writeReport } from './write';

const args = parseArgs(process.argv.slice(2));
const date = args.command;
// `--cards a b c` parses as the flag `cards` = a, then b as the command and c as a positional.
const cardNights = typeof args.flags.cards === 'string' ? [args.flags.cards, ...(date ? [date] : []), ...args.positional] : [];
if (!date && cardNights.length === 0) {
    process.stdout.write('Usage: npm run playtest:report -- <date>   (the folder name under results/playtest/)\n');
    process.stdout.write('       npm run playtest:report -- --cards <date> <date> ...   (several nights\' card tallies in one table)\n');
    process.exit(1);
}
try {
    const resultsRoot = typeof args.flags.results === 'string' ? args.flags.results : DEFAULT_ROOT;
    const outDir = typeof args.flags.out === 'string' ? args.flags.out : REPORT_DIR;
    const sessions = (runs: number) => `${runs} session${runs === 1 ? '' : 's'}`;
    if (cardNights.length > 0) {
        const { path, runs } = writeCardsTable(cardNights, resultsRoot, outDir);
        process.stdout.write(`Wrote ${path} from ${sessions(runs)} over ${cardNights.length} night${cardNights.length === 1 ? '' : 's'}.\n`);
    } else {
        const { path, cardsPath, runs } = writeReport(date!, resultsRoot, outDir);
        process.stdout.write(`Wrote ${path} and ${cardsPath} from ${sessions(runs)}.\n`);
    }
} catch (error) {
    process.stdout.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
}
