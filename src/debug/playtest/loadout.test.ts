/**
 * TICKET 180c — the loadout editor and the biome boundary offer.
 *
 * Every edit is checked against the run the game's own reducer produces for the same action.
 */
import { describe, it, expect } from 'vitest';
import type { PayloadAction } from '@reduxjs/toolkit';

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import runReducer, {
    benchPartyMember, moveCardToCollection, moveCardToDeck, setRun, swapBenchMember, unbenchMember,
} from '../../ui/store/runSlice';
import { addRunCards } from '../../ui/store/runSlice';
import { currentScreen } from './screen';
import { freshWorld } from './testKit';
import { giveBlueprint, setScrap, worldAt } from './walkKit';
import { applyMove } from './world';
import type { World } from './types';
import { runOf } from './types';

const keysOf = (world: World): string[] => currentScreen(world).moves.map((m) => m.key);
const press = (world: World, key: string): void => applyMove(world, { key, why: 'test' });
const expectedRun = (world: World, action: PayloadAction<unknown>) => runReducer({ run: runOf(world) }, action).run;

/** At a workshop with a second member built (onto the bench, or into the party), then the editor open. */
function editorWorld(into: 'bench' | 'party' = 'bench'): World {
    const world = worldAt('workshop');
    setScrap(world, 300);
    const mine = world.store.getState().game.roster.map((m) => m.definitionId);
    const species = Object.keys(MingmingRegistry).find((id) => !mine.includes(id) && MingmingRegistry[id].availableOS.length > 0)!;
    giveBlueprint(world, species);
    const bench = keysOf(world).find((k) => k.startsWith('workshop:assemble:') && k.endsWith(`:${into}`))!;
    press(world, bench);
    press(world, 'loadout:open');
    return world;
}

describe('180c — the loadout editor', () => {
    it('opens over the workshop and confirm closes it', () => {
        const world = editorWorld();
        expect(currentScreen(world).id).toBe('loadout');
        press(world, 'loadout:confirm');
        expect(currentScreen(world).id).toBe('workshop');
    });

    it('shuts deck cards at the floor and moves a card between deck and collection as the reducers do', () => {
        const world = editorWorld();
        const deck = runOf(world).deck;
        const sendKeys = keysOf(world).filter((k) => k.startsWith('loadout:send:'));
        const toSend = deck.find((c) => !keysOf(world).includes(`loadout:send:${c.instanceId}`));
        // Whatever the floor says, the editor and the reducer agree on which deck cards may go.
        for (const key of sendKeys) {
            const id = key.replace('loadout:send:', '');
            expect(expectedRun(world, moveCardToCollection(id))).not.toBe(runOf(world));
        }
        if (toSend) expect(sendKeys.length).toBeLessThan(deck.length);

        world.store.dispatch(addRunCards([{ instanceId: 'spare', dataId: deck[0].dataId, ownerId: null }]));
        const send = keysOf(world).find((k) => k.startsWith('loadout:send:'))!;
        const id = send.replace('loadout:send:', '');
        const afterSend = expectedRun(world, moveCardToCollection(id));
        press(world, send);
        expect(runOf(world)).toEqual(afterSend);

        const add = keysOf(world).find((k) => k.startsWith('loadout:add:'))!;
        const afterAdd = expectedRun(world, moveCardToDeck(add.replace('loadout:add:', '')));
        press(world, add);
        expect(runOf(world)).toEqual(afterAdd);
    });

    it('benches a party member as benchPartyMember does, but never the last one', () => {
        const world = editorWorld('party');
        const [first] = runOf(world).partyIds;
        const solo = keysOf(world).filter((k) => k.startsWith('loadout:bench:'));
        expect(solo.length).toBeGreaterThan(0);
        const expected = expectedRun(world, benchPartyMember(first));
        press(world, `loadout:bench:${first}`);
        expect(runOf(world)).toEqual(expected);
        expect(keysOf(world).filter((k) => k.startsWith('loadout:bench:'))).toEqual([]);
    });

    it('swaps a benched member in for a party member', () => {
        const world = editorWorld();
        const benched = runOf(world).bench![0];
        const out = runOf(world).partyIds[0];
        press(world, `loadout:pick:${benched}`);
        expect(keysOf(world).some((k) => k.startsWith('loadout:swap-in:'))).toBe(true);
        const expected = expectedRun(world, swapBenchMember({ outId: out, inId: benched }));
        press(world, `loadout:swap-in:${out}`);
        expect(runOf(world)).toEqual(expected);
        expect(world.view.editor?.swapping).toBeNull();
    });

    it('brings a benched member into an empty slot', () => {
        const world = editorWorld();
        const benched = runOf(world).bench![0];
        press(world, `loadout:pick:${benched}`);
        const expected = expectedRun(world, unbenchMember(benched));
        press(world, 'loadout:unbench');
        expect(runOf(world)).toEqual(expected);
    });

    it('warns once when confirmed with a member still picked up, then closes', () => {
        const world = editorWorld();
        press(world, `loadout:pick:${runOf(world).bench![0]}`);
        press(world, 'loadout:confirm');
        expect(world.view.editor?.confirmWarned).toBe(true);
        press(world, 'loadout:confirm');
        expect(world.view.editor).toBeNull();
    });
});

describe('180c — the biome boundary offer', () => {
    const owed = (): World => {
        const world = freshWorld();
        world.store.dispatch(setRun({ ...runOf(world), boundaryBiome: 1 }));
        return world;
    };

    it('replaces the map until it is answered', () => {
        const world = owed();
        expect(currentScreen(world).id).toBe('boundary');
        expect(keysOf(world).sort()).toEqual(['boundary:edit', 'boundary:ignore']);
    });

    it('ignoring dismisses it and the map is back', () => {
        const world = owed();
        press(world, 'boundary:ignore');
        expect(runOf(world).boundaryBiome).toBeUndefined();
        expect(currentScreen(world).id).toBe('map');
    });

    it('editing dismisses it and opens the editor', () => {
        const world = owed();
        press(world, 'boundary:edit');
        expect(runOf(world).boundaryBiome).toBeUndefined();
        expect(currentScreen(world).id).toBe('loadout');
        press(world, 'loadout:confirm');
        expect(currentScreen(world).id).toBe('map');
    });
});
