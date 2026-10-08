/**
 * TICKET 202c — the end of a run tells the agent what to do next, in one set of words.
 *
 * The end-of-run screen and the two briefs say the same sentence ("Run 1 is over. Start run 2 with: ..."),
 * and both take it from `runOverLine`. Only the ticket's own words are pinned.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { OLD_WORDS } from '../../ui/labels/labels';
import { parseArgs } from './args';
import { COMMANDS } from './commands';
import { runOverLine } from './runOver';
import { sessionPath } from './sessionFile';
import { starter, tempRoot } from './testKit';

const cmd = (root: string, line: string) => {
    const tokens = [...line.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
    const args = parseArgs(tokens);
    return COMMANDS[args.command!](root, args);
};

const NEW = `new --session s1 --seed pt2026-10-04:3 --starter ${starter()} --gym 1 --mode run --budget 1`;
const MOVE = 'move --session s1 1 --why "one decision ends the run"';

describe('202c — the sentence', () => {
    it('says run 1 is over and how to start run 2, and run 2 is the end of the session', () => {
        expect(runOverLine(1)).toMatch(/^Run 1 is over\. Start run 2 with: npm run playtest -- again --session /);
        expect(runOverLine(2)).toMatch(/^Run 2 is over\./);
        expect(runOverLine(2)).not.toContain('again');
    });

    it('uses the game\'s words: no old currency, workshop, macro or blueprint', () => {
        for (const run of [1, 2] as const) {
            OLD_WORDS.lastIndex = 0;
            expect(runOverLine(run).match(OLD_WORDS)).toBeNull();
        }
    });
});

describe('202c — the end screen', () => {
    it('says it when run 1 is over, and when run 2 is over', () => {
        const root = tempRoot();
        cmd(root, NEW);
        cmd(root, MOVE);
        expect(cmd(root, 'state --session s1').out).toContain(runOverLine(1));
        cmd(root, 'again --session s1');
        expect(cmd(root, 'state --session s1').out).not.toContain(runOverLine(1));
        cmd(root, MOVE);
        const end = cmd(root, 'state --session s1').out;
        expect(end).toContain(runOverLine(2));
        expect(end).not.toContain(runOverLine(1));
    });

    it('says nothing of the kind on a session written before this ticket', () => {
        const root = tempRoot();
        cmd(root, NEW);
        cmd(root, MOVE);
        const path = sessionPath(root, 's1');
        const old = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
        delete old.twoRuns;
        writeFileSync(path, JSON.stringify(old));
        const end = cmd(root, 'state --session s1').out;
        expect(end).toContain('RUN OVER');
        expect(end).not.toMatch(/Run [12] is over/);
    });
});

describe.each(['agent-player.md', 'agent-player-primed.md'])('202c — the brief %s', (file) => {
    const brief = readFileSync(resolve(__dirname, '../../../docs/playtest', file), 'utf8');
    // the brief wraps its lines; the sentence is the same once the wrapping is read as spaces
    const whatToDo = brief.slice(brief.indexOf('## What to do'), brief.indexOf('## Battles')).replace(/\s+/g, ' ');

    it('tells the agent, under "What to do", to start a second run with again when the run ends, and that the session ends with run 2', () => {
        expect(whatToDo).toContain('`again`');
        expect(whatToDo).toMatch(/second run/);
        expect(whatToDo).toMatch(/run 2 ends/);
        expect(whatToDo).toContain(runOverLine(1));
    });

    it('stays LF', () => {
        expect(brief).not.toContain('\r');
    });
});
