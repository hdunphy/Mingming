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

import { REGION_PARAMS, nodeRole, routeNumberOf } from '../../engine/run/regionGraph';
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
 * Its KIND is untouched (it is still a wild underneath, and the run opens by fighting it, Henry
 * 2026-10-03: `openingFight.ts`). It is drawn as a flag and labelled Start, because it is where you
 * are standing when the map first comes up, not a place to choose.
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
// Layout (ticket 176e)
// ---------------------------------------------------------------------------------------------

/*
 * ONE COLUMN PER ROW OF THE GRAPH.
 *
 * The region is rows (`REGION_PARAMS.biomeRows`: biome 0 has seven, biome 1 five, biome 2 four), and
 * a row is a column on screen, so the whole run is 7 + 5 + 4 = 16 columns, left to right. Up to
 * ticket 176 it was a flat five per biome, which only suited a map whose layers were all the same
 * width. Branching routes change what a column is: a town is one node, a route is one to three.
 *
 * Within a column the nodes sit in GENERATION ORDER, top to bottom (the id's `n<index>`), which is
 * the order the generator linked them in and why no two links cross. A DETOUR is not in that
 * order. It hangs half a column to the right of the node it leaves, above or below the route, so the
 * plain link (host to the next row) stays a straight road and the detour is visibly the long way
 * round. It costs one extra fight, and the map says so with a dashed link and a "+1 fight" label.
 */

/** First column of each biome: 0, 7, 12 with the current row counts. */
const BIOME_FIRST_COLUMN: ReadonlyArray<number> = (() => {
    const starts: number[] = [];
    let total = 0;
    for (const rows of REGION_PARAMS.biomeRows) {
        starts.push(total);
        total += rows.length;
    }
    return starts;
})();

/** 16 with the current rows. */
export const COLUMN_COUNT: number = REGION_PARAMS.biomeRows.reduce((sum, rows) => sum + rows.length, 0);

/** The widest a row of the map is drawn: a route row has at most three nodes. */
const BASE_SLOTS = 3;
/** How far above or below the route a detour hangs, in rows. */
export const DETOUR_LIFT = 0.8;

// Geometry, in viewBox units (roughly 1.5x what the 15-column map used).
export const COL_W = 144;
export const ROW_H = 110;
export const PAD_X = 84;
export const NODE_R = 30;
/** An elite gate (a biome's exit) and the gym are drawn larger than a route node. */
export const GATE_R = 38;
export const GYM_R = 42;
export const TOWN_W = 116;
export const TOWN_H = 84;
/** Where the first row of nodes sits: room for the biome name above it. */
export const TOP_Y = 92;
/** Room under the lowest row for the node names and the "Route N" labels. */
export const BOTTOM_ROOM = 104;
/** The wander is vertical only now: at most this fraction of a row. */
export const WANDER_Y_FRACTION = 0.12;

export interface LaidOutNode {
    readonly node: IRegionNode;
    /** 0-15, left to right across the whole run. A detour has the column of the node it leaves. */
    readonly column: number;
    /** Horizontal position in columns: the column, plus a half for a detour. */
    readonly x: number;
    /** 0-based position within the column, top to bottom (a detour is counted after the route). */
    readonly row: number;
    /** Total route nodes in this column, so a renderer can centre it. */
    readonly rowsInColumn: number;
    /** Vertical position in rows from the top route slot; a detour is above 0 or below the last slot. */
    readonly slot: number;
    /** For a detour: the node it leaves, and which side of the route it hangs. */
    readonly hostId?: string;
    readonly side?: 'up' | 'down';
    /** One edge away from the player, so a click travels there. */
    readonly reachable: boolean;
    readonly isCurrent: boolean;
    /** On the path the player walked (it has been entered, or the player stands on it). */
    readonly taken: boolean;
    /**
     * PASSED, NOT TAKEN: not entered, and no road leads to it from where the player stands any more.
     * Travel is one-way, so the other branch of a fork you did not take is behind you for good.
     */
    readonly passed: boolean;
    /**
     * TICKET 34 part two — **the wander**, in unit terms: a value in `[-1, 1]` the renderer scales
     * into pixels. Derived from the node ID, not rolled, so it is stable across a re-render, a
     * reload and a resumed save. Since 176e it is vertical only (`WANDER_Y_FRACTION` of a row): the
     * columns carry the run's order, and a node that leaned sideways could look like it belonged to
     * its neighbour's row.
     */
    readonly wanderY: number;
}

export interface RouteLabel {
    readonly route: number;
    /** First and last column of the route, so the label can be centred under it. */
    readonly firstColumn: number;
    readonly lastColumn: number;
}

export interface RegionLayout {
    readonly nodes: ReadonlyArray<LaidOutNode>;
    readonly columnCount: number;
    readonly maxRows: number;
    /** Route-row slots the picture reserves (3 for a generated map). */
    readonly slotCount: number;
    readonly byId: ReadonlyMap<string, LaidOutNode>;
    /** "Route 1" to "Route 5", where each runs. */
    readonly routes: ReadonlyArray<RouteLabel>;
}

export function columnOf(node: IRegionNode): number {
    return (BIOME_FIRST_COLUMN[node.biomeIndex] ?? 0) + node.layer;
}

/** The generation index in a node id (`b1l2n1` is 1); ids from a hand-built map sort after. */
function generationIndex(node: IRegionNode): number {
    const match = /n(\d+)$/.exec(node.id);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

/**
 * A stable pair of offsets in `[-1, 1]` for a node id — ticket 34 part two's wander.
 *
 * FNV-1a, because it needs to be *stable forever* and cheap, not statistically excellent: the same
 * id must land in the same place in every build, and two adjacent ids (`b1l2n0`, `b1l2n1`) must land
 * in visibly different places. `Math.random` is forbidden in this module for the ordinary reason and
 * one extra: a re-render would move the map under the cursor.
 *
 * The two values come from different halves of the hash so that x and y are independent.
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
     * drawn on top of each other. `regionLayout.test.ts` pins it.
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

/** Every node the player can still get to by walking forward from `fromId` (not including it). */
function forwardReach(byId: ReadonlyMap<string, IRegionNode>, fromId: string): Set<string> {
    const seen = new Set<string>();
    const queue = [...(byId.get(fromId)?.edges ?? [])];
    while (queue.length > 0) {
        const id = queue.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const next of byId.get(id)?.edges ?? []) queue.push(next);
    }
    return seen;
}

/**
 * Which side of the route a detour hangs. The generator hangs it off the TOP link or the BOTTOM link
 * between two rows (`regionGraph`, M3): when its host's row is wider than one that is the host's own
 * position, and when the host is alone in its row it is the position of the link's target.
 */
function detourSide(
    host: IRegionNode,
    hostRow: ReadonlyArray<IRegionNode>,
    target: IRegionNode | undefined,
    targetRow: ReadonlyArray<IRegionNode>,
): 'up' | 'down' {
    if (hostRow.length > 1) return hostRow.indexOf(host) === 0 ? 'up' : 'down';
    if (target && targetRow.length > 1) return targetRow.indexOf(target) === 0 ? 'up' : 'down';
    return 'up';
}

export function layoutRegion(
    nodes: ReadonlyArray<IRegionNode>,
    currentNodeId: string,
): RegionLayout {
    const current = nodes.find((n) => n.id === currentNodeId);
    const reachableIds = new Set(current?.edges ?? []);
    const nodesById = new Map(nodes.map((n) => [n.id, n] as const));
    const ahead = forwardReach(nodesById, currentNodeId);

    // Route nodes per (biome, layer), in generation order — stable whatever order the array arrives in.
    const rowKey = (n: IRegionNode): string => `${n.biomeIndex}:${n.layer}`;
    const rows = new Map<string, IRegionNode[]>();
    for (const node of nodes) {
        if (node.detour) continue;
        const bucket = rows.get(rowKey(node));
        if (bucket) bucket.push(node);
        else rows.set(rowKey(node), [node]);
    }
    for (const bucket of rows.values()) {
        bucket.sort((a, b) => (generationIndex(a) - generationIndex(b)) || (a.id < b.id ? -1 : 1));
    }

    const slotCount = Math.max(BASE_SLOTS, ...[...rows.values()].map((bucket) => bucket.length));
    const laid: LaidOutNode[] = [];

    const common = (node: IRegionNode) => ({
        node,
        column: columnOf(node),
        reachable: reachableIds.has(node.id),
        isCurrent: node.id === currentNodeId,
        taken: node.visited > 0 || node.id === currentNodeId,
        passed: node.visited === 0 && node.id !== currentNodeId && !ahead.has(node.id),
        wanderY: wanderFor(node.id).y,
    });

    for (const bucket of rows.values()) {
        bucket.forEach((node, row) => {
            laid.push({
                ...common(node),
                x: columnOf(node),
                row,
                rowsInColumn: bucket.length,
                slot: (slotCount - bucket.length) / 2 + row,
            });
        });
    }

    // Detours: half a column right of the node they leave, above or below the route.
    const detours = nodes
        .filter((n) => n.detour)
        .sort((a, b) => (a.biomeIndex - b.biomeIndex) || (a.layer - b.layer) || (a.id < b.id ? -1 : 1));
    const detourCount = new Map<string, number>();
    for (const detour of detours) {
        const routeRow = rows.get(rowKey(detour)) ?? [];
        const host = routeRow.find((n) => n.edges.includes(detour.id));
        const target = detour.edges.map((id) => nodesById.get(id)).find((n) => n !== undefined);
        const targetRow = target ? rows.get(rowKey(target)) ?? [] : [];
        const side = host ? detourSide(host, routeRow, target, targetRow) : 'down';
        const placed = detourCount.get(rowKey(detour)) ?? 0;
        detourCount.set(rowKey(detour), placed + 1);
        laid.push({
            ...common(detour),
            x: columnOf(detour) + (host ? 0.5 : 0),
            row: routeRow.length + placed,
            rowsInColumn: routeRow.length,
            slot: side === 'up' ? -DETOUR_LIFT : slotCount - 1 + DETOUR_LIFT,
            hostId: host?.id,
            side,
        });
    }

    laid.sort((a, b) => (a.column - b.column) || (a.row - b.row));

    // "Route N": a run of route columns, labelled by the number the generator gives them.
    const spans = new Map<number, { first: number; last: number }>();
    for (const bucket of rows.values()) {
        const route = routeNumberOf(bucket[0]);
        if (route === null) continue;
        const column = columnOf(bucket[0]);
        const span = spans.get(route);
        if (!span) spans.set(route, { first: column, last: column });
        else { span.first = Math.min(span.first, column); span.last = Math.max(span.last, column); }
    }
    const routes = [...spans.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([route, span]) => ({ route, firstColumn: span.first, lastColumn: span.last }));

    return {
        nodes: laid,
        columnCount: COLUMN_COUNT,
        maxRows: Math.max(0, ...[...rows.values()].map((bucket) => bucket.length)),
        slotCount,
        byId: new Map(laid.map((n) => [n.node.id, n])),
        routes,
    };
}

// ---------------------------------------------------------------------------------------------
// Where a node is drawn (pixels). Here rather than in the component so a test can check that no two
// nodes overlap without rendering anything.
// ---------------------------------------------------------------------------------------------

/** Total height of the picture for a layout. */
export function canvasHeight(layout: RegionLayout): number {
    return TOP_Y + (layout.slotCount - 1 + 2 * DETOUR_LIFT) * ROW_H + BOTTOM_ROOM;
}

export function canvasWidth(layout: RegionLayout): number {
    return PAD_X * 2 + (layout.columnCount - 1) * COL_W;
}

/** A laid-out node's centre, wander included. */
export function centreOf(laid: LaidOutNode): { x: number; y: number } {
    return {
        x: PAD_X + laid.x * COL_W,
        y: TOP_Y + (laid.slot + DETOUR_LIFT) * ROW_H + laid.wanderY * WANDER_Y_FRACTION * ROW_H,
    };
}

/** What shape and size a node is drawn at: a town is a wide rounded box, a gate or the gym is a bigger disc. */
export function shapeOf(node: IRegionNode): { kind: 'disc'; r: number } | { kind: 'box'; w: number; h: number } {
    if (node.kind === 'town') return { kind: 'box', w: TOWN_W, h: TOWN_H };
    if (node.kind === 'gym') return { kind: 'disc', r: GYM_R };
    if (nodeRole(node) === 'exit') return { kind: 'disc', r: GATE_R };
    return { kind: 'disc', r: NODE_R };
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
