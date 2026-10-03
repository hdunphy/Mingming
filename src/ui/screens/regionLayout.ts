/**
 * Where the region's nodes sit on screen — ticket 10.
 *
 * # WHY THIS IS A PURE MODULE AND NOT PART OF THE COMPONENT
 *
 * Ticket 06 deliberately removed `x`/`y` from `IRegionNode`: storing pixel or lane positions in the
 * save would freeze a UI decision into the persisted format, and the position is *derivable* —
 * `(biomeIndex, layer)` is the position, and everything else is presentation. That makes layout a
 * pure function of the node set, which means it can be tested without a DOM, and it means ticket 34
 * (UI art pass) can re-lay-out the map without touching a save.
 *
 * # NO FOG (ticket 176d)
 *
 * Every node's type is visible from the start of the run. Ticket 07 had fog one layer ahead and
 * ticket 15 a map-reveal that lifted it a biome at a time; with branching routes the choice between
 * them is the game, so the whole road is shown. What a Ping Sweep or a Relay Tower Survey reveals
 * now is the SPECIES in a biome's fights, which is not a layout question: `RunScreen` rolls it
 * (`encounter.surveyedEncounters`) and hands the lines to `RegionMap`.
 */

import type { IRegionNode, NodeKind } from '../../engine/runTypes';
import type { IconName } from '../theme/icons';

// ---------------------------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------------------------

/**
 * Icons match the legend in ticket 07's Python prototype, so a screenshot of the game and an SVG
 * dump from the generator read the same. They live here rather than in the component because two
 * screens use them and because a `.tsx` that exports constants alongside a component breaks fast
 * refresh.
 */
/*
 * TICKET 34: these were emoji. They are now names in `ui/theme/Icon`'s closed set, and the change is
 * not cosmetic on this screen of all screens — an emoji ignores `color`, so the ruled mockup's
 * biome-tinted nodes were undrawable, and `\u{1F573}` (the ambush pit) renders as nothing at all on
 * several Linux font stacks. The map's whole job is that a node's kind is legible from across it.
 */
export const NODE_ICON: Record<NodeKind, IconName> = {
    wild: 'wild',
    rival: 'rival',
    elite: 'elite',
    alpha: 'alpha',
    ambush: 'ambush',
    marketplace: 'marketplace',
    workshop: 'workshop',
    town: 'town',
    event: 'event',
    gym: 'gym',
};

export const NODE_LABEL: Record<NodeKind, string> = {
    wild: 'Wild',
    rival: 'Rival',
    elite: 'Elite',
    alpha: 'Alpha',
    ambush: 'Ambush',
    marketplace: 'Marketplace',
    workshop: 'Den',
    town: 'Town',
    event: 'Event',
    gym: 'Gym',
};

/**
 * Which kinds are a fight. Drives the element badge — a fight is where the biome's element bites.
 *
 * Ticket 11 moved the list itself into `engine/run/encounter.ts`, where the node trigger and the
 * encounter sizing both read it, and left this re-export so the map keeps importing all its
 * presentation constants from one place. A badge drawn from a second copy of the list would go
 * stale the day a ninth kind is added — and stale *silently*, since the map would simply stop
 * labelling a node that fights.
 */
export { FIGHT_KINDS } from '../../engine/run/encounter';

/**
 * ── THE START NODE — Henry, 2026-09-25, off the Rootfall playtest ──────────────────────────────
 *
 * *"I think you skip the first fight? I start on node one, but never encounter a fight."* The node
 * the run opens on is a `wild` underneath (`NODE_KINDS` has no entry kind, and `regionGraph` marks it
 * `visited: 1` so it does not fire before the run has begun), so the map drew it with the wild's
 * blade: a fight that never happened. It is drawn as a flag now and labelled Start.
 *
 * Its KIND is untouched. Walking back into it is a wild fight like any other re-entry — ticket 07's
 * "entering a node triggers it again, always", which Henry re-ruled the same day — and the label
 * says so, rather than a flag quietly turning into an ambush of your own making.
 */
export function isRunStart(node: IRegionNode): boolean {
    return node.biomeIndex === 0 && node.layer === 0;
}

/** The icon a node is drawn with: its kind's, except the run's start. */
export function nodeIconFor(node: IRegionNode): IconName {
    return isRunStart(node) ? 'start' : NODE_ICON[node.kind];
}

/** The word a node is called by: its kind's, except the run's start. */
export function nodeLabelFor(node: IRegionNode): string {
    return isRunStart(node) ? 'Start' : NODE_LABEL[node.kind];
}

// ---------------------------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------------------------

/** 3 biomes x 5 layers laid left to right. Biome b, layer l sits in column `b * 5 + l`. */
export const COLUMNS_PER_BIOME = 5;

export interface LaidOutNode {
    readonly node: IRegionNode;
    /** 0-14, left to right across the whole run. */
    readonly column: number;
    /** 0-based position within the column, top to bottom. */
    readonly row: number;
    /** Total nodes in this column, so a renderer can centre it. */
    readonly rowsInColumn: number;
    /** One edge away from the player, so a click travels there. */
    readonly reachable: boolean;
    readonly isCurrent: boolean;
    /**
     * TICKET 34 part two — **the wander**, in unit terms: two values in `[-1, 1]` the renderer
     * scales into pixels.
     *
     * The ruled reference (`research/64-map-proto/map_N_route.svg`, *"OPTION N — WINDING ROUTE
     * (overworld feel)"*) does not put its nodes on a lattice. A perfect grid reads as a flowchart;
     * a route reads as somewhere you are walking, and the difference is entirely in whether the
     * nodes sit exactly where you would predict.
     *
     * **Derived from the node ID, not rolled.** The offset has to be stable across a re-render, a
     * reload and a resumed save, and it must not become a third thing the run seed decides — ticket
     * 06 deliberately kept `x`/`y` out of `IRegionNode` so that layout stays derivable and a save
     * never freezes a UI decision. A hash of the id is derivable, deterministic, and costs the save
     * nothing.
     *
     * Bounded to a fraction of the lane spacing by the renderer, so the wander is a lean, not a
     * scramble: `(biomeIndex, layer)` is still the position and the graph still reads left to right.
     */
    readonly wanderX: number;
    readonly wanderY: number;
}

export interface RegionLayout {
    readonly nodes: ReadonlyArray<LaidOutNode>;
    readonly columnCount: number;
    readonly maxRows: number;
    readonly byId: ReadonlyMap<string, LaidOutNode>;
}

export function columnOf(node: IRegionNode): number {
    return node.biomeIndex * COLUMNS_PER_BIOME + node.layer;
}

/**
 * A stable pair of offsets in `[-1, 1]` for a node id — ticket 34 part two's wander.
 *
 * FNV-1a, because it needs to be *stable forever* and cheap, not statistically excellent: the same
 * id must land in the same place in every build, and two adjacent ids (`b1l2n0`, `b1l2n1`) must land
 * in visibly different places. FNV's avalanche is more than enough for both and it is eight lines
 * with no dependency. `Math.random` is forbidden in this module for the ordinary reason and one
 * extra: a re-render would move the map under the cursor.
 *
 * The two values come from different halves of the hash so that x and y are independent — deriving
 * y from the same number as x would put every node on a diagonal.
 */
export function wanderFor(id: string): { x: number; y: number } {
    let hash = 0x811c9dc5;
    for (let i = 0; i < id.length; i += 1) {
        hash ^= id.charCodeAt(i);
        // FNV prime, via shifts so this stays in 32-bit integer arithmetic rather than drifting
        // into float territory on a long id.
        hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0;
    }
    /*
     * AVALANCHE, and it is load-bearing rather than ceremony.
     *
     * FNV-1a alone leaves adjacent ids adjacent in the low bits — `b1l2n0` and `b1l2n1` differ by
     * one byte and came out **0.015 apart** on a scale of 2, which is not a wander, it is two nodes
     * drawn on top of each other. And those two ids are precisely the case that matters: they are
     * neighbours in the same column, so they are the pair the wander exists to separate.
     * `regionLayout.test.ts` pins it.
     *
     * This is the `lowbias32` finalizer: two xorshift-multiply rounds, which is what makes a
     * one-byte change rewrite the whole word rather than the end of it.
     */
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x21f0aaad) >>> 0;
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x735a2d97) >>> 0;
    hash ^= hash >>> 15;

    // Two independent 16-bit halves, each mapped to [-1, 1].
    const low = hash & 0xffff;
    const high = (hash >>> 16) & 0xffff;
    return { x: (low / 0xffff) * 2 - 1, y: (high / 0xffff) * 2 - 1 };
}

export function layoutRegion(
    nodes: ReadonlyArray<IRegionNode>,
    currentNodeId: string,
): RegionLayout {
    const current = nodes.find((n) => n.id === currentNodeId);
    const reachableIds = new Set(current?.edges ?? []);

    // Group by column, then order within it. Detours sort last so a side trip hangs off the bottom of
    // its layer rather than pushing the main route around — the route should read as a spine.
    const columns = new Map<number, IRegionNode[]>();
    for (const node of nodes) {
        const column = columnOf(node);
        const bucket = columns.get(column);
        if (bucket) bucket.push(node);
        else columns.set(column, [node]);
    }

    const laid: LaidOutNode[] = [];
    let maxRows = 0;
    for (const [column, bucket] of columns) {
        // Stable by id within the detour/non-detour split, so the same graph always draws the same
        // way. A map that reshuffles between renders is unreadable.
        const ordered = [...bucket].sort((a, b) => {
            if (a.detour !== b.detour) return a.detour ? 1 : -1;
            return a.id < b.id ? -1 : 1;
        });
        maxRows = Math.max(maxRows, ordered.length);
        ordered.forEach((node, row) => {
            const wander = wanderFor(node.id);
            laid.push({
                node,
                column,
                row,
                rowsInColumn: ordered.length,
                reachable: reachableIds.has(node.id),
                isCurrent: node.id === currentNodeId,
                wanderX: wander.x,
                wanderY: wander.y,
            });
        });
    }

    laid.sort((a, b) => (a.column - b.column) || (a.row - b.row));

    return {
        nodes: laid,
        columnCount: COLUMNS_PER_BIOME * 3,
        maxRows,
        byId: new Map(laid.map((n) => [n.node.id, n])),
    };
}

/**
 * TICKET 186c: where one of several same-worded nodes of a column sits, top to bottom (`place` is
 * 0-based). Used by the map's Travel list and hover, and by the text playtester's map screen, so the
 * two say it the same way.
 */
export function positionWord(count: number, place: number): string {
    if (count === 2) return ['upper', 'lower'][place];
    if (count === 3) return ['upper', 'middle', 'lower'][place];
    return `${place + 1} from the top`;
}
