/**
 * TICKET 180f — the morning report, built from a fixture night of two short sessions.
 *
 * The sessions are played for real (a card mode fight with a wrong prediction and some notes; a run
 * mode walk to a market with a purchase and a card pick), saved the way the CLI saves them, and
 * then read back by replaying. Every section must be present, lists must stop at ten, the file is LF,
 * and nothing here pins a word of the game's own text.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { gatherRun, sessionsIn, type RunFact } from './report/facts';
import { groupNotes } from './report/notes';
import { renderReport, replayCommand } from './report/render';
import { writeReport } from './report/write';
import { writeSession } from './sessionFile';
import { currentScreen } from './screen';
import { freshWorld, tempRoot } from './testKit';
import { walkTo } from './walkKit';
import { applyMove } from './world';
import type { World } from './types';
import { writeFileSync } from 'node:fs';

const DATE = '2026-10-02';

const save = (root: string, name: string, world: World, notes: Array<{ atMove: number; text: string }> = []): void =>
    writeSession(root, name, { ...world.header, moves: world.log, notes });

/** r01: a card-mode fight, a wrong prediction about Tackle, and notes. */
function cardNightSession(): { world: World; notes: Array<{ atMove: number; text: string }> } {
    const world = freshWorld({ mode: 'card', seed: 'ps1' });
    applyMove(world, { key: currentScreen(world).moves[0].key, why: 'the only way forward' });
    const card = world.view.battle!.state.playerDeck.hand.find((c) => c.dataId === 'tackle')!;
    const play = currentScreen(world).moves.find((m) => m.key.startsWith(`battle:play:${card.id}:`))!;
    applyMove(world, { key: play.key, why: 'a cheap hit to start', expect: { hits: 3 } });
    return {
        world,
        notes: [
            { atMove: 1, text: 'Tackle hit once, and I expected a combo from the firmware' },
            { atMove: 2, text: 'the map labels all look the same' },
        ],
    };
}

/** r02: a run-mode walk to a market, one purchase, then on to the first reward. */
function runNightSession(): World {
    // 194b: seed 'ps22' no longer reaches a market on the scripted walk (Ragnarok Edge lost its cap, so the
    // starter's first fights play out differently), so the fixture used 'ps21'. 206: the biome order changed
    // (the gym's element first), 'ps21' no longer reaches one, and 'ps1' does.
    const world = freshWorld({ mode: 'run', seed: 'ps1' });
    expect(walkTo(world, 'marketplace')).toBe(true);
    const buy = currentScreen(world).moves.find((m) => m.about?.verb === 'buy');
    if (buy) applyMove(world, { key: buy.key, why: 'looked like it fit the deck' });
    return world;
}

function fixtureNight(): string {
    const root = tempRoot();
    const night = join(root, DATE);
    const one = cardNightSession();
    save(night, 'r01', one.world, one.notes);
    save(night, 'r02', runNightSession());
    writeFileSync(join(night, 'r01', 'driver.json'), JSON.stringify({ minutes: 12.4, tokens: 90210, costUsd: 0.4, turns: 31 }));
    return root;
}

const HEADINGS = [
    '# Agent playtest night', '## Invariant failures', '## Surprises', '## Runs', "## The agent's notes",
    '## Decision patterns', '### Cards taken most often', '### Cards passed over most often', '### Shop items never bought', '### Upgrades taken',
];

describe('180f — the morning report from a fixture night', () => {
    it('finds both sessions and reads each by replaying it', () => {
        const root = fixtureNight();
        expect(sessionsIn(join(root, DATE))).toEqual(['r01', 'r02']);
        const one = gatherRun(join(root, DATE), 'r01');
        expect(one.findings.filter((f) => f.kind === 'surprise')).toHaveLength(1);
        expect(one.driver).toMatchObject({ minutes: 12.4, tokens: 90210 });
        expect(one.notes.map((n) => n.screen)).toEqual(['battle', 'battle']);
        expect(one.decisions).toBe(2);
    });

    it('every section is present, in the right order', () => {
        const root = fixtureNight();
        const runs = sessionsIn(join(root, DATE)).map((name) => gatherRun(join(root, DATE), name));
        const text = renderReport(DATE, runs);
        let at = -1;
        for (const heading of HEADINGS) {
            const found = text.indexOf(heading);
            expect(found, heading).toBeGreaterThan(at);
            at = found;
        }
    });

    it('lists the run lines with outcome, fights, deck, scrap, tokens and minutes', () => {
        const root = fixtureNight();
        const text = renderReport(DATE, sessionsIn(join(root, DATE)).map((n) => gatherRun(join(root, DATE), n)));
        expect(text).toMatch(/- r01: .*card mode\. unfinished; 0 fights won.*90,210 tokens, 12 minutes/);
        expect(text).toMatch(/- r02: .*run mode\./);
    });

    it('puts the surprise near the top with the card text, the prediction, the result and a replay command', () => {
        const root = fixtureNight();
        const text = renderReport(DATE, sessionsIn(join(root, DATE)).map((n) => gatherRun(join(root, DATE), n)));
        const surprises = text.slice(text.indexOf('## Surprises'), text.indexOf('## Runs'));
        expect(surprises).toContain('Tackle');
        expect(surprises).toContain('{"hits":3}');
        expect(surprises).toContain('{"hits":1}');
        expect(surprises).toContain(replayCommand(DATE, 'r01', 1));
    });

    it('files the notes under the card they name, or the screen they were written on', () => {
        const root = fixtureNight();
        const groups = groupNotes(gatherRun(join(root, DATE), 'r01').notes);
        expect(groups.map((g) => g.label).sort()).toEqual(['card: Tackle', 'screen: battle'].sort());
    });

    it('writes docs/playtest/agent-runs/<date>.md with LF line endings only', () => {
        const root = fixtureNight();
        const out = join(tempRoot(), 'agent-runs');
        const { path, runs } = writeReport(DATE, root, out);
        expect(runs).toBe(2);
        expect(path).toBe(join(out, `${DATE}.md`));
        const bytes = readFileSync(path, 'utf8');
        expect(bytes).not.toContain('\r');
        expect(bytes.endsWith('\n')).toBe(true);
        for (const heading of HEADINGS) expect(bytes).toContain(heading);
    });

    it('refuses a night with no sessions', () => {
        expect(() => writeReport(DATE, tempRoot(), tempRoot())).toThrow(/no sessions/);
    });
});

/** A run with whatever findings and choices a test needs, and nothing else. */
const stub = (over: Partial<RunFact> = {}): RunFact => ({
    session: 'r01', header: { seed: 's', starter: 'x', gymIndex: 0, mode: 'run', tier: 0, modifiers: [], moves: [], notes: [] },
    starter: 'Firmware', gym: 'Gym', outcome: 'defeat', fights: 1, biome: '1 of 3', deckSize: 8, scrap: 0, decisions: 4,
    partySize: 1, blueprints: 0, endedAt: 'Elite', reachedGym: false,
    findings: [], notes: [], choices: [], shelfOffers: [], ...over,
});

describe('180f — what the report says when things are wrong, and how short it stays', () => {
    it('shows an invariant failure with its count and a replay command, above the surprises', () => {
        const run = stub({ findings: [
            { kind: 'invariant', atMove: 6, name: 'hp-range', detail: 'Huldra has 99 HP of 50' },
            { kind: 'invariant', atMove: 9, name: 'hp-range', detail: 'Huldra has 99 HP of 50' },
        ] });
        const text = renderReport(DATE, [run]);
        expect(text.indexOf('## Invariant failures')).toBeLessThan(text.indexOf('## Surprises'));
        expect(text).toContain('hp-range: Huldra has 99 HP of 50 (2 times)');
        expect(text).toContain(replayCommand(DATE, 'r01', 6));
    });

    it('stops every list at ten and says how many more there were', () => {
        const findings = Array.from({ length: 15 }, (_, i) => ({
            kind: 'invariant' as const, atMove: i, name: 'hp-range' as const, detail: `unit ${i} out of range`,
        }));
        const text = renderReport(DATE, [stub({ findings })]);
        expect(text).toContain('...and 5 more');
        expect(text.match(/unit \d+ out of range/g)).toHaveLength(10);
    });

    it('tallies what the agent picked, passed over, never bought and upgraded, with its reasons', () => {
        const take = (card: string, why: string) => ({ about: { verb: 'take' as const, items: [card] }, offered: ['Alpha', 'Beta', 'Gamma'], why });
        const run = stub({
            choices: [
                take('Alpha', 'cheap and strong'), take('Alpha', 'cheap and strong'), take('Beta', 'fills the curve'),
                { about: { verb: 'skip' as const, items: ['Alpha', 'Beta', 'Gamma'] }, offered: ['Alpha', 'Beta', 'Gamma'], why: 'nothing fits' },
                { about: { verb: 'upgrade' as const, items: ['Alpha'] }, offered: [], why: 'free' },
                { about: { verb: 'buy' as const, items: ['Bought Thing'] }, offered: [], why: 'ok' },
            ],
            shelfOffers: ['Bought Thing', 'Unloved Thing', 'Unloved Thing'],
        });
        const text = renderReport(DATE, [run]);
        expect(text).toMatch(/Alpha: taken 2 of 4 times offered\. Reasons: cheap and strong \(2x\)/);
        expect(text).toMatch(/Gamma: passed over 4 of 4 times offered\. Reasons: nothing fits/);
        expect(text).toContain('Unloved Thing: on a shelf 2 times, never bought.');
        expect(text).not.toContain('Bought Thing: on a shelf');
        expect(text).toMatch(/Alpha: 1 time\./);
    });

    it('a quiet night still has every section, each saying None', () => {
        const text = renderReport(DATE, [stub()]);
        for (const heading of HEADINGS) expect(text).toContain(heading);
        expect(text.match(/^None\.$/gm)!.length).toBeGreaterThanOrEqual(5);
    });
});

