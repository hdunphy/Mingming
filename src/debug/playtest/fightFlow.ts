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
import { endRun } from '../../ui/store/runSlice';
import { rollEncounter } from '../../engine/run/encounter';
import { fightNodeFor } from '../../engine/run/eventFight';
import { tempDriverIds } from '../../engine/run/tempDrivers';
import type { IRegionNode } from '../../engine/runTypes';
import type { IBattleState } from '../../engine/types';
import { setupFor, withCarriedHp } from '../balance/runWalker';
import { autoPlay, openBattle, type AutoResult } from './battleSim';
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

/** Play an encounter out with the game's AI on both sides, from the party as it stands (and as the gauntlet carried it). */
export function fightEncounter(
    world: World, encounter: ReturnType<typeof rollEncounter>, carriedHp?: Readonly<Record<string, number>>,
): AutoResult | null {
    const run = runOf(world);
    const party = partyOf(world);
    const built = setupFor(
        encounter.seed, party, run.deck.map((c) => c.dataId), encounter.enemyParty, encounter.enemyDeckIds,
        encounter.enemyDrivers ?? [], [...(run.drivers ?? []), ...tempDriverIds(run)], run.patches,
    );
    const setup = withCarriedHp(built, party, carriedHp);
    try {
        return autoPlay(openBattle({ setup, seed: encounter.seed, enemyAiTier: encounter.enemyAiTier, aiBeam: encounter.aiBeam }));
    } catch (error) {
        // The game's own code threw mid-fight. That is a game bug worth a report line, not a reason
        // to lose the session: the run is cut short (as abandoned) and the message is kept.
        world.view.engineError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        world.store.dispatch(endRun('abandoned'));
        return null;
    }
}

/** Roll the node's encounter, play it out with the game's AI on both sides, and settle the result. */
export function playFightNode(world: World, node: IRegionNode): void {
    const run = runOf(world);
    const fought = fightNodeFor(run, node);
    const encounter = rollEncounter({ run, node: fought, party: partyOf(world) });
    const result = fightEncounter(world, encounter);
    if (!result) return;
    const won = result.winner === 'PLAYER';
    world.view.fight = reportFor(fought, result.state, won, result.turns, result.truncated, result.hits);

    if (won) {
        startRewards(world, node, result.state);
        return;
    }
    world.store.dispatch(endRun('defeat'));
}
