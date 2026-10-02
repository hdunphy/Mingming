/** TICKET 180f — gather a night's sessions and write its report file (LF line endings). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { gatherRun, sessionsIn } from './facts';
import { renderReport } from './render';

export const REPORT_DIR = join('docs', 'playtest', 'agent-runs');

export function writeReport(date: string, resultsRoot: string, outDir: string): { readonly path: string; readonly runs: number } {
    const root = join(resultsRoot, date);
    const names = sessionsIn(root);
    if (names.length === 0) throw new Error(`no sessions under ${root}`);
    const runs = names.map((name) => gatherRun(root, name));
    mkdirSync(outDir, { recursive: true });
    const path = join(outDir, `${date}.md`);
    writeFileSync(path, renderReport(date, runs), { encoding: 'utf8' });
    return { path, runs: runs.length };
}
