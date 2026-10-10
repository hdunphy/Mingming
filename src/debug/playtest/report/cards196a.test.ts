/**
 * TICKET 196a — the full card tallies as CSV, and nights merged into one table.
 *
 * A fixture night of two run-mode sessions, played for real (cards taken at every reward), saved the way the
 * CLI saves them and read back by replaying. The CSV must hold every card the sessions saw, and its numbers
 * must be the Markdown report's. Nothing here pins a card's name.
 */
import { cpSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { writeSession } from '../sessionFile';
import { freshWorld, play, starter, tempRoot } from '../testKit';
import type { World } from '../types';
import { CARDS_CSV_HEADER, cardsCsv } from './cardsCsv';
import { gatherRun, sessionsIn, type RunFact } from './facts';
import { renderReport } from './render';
import { writeCardsTable, writeReport } from './write';

const DATE = '2026-10-09';

const save = (root: string, name: string, world: World): void => writeSession(root, name, { ...world.header, moves: world.log, notes: [] });

/** A night folder of two sessions that each took the first card at every reward. */
function fixtureNight(date = DATE): string {
    const root = tempRoot();
    const night = join(root, date);
    for (const [name, seed, index] of [['r01', 'ps1', 0], ['r02', 'ps2', 1]] as const) {
        const world = freshWorld({ mode: 'run', seed, starter: starter(index) });
        play(world, 40);
        save(night, name, world);
    }
    return root;
}

const gather = (root: string, date = DATE): RunFact[] => sessionsIn(join(root, date)).map((name) => gatherRun(join(root, date), name));

/** The CSV as rows keyed by card name; every cell a string, as a spreadsheet would read it. */
function parse(csv: string): { header: string[]; rows: Map<string, Record<string, string>> } {
    const lines = csv.trimEnd().split('\n');
    const split = (line: string) => [...line.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/g)].slice(0, -1).map((m) => m[1].replace(/^"|"$/g, '').replace(/""/g, '"'));
    const header = split(lines[0]);
    const rows = new Map(lines.slice(1).map((line) => {
        const cells = split(line);
        return [cells[0], Object.fromEntries(header.map((h, i) => [h, cells[i]]))] as const;
    }));
    return { header, rows };
}

describe('196a — the card CSV from a fixture night', () => {
    const root = fixtureNight();
    const runs = gather(root);
    const { header, rows } = parse(cardsCsv(runs));

    it('the fixture made card choices to count', () => {
        expect(runs.flatMap((r) => r.choices).filter((c) => c.about.verb === 'take').length).toBeGreaterThan(1);
    });

    it('has the ticket\'s columns', () => {
        expect(header).toEqual([...CARDS_CSV_HEADER]);
    });

    it('has a row for every card the sessions saw: offered, on a shelf, bought or upgraded', () => {
        const seen = new Set(runs.flatMap((r) => [
            ...r.shelfOffers,
            ...r.choices.flatMap((c) => [...c.offered, ...(c.about.verb === 'skip' ? [] : c.about.items)]),
        ]));
        expect(seen.size).toBeGreaterThan(0);
        for (const card of seen) expect(rows.has(card), card).toBe(true);
        expect(rows.size).toBe(seen.size);
    });

    it('says what each card is: an element, a kind and a cost for every card', () => {
        for (const [card, row] of rows) {
            if (row.kind === 'Draught') continue;
            expect(row.kind, card).not.toBe('');
            expect(row.element, card).not.toBe('');
            expect(row.cost, card).toMatch(/^\d+$/);
        }
    });

    it('its numbers are the Markdown report\'s', () => {
        const text = renderReport(DATE, runs);
        const taken = [...text.matchAll(/^- (.+): taken (\d+) of (\d+) times offered/gm)];
        const passed = [...text.matchAll(/^- (.+): passed over (\d+) of (\d+) times offered/gm)];
        const shelf = [...text.matchAll(/^- (.+): on a shelf (\d+) times?, never bought/gm)];
        expect(taken.length + passed.length).toBeGreaterThan(0);
        for (const m of taken) expect([rows.get(m[1])?.taken, rows.get(m[1])?.offered], m[1]).toEqual([m[2], m[3]]);
        for (const m of passed) expect([rows.get(m[1])?.passed, rows.get(m[1])?.offered], m[1]).toEqual([m[2], m[3]]);
        for (const m of shelf) expect([rows.get(m[1])?.['on a shelf'], rows.get(m[1])?.bought], m[1]).toEqual([m[2], '0']);
        // and the totals: every take, store and skip the sessions made
        const sum = (col: string) => [...rows.values()].reduce((n, r) => n + Number(r[col]), 0);
        const verbs = runs.flatMap((r) => r.choices.map((c) => c.about.verb));
        expect(sum('taken')).toBe(verbs.filter((v) => v === 'take').length);
        expect(sum('stored')).toBe(verbs.filter((v) => v === 'store').length);
        expect(sum('bought')).toBe(verbs.filter((v) => v === 'buy').length);
        expect(sum('upgraded')).toBe(verbs.filter((v) => v === 'upgrade').length);
        expect(sum('offered')).toBe(runs.flatMap((r) => r.choices).filter((c) => ['take', 'store', 'skip'].includes(c.about.verb)).reduce((n, c) => n + c.offered.length, 0));
    });

    it('records the deck\'s main element at each reward, and counts the offers that matched it', () => {
        const rewards = runs.flatMap((r) => r.choices).filter((c) => ['take', 'store', 'skip'].includes(c.about.verb));
        expect(rewards.some((c) => c.mainElement !== undefined)).toBe(true);
        for (const [card, row] of rows) {
            if (row['offers on main element'] === '') continue;
            expect(Number(row['offers on main element']), card).toBeLessThanOrEqual(Number(row.offered));
            expect(Number(row['main element share']), card).toBeCloseTo(Number(row['offers on main element']) / Number(row.offered), 2);
        }
    });
});

const stubRun = (over: Partial<RunFact> = {}): RunFact => ({
    session: 'r01', header: { seed: 's', starter: 'x', gymIndex: 0, mode: 'run', tier: 0, modifiers: [], moves: [], notes: [] },
    starter: 'Firmware', gym: 'Gym', outcome: 'defeat', fights: 1, biome: '1 of 3', deckSize: 8, scrap: 0, decisions: 4,
    partySize: 1, blueprints: 0, endedAt: 'Elite', reachedGym: false, findings: [], notes: [], choices: [], shelfOffers: [], ...over,
});

describe('196a — a Draught bought in the shop is a buy', () => {
    it('counts it under bought, and calls it a Draught (a fact read before Draughts were marked)', () => {
        const { rows } = parse(cardsCsv([stubRun({ shelfOffers: ['Revive', 'Revive'], choices: [{ about: { verb: 'buy', items: ['Revive'] }, offered: [], why: 'ok' }] })]));
        expect(rows.get('Revive')).toMatchObject({ kind: 'Draught', 'on a shelf': '2', bought: '1' });
    });

    it('keeps a Draught apart from a card of the same name (Mend is both)', () => {
        const run = stubRun({
            shelfOffers: ['Mend', 'Mend', 'Mend'], draughtOffers: ['Mend'],
            choices: [{ about: { verb: 'buy', items: ['Mend'] }, offered: [], why: 'ok', draught: true }],
        });
        const lines = cardsCsv([run]).trimEnd().split('\n').slice(1).filter((l) => l.startsWith('Mend,'));
        expect(lines).toHaveLength(2);
        const [card, draught] = lines.map((l) => l.split(','));
        expect(draught[1]).toBe('Draught');
        expect(card[1]).not.toBe('Draught');
        // the card: on a shelf 2, bought 0; the Draught: on a shelf 1, bought 1
        expect([card[8], card[9]]).toEqual(['2', '0']);
        expect([draught[8], draught[9]]).toEqual(['1', '1']);
    });
});

describe('196a — the files', () => {
    it('writeReport also writes <date>-cards.csv next to the report, LF only', () => {
        const root = fixtureNight();
        const out = join(tempRoot(), 'agent-runs');
        const { cardsPath } = writeReport(DATE, root, out);
        expect(cardsPath).toBe(join(out, `${DATE}-cards.csv`));
        const bytes = readFileSync(cardsPath, 'utf8');
        expect(bytes).not.toContain('\r');
        expect(bytes).toBe(cardsCsv(gather(root)));
    });

    it('--cards merges several nights into one table: the nights\' runs added up', () => {
        const a = fixtureNight('2026-10-04');
        const b = fixtureNight('2026-10-05');
        // both nights under one results folder, as results/playtest/ holds them
        const root = tempRoot();
        cpSync(join(a, '2026-10-04'), join(root, '2026-10-04'), { recursive: true });
        cpSync(join(b, '2026-10-05'), join(root, '2026-10-05'), { recursive: true });
        const out = join(tempRoot(), 'agent-runs');
        const { path, runs } = writeCardsTable(['2026-10-04', '2026-10-05'], root, out);
        expect(runs).toBe(4);
        const merged = readFileSync(path, 'utf8');
        expect(merged).toBe(cardsCsv([...gather(root, '2026-10-04'), ...gather(root, '2026-10-05')]));
        const one = parse(cardsCsv(gather(root, '2026-10-04'))).rows;
        const both = parse(merged).rows;
        for (const [card, row] of one) expect(Number(both.get(card)!.offered), card).toBeGreaterThanOrEqual(Number(row.offered));
    });

    it('refuses a merge with a night that has no sessions', () => {
        expect(() => writeCardsTable(['2026-10-04', 'nope'], fixtureNight('2026-10-04'), tempRoot())).toThrow(/no sessions/);
    });
});
