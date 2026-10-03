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
import { isBlueprintSlotSold, isMarketNode, rollBlueprintOffer } from '../../engine/run/marketplace';
import { isWorkshopNode } from '../../engine/run/workshop';
import { setRun } from '../../ui/store/runSlice';
import { getBestAction } from '../../engine/ai/TacticalAI';
import { stepOnto } from './arrive';
import { END_TURN_KEY, battleKeyOf } from './battle/keys';
import { freshWorld } from './testKit';
import { currentScreen } from './screen';
import type { Screen, World } from './types';
import { runOf } from './types';
import { applyMove } from './world';

/**
 * Whether a node is "of this kind" for a test that asks for one. A town is both a marketplace and a
 * workshop (ticket 176), so asking for either finds it.
 */
export function nodeIs(node: IRegionNode, kind: NodeKind): boolean {
    if (kind === 'marketplace') return isMarketNode(node.kind);
    if (kind === 'workshop') return isWorkshopNode(node.kind);
    return node.kind === kind;
}

/** The first edge of the shortest path from the current node to any node of `kind`, or null. */
function firstStepToward(world: World, kind: NodeKind): string | null {
    const run = runOf(world);
    const byId = new Map(run.nodes.map((n) => [n.id, n]));
    const queue: Array<{ id: string; first: string | null }> = [{ id: run.currentNodeId, first: null }];
    const seen = new Set([run.currentNodeId]);
    for (let i = 0; i < queue.length; i += 1) {
        const { id, first } = queue[i];
        const node = byId.get(id)!;
        if (first !== null && nodeIs(node, kind)) return first;
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

/**
 * The plain routine a test player follows off any screen that is not the map: take a card on offer,
 * look in a stall and leave, close an editor, ignore the boundary, answer an event with its first
 * choice, begin each gauntlet fight. `tried` stops a multi-step screen repeating one move forever.
 */
export function routineMove(screen: Screen, tried: ReadonlySet<string> = new Set(), world?: World): string {
    const keys = screen.moves.map((m) => m.key);
    const by = (test: (key: string) => boolean): string | undefined => keys.find((k) => test(k) && !tried.has(k));
    switch (screen.id) {
        // A town's buildings in turn (ticket 176c): the square, then the shop, then the workshop, then out.
        case 'town': return keys.includes('town:shop') ? 'town:shop' : keys[0];
        case 'market': return keys.includes('town:workshop') ? 'town:workshop' : keys.includes('leave') ? 'leave' : keys[0];
        case 'workshop': return keys.includes('leave') ? 'leave' : keys[0];
        case 'loadout': return 'loadout:confirm';
        case 'boundary': return 'boundary:ignore';
        case 'gauntlet': return by((k) => k === 'gauntlet:begin') ?? keys[0];
        case 'battle': return world ? aiBattleKey(world, keys) : keys[keys.length - 1];
        case 'reward': return by((k) => k.includes(':take:')) ?? by((k) => k.endsWith(':skip')) ?? keys[0];
        case 'event': return by((k) => k === 'event:confirm') ?? by((k) => k !== 'event:back') ?? keys[0];
        default: return by((k) => k.startsWith('enter:')) ?? keys[0];
    }
}

/** In a battle, the move the game's own AI would make for the player (END TURN when it is not on offer). */
export function aiBattleKey(world: World, offered: ReadonlyArray<string>): string {
    const key = battleKeyOf(getBestAction(world.view.battle!.state));
    return offered.includes(key) ? key : END_TURN_KEY;
}

/** Walk to the nearest node of `kind` by real moves. False when the run ends or no route exists. */
export function walkTo(world: World, kind: NodeKind, maxMoves = 60): boolean {
    for (let made = 0; made < maxMoves; made += 1) {
        const run = runOf(world);
        if (run.phase === 'ended') return false;
        const here = run.nodes.find((n) => n.id === run.currentNodeId)!;
        const screen = currentScreen(world);
        if (nodeIs(here, kind) && here.visited > 0 && screen.id !== 'map' && screen.id !== 'reward') {
            // A town opens on its square: asked for its market or its workshop, go through that door.
            if (here.kind === 'town' && (kind === 'marketplace' || kind === 'workshop')) {
                const door = kind === 'workshop' ? 'workshop' : 'shop';
                if (screen.id === (kind === 'workshop' ? 'workshop' : 'market')) return true;
                if (screen.moves.some((m) => m.key === `town:${door}`)) {
                    applyMove(world, { key: `town:${door}`, why: 'test' });
                    continue;
                }
            } else {
                return true;
            }
        }
        if (screen.id !== 'map') { applyMove(world, { key: routineMove(screen, new Set(), world), why: 'test' }); continue; }
        const step = firstStepToward(world, kind);
        const move = step === null ? undefined : screen.moves.find((m) => m.key === `enter:${step}`);
        if (!move) return false;
        applyMove(world, { key: move.key, why: 'test' });
    }
    return false;
}

/** Step straight onto the first node of a kind (not a logged move), and open its stall. */
export function standAt(world: World, kind: NodeKind, which = 0): IRegionNode {
    const target = runOf(world).nodes.filter((n) => nodeIs(n, kind))[which];
    if (!target) throw new Error(`this seed has no ${kind} node`);
    world.view.closedStall = null;
    placeBeside(world, target.id);
    stepOnto(world, target.id);
    // A town opens on its square; a test that asked for "the market" or "the workshop" stands inside it.
    if (target.kind === 'town') world.view.townPart = kind === 'workshop' ? 'workshop' : kind === 'marketplace' ? 'shop' : null;
    return runOf(world).nodes.find((n) => n.id === target.id)!;
}

/**
 * One-way travel (ticket 176) refuses a step to a node that is not one of the current node's links, and
 * a test that wants to stand somewhere has no road there. So the run is first put on a node that links to
 * the target (and the target is made unvisited), and then the real step is taken. A test helper, not a
 * move: nothing here is logged.
 */
function placeBeside(world: World, targetId: string): void {
    const run = runOf(world);
    const before = run.nodes.find((n) => n.edges.includes(targetId));
    if (!before) throw new Error(`nothing links to ${targetId}`);
    world.store.dispatch(setRun({
        ...run,
        currentNodeId: before.id,
        nodes: run.nodes.map((n) => (n.id === targetId ? { ...n, visited: 0 } : n)),
    }));
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
        const markets = runOf(world).nodes.filter((n) => nodeIs(n, 'marketplace')).length;
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

/** A fresh world on the first seed that has a node of this kind, with the party standing on it. */
export function worldAt(kind: NodeKind, over: Parameters<typeof freshWorld>[0] = {}): World {
    for (let n = 1; n <= 40; n += 1) {
        const world = freshWorld({ ...over, seed: `ps${n}` });
        if (runOf(world).nodes.some((node) => nodeIs(node, kind))) { standAt(world, kind); return world; }
    }
    throw new Error(`no seed in ps1..ps40 has a ${kind} node`);
}
