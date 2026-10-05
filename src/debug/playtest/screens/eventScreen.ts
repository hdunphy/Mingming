/**
 * TICKET 180c — THE EVENT SCREEN.
 *
 * `EventNode`'s states, in its order: the dark relay of a spent node (leave), the Empty Relay when
 * nothing was eligible (salvage), the Overclock Rig's free upgrade bench, a pick step of the choice
 * being answered, and otherwise the event's text with its playable choices. A choice the party
 * cannot take (`choiceBlockedReason`) is listed with the game's reason and has no move. An
 * unresolved event has no leave: the choices include their own way out, as in the game.
 */
import { hasUpgrade } from '../../../engine/data/plusRegistry';
import { playableChoices } from '../../../engine/run/events/eventChoices';
import { choiceDetail } from '../../../engine/run/events/eventDetail';
import { EMPTY_RELAY_ID, EMPTY_RELAY_SCRAP, EMPTY_RELAY_TEXT } from '../../../engine/run/events/emptyRelay';
import { eventResolvedAt } from '../../../engine/run/events/eventState';
import { applyEmptyRelay } from '../../../ui/events/applyOutcome';
import { choiceBlockedReason } from '../../../ui/events/choiceAvailability';
import { eventContextOf } from '../event/arrival';
import { activeChoice, backOut, chooseChoice, finish, flowAt, takePick } from '../event/flow';
import { stepSection } from '../event/steps';
import { hereNode } from '../stalls';
import type { Move, Screen, World } from '../types';
import { runOf } from '../types';
import { nodeLabel } from '../gameText';
import { plain } from '../../../ui/labels/labels';
import { upgradeSection } from './upgradeBench';

const leaveEvent = (world: World): void => {
    const node = hereNode(world);
    world.view.leftEvent = `${node.id}:${node.visited}`;
};

export function eventScreen(world: World): Screen {
    const run = runOf(world);
    const node = hereNode(world);
    const ctx = eventContextOf(world, node);
    const head = `${nodeLabel(node)}, visit ${node.visited}. Amber: ${run.scrap}.`;
    const flow = flowAt(world, node);
    const back: Move = { key: 'event:back', label: 'Go back', apply: backOut };

    if (eventResolvedAt(run, node.id) || flow === null) {
        return { id: 'event', body: [head, 'The relay is dark. Nothing here now.'], moves: [{ key: 'leave', label: 'Walk back out to the map', apply: leaveEvent }] };
    }

    if (flow.event === null) {
        return {
            id: 'event',
            body: [head, plain(EMPTY_RELAY_TEXT)],
            moves: [{
                key: 'event:salvage', label: `Salvage (+${EMPTY_RELAY_SCRAP} amber)`,
                apply: (w) => applyEmptyRelay((a) => w.store.dispatch(a), { run, node }, EMPTY_RELAY_ID, EMPTY_RELAY_SCRAP),
            }],
        };
    }

    const { event } = flow;
    const active = flow.choiceId === null ? null : activeChoice(world, node, flow);

    if (flow.upgrading && active) {
        const upgrade = active.choice.outcomes.find((o) => o.type === 'UPGRADE');
        const allowance = upgrade && upgrade.type === 'UPGRADE' ? upgrade.count : 1;
        const benchKey = `event:${node.id}`;
        const used = (run.upgradesTaken ?? []).filter((k) => k === benchKey).length;
        const finished = used >= allowance || run.deck.filter((c) => hasUpgrade(c.dataId)).length === 0;
        const bench = upgradeSection(world, { benchKey, allowance, free: true, keyPrefix: 'event' });
        const moves = [...bench.moves];
        if (finished) moves.push({ key: 'event:done', label: 'Done', apply: (w) => finish(w, node, event, active.choice, {}) });
        if (used === 0) moves.push(back);
        return { id: 'event', body: [head, plain(event.name), `Upgrade ${allowance} cards.`, ...bench.lines], moves };
    }

    if (active?.outcome && flow.choiceId !== null) {
        const slot = `${flow.choiceId}:${flow.outcomeIndex}`;
        const step = stepSection({ world, ctx, flow, outcome: active.outcome, slot, take: (pick) => takePick(world, node, flow, pick) });
        return { id: 'event', body: [head, plain(event.name), ...step.lines], moves: [...step.moves, back] };
    }

    const lines = [head, plain(event.name), plain(event.text)];
    const moves: Move[] = [];
    for (const choice of playableChoices(event)) {
        const blocked = choiceBlockedReason(choice, ctx);
        lines.push(`  ${plain(choice.label)}: ${blocked ? `[no: ${plain(blocked)}]` : plain(choiceDetail(choice))}`);
        if (blocked === null) moves.push({ key: `event:choose:${choice.id}`, label: plain(choice.label), apply: (w) => chooseChoice(w, node, flow, choice) });
    }
    return { id: 'event', body: lines, moves };
}
