/**
 * TICKET 168g — Ambush Bait's optional fight.
 *
 * The event is drawn on an `event` node, so the node's own kind says nothing about the fight. While
 * `run.eventFight` is set, the fight is a WILD on that node: it rolls the wild's enemies, rung and
 * beam from the node's seed, is labelled a wild, and its win pays double scrap. Everything that
 * classes a fight by its node reads it through `fightKindOf` / `fightNodeFor`, so the roll, the
 * reward, the top bar and the run log cannot disagree.
 *
 * Engine module: no React, no Redux.
 */

import type { IRunState, NodeKind } from '../runTypes';

/** What a win pays, against a wild's. `events.json` prints it on the button ("double scrap"). */
export const EVENT_FIGHT_SCRAP_MULTIPLIER = 2;

type FlagOnly = Pick<IRunState, 'eventFight'>;

/** Whether the fight on this node is Ambush Bait's. A stale flag on any other kind of node counts for nothing. */
export function isEventFight(run: FlagOnly, node: { readonly kind: NodeKind }): boolean {
    return run.eventFight === true && node.kind === 'event';
}

/** The node as the fight sees it: an event node in an event fight is a wild; any other node is itself. */
export function fightNodeFor<N extends { readonly kind: NodeKind }>(run: FlagOnly, node: N): N {
    return isEventFight(run, node) ? { ...node, kind: 'wild' } : node;
}

/** The kind a fight on this node is classed as. */
export function fightKindOf(run: FlagOnly, node: { readonly kind: NodeKind }): NodeKind {
    return isEventFight(run, node) ? 'wild' : node.kind;
}

/** How many times a win's scrap is paid on this node: 2 for an event fight, 1 for every other fight. */
export function eventFightScrapMultiplier(run: FlagOnly, node: { readonly kind: NodeKind }): number {
    return isEventFight(run, node) ? EVENT_FIGHT_SCRAP_MULTIPLIER : 1;
}
