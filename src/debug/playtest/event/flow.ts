/**
 * TICKET 180c — AN EVENT'S CHOICES, PICKS AND ENDING, as `EventNode` runs them.
 *
 * Choosing resolves the gambles (`resolveGambles`, deterministic from the node), then walks the
 * choice's interactive outcomes in order: a card pick, a give-up, a blueprint, a driver and so on,
 * each answered by one step. When the last is answered, `applyChoice` (the game's own, which
 * dispatches every reducer) settles the whole choice and `resolveEvent` marks the node spent. A
 * choice that sends the party into a fight (`FIGHT`) then plays that fight.
 */
import { resolveGambles } from '../../../engine/run/events/eventGamble';
import type { EventChoice, EventDefinition, EventOutcome } from '../../../engine/run/events/eventSchema';
import type { IRegionNode } from '../../../engine/runTypes';
import { isEventFight } from '../../../engine/run/eventFight';
import { applyChoice, isInteractiveOutcome } from '../../../ui/events/applyOutcome';
import { describeApplied } from '../../../ui/events/describeOutcome';
import type { OutcomePick } from '../../../ui/events/outcomePicks';
import { playFightNode } from '../fightFlow';
import { FIRST_TRACE_LINE, noteTraceGained } from '../firstTrace';
import type { EventFlow, World } from '../types';
import { runOf } from '../types';
import { eventContextOf } from './arrival';

const interactiveIndices = (choice: EventChoice): number[] =>
    choice.outcomes.flatMap((outcome, index) => (isInteractiveOutcome(outcome) ? [index] : []));

/** The flow for this visit, or null when the view holds none (or one from a past visit). */
export const flowAt = (world: World, node: IRegionNode): EventFlow | null =>
    (world.view.event && world.view.event.visitKey === `${node.id}:${node.visited}` ? world.view.event : null);

const withFlow = (world: World, patch: Partial<EventFlow>): void => {
    if (world.view.event) world.view.event = { ...world.view.event, ...patch };
};

/** The choice being answered, with its gambles resolved, and the outcome the step is on. */
export function activeChoice(world: World, node: IRegionNode, flow: EventFlow): { choice: EventChoice; outcome: EventOutcome | undefined } | null {
    const base = flow.event?.choices.find((c) => c.id === flow.choiceId);
    if (!base) return null;
    const choice = resolveGambles({ run: runOf(world), node }, base);
    return { choice, outcome: choice.outcomes[flow.outcomeIndex] };
}

export function chooseChoice(world: World, node: IRegionNode, flow: EventFlow, base: EventChoice): void {
    const choice = resolveGambles({ run: runOf(world), node }, base);
    if (choice.outcomes.some((outcome) => outcome.type === 'UPGRADE')) {
        withFlow(world, { choiceId: base.id, upgrading: true });
        return;
    }
    const interactive = interactiveIndices(choice);
    if (interactive.length === 0) { finish(world, node, flow.event!, choice, {}); return; }
    withFlow(world, { choiceId: base.id, outcomeIndex: interactive[0], picks: {}, selected: [] });
}

/** Answer the step the flow is on; the last answer settles the choice. */
export function takePick(world: World, node: IRegionNode, flow: EventFlow, answer: OutcomePick): void {
    const active = activeChoice(world, node, flow);
    if (!active) return;
    const picks = { ...flow.picks, [flow.outcomeIndex]: answer };
    const rest = interactiveIndices(active.choice).filter((index) => index > flow.outcomeIndex);
    if (rest.length === 0) { finish(world, node, flow.event!, active.choice, picks); return; }
    withFlow(world, { picks, outcomeIndex: rest[0], selected: [] });
}

/** BACK: abandon the choice and its picks and return to the offer. */
export function backOut(world: World): void {
    withFlow(world, { choiceId: null, outcomeIndex: 0, picks: {}, selected: [], upgrading: false });
}

export const toggleSelected = (world: World, instanceId: string, count: number, current: ReadonlyArray<string>): void => {
    if (current.includes(instanceId)) withFlow(world, { selected: current.filter((id) => id !== instanceId) });
    else if (current.length < count) withFlow(world, { selected: [...current, instanceId] });
};

export function finish(world: World, node: IRegionNode, event: EventDefinition, choice: EventChoice, picks: Readonly<Record<number, OutcomePick>>): void {
    const run = runOf(world);
    const ctx = eventContextOf(world, node);
    const note = describeApplied(choice, run.scrap, picks, ctx);
    if (note !== '') world.view.news.push(note);
    // 195b: a Trace taken from the event is the save's first, so it says where to use it, under the note.
    if (choice.outcomes.some((outcome, index) => outcome.type === 'BLUEPRINT_PICK' && picks[index] !== undefined) && noteTraceGained(world)) {
        world.view.news.push(FIRST_TRACE_LINE);
    }
    applyChoice(
        (action) => world.store.dispatch(action),
        { run, node, ranch: world.store.getState().game, rosterHas: (id) => world.store.getState().game.roster.some((m) => m.id === id) },
        event, choice, picks,
    );
    world.view.event = null;

    const after = runOf(world);
    const here = after.nodes.find((n) => n.id === node.id)!;
    if (after.phase === 'encounter' && isEventFight(after, here)) playFightNode(world, here);
}
