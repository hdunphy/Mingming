/**
 * TICKET 195c — the playtest tool's header says how many Traces are held, from the same function the game reads.
 */
import { describe, it, expect } from 'vitest';

import { MingmingRegistry } from '../../engine/data/mingmingRegistry';
import { tracesHeld } from '../../engine/run/workshop';
import { currentScreen } from './screen';
import { statusLine } from './render';
import { freshWorld } from './testKit';
import { giveBlueprint, setScrap, standAt } from './walkKit';
import { applyMove } from './world';
import type { World } from './types';
import { runOf } from './types';

const press = (world: World, key: string): void => applyMove(world, { key, why: 'test' });
const ranchOf = (world: World) => world.store.getState().game;
const traces = (world: World): string | undefined => /traces (\d+)/.exec(statusLine(world))?.[1];

describe('195c — the tool’s header', () => {
    it('says 0 for a fresh save, and counts what the ranch holds', () => {
        const world = freshWorld();
        expect(traces(world)).toBe('0');
        const [a, b] = Object.keys(MingmingRegistry);
        giveBlueprint(world, a);
        giveBlueprint(world, b);
        expect(traces(world)).toBe('2');
        expect(traces(world)).toBe(String(tracesHeld(ranchOf(world), runOf(world))));
    });

    it('goes from 2 to 1 when a summon spends one', () => {
        const world = freshWorld();
        standAt(world, 'workshop');
        setScrap(world, 500);
        const mine = ranchOf(world).roster.map((m) => m.definitionId);
        const [species] = Object.keys(MingmingRegistry).filter((id) => !mine.includes(id) && MingmingRegistry[id].availableOS.length > 0);
        giveBlueprint(world, species);
        giveBlueprint(world, species);
        expect(traces(world)).toBe('2');
        press(world, currentScreen(world).moves.find((m) => m.key.startsWith('workshop:assemble:'))!.key);
        expect(traces(world)).toBe('1');
    });

    it('is on the status line, which every screen starts with', () => {
        expect(statusLine(freshWorld())).toMatch(/\| traces 0 \|/);
    });
});
