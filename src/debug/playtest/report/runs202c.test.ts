/**
 * TICKET 202c — the morning report with two runs a session.
 *
 * Each session's line splits into run 1 and run 2; the party table counts runs, not sessions; and a column,
 * "run 2 of a session", shows whether second runs summon more and get further. The decision patterns stay
 * pooled over both runs. Only the ticket's own words are pinned ("Run 1", "Run 2", the column's name).
 */
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseArgs } from '../args';
import { COMMANDS } from '../commands';
import { starter, tempRoot } from '../testKit';
import { gatherRun, type RunFact } from './facts';
import { legsOf, type RunLeg } from './runLeg';
import { partyTable } from './partyTable';
import { renderReport } from './render';

const DATE = '2026-10-08';
const cmd = (root: string, line: string) => {
    const tokens = [...line.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
    const args = parseArgs(tokens);
    return COMMANDS[args.command!](root, args);
};

/** A night folder with one session that played two runs (one decision each) and one that played a single run. */
function twoRunNight(): string {
    const root = tempRoot();
    const night = join(root, DATE);
    cmd(night, `new --session r01 --seed pt2026-10-04:3 --starter ${starter()} --gym 1 --mode run --budget 1`);
    cmd(night, 'move --session r01 1 --why "first run"');
    cmd(night, 'again --session r01');
    cmd(night, 'move --session r01 1 --why "second run"');
    cmd(night, `new --session r02 --seed pt2026-10-04:4 --starter ${starter()} --gym 1 --mode run --budget 1`);
    cmd(night, 'move --session r02 1 --why "only run"');
    return night;
}

const leg = (over: Partial<RunLeg> = {}): RunLeg => ({
    number: 1, outcome: 'defeat', fights: 1, biome: '1 of 3', deckSize: 8, scrap: 0, decisions: 4,
    partySize: 1, blueprints: 0, endedAt: 'Elite', reachedGym: false, ...over,
});

const stub = (legs: ReadonlyArray<RunLeg>, over: Partial<RunFact> = {}): RunFact => {
    const last = legs[legs.length - 1];
    return {
        session: 'r01', header: { seed: 's', starter: 'x', gymIndex: 0, mode: 'run', tier: 0, modifiers: [], moves: [], notes: [] },
        starter: 'Firmware', gym: 'Gym', outcome: last.outcome, fights: last.fights, biome: last.biome, deckSize: last.deckSize, scrap: last.scrap,
        decisions: legs.reduce((n, l) => n + l.decisions, 0), partySize: last.partySize, blueprints: last.blueprints, endedAt: last.endedAt, reachedGym: last.reachedGym,
        findings: [], notes: [], choices: [], shelfOffers: [], legs, ...over,
    };
};

describe('202c — gathering a session with a second run', () => {
    it('reads both runs by replaying the session across the boundary', () => {
        const fact = gatherRun(join(twoRunNight()), 'r01');
        expect(fact.legs).toHaveLength(2);
        expect(fact.legs!.map((l) => l.number)).toEqual([1, 2]);
        expect(fact.legs!.every((l) => l.decisions === 1)).toBe(true);
        expect(fact.decisions).toBe(2);
        // the session-level facts are the last run's, as they always were the run's
        expect(fact).toMatchObject({ outcome: fact.legs![1].outcome, partySize: fact.legs![1].partySize });
    });

    it('a session with one run has one leg, and legsOf makes one for a fact that has none', () => {
        const fact = gatherRun(twoRunNight(), 'r02');
        expect(fact.legs).toHaveLength(1);
        expect(legsOf(stub([leg()], { legs: undefined }))).toHaveLength(1);
        expect(legsOf(stub([leg()], { legs: undefined }))[0]).toMatchObject({ number: 1, outcome: 'defeat', partySize: 1 });
    });
});

describe('202c — the party table counts runs', () => {
    const rows = (lines: string[]) => lines.filter((l) => l.startsWith('| ') && !l.startsWith('| Party') && !l.startsWith('|---'))
        .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));

    it('counts a session that played two runs as two runs, each under its own party size', () => {
        const table = partyTable([
            stub([leg({ partySize: 1 }), leg({ number: 2, partySize: 2, reachedGym: true, outcome: 'victory' })]),
            stub([leg({ partySize: 1 })], { session: 'r02' }),
        ]);
        expect(table[0]).toMatch(/\| Runs \|/);
        const [solo, pair] = rows(table);
        expect(solo[0]).toMatch(/^1/);
        expect(solo[1]).toBe('2');
        expect(pair[0]).toBe('2');
        expect(pair[1]).toBe('1');
        expect(pair[2]).toBe('1');
        expect(pair[3]).toBe('1');
    });

    it('has a "run 2 of a session" column: only the second runs, by party size, with how many reached the gym and won', () => {
        const table = partyTable([
            stub([leg({ partySize: 1 }), leg({ number: 2, partySize: 3, reachedGym: true, outcome: 'victory' })]),
            stub([leg({ partySize: 2, reachedGym: true }), leg({ number: 2, partySize: 3, reachedGym: true })], { session: 'r02' }),
            stub([leg({ partySize: 1 })], { session: 'r03' }),
        ]);
        expect(table[0].toLowerCase()).toContain('run 2 of a session');
        const byParty = Object.fromEntries(rows(table).map((r) => [r[0].split(' ')[0], r]));
        // two second runs ended with a party of three, both reached the gym, one won
        const cell = byParty['3'][byParty['3'].length - 1];
        expect(cell).toMatch(/^2\b/);
        expect(cell).toMatch(/2/);
        expect(cell).toMatch(/1/);
        // no second run ended solo or with a pair
        expect(byParty['1'][byParty['1'].length - 1]).toBe('-');
        expect(byParty['2'][byParty['2'].length - 1]).toBe('-');
    });

    it('says nothing for a night with no runs', () => {
        expect(partyTable([])).toEqual([]);
    });
});

describe('202c — the report', () => {
    it('splits a two-run session\'s line into run 1 and run 2, and leaves a one-run session\'s as one', () => {
        const text = renderReport(DATE, [gatherRun(twoRunNight(), 'r01'), gatherRun(twoRunNight(), 'r02')]);
        const lines = text.split('\n').filter((l) => /^- r0[12]:/.test(l));
        expect(lines).toHaveLength(2);
        expect(lines[0]).toMatch(/Run 1: .*Run 2: /);
        expect(lines[1]).not.toMatch(/Run 1:|Run 2:/);
    });

    it('gives each run its outcome, fights won, party and Traces, in the game\'s words', () => {
        const text = renderReport(DATE, [stub([leg({ fights: 3, partySize: 1, blueprints: 2 }), leg({ number: 2, outcome: 'victory', fights: 9, partySize: 3, blueprints: 1 })])]);
        const line = text.split('\n').find((l) => l.startsWith('- r01:'))!;
        expect(line).toMatch(/Run 1: defeat; 3 fights won.*party of 1, 2 Traces unspent/);
        expect(line).toMatch(/Run 2: victory; 9 fights won.*party of 3, 1 Trace unspent/);
        expect(text).not.toMatch(/blueprint|scrap/i);
    });

    it('counts runs in its summary, and says how many sessions they were played in', () => {
        const text = renderReport(DATE, [stub([leg(), leg({ number: 2, outcome: 'victory' })]), stub([leg({ outcome: 'victory' })], { session: 'r02' })]);
        expect(text).toMatch(/3 runs played in 2 sessions, 2 won, 1 lost/);
    });

    it('keeps the decision patterns pooled over both runs of every session', () => {
        const take = (card: string) => ({ about: { verb: 'take' as const, items: [card] }, offered: ['Alpha', 'Beta'], why: 'fits' });
        const text = renderReport(DATE, [stub([leg(), leg({ number: 2 })], { choices: [take('Alpha'), take('Alpha')] })]);
        expect(text).toMatch(/Alpha: taken 2 of 2 times offered/);
    });

    it('keeps the not-comparable note and says amber', () => {
        const text = renderReport(DATE, [stub([leg({ scrap: 45 })])]);
        expect(text).toContain('Not comparable with nights before 2026-10-06');
        expect(text).toContain('45 amber');
    });
});
