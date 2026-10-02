/**
 * TICKET 180b — test helpers for getting a world to a place. Not a test file.
 *
 * `walkTo` plays real moves (so the log stays a valid session): the shortest route over the nodes'
 * edges to the nearest node of a kind, answering any reward screen on the way by skipping it.
 * `standAt` is the shortcut for tests that only care what a stall does: it steps onto a node of the
 * kind directly, which is a dispatch the map would make but is not a logged move.
 */
import { addBlueprint } from '../../ui/store/gameSlice';
import { addRunScrap, spendRunScrap } from '../../ui/store/runSlice';
import type { IRegionNode, NodeKind } from '../../engine/runTypes';
import { isBlueprintSlotSold, rollBlueprintOffer } from '../../engine/run/marketplace';
import { stepOnto } from './fightFlow';
import { freshWorld } from './testKit';
import { currentScreen } from './screen';
import type { World } from './types';
import { runOf } from './types';
import { applyMove } from './world';

/** The first edge of the shortest path from the current node to any node of `kind`, or null. */
function firstStepToward(world: World, kind: NodeKind): string | null {
    const run = runOf(world);
    const byId = new Map(run.nodes.map((n) => [n.id, n]));
    const queue: Array<{ id: string; first: string | null }> = [{ id: run.currentNodeId, first: null }];
    const seen = new Set([run.currentNodeId]);
    for (let i = 0; i < queue.length; i += 1) {
        const { id, first } = queue[i];
        const node = byId.get(id)!;
        if (first !== null && node.kind === kind) return first;
        for (const next of node.edges) {
            if (seen.has(next)) continue;
            seen.add(next);
            queue.push({ id: next, first: first ?? next });
        }
    }
    return null;
}

/** Skip every open reward decision. */
export function settleRewards(world: World): void {
    for (let guard = 0; guard < 12 && world.view.reward; guard += 1) {
        const skip = currentScreen(world).moves.find((m) => m.key.endsWith(':skip'));
        if (!skip) return;
        applyMove(world, { key: skip.key, why: 'test' });
    }
}

/** Walk to the nearest node of `kind` by real moves. False when the run ends or no route exists. */
export function walkTo(world: World, kind: NodeKind, maxMoves = 40): boolean {
    for (let made = 0; made < maxMoves; made += 1) {
        settleRewards(world);
        const run = runOf(world);
        if (run.phase === 'ended') return false;
        const here = run.nodes.find((n) => n.id === run.currentNodeId)!;
        if (here.kind === kind && here.visited > 0) return true;
        const step = firstStepToward(world, kind);
        if (step === null) return false;
        const move = currentScreen(world).moves.find((m) => m.key === `enter:${step}`);
        if (!move) return false;
        applyMove(world, { key: move.key, why: 'test' });
    }
    return false;
}

/** Step straight onto the first node of a kind (not a logged move), and open its stall. */
export function standAt(world: World, kind: NodeKind, which = 0): IRegionNode {
    const target = runOf(world).nodes.filter((n) => n.kind === kind)[which];
    if (!target) throw new Error(`this seed has no ${kind} node`);
    world.view.closedStall = null;
    stepOnto(world, target.id);
    return runOf(world).nodes.find((n) => n.id === target.id)!;
}

export const giveScrap = (world: World, amount: number): void => { world.store.dispatch(addRunScrap(amount)); };
export const giveBlueprint = (world: World, speciesId: string): void => { world.store.dispatch(addBlueprint(speciesId)); };

/** Set the purse to exactly this much, through the game's own reducers. */
export const setScrap = (world: World, amount: number): void => {
    world.store.dispatch(spendRunScrap(runOf(world).scrap));
    giveScrap(world, amount);
};

/** A world standing at a market whose blueprint offer is for sale, on the first seed that has one. */
export function marketWithBlueprint(): { world: World; speciesId: string; price: number } {
    for (const seed of ['ps1', 'ps2', 'ps3', 'ps4', 'ps5', 'ps6', 'ps7', 'ps8']) {
        const world = freshWorld({ seed });
        const markets = runOf(world).nodes.filter((n) => n.kind === 'marketplace').length;
        for (let index = 0; index < markets; index += 1) {
            standAt(world, 'marketplace', index);
            const run = runOf(world);
            const node = run.nodes.find((n) => n.id === run.currentNodeId)!;
            const offer = rollBlueprintOffer(run, node);
            if (offer && !isBlueprintSlotSold(run, node)) return { world, speciesId: offer.speciesId, price: offer.price };
        }
    }
    throw new Error('no seed offers a blueprint at a market');
}
