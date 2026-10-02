/**
 * TICKET 180a — the CLI's commands, driven as functions over a temporary results folder.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { parseArgs } from './args';
import { COMMANDS } from './commands';
import { sessionPath } from './sessionFile';
import { roughTokens } from './render';
import { starter, tempRoot } from './testKit';

const run = (root: string, line: string) => {
    // A tiny tokenizer so tests can write a command line the way the agent will, quotes and all.
    const tokens = [...line.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
    const args = parseArgs(tokens);
    return COMMANDS[args.command!](root, args);
};

const NEW = (name = 's1') => `new --session ${name} --seed ps1 --starter ${starter()} --gym 0 --mode run`;

describe('180a — the command line', () => {
    it('starts a session and prints the first screen with numbered moves', () => {
        const root = tempRoot();
        const result = run(root, NEW());
        expect(result.code).toBe(0);
        expect(result.out).toMatch(/^\[/);
        expect(result.out).toMatch(/\n1\. /);
        const saved = JSON.parse(readFileSync(sessionPath(root, 's1'), 'utf8'));
        expect(saved).toMatchObject({ seed: 'ps1', starter: starter(), gymIndex: 0, mode: 'run', tier: 0, moves: [] });
    });

    it('refuses a duplicate session name and an unknown starter', () => {
        const root = tempRoot();
        run(root, NEW());
        expect(run(root, NEW()).code).toBe(1);
        expect(run(root, 'new --session s2 --seed x --starter not_a_firmware').code).toBe(1);
    });

    it('applies a move, logs the key with its reason, and shows the next screen', () => {
        const root = tempRoot();
        run(root, NEW());
        const moved = run(root, 'move --session s1 1 --why "the scripted fight is the only sensible start"');
        expect(moved.code).toBe(0);
        const saved = JSON.parse(readFileSync(sessionPath(root, 's1'), 'utf8'));
        expect(saved.moves).toHaveLength(1);
        expect(saved.moves[0].key).toMatch(/^enter:/);
        expect(saved.moves[0].why).toBe('the scripted fight is the only sensible start');
        expect(run(root, 'state --session s1').code).toBe(0);
    });

    it('refuses a move with no reason, and changes nothing', () => {
        const root = tempRoot();
        run(root, NEW());
        const before = readFileSync(sessionPath(root, 's1'), 'utf8');
        const result = run(root, 'move --session s1 1');
        expect(result.code).toBe(1);
        expect(result.out).toMatch(/--why/);
        expect(readFileSync(sessionPath(root, 's1'), 'utf8')).toBe(before);
    });

    it('refuses an illegal move number without changing the session', () => {
        const root = tempRoot();
        run(root, NEW());
        const before = readFileSync(sessionPath(root, 's1'), 'utf8');
        for (const n of ['0', '99', 'x']) {
            const result = run(root, `move --session s1 ${n} --why "testing"`);
            expect(result.code).toBe(1);
        }
        expect(readFileSync(sessionPath(root, 's1'), 'utf8')).toBe(before);
    });

    it('applies a list of moves against the screen as printed, and stops at the first illegal one', () => {
        const root = tempRoot();
        run(root, NEW());
        const result = run(root, 'moves --session s1 1,1 --why "two in a row"');
        // After a fight the screen has changed, so the second "1" is a different move: it is the move
        // that was printed as number 1 on the FIRST screen, which is no longer legal.
        const saved = JSON.parse(readFileSync(sessionPath(root, 's1'), 'utf8'));
        expect(saved.moves.length).toBe(1);
        expect(result.code).toBe(1);
        expect(result.out).toMatch(/Stopped at move 2 of 2/);
    });

    it('records a note against the move count', () => {
        const root = tempRoot();
        run(root, NEW());
        run(root, 'move --session s1 1 --why "go"');
        expect(run(root, 'note --session s1 "the first reward felt thin"').code).toBe(0);
        const saved = JSON.parse(readFileSync(sessionPath(root, 's1'), 'utf8'));
        expect(saved.notes).toEqual([{ atMove: 1, text: 'the first reward felt thin' }]);
    });

    it('prints one card exactly as the game words it', () => {
        const root = tempRoot();
        run(root, NEW());
        const result = run(root, 'card --session s1 tackle');
        expect(result.code).toBe(0);
        expect(result.out.length).toBeGreaterThan(0);
        expect(run(root, 'card --session s1 zzz-no-such-card').code).toBe(1);
    });

    it('gives JSON on request', () => {
        const root = tempRoot();
        run(root, NEW());
        const result = run(root, 'state --session s1 --json');
        const parsed = JSON.parse(result.out);
        expect(parsed.moves.length).toBeGreaterThan(0);
        expect(parsed.moves[0]).toHaveProperty('n', 1);
    });
});

describe('180a — a run screen is small', () => {
    it('stays under about 1,000 tokens on the first screen, a reward screen and a map after a fight', () => {
        const root = tempRoot();
        const first = run(root, NEW());
        expect(roughTokens(first.out)).toBeLessThan(1000);
        const reward = run(root, 'move --session s1 1 --why "go"');
        expect(roughTokens(reward.out)).toBeLessThan(1000);
        const onReward = () => JSON.parse(run(root, 'state --session s1 --json').out).screen === 'reward';
        for (let i = 0; i < 4 && onReward(); i += 1) {
            const out = run(root, 'move --session s1 1 --why "take the first"').out;
            expect(roughTokens(out)).toBeLessThan(1000);
        }
    });
});
