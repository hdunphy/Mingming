/**
 * TICKET 180a/180d — WHAT HAPPENS WHEN A FIGHT IS OVER, however it was played.
 *
 * A fight the game's AI played in one go (`run` mode) and a battle the agent played move by move
 * (`turn`, `card`) end the same way: a report of the fight for the next screen, then either the
 * reward claim (a win) or the end of the run (a loss). In the gauntlet a win carries every member's
 * HP into the claim, which advances the gauntlet. One function, so the two ways cannot drift.
 */
import { endRun } from '../../ui/store/runSlice';
import type { IRegionNode } from '../../engine/runTypes';
import type { IBattleState } from '../../engine/types';
import type { BattleOutcome } from '../../engine/battleOutcome';
import type { HitTotal } from './battleSim';
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

export interface FightEnd {
    readonly state: IBattleState;
    readonly winner: BattleOutcome;
    readonly turns: number;
    readonly truncated: boolean;
    readonly hits: ReadonlyArray<HitTotal>;
}

/** The party's node (where the claim happens) and the node the fight counts as (what it pays). */
export interface FightPlace {
    readonly context: 'node' | 'gauntlet';
    readonly nodeId: string;
    readonly fought: IRegionNode;
}

/** Report the fight, then open the claim for a win or end the run for anything else. */
export function settleFight(world: World, place: FightPlace, end: FightEnd): void {
    const won = end.winner === 'PLAYER';
    world.view.fight = reportFor(place.fought, end.state, won, end.turns, end.truncated, end.hits);
    if (!won) {
        world.store.dispatch(endRun('defeat'));
        return;
    }
    const node = runOf(world).nodes.find((n) => n.id === place.nodeId)!;
    if (place.context === 'gauntlet') {
        const carried = end.state.playerParty.map((p) => ({ memberId: p.id, hp: p.currentHp, maxHp: p.maxHp }));
        startRewards(world, node, end.state, carried);
        return;
    }
    startRewards(world, node, end.state);
}

/**
 * The game's own code threw during a fight. That is a game bug worth a report line, not a reason to
 * lose the session: the run is cut short (as abandoned) and the message is kept.
 */
export function failFight(world: World, error: unknown): void {
    world.view.engineError = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    world.view.battle = null;
    world.store.dispatch(endRun('abandoned'));
}
