/**
 * TICKET 180c — ONE GAUNTLET FIGHT.
 *
 * `GauntletNode`'s "Begin fight N of M": roll the gauntlet's own encounter (`rollGauntletFight`),
 * build the party with the HP the gauntlet carried (`persistedHp`, a downed member at 0), and start
 * it: the game's AI plays it in `run` mode, the agent in `turn` and `card` mode (180d). A win rolls
 * its pay and carries each member's HP to the claim, which advances the gauntlet (`rewards.ts`); a
 * loss ends the run.
 */
import { rollGauntletFight } from '../../engine/run/gauntlet';
import { startFight } from './fightFlow';
import type { World } from './types';
import { runOf } from './types';

export function playGauntletFight(world: World): void {
    const run = runOf(world);
    const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
    const gauntlet = run.gauntlet!;
    const encounter = rollGauntletFight({ run, node, fightIndex: gauntlet.fightIndex });
    startFight(world, { context: 'gauntlet', nodeId: node.id, fought: node }, encounter, gauntlet.persistedHp);
}
