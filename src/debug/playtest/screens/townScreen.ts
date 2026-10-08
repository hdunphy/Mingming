/**
 * TICKET 176c — THE TOWN SQUARE: where a town opens, before any building is entered.
 *
 * A town is one node that is both a market and a workshop. The game opens it on a square with four
 * large buttons (Shop, Upgrades, Workshop, Loadout); the text tool has the same doors, minus the
 * Upgrades tab, which lives in the shop here (the upgrade bench is one pool per town visit, shown
 * with the shelf). The shop and the workshop screens each carry the way to the other and the way
 * back to the square, so a player can go from one to the other like the game's side rail does.
 */
import { upgradeAllowanceFor, upgradeBenchKeyFor } from '../../../engine/run/marketplace';
import { tracesHeld } from '../../../engine/run/workshop';
import { denTagLine } from '../../../ui/labels/denTagLine';
import { hereNode, leaveStall } from '../stalls';
import type { Move, Screen, World } from '../types';
import { runOf } from '../types';
import { nodeLabel } from '../gameText';
import { openLoadout } from './loadoutScreen';

/** The moves that go between a town's buildings. Empty at a plain market or workshop. */
export function townDoors(world: World, here: 'square' | 'shop' | 'workshop'): Move[] {
    const node = hereNode(world);
    if (node.kind !== 'town') return [];
    const doors: Move[] = [];
    if (here !== 'shop') {
        doors.push({ key: 'town:shop', label: 'Go to the shop', apply: (w) => { w.view.townPart = 'shop'; } });
    }
    if (here !== 'workshop') {
        doors.push({ key: 'town:workshop', label: 'Go to the den', apply: (w) => { w.view.townPart = 'workshop'; } });
    }
    if (here !== 'square') {
        doors.push({ key: 'town:square', label: 'Back to the town square', apply: (w) => { w.view.townPart = null; } });
    }
    return doors;
}

export function townScreen(world: World): Screen {
    const node = hereNode(world);
    const run = runOf(world);
    const used = (run.upgradesTaken ?? []).filter((key) => key === upgradeBenchKeyFor(node)).length;
    const left = Math.max(0, upgradeAllowanceFor(node) - used);
    const leave: Move = { key: 'leave', label: 'Leave the town', apply: leaveStall };
    // 202a: the Den's tag line comes first, so an agent reads it before the line about the shop.
    const denLine = denTagLine(tracesHeld(world.store.getState().game, run));
    return {
        id: 'town',
        body: [
            ...(denLine ? [denLine] : []),
            `${nodeLabel(node)}. Amber: ${run.scrap}. A town has a shop (cards, draughts, a trace, runes, upgrades) and a den (summon, retrain, the team).`,
            `Upgrades left on this visit: ${left}.`,
        ],
        moves: [...townDoors(world, 'square'), openLoadout, leave],
    };
}
