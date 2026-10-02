/**
 * TICKET 182c — THE INTRO MAP: seven nodes, one biome, one fork.
 *
 *   layer 0      layer 1               layer 2            layer 3       layer 4
 *   Start  ---  Wild (1)               Market ----+
 *                  |                     |        +----  Wild (3)  ----  The leader
 *               Stray Mingming  ------  Wild (2) -+
 *
 *   Start leads only to Wild (1), and Wild (1) only to the stray Mingming (a sideways link, like the
 *   ones ordinary maps draw between siblings). The stray leads to the fork: Market and Wild (2) are
 *   joined, so the player can take one of them or both. Both lead to Wild (3), which is not optional:
 *   it is the leader's only way in.
 *
 * Wild (3) was added at Henry's request (2026-10-02) to lengthen the intro. The graph shape allows
 * layers 0-4 (`RegionNodeSchema`), so the stray shares Wild (1)'s layer rather than adding a sixth.
 * Node ids follow `generateRegionGraph`'s own pattern (`b<biome>l<layer>n<index>`), and `nodeSeed`
 * hashes the id, so every roll off these nodes behaves like any other node's.
 *
 * Hand-built, so there is no seed in here: every intro run walks the same seven nodes. What differs
 * between runs is what the nodes ROLL (the enemies, the card pick, the shelf).
 */

import type { IRegionNode } from '../../runTypes';

export const INTRO_START_ID = 'b0l0n0';
export const INTRO_FIRST_WILD_ID = 'b0l1n0';
export const INTRO_RECRUIT_ID = 'b0l1n1';
export const INTRO_MARKET_ID = 'b0l2n0';
export const INTRO_SECOND_WILD_ID = 'b0l2n1';
export const INTRO_LAST_WILD_ID = 'b0l3n0';
export const INTRO_LEADER_ID = 'b0l4n0';

type Draft = Omit<IRegionNode, 'edges'> & { edges: string[] };

function node(id: string, kind: IRegionNode['kind'], layer: number, visited = 0): Draft {
    return { id, kind, biomeIndex: 0, layer, pocket: false, edges: [], visited };
}

function link(a: Draft, b: Draft): void {
    if (!a.edges.includes(b.id)) a.edges.push(b.id);
    if (!b.edges.includes(a.id)) b.edges.push(a.id);
}

/** The seven nodes, edges walkable both ways like every other map's. The run opens standing on Start. */
export function buildIntroNodes(): ReadonlyArray<IRegionNode> {
    const start = node(INTRO_START_ID, 'wild', 0, 1);
    const firstWild = node(INTRO_FIRST_WILD_ID, 'wild', 1);
    const stray = node(INTRO_RECRUIT_ID, 'event', 1);
    const market = node(INTRO_MARKET_ID, 'marketplace', 2);
    const secondWild = node(INTRO_SECOND_WILD_ID, 'wild', 2);
    const lastWild = node(INTRO_LAST_WILD_ID, 'wild', 3);
    const leader = node(INTRO_LEADER_ID, 'gym', 4);

    link(start, firstWild);
    link(firstWild, stray);
    link(stray, market);
    link(stray, secondWild);
    link(market, secondWild);
    link(market, lastWild);
    link(secondWild, lastWild);
    link(lastWild, leader);

    return [start, firstWild, stray, market, secondWild, lastWild, leader];
}
