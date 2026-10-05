/**
 * TICKET 193h — WHAT A RUN HOLDS WHEN IT STOPS: the numbers that explain a night.
 *
 * Two nights of reports showed deaths and decision counts, but not the three things that explained
 * them: whether the run had a party, whether it still held blueprints it never spent, and where it
 * ended. Each is one small function over the replayed world; `endFactsOf` gathers them for `gatherRun`.
 */
import type { IRegionNode } from '../../../engine/runTypes';
import { nodeLabel } from '../gameText';
import type { World } from '../types';
import { runOf } from '../types';

/** How many members are on the team (the bench is not the team). */
export const partySizeAtEnd = (world: World): number => runOf(world).partyIds.length;

/** Blueprints the ranch holds, summed over species: assembly material not spent. */
export const blueprintsHeld = (world: World): number =>
    Object.values(world.store.getState().game.blueprints ?? {}).reduce((n, count) => n + count, 0);

const standingOn = (world: World): IRegionNode | undefined => {
    const run = runOf(world);
    return run.nodes.find((n) => n.id === run.currentNodeId);
};

/** The map's own word for the node the run stopped on (Elite, Ambush, Rival, Gym...), or `none`. */
export const endedAtLabel = (world: World): string => {
    const node = standingOn(world);
    return node ? nodeLabel(node) : 'none';
};

/** Did the run ever walk into the gym? Entering a node raises its `visited` count. */
export const reachedGym = (world: World): boolean => runOf(world).nodes.some((n) => n.kind === 'gym' && n.visited > 0);

export interface EndFacts {
    readonly partySize: number;
    readonly blueprints: number;
    readonly endedAt: string;
    readonly reachedGym: boolean;
}

export const endFactsOf = (world: World): EndFacts => ({
    partySize: partySizeAtEnd(world),
    blueprints: blueprintsHeld(world),
    endedAt: endedAtLabel(world),
    reachedGym: reachedGym(world),
});
