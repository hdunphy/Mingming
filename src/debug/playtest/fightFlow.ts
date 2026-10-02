/**
 * TICKET 180a — STEPPING ONTO A FIGHT NODE, IN `run` MODE.
 *
 * *"Entering a fight node plays the fight with the game's own AI on both sides, exactly as the
 * walker's `fight()` does."* So this builds the setup with the walker's `setupFor`, opens the battle
 * with `openBattle` (which is `runOne`'s own construction) and plays it with `autoPlay`. What it
 * reads about the encounter, the beam and the AI tier comes off `rollEncounter`, never from a
 * constant here.
 *
 * Two places differ from the walker, both because the arena does it that way and the ticket says to
 * call what the screens call: the reward roll is seeded with the battle's seed and is told
 * `firstRun`, and the player side also runs the temporary Drivers an event may have granted.
 */
import { enterNode, endRun } from '../../ui/store/runSlice';
import { rollEncounter, isFightNode } from '../../engine/run/encounter';
import { fightNodeFor } from '../../engine/run/eventFight';
import { tempDriverIds } from '../../engine/run/tempDrivers';
import type { IRegionNode } from '../../engine/runTypes';
import type { IBattleState } from '../../engine/types';
import { setupFor } from '../balance/runWalker';
import { autoPlay, openBattle } from './battleSim';
import { partyOf } from './party';
import { speciesName } from './gameText';
import { startRewards } from './rewards';
import type { FightReport, World } from './types';
import { runOf } from './types';

const TOP_HITS = 5;

/** What the player is told when a fight ends: who won, how long it took, what is left. */
export function reportFor(node: IRegionNode, battle: IBattleState, won: boolean, turns: number, truncated: boolean, hits: FightReport['hits']): FightReport {
    return {
        nodeId: node.id,
        kind: node.kind,
        won,
        turns,
        truncated,
        party: battle.playerParty.map((e) => ({ name: e.name, hp: Math.max(0, e.currentHp), maxHp: e.maxHp })),
        foes: battle.enemyParty.map((e) => ({ name: e.name || speciesName(e.definitionId) })),
        hits: hits.slice(0, TOP_HITS),
    };
}

/** Walk onto a node. A fight node is fought on the spot; anything else just becomes the current node. */
export function stepOnto(world: World, nodeId: string): void {
    world.store.dispatch(enterNode(nodeId));
    const node = runOf(world).nodes.find((n) => n.id === nodeId);
    if (node && isFightNode(node.kind) && node.kind !== 'gym') playFightNode(world, node);
}

/** Roll the node's encounter, play it out with the game's AI on both sides, and settle the result. */
export function playFightNode(world: World, node: IRegionNode): void {
    const run = runOf(world);
    const party = partyOf(world);
    const fought = fightNodeFor(run, node);
    const encounter = rollEncounter({ run, node: fought, party });
    const setup = setupFor(
        encounter.seed, party, run.deck.map((c) => c.dataId), encounter.enemyParty, encounter.enemyDeckIds,
        encounter.enemyDrivers ?? [], [...(run.drivers ?? []), ...tempDriverIds(run)], run.patches,
    );
    const result = autoPlay(openBattle({
        setup, seed: encounter.seed, enemyAiTier: encounter.enemyAiTier, aiBeam: encounter.aiBeam,
    }));
    const won = result.winner === 'PLAYER';
    world.view.fight = reportFor(fought, result.state, won, result.turns, result.truncated, result.hits);

    if (won) {
        startRewards(world, node, result.state);
        return;
    }
    world.store.dispatch(endRun('defeat'));
}
