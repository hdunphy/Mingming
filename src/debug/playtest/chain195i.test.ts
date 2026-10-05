/**
 * TICKET 195i — `moves` stops when a move reshuffles the list.
 *
 * Sonnet r16: "the move numbers shifted after buying Fehu (the Skoll blueprint line vanished), so my
 * next number sold Brand by accident." Selling is one keypress with no confirm and no undo. So a
 * `moves` list stops at the first move after which the list of moves changed shape, says which
 * numbers it did not take, and shows the renumbered screen. And a sale is never taken inside a
 * `moves` list at all. The game is unchanged.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { parseArgs } from './args';
import { applyKeys, isSale, shapeChanged } from './chain';
import { COMMANDS } from './commands';
import { currentScreen } from './screen';
import { sessionPath, writeSession } from './sessionFile';
import { freshWorld, tempRoot } from './testKit';
import { marketWithBlueprint, setScrap, walkTo } from './walkKit';
import { applyMove } from './world';
import type { IRunCard } from '../../engine/runTypes';
import { addRunCollection } from '../../ui/store/runSlice';
import type { SessionFile, World } from './types';
import { runOf } from './types';

const mint = (dataId: string, instanceId: string): IRunCard => ({ instanceId, dataId, ownerId: null });
const keysOf = (world: World): string[] => currentScreen(world).moves.map((m) => m.key);
const numberOf = (world: World, key: string): number => keysOf(world).indexOf(key) + 1;

/** A market where the blueprint can be bought with exactly the amber it costs, and a card is in the collection to sell. */
function buyThenSell(): { world: World; buy: number; sell: number } {
    const { world, price } = marketWithBlueprint();
    setScrap(world, price);
    world.store.dispatch(addRunCollection([mint(runOf(world).deck[0].dataId, 'stored-1')]));
    return { world, buy: numberOf(world, 'market:blueprint'), sell: numberOf(world, 'market:sell:stored-1') };
}

describe('195i — a move that reshuffles the list stops the chain', () => {
    it('buy then sell, where the buy removes a line: the buy is made, the sell is not, and the stop says so', () => {
        const { world, buy, sell } = buyThenSell();
        expect(buy).toBeGreaterThan(0);
        expect(sell).toBeGreaterThan(0);
        const before = currentScreen(world);
        const result = applyKeys(world, before, [buy, sell], 'a chain', undefined, true);
        expect(result.applied.map((m) => m.key)).toEqual(['market:blueprint']);
        expect(result.stop).toContain('Stopped after move 1 of 2');
        expect(result.stop).toContain(`${sell} (`);
        // The card was not sold.
        expect(runOf(world).collection?.some((c) => c.instanceId === 'stored-1')).toBe(true);
    });

    it('a battle turn sent as one list is left alone, though the hand changes with every card', () => {
        const world = freshWorld({ mode: 'turn' });
        applyMove(world, { key: currentScreen(world).moves[0].key, why: 'into the fight' });
        expect(world.view.battle).not.toBeNull();
        const screen = currentScreen(world);
        const play = 1;
        const end = screen.moves.findIndex((m) => m.key === 'battle:end') + 1;
        expect(end).toBeGreaterThan(0);
        const result = applyKeys(world, screen, [play, end], 'a whole turn', undefined, true);
        expect(result.applied).toHaveLength(2);
        expect(result.stop).toBeNull();
    });
});

describe('195i — shapeChanged', () => {
    it('is true when another line came or went, false when only the move itself left', () => {
        const { world, buy } = buyThenSell();
        const before = currentScreen(world);
        applyMove(world, { key: 'market:blueprint', why: 't' });
        expect(shapeChanged(before, currentScreen(world), 'market:blueprint')).toBe(true);
        expect(buy).toBeGreaterThan(0);
        expect(shapeChanged(before, before, 'market:blueprint')).toBe(false);
    });
});

describe('195i — a sale is refused inside `moves`', () => {
    it('stops at the sale, takes nothing from it, and says to use "move"', () => {
        const { world, sell } = buyThenSell();
        const screen = currentScreen(world);
        const alone = applyKeys(world, screen, [sell], 'sale', undefined, true);
        expect(alone.applied).toEqual([]);
        expect(alone.failed).toBe(true);
        expect(alone.stop).toContain('Selling');
        expect(alone.stop).toContain('"move <n>"');
        expect(alone.stop).toContain('Nothing was changed');
        expect(runOf(world).collection?.some((c) => c.instanceId === 'stored-1')).toBe(true);
        // The same sale through `move` (not a list) is taken.
        expect(applyKeys(world, screen, [sell], 'sale').applied).toHaveLength(1);
        expect(isSale('market:sell:x')).toBe(true);
        expect(isSale('market:buy:x')).toBe(false);
    });
});

/** Sonnet r16's own situation, as a session on disk: a town with the Ratatoskr trace on the shelf and 75 amber. */
function townSession(root: string): { world: World; buy: number; sell: number; other: number } {
    const world = freshWorld({ seed: 'ps1' });
    expect(walkTo(world, 'marketplace', 80)).toBe(true);
    writeSession(root, 's1', { ...world.header, moves: world.log, notes: [] });
    return { world, buy: numberOf(world, 'market:blueprint'), sell: keysOf(world).findIndex((k) => k.startsWith('market:sell:')) + 1, other: numberOf(world, 'leave') };
}
const saved = (root: string): SessionFile => JSON.parse(readFileSync(sessionPath(root, 's1'), 'utf8')) as SessionFile;
const moves = (root: string, list: string, verb = 'moves') => COMMANDS[verb](root, parseArgs([verb, '--session', 's1', list, '--why', 'test']));

describe('195i — through the command, in the town where r16 sold Brand by accident', () => {
    it('`moves` buy-then-sell stops after the buy, says what it did not take, and shows the renumbered screen', () => {
        const root = tempRoot();
        const { buy, sell } = townSession(root);
        const before = saved(root).moves.length;
        const result = moves(root, `${buy},${sell}`);
        expect(result.code).toBe(0);
        expect(result.out).toContain('Stopped after move 1 of 2');
        expect(result.out).toContain(`Not taken: ${sell} (Sell `);
        expect(result.out).toContain('Bought the');
        expect(saved(root).moves.map((m) => m.key).slice(before)).toEqual(['market:blueprint']);
    });

    it('`moves` with a sale in it is refused and nothing is changed; `move` takes the same sale', () => {
        const root = tempRoot();
        const { sell } = townSession(root);
        const before = saved(root).moves.length;
        const refused = moves(root, `${sell}`);
        expect(refused.code).toBe(1);
        expect(refused.out).toContain('Selling');
        expect(saved(root).moves).toHaveLength(before);
        const single = moves(root, `${sell}`, 'move');
        expect(single.code).toBe(0);
        expect(saved(root).moves).toHaveLength(before + 1);
    });
});
