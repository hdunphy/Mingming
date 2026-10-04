/**
 * TICKET 193i — the night script can be given another brief, and says so when there is nothing to do.
 *
 * `runNight` already read `options.briefPath`, but `parseNightArgs` never set it, so a second brief
 * could not be chosen from the command line. And Henry's first rerun on a finished date printed a
 * column of "already done" lines and nothing that said why nothing ran.
 */
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';

interface NightScript {
    DEFAULTS: { briefPath: string };
    parseNightArgs(argv: string[], today?: string): { briefPath?: string; date: string };
    summaryLines(done: Array<Record<string, unknown>>, options: { date: string; dryRun?: boolean }): string[];
}
const load = async (): Promise<NightScript> => (await import(/* @vite-ignore */ resolve(__dirname, '../../../scripts/playtest-night.mjs'))) as NightScript;

describe('193i — --brief', () => {
    it('--brief <path> sets briefPath, and without it the option is left to the default', async () => {
        const { parseNightArgs } = await load();
        expect(parseNightArgs(['--brief', 'docs/playtest/agent-player-primed.md'], '2026-10-05').briefPath).toBe('docs/playtest/agent-player-primed.md');
        expect(parseNightArgs([], '2026-10-05').briefPath).toBeUndefined();
    });
});

describe('193i — a night with nothing left to play', () => {
    const skipped = (n: number) => Array.from({ length: n }, (_, i) => ({ session: `r0${i + 1}`, skipped: true }));
    const played = { session: 'r04', minutes: 3, timedOut: false };

    it('says so first, with the date and the two ways out, when every session was already finished', async () => {
        const { summaryLines } = await load();
        const lines = summaryLines(skipped(3), { date: '2026-10-04' });
        expect(lines[0]).toBe('Every session for 2026-10-04 is already finished; use --date <new date> for a fresh night, or delete results/playtest/2026-10-04.');
        // the per-session lines still follow
        expect(lines.slice(1)).toEqual(['r01: already done', 'r02: already done', 'r03: already done']);
    });

    it('says nothing of the kind when something was played, or when nothing was planned', async () => {
        const { summaryLines } = await load();
        expect(summaryLines([...skipped(2), played], { date: '2026-10-04' }).join('\n')).not.toMatch(/already finished/);
        expect(summaryLines([], { date: '2026-10-04' })).toEqual([]);
    });

    it('does not claim a dry run was finished', async () => {
        const { summaryLines } = await load();
        const dry = [{ session: 'r01', dryRun: true, command: 'claude -p' }];
        expect(summaryLines(dry, { date: '2026-10-04', dryRun: true })).toEqual(['r01: claude -p']);
    });
});
