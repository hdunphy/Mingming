/**
 * TICKET 197a step 1 — the morning report counts each run's Amber: earned, spent on cards, upgrades, Draughts,
 * Traces and Runes, and left at the end.
 *
 * Additions only. The first block pins the report as it was before 197a, word for word, on a stand-in night that
 * touches every section; the report must still begin with exactly that text, and the Amber table comes after it.
 * The rest reads Amber off real replayed sessions, where the sums must close to the coin.
 */
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { writeSession } from '../sessionFile';
import { currentScreen } from '../screen';
import { freshWorld, tempRoot } from '../testKit';
import type { World } from '../types';
import { runOf } from '../types';
import { walkTo } from '../walkKit';
import { applyMove } from '../world';
import { AMBER_SPENDS, amberSpendOf, openLedger, recordMove, type AmberLedger } from './amber';
import { AMBER_COLUMNS, AMBER_HEADING } from './amberTable';
import { gatherRun, type RunFact } from './facts';
import { renderReport } from './render';
import type { RunLeg } from './runLeg';

const DATE = '2026-10-09';

const leg = (over: Partial<RunLeg> = {}): RunLeg => ({
    number: 1, outcome: 'defeat', fights: 3, biome: '1 of 3 (Rootfall)', deckSize: 12, scrap: 40, decisions: 20,
    partySize: 1, blueprints: 1, endedAt: 'Elite', reachedGym: false, ...over,
});

const stub = (legs: ReadonlyArray<RunLeg>, over: Partial<RunFact> = {}): RunFact => {
    const last = legs[legs.length - 1];
    return {
        session: 'r01', header: { seed: 's', starter: 'x', gymIndex: 0, mode: 'run', tier: 0, modifiers: [], moves: [], notes: [] },
        starter: 'Firmware', gym: 'Gym', outcome: last.outcome, fights: last.fights, biome: last.biome, deckSize: last.deckSize, scrap: last.scrap,
        decisions: legs.reduce((n, l) => n + l.decisions, 0), partySize: last.partySize, blueprints: last.blueprints, endedAt: last.endedAt,
        reachedGym: last.reachedGym, findings: [], notes: [], choices: [], shelfOffers: [], legs, ...over,
    };
};

const TACKLE = { type: 'card' as const, id: 'tackle', name: 'Tackle', text: 'Deal 10.' };

const take = (card: string, why: string) => ({ about: { verb: 'take' as const, items: [card] }, offered: ['Alpha', 'Beta', 'Gamma'], why });

/** A stand-in night that puts something in every section of the report. */
function standInNight(amber?: AmberLedger): RunFact[] {
    const withAmber = (l: RunLeg): RunLeg => (amber === undefined ? l : { ...l, amber });
    return [
        stub([withAmber(leg()), withAmber(leg({ number: 2, outcome: 'victory', fights: 9, partySize: 3, reachedGym: true, endedAt: 'Gym', scrap: 7 }))], {
            findings: [
                { kind: 'invariant', atMove: 6, name: 'hp-range', detail: 'Huldra has 99 HP of 50' },
                { kind: 'explained', atMove: 8, subject: TACKLE, differences: [{ key: 'hits', predicted: 3, actual: 1 }], by: ['Firmware X'] },
                { kind: 'surprise', atMove: 9, subject: TACKLE, prediction: { hits: 3 }, result: { hits: 1 }, differences: [{ key: 'hits', predicted: 3, actual: 1 }] },
            ],
            notes: [{ text: 'Tackle hit once', screen: 'battle' }, { text: 'the shop is dear', screen: 'market' }],
            choices: [
                take('Alpha', 'cheap and strong'), take('Alpha', 'cheap and strong'), take('Beta', 'fills the curve'),
                { about: { verb: 'skip', items: ['Alpha', 'Beta', 'Gamma'] }, offered: ['Alpha', 'Beta', 'Gamma'], why: 'nothing fits' },
                { about: { verb: 'upgrade', items: ['Alpha'] }, offered: [], why: 'free' },
                { about: { verb: 'buy', items: ['Bought Thing'] }, offered: [], why: 'ok' },
            ],
            shelfOffers: ['Bought Thing', 'Unloved Thing', 'Unloved Thing'],
            driver: { minutes: 12.4, tokens: 90210, costUsd: 0.4, turns: 31 },
        }),
        stub([withAmber(leg({ partySize: 2, scrap: 0 }))], { session: 'r02', driver: { minutes: 3, tokens: 1000 } }),
    ];
}

/** `renderReport(DATE, standInNight())` at 36711a3, before 197a. Do not edit: it is the proof that 197a only adds. */
const BEFORE_197A = [
    '# Agent playtest night, 2026-10-09',
    '',
    '3 runs played in 2 sessions, 1 won, 2 lost, 0 stopped by the decision budget, 0 cut short or unfinished. The driver reported 91,210 tokens, 15 minutes and about $0.40 in all.',
    '',
    '| Party at the end | Runs | Reached the gym | Won | Run 2 of a session |',
    '|---|---|---|---|---|',
    '| 1 (solo) | 1 | 0 | 0 | - |',
    '| 2 | 1 | 0 | 0 | - |',
    '| 3 | 1 | 1 | 1 | 1 (1 reached the gym, 1 won) |',
    '',
    'The table counts runs, not sessions: a session that played two runs is in it twice. "Run 2 of a session" is the second runs alone (how many, how many reached the gym, how many won); the first runs are the rest.',
    '',
    'Not comparable with nights before 2026-10-06 (195k changed the gym matchups; 195h made the gauntlet carry HP).',
    '',
    '## Invariant failures (most likely bugs)',
    '',
    '- hp-range: Huldra has 99 HP of 50. First seen in r01; replay it with `npm run playtest -- replay --results results/playtest/2026-10-09 --session r01 --to 7`.',
    '',
    '## Surprises (a bug, or wording that misled)',
    '',
    '- Tackle (card), 1 time. Printed text: "Deal 10."',
    '  Typical case: the agent expected {"hits":3} and got {"hits":1}. Replay: `npm run playtest -- replay --results results/playtest/2026-10-09 --session r01 --to 10`',
    '',
    '1 explained by a firmware or Aura (not bugs, so not listed above): Firmware X (1). Ticket 186d: card text stays clean and the combat log says what a firmware adds.',
    '',
    '## Runs',
    '',
    '- r01: Firmware, gym Gym, run mode. Run 1: defeat; 3 fights won, biome 1 of 3 (Rootfall), 12 cards in the deck, 40 amber left, party of 1, 1 Trace unspent, ended at Elite, 20 decisions. Run 2: victory; 9 fights won, biome 1 of 3 (Rootfall), 12 cards in the deck, 7 amber left, party of 3, 1 Trace unspent, ended at Gym, 20 decisions. 40 decisions in all, 90,210 tokens, 12 minutes.',
    '- r02: Firmware, gym Gym, run mode. defeat; 3 fights won, biome 1 of 3 (Rootfall), 12 cards in the deck, 0 amber left, party of 2, 1 Trace unspent, ended at Elite, 20 decisions, 1,000 tokens, 3 minutes.',
    '',
    '## The agent\'s notes',
    '',
    '- card: Tackle (1 note)',
    '  - "Tackle hit once"',
    '- screen: market (1 note)',
    '  - "the shop is dear"',
    '',
    '## Decision patterns',
    '',
    '### Cards taken most often',
    '',
    '- Alpha: taken 2 of 4 times offered. Reasons: cheap and strong (2x).',
    '- Beta: taken 1 of 4 times offered. Reasons: fills the curve.',
    '',
    '### Cards passed over most often',
    '',
    '- Gamma: passed over 4 of 4 times offered. Reasons: nothing fits.',
    '- Beta: passed over 3 of 4 times offered. Reasons: nothing fits.',
    '- Alpha: passed over 2 of 4 times offered. Reasons: nothing fits.',
    '',
    '### Shop items never bought',
    '',
    '- Unloved Thing: on a shelf 2 times, never bought.',
    '',
    '### Upgrades taken',
    '',
    '- Alpha: 1 time.',
].join('\n') + '\n';

describe('197a — the report before Amber is unchanged', () => {
    it('a night read without Amber renders exactly as before, then an empty Amber table', () => {
        const text = renderReport(DATE, standInNight());
        expect(text.startsWith(BEFORE_197A)).toBe(true);
        expect(text.slice(BEFORE_197A.length)).toBe(`\n${AMBER_HEADING}\n\nNone.\n`);
    });

    it('a night read with Amber renders exactly as before, then the Amber table', () => {
        const text = renderReport(DATE, standInNight({ ...openLedger(45), earned: 100, spent: { ...openLedger(0).spent, cards: 35, upgrades: 60 }, left: 50 }));
        expect(text.startsWith(BEFORE_197A)).toBe(true);
        const rest = text.slice(BEFORE_197A.length);
        expect(rest.startsWith(`\n${AMBER_HEADING}\n`)).toBe(true);
        expect(rest).toContain(`| ${AMBER_COLUMNS.join(' | ')} |`);
        expect(rest).toContain('| r01 | 1 | 45 | 100 | 35 | 60 | 0 | 0 | 0 | 0 | 50 |');
        expect(rest).toContain('| r01 | 2 | 45 | 100 | 35 | 60 | 0 | 0 | 0 | 0 | 50 |');
        expect(rest).toContain('| r02 | 1 |');
        expect(rest).toContain('| All |  | 135 | 300 | 105 | 180 | 0 | 0 | 0 | 0 | 150 |');
    });
});

describe('197a — the ledger', () => {
    it('files a spend by the move that made it, and a gain as earned', () => {
        expect(amberSpendOf('market:buy:card_1')).toBe('cards');
        expect(amberSpendOf('market:upgrade:card_1')).toBe('upgrades');
        expect(amberSpendOf('workshop:upgrade:card_1')).toBe('upgrades');
        expect(amberSpendOf('market:macro:rally')).toBe('draughts');
        expect(amberSpendOf('market:blueprint')).toBe('traces');
        expect(amberSpendOf('patch:shop:m1:p1')).toBe('runes');
        expect(amberSpendOf('market:refresh')).toBe('other');
        let l = openLedger(45);
        l = recordMove(l, 'battle:end', 45, 75);
        l = recordMove(l, 'market:buy:card_1', 75, 50);
        l = recordMove(l, 'market:sell:card_2', 50, 60);
        l = recordMove(l, 'leave', 60, 60);
        expect(l).toEqual({ start: 45, earned: 40, spent: { cards: 25, upgrades: 0, draughts: 0, traces: 0, runes: 0, other: 0 }, left: 60 });
    });
});

const save = (root: string, name: string, world: World): void => writeSession(root, name, { ...world.header, moves: world.log, notes: [] });

/** A run-mode walk to the first shop, then every buy and upgrade it can afford. */
function shopSession(): World {
    const world = freshWorld({ mode: 'run', seed: 'ps1' });
    expect(walkTo(world, 'marketplace')).toBe(true);
    for (let i = 0; i < 6; i += 1) {
        const spend = currentScreen(world).moves.find((m) => m.about?.verb === 'buy' || m.about?.verb === 'upgrade');
        if (!spend) break;
        applyMove(world, { key: spend.key, why: 'spend it' });
    }
    return world;
}

describe('197a — Amber read off a replayed session', () => {
    const root = join(tempRoot(), DATE);
    const world = shopSession();
    save(root, 'r01', world);
    const fact = gatherRun(root, 'r01');
    const amber = fact.legs![0].amber!;

    it('every run carries a ledger, and it closes to the coin', () => {
        expect(amber).toBeDefined();
        const spent = AMBER_SPENDS.reduce((n, k) => n + amber.spent[k], 0);
        expect(amber.start + amber.earned - spent).toBe(amber.left);
        expect(amber.left).toBe(runOf(world).scrap);
        expect(amber.left).toBe(fact.scrap);
    });

    it('the shop\'s spending lands under cards, upgrades and Draughts', () => {
        expect(amber.spent.cards + amber.spent.upgrades + amber.spent.draughts).toBeGreaterThan(0);
        expect(amber.earned).toBeGreaterThan(0);
    });

    it('the report prints that run\'s row', () => {
        const text = renderReport(DATE, [fact]);
        const row = text.split('\n').find((l) => l.startsWith('| r01 | 1 |'))!;
        const cells = row.split('|').slice(1, -1).map((c) => c.trim());
        expect(cells).toEqual(['r01', '1', String(amber.start), String(amber.earned), ...AMBER_SPENDS.map((k) => String(amber.spent[k])), String(amber.left)]);
    });
});
