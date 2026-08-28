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
 *
 * # THE THIRD CLAUSE — A SURVEYED BIOME (ticket 15)
 *
 * Ticket 07's amendment adds a MAP-REVEAL consumable, and Henry's ask behind it is *"items and
 * events that reveal more of the map"* under one-layer visibility. So the fog now has one more way
 * to lift: **a biome the run has surveyed is revealed whole**, however far ahead of the player it
 * is. It is passed in as a list of biome indices rather than read out of the run here, because this
 * module is a pure function of the node set and must stay callable without a run — `RunScreen`
 * derives the list from `IRunState.modifiers` through `macroRegistry.revealedBiomesFrom`.
 *
 * The parameter is optional and defaults to empty, so every existing caller and every existing test
 * describes the unsurveyed map exactly as before: the reveal can only ever *add* revealed nodes.
 */

import { revealedBiomesFrom } from '../../engine/data/macroRegistry';
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
    elite: 'elite',
    alpha: 'alpha',
    ambush: 'ambush',
    marketplace: 'marketplace',
    workshop: 'workshop',
    event: 'event',
    gym: 'gym',
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

/**
 * Re-exported so a screen holding an `IRunState` can turn `modifiers` into the argument below
 * without importing the macro registry itself. One import for "everything the map needs to draw",
 * which is the same reason `FIGHT_KINDS` is re-exported above.
 */
export { revealedBiomesFrom };

export function layoutRegion(
    nodes: ReadonlyArray<IRegionNode>,
    currentNodeId: string,
    /**
     * Biome indices the run has surveyed with a map-reveal macro (ticket 15). Empty by default, so
     * an omitted argument is exactly the pre-ticket-15 fog.
     */
    revealedBiomes: ReadonlyArray<number> = [],
): RegionLayout {
    const current = nodes.find((n) => n.id === currentNodeId);
    const playerColumn = current ? columnOf(current) : 0;
    const reachableIds = new Set(current?.edges ?? []);
    const surveyed = new Set(revealedBiomes);

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
                revealed: node.visited > 0
                    || column <= playerColumn + VISIBILITY_LAYERS
                    // Ticket 15's survey. Whole-biome rather than one-node, because "reveals the
                    // current biome's node types" is what the amendment says and because a
                    // per-node reveal would need a per-node record in `modifiers`, which is a list
                    // of run-wide facts and not a place to keep fifteen booleans.
                    || surveyed.has(node.biomeIndex),
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
