/**
 * TICKET 180a — STEPPING ONTO A FIGHT NODE.
 *
 * *"Entering a fight node plays the fight with the game's own AI on both sides, exactly as the
 * walker's `fight()` does."* So this builds the setup with the walker's `setupFor`, opens the battle
 * with `openBattle` (which is `runOne`'s own construction) and, in `run` mode, plays it with
 * `autoPlay`. What it reads about the encounter, the beam and the AI tier comes off `rollEncounter`,
 * never from a constant here.
 *
 * In `turn` and `card` mode (180d) the same opening state is handed to the agent instead: the fight
 * becomes `view.battle` and the agent plays the player's side (`battle/play.ts`).
 *
 * Two places differ from the walker, both because the arena does it that way and the ticket says to
 * call what the screens call: the reward roll is seeded with the battle's seed and is told
 * `firstRun`, and the player side also runs the temporary Drivers an event may have granted.
 */
import { rollEncounter } from '../../engine/run/encounter';
import { fightNodeFor } from '../../engine/run/eventFight';
import { tempDriverIds } from '../../engine/run/tempDrivers';
import type { IRegionNode } from '../../engine/runTypes';
import type { IBattleState } from '../../engine/types';
import { setupFor, withCarriedHp } from '../balance/runWalker';
import { autoPlay, openBattle, type AutoResult } from './battleSim';
import { stabilizeIds } from './battle/stableIds';
import { failFight, settleFight, type FightPlace } from './fightSettle';
import { partyOf } from './party';
import type { World } from './types';
import { runOf } from './types';

export { reportFor } from './fightSettle';

type Encounter = ReturnType<typeof rollEncounter>;

/** The opening state of an encounter, from the party as it stands (and as the gauntlet carried it). */
export function buildFight(world: World, encounter: Encounter, carriedHp?: Readonly<Record<string, number>>): IBattleState {
    const run = runOf(world);
    const party = partyOf(world);
    const built = setupFor(
        encounter.seed, party, run.deck.map((c) => c.dataId), encounter.enemyParty, encounter.enemyDeckIds,
        encounter.enemyDrivers ?? [], [...(run.drivers ?? []), ...tempDriverIds(run)], run.patches,
    );
    const setup = withCarriedHp(built, party, carriedHp);
    return openBattle({ setup, seed: encounter.seed, enemyAiTier: encounter.enemyAiTier, aiBeam: encounter.aiBeam });
}

/**
 * Open an encounter: in `run` mode play it out with the game's AI on both sides and settle it; in
 * the other modes hand the opening state to the agent. An engine throw ends the run as abandoned.
 */
export function startFight(
    world: World, place: FightPlace, encounter: Encounter, carriedHp?: Readonly<Record<string, number>>,
): void {
    try {
        const opening = buildFight(world, encounter, carriedHp);
        if (world.header.mode !== 'run') {
            const named = stabilizeIds(opening, 0);
            world.view.battle = { ...place, state: named.state, minted: named.minted, hits: [] };
            return;
        }
        const result: AutoResult = autoPlay(opening);
        settleFight(world, place, result);
    } catch (error) {
        failFight(world, error);
    }
}

/** Roll the node's encounter and start it. */
export function playFightNode(world: World, node: IRegionNode): void {
    const run = runOf(world);
    const fought = fightNodeFor(run, node);
    const encounter = rollEncounter({ run, node: fought, party: partyOf(world) });
    startFight(world, { context: 'node', nodeId: node.id, fought }, encounter);
}
