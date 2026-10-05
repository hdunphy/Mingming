/**
 * TICKET 195b — the playtest tool prints the same first-Trace line the game does, on the same screens.
 *
 * The line is read from `ui/hints/firstTraceHint.ts`, so the agent and a player see one sentence. The
 * tool starts every session as a fresh save, so the agent meets it on its first Trace of the session:
 * under the reward, under the shop's purchase, under the Wild Tracks pick, and under the gym's payout.
 * A later Trace does not carry it.
 */
import { describe, it, expect } from 'vitest';

import { getEvent } from '../../engine/run/events/eventCatalogue';
import { FIRST_TRACE_LINE } from '../../ui/hints/firstTraceHint';
import { markTraceHintShown } from '../../ui/store/gameSlice';
import { visitKeyOf } from './event/arrival';
import { noteTraceGained } from './firstTrace';
import { claimRewards } from './rewards';
import { renderScreen } from './render';
import { currentScreen } from './screen';
import { freshWorld } from './testKit';
import { giveBlueprint, marketWithBlueprint, routineMove, setScrap, worldAt } from './walkKit';
import { applyMove } from './world';
import type { World } from './types';
import { runOf } from './types';

const press = (world: World, key: string): void => applyMove(world, { key, why: 'test' });
const text = (world: World): string => renderScreen(world, currentScreen(world));
const count = (haystack: string): number => haystack.split(FIRST_TRACE_LINE).length - 1;
const shown = (world: World): boolean | undefined => world.store.getState().game.traceHintShown;

/** Routine moves until the first reward screen that pays a Trace (seed ps1 pays one on its first fight). */
function worldAtRewardWithTrace(): World {
    const world = freshWorld({ seed: 'ps1' });
    for (let i = 0; i < 40; i += 1) {
        const screen = currentScreen(world);
        if (screen.id === 'reward') {
            expect(world.view.reward!.blueprints.length, 'ps1 pays a Trace on its first fight').toBeGreaterThan(0);
            return world;
        }
        press(world, routineMove(screen, new Set(), world));
    }
    throw new Error('no reward screen');
}

describe('195b — the tool’s first-Trace check', () => {
    it('is true once on a fresh save, marks it, and is false after', () => {
        const world = freshWorld();
        expect(shown(world)).toBe(false);
        expect(noteTraceGained(world)).toBe(true);
        expect(shown(world)).toBe(true);
        expect(noteTraceGained(world)).toBe(false);
    });

    it('giving a Trace to the ranch for a test setup does not use it up', () => {
        const world = freshWorld();
        giveBlueprint(world, 'fenrir');
        expect(shown(world)).toBe(false);
    });
});

describe('195b — the reward screen', () => {
    it('carries the line under the Trace the fight paid, once', () => {
        const world = worldAtRewardWithTrace();
        const screen = text(world);
        expect(screen).toMatch(/trace/i);
        expect(count(screen)).toBe(1);
        expect(screen.indexOf(FIRST_TRACE_LINE)).toBeGreaterThan(screen.indexOf('REWARDS'));
        expect(world.view.reward!.firstTrace).toBe(true);
    });

    it('a save that has already shown the line does not carry it', () => {
        const world = freshWorld({ seed: 'ps1' });
        world.store.dispatch(markTraceHintShown());
        for (let i = 0; i < 40 && currentScreen(world).id !== 'reward'; i += 1) press(world, routineMove(currentScreen(world), new Set(), world));
        expect(world.view.reward!.blueprints.length).toBeGreaterThan(0);
        expect(count(text(world))).toBe(0);
    });

    it('a fight with nothing to decide is claimed at once, and the line is in the news under the banked Trace', () => {
        const world = worldAtRewardWithTrace();
        world.view.reward = { ...world.view.reward!, cardChoices: [], patchOffers: [], macroOffers: [] };
        claimRewards(world);
        const news = world.view.news.join('\n');
        expect(count(news)).toBe(1);
        expect(news.indexOf(FIRST_TRACE_LINE)).toBeGreaterThan(news.indexOf('Banked'));
    });
});

describe('195b — the shop', () => {
    it('buying the shop’s Trace says to summon it in the Den, under the "Bought" line', () => {
        const { world } = marketWithBlueprint();
        setScrap(world, 600);
        press(world, 'market:blueprint');
        const news = world.view.news.join('\n');
        expect(news).toContain('Bought');
        expect(news.indexOf(FIRST_TRACE_LINE)).toBeGreaterThan(news.indexOf('Bought'));
        expect(count(text(world))).toBe(1);
    });

    it('a save that has shown the line does not carry it', () => {
        const { world } = marketWithBlueprint();
        setScrap(world, 600);
        world.store.dispatch(markTraceHintShown());
        press(world, 'market:blueprint');
        expect(count(text(world))).toBe(0);
    });
});

describe('195b — Wild Tracks', () => {
    function wildTracksWorld(): World {
        const world = worldAt('event');
        const node = runOf(world).nodes.find((n) => n.id === runOf(world).currentNodeId)!;
        world.view.event = { visitKey: visitKeyOf(node), event: getEvent('wild_tracks')!, choiceId: null, outcomeIndex: 0, picks: {}, selected: [], upgrading: false };
        return world;
    }
    const takeATrace = (world: World): void => {
        press(world, 'event:choose:pick');
        press(world, currentScreen(world).moves.find((m) => m.key.startsWith('event:blueprint:'))!.key);
    };

    it('the pick says to summon it in the Den, once a save', () => {
        const world = wildTracksWorld();
        takeATrace(world);
        expect(Object.values(world.store.getState().game.blueprints).reduce((a, b) => a + b, 0)).toBe(1);
        expect(count(text(world))).toBe(1);
        expect(shown(world)).toBe(true);
    });

    it('a save that has shown the line does not carry it', () => {
        const world = wildTracksWorld();
        world.store.dispatch(markTraceHintShown());
        takeATrace(world);
        expect(count(text(world))).toBe(0);
    });
});
