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
 * # THE FOG RULE
 *
 * Ticket 07 rules visibility at **one layer ahead**, types visible and contents hidden. Two
 * additions this module makes explicit, both of which follow from the rest of the ruling rather
 * than inventing anything:
 *
 * - **Anywhere you have already been stays visible.** `visited > 0` reveals a node regardless of
 *   distance, because a map that forgets where you walked is not fog, it is amnesia.
 * - **Fog hides the KIND, never the node.** The graph's shape is public — you can see that a fork
 *   exists three layers ahead, you just cannot see what is on it. That is what "types visible,
 *   contents hidden" becomes one step further out, and it is what makes routing a decision.
 */

import type { IRegionNode, NodeKind } from '../../engine/runTypes';

// ---------------------------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------------------------

/**
 * Icons match the legend in ticket 07's Python prototype, so a screenshot of the game and an SVG
 * dump from the generator read the same. They live here rather than in the component because two
 * screens use them and because a `.tsx` that exports constants alongside a component breaks fast
 * refresh.
 */
export const NODE_ICON: Record<NodeKind, string> = {
    wild: '⚔',
    elite: '☠',
    alpha: '👑',
    ambush: '🕳',
    marketplace: '🛒',
    workshop: '🔧',
    event: '❓',
    gym: '🏛',
};

export const NODE_LABEL: Record<NodeKind, string> = {
    wild: 'Wild',
    elite: 'Elite',
    alpha: 'Alpha',
    ambush: 'Ambush',
    marketplace: 'Marketplace',
    workshop: 'Workshop',
    event: 'Event',
    gym: 'Gym',
};

/** Which kinds are a fight. Drives the element badge — a fight is where the biome's element bites. */
export const FIGHT_KINDS: ReadonlyArray<NodeKind> = ['wild', 'elite', 'alpha', 'ambush', 'gym'];

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
    /** Kind is visible. False means fog: the node is drawn, its kind is not. */
    readonly revealed: boolean;
    /** One edge away from the player, so a click travels there. */
    readonly reachable: boolean;
    readonly isCurrent: boolean;
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

/** How far ahead of the player's column a node's kind is visible. Ticket 07: one layer. */
export const VISIBILITY_LAYERS = 1;

export function layoutRegion(
    nodes: ReadonlyArray<IRegionNode>,
    currentNodeId: string,
): RegionLayout {
    const current = nodes.find((n) => n.id === currentNodeId);
    const playerColumn = current ? columnOf(current) : 0;
    const reachableIds = new Set(current?.edges ?? []);

    // Group by column, then order within it. Pockets sort last so a dead-end hangs off the bottom of
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
        // Stable by id within the pocket/non-pocket split, so the same graph always draws the same
        // way. A map that reshuffles between renders is unreadable.
        const ordered = [...bucket].sort((a, b) => {
            if (a.pocket !== b.pocket) return a.pocket ? 1 : -1;
            return a.id < b.id ? -1 : 1;
        });
        maxRows = Math.max(maxRows, ordered.length);
        ordered.forEach((node, row) => {
            laid.push({
                node,
                column,
                row,
                rowsInColumn: ordered.length,
                revealed: node.visited > 0 || column <= playerColumn + VISIBILITY_LAYERS,
                reachable: reachableIds.has(node.id),
                isCurrent: node.id === currentNodeId,
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
