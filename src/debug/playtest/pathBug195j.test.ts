/**
 * TICKET 195j — the path bug.
 *
 * On Windows the night script built the results folder with `path.join`, which gives
 * `results\playtest\2026-10-05-haiku`. The agent's Bash tool is Git Bash, which treats an unquoted
 * backslash as an escape and drops it, so 21 of 36 haiku sessions wrote into a folder named
 * `resultsplaytest2026-10-05-haiku`. The prompt now names the folder with forward slashes, which
 * Node and the tool both accept on Windows. And a `state` on a folder with no such session says
 * where it looked and what to check, instead of leaving the agent to start a new one.
 */
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';

import { parseArgs } from './args';
import { COMMANDS } from './commands';
import { tempRoot } from './testKit';

interface NightScript {
    promptFor(entry: { session: string; mode: string }, brief: string, resultsDir: string): string;
}
const scriptPath = resolve(__dirname, '../../../scripts/playtest-night.mjs');
const loadScript = async (): Promise<NightScript> => (await import(/* @vite-ignore */ scriptPath)) as NightScript;

const ENTRY = { session: 'r12', mode: 'run' };

describe('195j — the prompt names the results folder with forward slashes', () => {
    it('a Windows-style folder reaches the agent with no backslash in it', async () => {
        const { promptFor } = await loadScript();
        const prompt = promptFor(ENTRY, 'brief', 'results\\playtest\\2026-10-05-haiku');
        expect(prompt).not.toContain('\\');
        expect(prompt).toContain('--results results/playtest/2026-10-05-haiku');
        expect(prompt).toContain('state --session r12 --results results/playtest/2026-10-05-haiku');
    });

    it('a folder that already uses forward slashes is left as it is', async () => {
        const { promptFor } = await loadScript();
        expect(promptFor(ENTRY, 'brief', 'results/playtest/2026-10-05-sonnet')).toContain('--results results/playtest/2026-10-05-sonnet\n');
    });
});

describe('195j — state on a session that is not there', () => {
    const state = (root: string, name: string) => COMMANDS.state(root, parseArgs(['state', '--session', name]));

    it('says which folder it looked in and to check the --results path, and fails', () => {
        const root = tempRoot();
        const result = state(root, 'r12');
        expect(result.code).not.toBe(0);
        expect(result.out).toBe(`No session r12 in ${root}. Check the --results path.`);
    });

    it('the card command says the same when its session is missing', () => {
        const root = tempRoot();
        const result = COMMANDS.card(root, parseArgs(['card', '--session', 'r12', 'tackle']));
        expect(result.code).not.toBe(0);
        expect(result.out).toBe(`No session r12 in ${root}. Check the --results path.`);
    });
});
