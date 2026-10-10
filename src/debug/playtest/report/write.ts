/** TICKET 180f — gather a night's sessions and write its report file (LF line endings). 196a: and its card table. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { cardsCsv } from './cardsCsv';
import { gatherRun, sessionsIn, type RunFact } from './facts';
import { renderReport } from './render';

export const REPORT_DIR = join('docs', 'playtest', 'agent-runs');

/** Every session of one night, read by replaying it. */
function gatherNight(date: string, resultsRoot: string): RunFact[] {
    const root = join(resultsRoot, date);
    const names = sessionsIn(root);
    if (names.length === 0) throw new Error(`no sessions under ${root}`);
    return names.map((name) => gatherRun(root, name));
}

/** The report, and (196a) beside it `<date>-cards.csv`, the full card tallies the report's lists are the top of. */
export function writeReport(date: string, resultsRoot: string, outDir: string): { readonly path: string; readonly cardsPath: string; readonly runs: number } {
    const runs = gatherNight(date, resultsRoot);
    mkdirSync(outDir, { recursive: true });
    const path = join(outDir, `${date}.md`);
    writeFileSync(path, renderReport(date, runs), { encoding: 'utf8' });
    const cardsPath = join(outDir, `${date}-cards.csv`);
    writeFileSync(cardsPath, cardsCsv(runs), { encoding: 'utf8' });
    return { path, cardsPath, runs: runs.length };
}

/** TICKET 196a — several nights' card tallies added into one table, `<date>+<date>...-cards.csv`. */
export function writeCardsTable(dates: ReadonlyArray<string>, resultsRoot: string, outDir: string): { readonly path: string; readonly runs: number } {
    const runs = dates.flatMap((date) => gatherNight(date, resultsRoot));
    mkdirSync(outDir, { recursive: true });
    const path = join(outDir, `${dates.join('+')}-cards.csv`);
    writeFileSync(path, cardsCsv(runs), { encoding: 'utf8' });
    return { path, runs: runs.length };
}
