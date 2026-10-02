/**
 * TICKET 180c — ONE GAUNTLET FIGHT, in `run` mode.
 *
 * `GauntletNode`'s "Begin fight N of M": roll the gauntlet's own encounter (`rollGauntletFight`),
 * build the party with the HP the gauntlet carried (`persistedHp`, a downed member at 0), and play
 * it with the game's AI on both sides. A win rolls its pay and carries each member's HP to the
 * claim, which advances the gauntlet (`rewards.ts`); a loss ends the run.
 */
import { rollGauntletFight } from '../../engine/run/gauntlet';
import { endRun } from '../../ui/store/runSlice';
import { fightEncounter, reportFor } from './fightFlow';
import { startRewards } from './rewards';
import type { World } from './types';
import { runOf } from './types';

export function playGauntletFight(world: World): void {
    const run = runOf(world);
    const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
    const gauntlet = run.gauntlet!;
    const encounter = rollGauntletFight({ run, node, fightIndex: gauntlet.fightIndex });
    const result = fightEncounter(world, encounter, gauntlet.persistedHp);
    if (!result) return;
    const won = result.winner === 'PLAYER';
    world.view.fight = reportFor(node, result.state, won, result.turns, result.truncated, result.hits);

    if (!won) { world.store.dispatch(endRun('defeat')); return; }
    const carried = result.state.playerParty.map((p) => ({ memberId: p.id, hp: p.currentHp, maxHp: p.maxHp }));
    startRewards(world, node, result.state, carried);
}
