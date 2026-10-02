/**
 * TICKET 180b — the market: every move does what the matching game reducer does.
 *
 * Each test builds the expected run by calling the game's own reducer with the action the stall
 * would send, applies the playtester's move, and compares the two whole runs. Nothing here pins
 * on-screen wording (182 and 183h rewrite it): it reads move keys, run state and rolled stock.
 */
import { describe, it, expect } from 'vitest';
import type { PayloadAction } from '@reduxjs/toolkit';

import { ProgramRegistry } from '../../engine/data/programRegistry';
import { upgradeIdFor } from '../../engine/data/plusRegistry';
import { isJunkCard } from '../../engine/run/junk';
import {
    JUNK_REMOVAL_PRICE, MARKET_REFRESH_PRICE, UPGRADES_PER_VISIT, isOfferSold, rollMacroStock,
    rollMarketStock, sellPrice,
} from '../../engine/run/marketplace';
import { marketPartyFor } from '../../engine/run/marketParty';
import { shopPrice } from '../../engine/run/modifiers/shopPrice';
import type { IRunCard } from '../../engine/runTypes';
import runReducer, { addRunCards, addRunCollection, buyMacro, buyMarketCard, fitPatch, removeJunkCard, rerollMarketStock, sellRunCard, upgradeDeckCard } from '../../ui/store/runSlice';
import { SHOP_PATCH_PRICE } from '../../ui/screens/PatchBench';
import { renderScreen, roughTokens } from './render';
import { currentScreen } from './screen';
import { liveRanchParty } from './stalls';
import { freshWorld } from './testKit';
import { giveScrap, marketWithBlueprint, setScrap, standAt, walkTo } from './walkKit';
import { applyMove } from './world';
import type { World } from './types';
import { runOf } from './types';

const keysOf = (world: World): string[] => currentScreen(world).moves.map((m) => m.key);
const press = (world: World, key: string): void => applyMove(world, { key, why: 'test' });
const expectedRun = (world: World, action: PayloadAction<unknown>) => runReducer({ run: runOf(world) }, action).run;

function marketWorld(scrap = 600): World {
    const world = freshWorld();
    standAt(world, 'marketplace');
    setScrap(world, scrap);
    return world;
}

const mint = (dataId: string, instanceId: string): IRunCard => ({ instanceId, dataId, ownerId: null });
const upgradable = (): string[] => Object.keys(ProgramRegistry).filter((id) => upgradeIdFor(id) !== undefined);

describe('180b — arriving at a market', () => {
    it('is the market screen, with the shelf frozen for the team it was first seen with', () => {
        const world = freshWorld();
        const node = standAt(world, 'marketplace');
        expect(currentScreen(world).id).toBe('market');
        expect(runOf(world).marketParties?.[node.id]).toBeDefined();
        expect(keysOf(world)).toContain('leave');
    });

    it('leaving shows the map with a way back in, and going back in shows the market again', () => {
        const world = marketWorld();
        press(world, 'leave');
        expect(currentScreen(world).id).toBe('map');
        expect(keysOf(world)).toContain('reopen');
        press(world, 'reopen');
        expect(currentScreen(world).id).toBe('market');
    });
});

describe('180b — market purchases change the run as the reducer does', () => {
    it('buys a card from the shelf', () => {
        const world = marketWorld();
        const run = runOf(world);
        const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
        const stock = rollMarketStock({ run, node, party: marketPartyFor(run, node.id, liveRanchParty(world)) });
        const offer = stock.offers.find((o) => !isOfferSold([...run.deck, ...(run.collection ?? [])], o))!;
        const expected = expectedRun(world, buyMarketCard({ card: offer.card, price: offer.price }));
        press(world, `market:buy:${offer.card.instanceId}`);
        expect(runOf(world)).toEqual(expected);
        expect(runOf(world).deck.some((c) => c.instanceId === offer.card.instanceId)).toBe(true);
        expect(keysOf(world)).not.toContain(`market:buy:${offer.card.instanceId}`);
    });

    it('buys a macro into the rack', () => {
        const world = marketWorld();
        const run = runOf(world);
        const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
        const offer = rollMacroStock({ run, node, party: marketPartyFor(run, node.id, liveRanchParty(world)) })[0];
        const expected = expectedRun(world, buyMacro({ macroId: offer.macroId, price: offer.price }));
        press(world, `market:macro:${offer.macroId}`);
        expect(runOf(world)).toEqual(expected);
        expect(runOf(world).macros).toContain(offer.macroId);
        expect(keysOf(world)).not.toContain(`market:macro:${offer.macroId}`);
    });

    it('pays for a refresh, which re-rolls the shelf for the team you have now', () => {
        const world = marketWorld();
        const run = runOf(world);
        const price = shopPrice(run, MARKET_REFRESH_PRICE);
        const expected = expectedRun(world, rerollMarketStock({ nodeId: run.currentNodeId, price, party: liveRanchParty(world) }));
        press(world, 'market:refresh');
        expect(runOf(world)).toEqual(expected);
        expect(runOf(world).scrap).toBe(run.scrap - price);
    });

    it('buys a blueprint into the ranch and takes the scrap once', () => {
        const { world, speciesId, price } = marketWithBlueprint();
        giveScrap(world, 400);
        const before = runOf(world).scrap;
        const held = world.store.getState().game.blueprints[speciesId] ?? 0;
        press(world, 'market:blueprint');
        expect(world.store.getState().game.blueprints[speciesId]).toBe(held + 1);
        expect(runOf(world).scrap).toBe(before - price);
        expect(keysOf(world)).not.toContain('market:blueprint');
    });
});

describe('180b — selling, junk, patches and upgrades', () => {
    it('sells a collection card, and shuts deck sales at the floor', () => {
        const world = marketWorld(0);
        const deckKeys = runOf(world).deck.map((c) => `market:sell:${c.instanceId}`);
        expect(keysOf(world).filter((k) => deckKeys.includes(k))).toEqual([]);

        const card = mint(runOf(world).deck[0].dataId, 'stored-1');
        world.store.dispatch(addRunCollection([card]));
        const price = sellPrice(card.dataId);
        const expected = expectedRun(world, sellRunCard({ instanceId: 'stored-1', price }));
        press(world, 'market:sell:stored-1');
        expect(runOf(world)).toEqual(expected);
        expect(runOf(world).scrap).toBe(price);
    });

    it('sells a deck card once the deck is above the floor', () => {
        const world = marketWorld(0);
        const extra = mint(runOf(world).deck[0].dataId, 'extra-1');
        world.store.dispatch(addRunCards([extra]));
        const deckIds = runOf(world).deck.map((c) => `market:sell:${c.instanceId}`);
        expect(keysOf(world).some((k) => deckIds.includes(k))).toBe(true);
    });

    it('pays to remove junk, and only when it can be paid for', () => {
        const junkId = Object.keys(ProgramRegistry).find((id) => isJunkCard(id));
        expect(junkId, 'the registry has a junk card').toBeDefined();
        const world = marketWorld(0);
        world.store.dispatch(addRunCards([mint(junkId!, 'junk-1')]));
        expect(keysOf(world)).not.toContain('market:junk:junk-1');
        setScrap(world, 200);
        const price = shopPrice(runOf(world), JUNK_REMOVAL_PRICE);
        const expected = expectedRun(world, removeJunkCard({ instanceId: 'junk-1', price }));
        press(world, 'market:junk:junk-1');
        expect(runOf(world)).toEqual(expected);
    });

    it('fits the stall patch on a body, once', () => {
        const world = marketWorld();
        const patchKeys = keysOf(world).filter((k) => k.startsWith('patch:shop:'));
        expect(patchKeys.length).toBeGreaterThan(0);
        const [, , memberId, patchId] = patchKeys[0].split(':');
        const price = shopPrice(runOf(world), SHOP_PATCH_PRICE);
        const expected = expectedRun(world, fitPatch({ memberId, patchId, price, benchKey: undefined }));
        press(world, patchKeys[0]);
        expect(runOf(world)).toEqual(expected);
        expect(keysOf(world).filter((k) => k.startsWith('patch:shop:'))).toEqual([]);
    });

    it('upgrades a card, and a third upgrade at a two-upgrade bench has no move', () => {
        expect(UPGRADES_PER_VISIT).toBe(2);
        const world = marketWorld(900);
        const ids = upgradable().slice(0, 3);
        world.store.dispatch(addRunCards(ids.map((id, i) => mint(id, `up-${i}`))));
        const upgradeKeys = () => keysOf(world).filter((k) => k.startsWith('market:upgrade:'));

        const run = runOf(world);
        const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
        const expected = expectedRun(world, upgradeDeckCard({ instanceId: 'up-0', benchKey: `${node.id}:${node.visited}`, free: false, allowance: UPGRADES_PER_VISIT }));
        press(world, 'market:upgrade:up-0');
        expect(runOf(world)).toEqual(expected);
        expect(runOf(world).deck.find((c) => c.instanceId === 'up-0')!.dataId).toBe(upgradeIdFor(ids[0]));

        press(world, 'market:upgrade:up-1');
        expect(upgradeKeys()).toEqual([]);
    });

    it('lists what it cannot afford without a move for it', () => {
        const world = freshWorld();
        standAt(world, 'marketplace');
        setScrap(world, 0);
        const keys = keysOf(world);
        for (const prefix of ['market:buy:', 'market:macro:', 'market:blueprint', 'market:refresh', 'patch:shop:', 'market:upgrade:']) {
            expect(keys.filter((k) => k.startsWith(prefix)), prefix).toEqual([]);
        }
        expect(keys).toContain('leave');
    });
});

describe('180b — screen size', () => {
    it('a market with a full purse prints in under about 1,000 tokens', () => {
        const world = marketWorld(300);
        expect(roughTokens(renderScreen(world))).toBeLessThan(1000);
    });
});

describe('180b — a market on a real route', () => {
    it('is reached by plain moves, and a replay of those moves lands on the same state', async () => {
        const { replayWorld, stateHash } = await import('./world');
        let reached: World | null = null;
        for (const seed of ['ps1', 'ps2', 'ps3', 'ps4', 'ps5', 'ps6']) {
            const world = freshWorld({ seed });
            if (walkTo(world, 'marketplace', 30)) { reached = world; break; }
        }
        expect(reached, 'a seed reaches a market').not.toBeNull();
        const world = reached!;
        expect(currentScreen(world).id).toBe('market');
        press(world, 'leave');
        press(world, 'reopen');
        const replayed = replayWorld(world.header, world.log);
        expect(stateHash(replayed)).toBe(stateHash(world));
    });
});
