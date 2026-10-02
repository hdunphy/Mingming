/**
 * TICKET 180d — the decision budget, the one-move-per-call rule of `card` mode, and `moves` lists.
 *
 * A decision is one call. A whole battle turn sent as one `moves` list is one decision, and a run
 * that uses up its budget ends cleanly with outcome `budget` (never mid-list), and replays the same.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { parseArgs } from './args';
import { COMMANDS } from './commands';
import { sessionPath } from './sessionFile';
import { starter, tempRoot } from './testKit';
import { replayWorld, stateHash, DEFAULT_BUDGET, decisionsIn } from './world';
import type { SessionFile } from './types';
import { runOf } from './types';
import { currentScreen } from './screen';

const run = (root: string, line: string) => {
    const tokens = [...line.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
    const args = parseArgs(tokens);
    return COMMANDS[args.command!](root, args);
};
const NEW = (mode: string, extra = '', seed = 'ps4') => `new --session s1 --seed ${seed} --starter ${starter()} --gym 0 --mode ${mode} ${extra}`;
const saved = (root: string): SessionFile => JSON.parse(readFileSync(sessionPath(root, 's1'), 'utf8')) as SessionFile;

describe('180d — the decision budget', () => {
    it('is 400 decisions unless the session says otherwise', () => {
        expect(DEFAULT_BUDGET).toBe(400);
    });

    it('stops the run with outcome `budget` when the decisions are used up', () => {
        const root = tempRoot();
        run(root, NEW('run', '--budget 2', 'ps1'));
        expect(run(root, 'move --session s1 1 --why "go"').out).not.toMatch(/RUN OVER/);
        const last = run(root, 'move --session s1 1 --why "go"');
        expect(last.code).toBe(0);
        expect(last.out).toMatch(/RUN OVER: budget/);
        // and nothing more can be played
        const more = run(root, 'move --session s1 1 --why "again"');
        expect(more.code).toBe(1);
        expect(saved(root).moves).toHaveLength(2);
    });

    it('the stopped session replays to the same ended state', () => {
        const root = tempRoot();
        run(root, NEW('run', '--budget 2', 'ps1'));
        run(root, 'move --session s1 1 --why "go"');
        run(root, 'move --session s1 1 --why "go"');
        const file = saved(root);
        const world = replayWorld(file, file.moves);
        expect(runOf(world).phase).toBe('ended');
        expect(world.view.cutShort).toBe('budget');
        expect(currentScreen(world).id).toBe('end');
        expect(stateHash(replayWorld(file, file.moves))).toBe(stateHash(world));
    });

    it('counts a call as one decision, however long its list', () => {
        const root = tempRoot();
        run(root, NEW('turn', '--budget 2'));
        run(root, 'move --session s1 1 --why "into the fight"');
        // a list of two moves, the second of which is gone once the first is made: still one decision
        const listed = run(root, 'moves --session s1 1,1 --why "one turn"');
        expect(listed.code).toBe(1);
        const log = saved(root).moves;
        expect(decisionsIn(log)).toBe(2);
    });

    it('refuses a bad --budget', () => {
        expect(run(tempRoot(), NEW('run', '--budget 0')).code).toBe(1);
        expect(run(tempRoot(), NEW('run', '--budget many')).code).toBe(1);
    });
});

describe('180d — turn mode and card mode at the command line', () => {
    const intoBattle = (mode: string) => {
        const root = tempRoot();
        run(root, NEW(mode));
        const opened = run(root, 'move --session s1 1 --why "into the scripted fight"');
        expect(opened.out).toContain('END TURN');
        return root;
    };
    const endTurnNumber = (out: string): number => {
        const line = out.split('\n').find((l) => /^\d+\. END TURN/.test(l))!;
        return Number(line.split('.')[0]);
    };

    it('turn mode takes a list: a card, then END TURN, as one call', () => {
        const root = intoBattle('turn');
        const out = run(root, 'state --session s1').out;
        const end = endTurnNumber(out);
        const result = run(root, `moves --session s1 1,${end} --why "play the first card, then pass"`);
        expect(result.code).toBe(0);
        const moves = saved(root).moves;
        expect(moves).toHaveLength(3);
        expect(moves[1].chained).toBeUndefined();
        expect(moves[2].chained).toBe(true);
        expect(moves[2].key).toBe('battle:end');
    });

    it('stops a list at the first move that is no longer legal and says which', () => {
        const root = intoBattle('turn');
        // the same play twice: the second is gone once the first is made
        const result = run(root, 'moves --session s1 1,1 --why "twice"');
        expect(result.code).toBe(1);
        expect(result.out).toMatch(/Stopped at move 2 of 2/);
        expect(saved(root).moves).toHaveLength(2);
    });

    it('card mode refuses a list and changes nothing, and takes a single move', () => {
        const root = intoBattle('card');
        const before = readFileSync(sessionPath(root, 's1'), 'utf8');
        const refused = run(root, 'moves --session s1 1,2 --why "two at once"');
        expect(refused.code).toBe(1);
        expect(refused.out).toMatch(/one move per call/);
        expect(readFileSync(sessionPath(root, 's1'), 'utf8')).toBe(before);
        expect(run(root, 'move --session s1 1 --why "one card"').code).toBe(0);
    });
});
