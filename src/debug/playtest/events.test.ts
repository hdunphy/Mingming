/**
 * TICKET 180c — events: the choices on offer, each choice's steps, and the ending.
 *
 * Rather than hunt for seeds that happen to draw a given event, the tests put the event they want
 * into the flow (`view.event`), exactly what arriving at the node would store, and then play it
 * through the screens. Nothing pins on-screen wording (182 and 183h rewrite it).
 */
import { describe, it, expect } from 'vitest';

import { getEvent, EVENTS } from '../../engine/run/events/eventCatalogue';
import { BUILT_EVENTS } from '../../engine/run/events/eventDraw';
import { playableChoices } from '../../engine/run/events/eventChoices';
import { EMPTY_RELAY_SCRAP } from '../../engine/run/events/emptyRelay';
import { eventResolvedAt } from '../../engine/run/events/eventState';
import type { EventDefinition } from '../../engine/run/events/eventSchema';
import { choiceBlockedReason } from '../../ui/events/choiceAvailability';
import { addRunCollection } from '../../ui/store/runSlice';
import { visitKeyOf, eventContextOf } from './event/arrival';
import { currentScreen } from './screen';
import { giveBlueprint, setScrap, settleRewards, worldAt } from './walkKit';
import { applyMove } from './world';
import type { World } from './types';
import { runOf } from './types';
import { ProgramRegistry } from '../../engine/data/programRegistry';
import { MingmingRegistry } from '../../engine/data/mingmingRegistry';

const keysOf = (world: World): string[] => currentScreen(world).moves.map((m) => m.key);
const press = (world: World, key: string): void => applyMove(world, { key, why: 'test' });

/** A world standing on an event node with `event` drawn (null for the Empty Relay), and a purse and kit to play it with. */
function eventWorld(event: EventDefinition | null): World {
    const world = worldAt('event');
    const node = runOf(world).nodes.find((n) => n.id === runOf(world).currentNodeId)!;
    setScrap(world, 500);
    for (const id of Object.keys(MingmingRegistry).slice(0, 4)) giveBlueprint(world, id);
    const some = Object.keys(ProgramRegistry).filter((id) => !ProgramRegistry[id].junk && ProgramRegistry[id].upgradeOf === undefined).slice(0, 6);
    world.store.dispatch(addRunCollection(some.map((dataId, i) => ({ instanceId: `kit-${i}`, dataId, ownerId: null }))));
    world.view.event = {
        visitKey: visitKeyOf(node), event, choiceId: null, outcomeIndex: 0, picks: {}, selected: [], upgrading: false,
    };
    return world;
}

describe('180c — an event on offer', () => {
    it('arriving at an event node draws its event once, and the screen offers its playable choices', () => {
        const world = worldAt('event');
        const node = runOf(world).nodes.find((n) => n.id === runOf(world).currentNodeId)!;
        expect(world.view.event).not.toBeNull();
        expect(world.view.event!.visitKey).toBe(visitKeyOf(node));
        expect(currentScreen(world).id).toBe('event');
    });

    it('lists every playable choice, and gives a move only to the ones that are not blocked', () => {
        const event = getEvent('trader')!;
        const world = eventWorld(event);
        const ctx = eventContextOf(world, runOf(world).nodes.find((n) => n.id === runOf(world).currentNodeId)!);
        const expected = playableChoices(event).filter((c) => choiceBlockedReason(c, ctx) === null).map((c) => `event:choose:${c.id}`);
        expect(keysOf(world)).toEqual(expected);
    });

    it('an unaffordable choice has no move', () => {
        const event = EVENTS.find((e) => e.choices.some((c) => c.outcomes.some((o) => o.type === 'SCRAP' && o.amount < 0)))!;
        const world = eventWorld(event);
        setScrap(world, 0);
        const ctx = eventContextOf(world, runOf(world).nodes.find((n) => n.id === runOf(world).currentNodeId)!);
        for (const choice of playableChoices(event)) {
            const blocked = choiceBlockedReason(choice, ctx) !== null;
            expect(keysOf(world).includes(`event:choose:${choice.id}`)).toBe(!blocked);
        }
    });
});

describe('180c — the Empty Relay and a spent node', () => {
    it('salvages scrap, then the node is dark and the only move is to leave', () => {
        const world = eventWorld(null);
        const before = runOf(world).scrap;
        expect(keysOf(world)).toEqual(['event:salvage']);
        press(world, 'event:salvage');
        expect(runOf(world).scrap).toBe(before + EMPTY_RELAY_SCRAP);
        expect(eventResolvedAt(runOf(world), runOf(world).currentNodeId)).toBeDefined();
        expect(keysOf(world)).toEqual(['leave']);
        press(world, 'leave');
        expect(currentScreen(world).id).toBe('map');
    });
});

describe('180c — walking every built event through to its end', () => {
    const built = EVENTS.filter((e) => BUILT_EVENTS.has(e.id));

    for (const event of built) {
        it(`${event.id}: every playable choice can be played to the end, with a legal move at every step`, () => {
            for (const choice of playableChoices(event)) {
                const world = eventWorld(event);
                const node = runOf(world).nodes.find((n) => n.id === runOf(world).currentNodeId)!;
                const ctx = eventContextOf(world, node);
                if (choiceBlockedReason(choice, ctx) !== null) continue;

                press(world, `event:choose:${choice.id}`);
                const pressed = new Set<string>();
                for (let guard = 0; guard < 12; guard += 1) {
                    if (world.view.reward || runOf(world).phase === 'ended') break;
                    const screen = currentScreen(world);
                    if (screen.id !== 'event' || eventResolvedAt(runOf(world), node.id)) break;
                    // A several-card step ticks cards and then confirms; never tick the same card twice.
                    const forward = screen.moves.find((m) => m.key === 'event:confirm')
                        ?? screen.moves.find((m) => m.key !== 'event:back' && !pressed.has(m.key));
                    expect(forward, `${event.id}/${choice.id}: a step with no way forward`).toBeDefined();
                    pressed.add(forward!.key);
                    press(world, forward!.key);
                }
                if (world.view.reward) settleRewards(world);
                const run = runOf(world);
                expect(run.phase === 'ended' || eventResolvedAt(run, node.id) !== undefined, `${event.id}/${choice.id} settles`).toBe(true);
                if (run.phase !== 'ended') expect(run.phase).toBe('map');
            }
        });
    }
});

describe('180c — a choice with picks', () => {
    it('BACK abandons the choice without spending the node', () => {
        const event = getEvent('trader') ?? built0();
        const world = eventWorld(event);
        const choose = keysOf(world).find((k) => {
            const id = k.replace('event:choose:', '');
            return event.choices.find((c) => c.id === id)!.outcomes.some((o) => ['CARD_PICK', 'GIVE_CARD', 'TRADE_UP', 'DRIVER_PICK', 'MACRO_PICK', 'BLUEPRINT_PICK'].includes(o.type));
        });
        expect(choose, 'a choice with a pick step').toBeDefined();
        press(world, choose!);
        expect(keysOf(world)).toContain('event:back');
        press(world, 'event:back');
        expect(eventResolvedAt(runOf(world), runOf(world).currentNodeId)).toBeUndefined();
        expect(keysOf(world)).toContain(choose!);
    });
});

const built0 = (): EventDefinition => EVENTS.find((e) => BUILT_EVENTS.has(e.id))!;
