/**
 * TICKET 180e — the agent's predictions, and what they are compared with.
 *
 * Nothing here pins on-screen wording. Cards are found by the game's own card data, and the
 * expected numbers are small facts about what a card does (Tackle hits once and costs no Energy).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { parseArgs } from './args';
import { COMMANDS } from './commands';
import { parsePrediction } from './expect/prediction';
import { compare } from './expect/compare';
import { outcomeOf } from './expect/outcome';
import { cardLine } from './gameText';
import { sessionPath } from './sessionFile';
import { currentScreen } from './screen';
import { freshWorld, starter, tempRoot } from './testKit';
import { applyMove, replayWorld } from './world';
import type { SessionFile, World } from './types';

const intoBattle = (seed = 'ps1'): World => {
    const world = freshWorld({ mode: 'turn', seed });
    applyMove(world, { key: currentScreen(world).moves[0].key, why: 'test' });
    return world;
};

/** The key of the play of this card (by its data id) at the first enemy. */
function keyForCard(world: World, dataId: string): string {
    const { hand } = world.view.battle!.state.playerDeck;
    const card = hand.find((c) => c.dataId === dataId);
    if (!card) throw new Error(`no ${dataId} in the opening hand of this seed`);
    const move = currentScreen(world).moves.find((m) => m.key.startsWith(`battle:play:${card.id}:`));
    if (!move) throw new Error(`no play offered for ${dataId}`);
    return move.key;
}

const surprises = (world: World) => world.findings.filter((f) => f.kind === 'surprise');

describe('180e — reading a prediction', () => {
    it('accepts every key, all optional', () => {
        const ok = parsePrediction({ hits: 2, kills: ['Huldra'], status: { Huldra: { Dazed: 2 } }, self: { Strengthened: 1 }, draw: 1, energy: -2, created: 0, exhausted: 1 });
        expect(ok.ok).toBe(true);
        expect(parsePrediction({}).ok).toBe(true);
    });

    it('refuses an unknown key, a wrong type and a non-object, and says why', () => {
        for (const bad of [{ damage: 5 }, { hits: 'two' }, { kills: 'Huldra' }, { self: { Strengthened: 'one' } }, { status: { Huldra: 3 } }, [1], 7]) {
            const read = parsePrediction(bad);
            expect(read.ok, JSON.stringify(bad)).toBe(false);
            if (!read.ok) expect(read.reason.length).toBeGreaterThan(5);
        }
    });
});

describe('180e — a prediction against the result', () => {
    it('a right prediction is not a surprise', () => {
        const world = intoBattle();
        applyMove(world, { key: keyForCard(world, 'tackle'), why: 'test', expect: { hits: 1, energy: 0, kills: [], draw: 0 } });
        expect(surprises(world)).toHaveLength(0);
    });

    it('a wrong prediction is logged as a surprise with the card text, the prediction and the result', () => {
        const world = intoBattle();
        const atMove = world.log.length;
        applyMove(world, { key: keyForCard(world, 'tackle'), why: 'test', expect: { hits: 3 } });
        const found = surprises(world);
        expect(found).toHaveLength(1);
        const [surprise] = found;
        if (surprise.kind !== 'surprise') throw new Error('unreachable');
        expect(surprise.atMove).toBe(atMove);
        expect(surprise.subject).toMatchObject({ type: 'card', id: 'tackle', text: cardLine('tackle') });
        expect(surprise.prediction).toEqual({ hits: 3 });
        expect(surprise.result).toEqual({ hits: 1 });
        expect(surprise.differences).toEqual([{ key: 'hits', predicted: 3, actual: 1 }]);
        // and the agent is told on the very next screen
        expect(world.view.news.join('\n')).toMatch(/SURPRISE/);
    });

    it('checks only the keys it is given', () => {
        const world = intoBattle();
        applyMove(world, { key: keyForCard(world, 'tackle'), why: 'test', expect: { energy: 0 } });
        expect(surprises(world)).toHaveLength(0);
    });

    it('energy and draw are measured: a 1-Energy card is -1, Forage draws a card', () => {
        const edge = intoBattle('ps1');
        applyMove(edge, { key: keyForCard(edge, 'ragnarok_edge'), why: 'test', expect: { energy: -1 } });
        expect(surprises(edge)).toHaveLength(0);

        const forage = intoBattle('ps9');
        applyMove(forage, { key: keyForCard(forage, 'forage'), why: 'test', expect: { draw: 1 } });
        expect(surprises(forage)).toHaveLength(0);
        const wrong = intoBattle('ps9');
        applyMove(wrong, { key: keyForCard(wrong, 'forage'), why: 'test', expect: { draw: 0 } });
        expect(surprises(wrong)).toHaveLength(1);
    });

    it('a kill is a kill, named by the unit or by its id', () => {
        for (const byId of [false, true]) {
            const world = intoBattle();
            const flow = world.view.battle!;
            const foe = flow.state.enemyParty[0];
            world.view.battle = { ...flow, state: { ...flow.state, enemyParty: flow.state.enemyParty.map((e) => ({ ...e, currentHp: 1 })) } };
            applyMove(world, { key: keyForCard(world, 'tackle'), why: 'test', expect: { kills: [byId ? foe.id : foe.name] } });
            expect(surprises(world)).toHaveLength(0);
        }
        const miss = intoBattle();
        applyMove(miss, { key: keyForCard(miss, 'tackle'), why: 'test', expect: { kills: [miss.view.battle!.state.enemyParty[0].name] } });
        expect(surprises(miss)).toHaveLength(1);
    });

    it('a card whose effect is bigger than its text is compared whole, and a firmware\'s share is explained (193c)', () => {
        // Desperate Strike's text promises one Strength; the firmware adds more on top. That is ticket
        // 186d's ruling (card text stays clean, the log says what a firmware adds), so since 193c it is
        // filed as explained by the firmware rather than as a surprise.
        const world = intoBattle();
        applyMove(world, { key: keyForCard(world, 'desperate_strike'), why: 'test', expect: { self: { Strengthened: 1 } } });
        expect(surprises(world)).toHaveLength(0);
        const [explained] = world.findings.filter((f) => f.kind === 'explained');
        expect(explained).toBeDefined();
        if (explained.kind === 'explained') {
            expect(explained.differences[0].key).toBe('self');
            expect(explained.by.length).toBeGreaterThan(0);
        }
    });

    it('compares units and statuses without regard to case or spacing', () => {
        const world = intoBattle();
        const before = world.view.battle!.state;
        const outcome = { hits: 0, kills: [], status: { Huldra: { Dazed: 2 } }, self: { Strengthened: 2 }, draw: 0, energy: 0, created: 0, exhausted: 0 };
        expect(compare({ status: { huldra: { dazed: 2 } }, self: { strengthened: 2 } }, outcome, before)).toEqual([]);
        expect(compare({ status: { Huldra: { Dazed: 1 } } }, outcome, before)).toHaveLength(1);
        expect(compare({ status: {} }, outcome, before)).toHaveLength(1);
    });

    it('the outcome of a play comes from the two states and the hits', () => {
        const world = intoBattle();
        applyMove(world, { key: keyForCard(world, 'tackle'), why: 'test' });
        expect(outcomeOf(world.lastPlay!)).toMatchObject({ hits: 1, energy: 0, draw: 0, created: 0, exhausted: 0 });
    });
});

describe('180e — expectations at the command line', () => {
    const run = (root: string, line: string) => {
        const tokens = [...line.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
        const args = parseArgs(tokens);
        return COMMANDS[args.command!](root, args);
    };
    const setup = () => {
        const root = tempRoot();
        run(root, `new --session s1 --seed ps1 --starter ${starter()} --gym 0 --mode card`);
        run(root, 'move --session s1 1 --why "into the fight"');
        return root;
    };
    const tackleNumber = (out: string): number => Number(out.split('\n').find((l) => /^\d+\. Play Tackle/.test(l))!.split('.')[0]);

    it('refuses an unreadable --expect and changes nothing', () => {
        const root = setup();
        const before = readFileSync(sessionPath(root, 's1'), 'utf8');
        const result = run(root, 'move --session s1 1 --why "x" --expect \'{"damage": 5}\'');
        expect(result.code).toBe(1);
        expect(result.out).toMatch(/hits/);
        expect(readFileSync(sessionPath(root, 's1'), 'utf8')).toBe(before);
    });

    it('tells the agent about a surprise on the next screen, and the session replays to the same finding', () => {
        const root = setup();
        const n = tackleNumber(run(root, 'state --session s1').out);
        const result = run(root, `move --session s1 ${n} --why "a plain hit" --expect '{"hits": 4}'`);
        expect(result.code).toBe(0);
        expect(result.out).toMatch(/SURPRISE/);
        const session = JSON.parse(readFileSync(sessionPath(root, 's1'), 'utf8')) as SessionFile;
        expect(session.moves[1].expect).toEqual({ hits: 4 });
        const replayed = replayWorld(session, session.moves);
        expect(replayed.findings.filter((f) => f.kind === 'surprise')).toHaveLength(1);
    });

    it('says an expectation on a non-battle move was not checked', () => {
        const root = tempRoot();
        run(root, `new --session s1 --seed ps1 --starter ${starter()} --gym 0 --mode card`);
        const result = run(root, 'move --session s1 1 --why "x" --expect \'{"hits": 1}\'');
        expect(result.out).toMatch(/only checked on a card or a draught/);
    });

    it('replay shows the screen as it was after the first n moves, and changes nothing', () => {
        const root = setup();
        const before = readFileSync(sessionPath(root, 's1'), 'utf8');
        const first = run(root, 'replay --session s1 --to 0');
        expect(first.code).toBe(0);
        expect(first.out).toMatch(/MAP|Go to/);
        expect(run(root, 'replay --session s1 --to 99').code).toBe(1);
        expect(readFileSync(sessionPath(root, 's1'), 'utf8')).toBe(before);
    });
});
