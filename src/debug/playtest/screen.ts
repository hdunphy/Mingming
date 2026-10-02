/**
 * TICKET 180a — WHICH SCREEN THE PLAYER IS ON.
 *
 * The same order `RunScreen` decides in: a finished run first, then a pending reward claim, then the
 * place the party is standing in (the stalls here; 180c adds events, the gauntlet and the boundary), and
 * the map otherwise. It reads the run and the view and nothing else, so a replay always lands on the
 * screen the live session was on.
 */
import { isMarketNode } from '../../engine/run/marketplace';
import { isWorkshopNode } from '../../engine/run/workshop';
import { endScreen } from './screens/endScreen';
import { mapScreen } from './screens/mapScreen';
import { rewardScreen } from './screens/rewardScreen';
import { marketScreen } from './screens/marketScreen';
import { leftKey, unbuiltScreen } from './screens/unbuiltScreen';
import { workshopScreen } from './screens/workshopScreen';
import { stallOpen } from './stalls';
import type { Screen, World } from './types';
import { runOf } from './types';

export function currentScreen(world: World): Screen {
    const run = runOf(world);
    if (run.phase === 'ended') return endScreen(world);
    if (world.view.reward) return rewardScreen(world);

    const node = run.nodes.find((n) => n.id === run.currentNodeId);
    if (node && stallOpen(world, node)) {
        if (isMarketNode(node.kind)) return marketScreen(world);
        if (isWorkshopNode(node.kind)) return workshopScreen(world);
    }
    if (node && world.view.leftEvent !== leftKey(node.id, node.visited) && (node.kind === 'event' || node.kind === 'gym')) {
        return unbuiltScreen(world);
    }
    return mapScreen(world);
}
