/**
 * REGION GRAPH GENERATOR — ticket 176's map: towns joined by branching, one-way routes.
 *
 * This is the thing the player walks: three sequential biomes, generated once at run start from
 * `IRunState.seed` and stored whole in the run save. Nothing here rolls what is *inside* a node —
 * contents are rolled at entry from the node's seed plus its visit count (ticket 07). This module
 * only decides shape and `kind`, both of which are public information the moment the map is drawn.
 *
 * ## The shape (ticket 176, M1–M3)
 *
 * Each biome is a fixed list of **rows** (`REGION_PARAMS.biomeRows`), walked left to right:
 *
 * - **start:** where the run begins (biome 0 only). One `wild`, already visited.
 * - **route:** `width` fights and events side by side.
 * - **town:** one node with a market AND a workshop. Every town is visited once.
 * - **exit:** the biome's elite gate, or the gym in the last biome.
 *
 * A run of consecutive route rows is a **route** (Route 1 to Route 5, like Pokémon).
 *
 * `edges` holds **forward links only**: the nodes you can step to from here. Travel is one-way
 * (Slay the Spire style), so there is no walking back and no farming. Links go from row `r` to row
 * `r + 1` and **never cross** when the rows are drawn top to bottom, so two paths can split and
 * merge but the picture stays readable. Each biome also has one optional **detour** hung off a top
 * or bottom link: out to one extra node and back to where the link was going, so taking it costs
 * exactly one more fight, and it is drawn outside the route where it crosses nothing.
 *
 * Every number in `REGION_PARAMS` is a value Henry ruled on 2026-10-01 (M1 the rows, M3 the
 * detours) or kept from ticket 07 and ticket 142 (the kind mix, the rivals, the scout). Tuning
 * them is a design decision, which is why they are one exported object.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports, and no `Math.random` —
 * everything procedural threads through `SeedStream` so a run replays identically from its seed.
 */

import { SeedStream } from '../core/SeedStream';
import type { IRegionNode, NodeKind } from '../runTypes';

// ---------------------------------------------------------------------------------------------
// Ruled parameters
// ---------------------------------------------------------------------------------------------

export type RowSpec =
    | { readonly type: 'start' }
    | { readonly type: 'route'; readonly width: number }
    | { readonly type: 'town' }
    | { readonly type: 'exit' };

export const REGION_PARAMS = {
    /** `exploration-map.md`: a run is three biomes, walked in order. */
    biomesPerRun: 3,
    /**
     * M1 (ruled 2026-10-01: *"Shape is good"*): the rows of each biome, left to right. Biome 0 is
     * the longest, and its first route row is the scripted opening fight. The scout stays in the
     * last route row before biome 2's town, so you meet the leader's comp with a market and a
     * workshop still ahead of the gym (142b). The widths and counts are Henry's numbers to tune.
     */
    biomeRows: [
        [
            { type: 'start' }, { type: 'route', width: 1 }, { type: 'route', width: 2 },
            { type: 'route', width: 3 }, { type: 'town' }, { type: 'route', width: 2 }, { type: 'exit' },
        ],
        [
            { type: 'route', width: 2 }, { type: 'route', width: 3 }, { type: 'town' },
            { type: 'route', width: 2 }, { type: 'exit' },
        ],
        [
            { type: 'route', width: 2 }, { type: 'route', width: 3 }, { type: 'town' }, { type: 'exit' },
        ],
    ] as ReadonlyArray<ReadonlyArray<RowSpec>>,
    /**
     * The route-row kind mix: ticket 07's ruled numbers with the shops taken out, because the
     * market and the workshop live in towns now.
     */
    routeKindWeights: { wild: 60, event: 14, elite: 10 },
    /**
     * Each node reaches forward to this many nodes of the next row. 1 keeps routes meaningfully
     * separate, 2 keeps the graph from degenerating into parallel lanes.
     */
    minForwardEdges: 1,
    maxForwardEdges: 2,
    /** M2: the chance a node gets a second forward link, when that keeps the links from crossing. */
    secondLinkChance: 0.5,
    /** "Biome exit = an elite; the last biome's exit is the gym." */
    biomeExitKind: 'elite',
    finalBiomeExitKind: 'gym',
    /** M3: one optional detour per biome, rolled uniformly from this list (ticket 07's old pocket list). */
    detoursPerBiome: 1,
    detourKinds: ['wild', 'wild', 'alpha', 'ambush'],
    /**
     * TICKET 142a — one route wild in three is a RIVAL: another trainer on the road to the same
     * leader, fielding the path species rather than the biome's. Every biome gets at least one,
     * because the whole point is that the path species are reachable in EVERY biome.
     */
    rivalWildFraction: 1 / 3,
} as const;

// ---------------------------------------------------------------------------------------------
// Row helpers: nothing outside this file hard-codes a layer number
// ---------------------------------------------------------------------------------------------

export type NodeRole = 'start' | 'route' | 'town' | 'exit' | 'detour';

const rowsOf = (biomeIndex: number): ReadonlyArray<RowSpec> => REGION_PARAMS.biomeRows[biomeIndex] ?? [];

/** The layer of a biome's exit: its last row. */
export function exitLayerOf(biomeIndex: number): number {
    return rowsOf(biomeIndex).length - 1;
}

/** The longest biome's row count, which `MAX_LAYER` in `runTypes.ts` must equal minus one. */
export function longestBiomeRowCount(): number {
    return Math.max(...REGION_PARAMS.biomeRows.map((rows) => rows.length));
}

/**
 * What a node is on the map, worked out from its biome's row list. A hand-built map (the intro's)
 * can have layers its biome has no row for; those read as route nodes, except a town (by kind) and
 * the gym (always an exit).
 */
export function nodeRole(node: Pick<IRegionNode, 'biomeIndex' | 'layer' | 'kind' | 'detour'>): NodeRole {
    if (node.detour) return 'detour';
    if (node.kind === 'town') return 'town';
    if (node.kind === 'gym') return 'exit';
    const row = rowsOf(node.biomeIndex)[node.layer];
    if (row?.type === 'start') return 'start';
    if (row?.type === 'exit') return 'exit';
    return 'route';
}

/** Biome 0's first route row: the scripted first fight (ticket 24). A detour is never it. */
export function isScriptedOpening(node: Pick<IRegionNode, 'biomeIndex' | 'layer' | 'kind' | 'detour'>): boolean {
    return node.biomeIndex === 0 && nodeRole(node) === 'route' && node.layer === 1;
}

/** Route number of every (biome, row) that is a route row: a run of route rows is one route. */
const ROUTE_NUMBERS: ReadonlyArray<ReadonlyArray<number | null>> = (() => {
    let current = 0;
    return REGION_PARAMS.biomeRows.map((rows) => {
        let previousWasRoute = false;
        return rows.map((row) => {
            if (row.type !== 'route') {
                previousWasRoute = false;
                return null;
            }
            if (!previousWasRoute) current += 1;
            previousWasRoute = true;
            return current;
        });
    });
})();

/** 1–5 for route and detour nodes, else null. Pokémon-style: "Route 3". */
export function routeNumberOf(node: Pick<IRegionNode, 'biomeIndex' | 'layer' | 'kind' | 'detour'>): number | null {
    const role = nodeRole(node);
    if (role !== 'route' && role !== 'detour') return null;
    return ROUTE_NUMBERS[node.biomeIndex]?.[node.layer] ?? null;
}

// ---------------------------------------------------------------------------------------------
// Public shape
// ---------------------------------------------------------------------------------------------

export interface RegionGraph {
    readonly nodes: ReadonlyArray<IRegionNode>;
    /** Biome 0, layer 0 — where the run starts, and what `IRunState.currentNodeId` opens on. */
    readonly entryNodeId: string;
    /** The last biome's exit — the gauntlet, and the only way a run is won. */
    readonly gymNodeId: string;
}

// ---------------------------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------------------------

/** The generator's working copy: `IRegionNode` is deeply readonly, which is right for consumers. */
interface MutableNode {
    id: string;
    kind: NodeKind;
    biomeIndex: number;
    layer: number;
    detour: boolean;
    edges: string[];
    visited: number;
    /** Ticket 142b — set on exactly one final-biome elite. Absent everywhere else. */
    scout?: boolean;
}

/** A forward link: you can step from `a` to `b`. There is no reverse half (ticket 176, one-way travel). */
function link(a: MutableNode, b: MutableNode): void {
    if (!a.edges.includes(b.id)) a.edges.push(b.id);
}

function pick<T>(stream: SeedStream, items: ReadonlyArray<T>): T {
    return items[stream.nextInt(0, items.length - 1)];
}

function buildRoutePool(): NodeKind[] {
    const pool: NodeKind[] = [];
    for (const [kind, weight] of Object.entries(REGION_PARAMS.routeKindWeights) as ReadonlyArray<[NodeKind, number]>) {
        for (let i = 0; i < weight; i += 1) pool.push(kind);
    }
    return pool;
}

/**
 * M2: no two links cross when the rows are drawn top to bottom. For nodes `i < j` of the upper row,
 * the highest target of `i` must be at or below the lowest target of `j` (at or above, in index
 * terms: `max(i) <= min(j)`). Two paths may share a target, which is how a split rejoins.
 */
function crossFree(targets: ReadonlyArray<ReadonlyArray<number>>): boolean {
    for (let i = 0; i < targets.length; i += 1) {
        if (targets[i].length === 0) continue;
        const highest = Math.max(...targets[i]);
        for (let j = i + 1; j < targets.length; j += 1) {
            if (targets[j].length > 0 && highest > Math.min(...targets[j])) return false;
        }
    }
    return true;
}

/** Links one row to the next (M2). Both rows are in generation order, top to bottom. */
function linkRows(upper: MutableNode[], lower: MutableNode[], stream: SeedStream): void {
    if (upper.length === 1 || lower.length === 1) {
        for (const a of upper) for (const b of lower) link(a, b);
        return;
    }
    const m = upper.length;
    const n = lower.length;
    // Every node gets its home target: the proportional position, so the rows line up.
    const targets: number[][] = upper.map((_, i) => [Math.floor((i * (n - 1)) / (m - 1) + 0.5)]);

    // A second link, to the target just above or just below home, when nothing crosses.
    for (let i = 0; i < m; i += 1) {
        if (stream.next() >= REGION_PARAMS.secondLinkChance) continue;
        const direction = stream.next() < 0.5 ? -1 : 1;
        const wanted = targets[i][0] + direction;
        if (wanted < 0 || wanted >= n) continue;
        const trial = targets.map((row, index) => (index === i ? [...row, wanted] : row));
        if (crossFree(trial)) targets[i].push(wanted);
    }

    // A target nobody reaches would be unreachable: the nearest node above adopts it, else below.
    for (let t = 0; t < n; t += 1) {
        if (targets.some((row) => row.includes(t))) continue;
        const above = targets.map((_, i) => i).filter((i) => Math.max(...targets[i]) < t).reverse();
        const below = targets.map((_, i) => i).filter((i) => Math.min(...targets[i]) > t);
        for (const i of [...above, ...below]) {
            const trial = targets.map((row, index) => (index === i ? [...row, t] : row));
            if (crossFree(trial)) {
                targets[i].push(t);
                break;
            }
        }
    }

    upper.forEach((a, i) => {
        for (const t of [...targets[i]].sort((x, y) => x - y)) link(a, lower[t]);
    });
}

/**
 * Build the whole region for a run.
 *
 * Deterministic in `seed` alone: the same seed always produces the same graph, node ids included,
 * which is what lets ticket 23 resume a mid-run app close by storing one seed string plus the node
 * states rather than the pre-rolled world.
 */
export function generateRegionGraph(seed: string): RegionGraph {
    // Fork rather than consuming the run seed directly. Other subsystems (encounter generation,
    // shop stock) are seeded from the same `IRunState.seed`, and a label keeps two of them from
    // drawing the identical number sequence.
    const stream = new SeedStream(new SeedStream(seed).fork('region-graph'));
    const pool = buildRoutePool();
    const nodes: MutableNode[] = [];

    let entryNodeId = '';
    let gymNodeId = '';
    /** The previous row, which the next one links from. Carries across the biome seam. */
    let previousRow: MutableNode[] = [];

    for (let biomeIndex = 0; biomeIndex < REGION_PARAMS.biomesPerRun; biomeIndex += 1) {
        const isFinalBiome = biomeIndex === REGION_PARAMS.biomesPerRun - 1;
        const rows = rowsOf(biomeIndex);
        const built: MutableNode[][] = [];

        const make = (layer: number, index: number, kind: NodeKind, detour = false): MutableNode => {
            const node: MutableNode = {
                id: `b${biomeIndex}l${layer}n${index}`, kind, biomeIndex, layer, detour, edges: [], visited: 0,
            };
            nodes.push(node);
            return node;
        };

        rows.forEach((spec, layer) => {
            const row: MutableNode[] = [];
            if (spec.type === 'start') {
                // `NODE_KINDS` has no `'start'`: this is a `wild` the run begins standing on. It is
                // already visited (so travel can never step back onto it), and the run OPENS on its
                // fight (`openingFight.ts`, Henry 2026-10-03). `nodeRole` is what calls it the start.
                const start = make(layer, 0, 'wild');
                start.visited = 1;
                entryNodeId = start.id;
                row.push(start);
            } else if (spec.type === 'route') {
                for (let i = 0; i < spec.width; i += 1) {
                    // TICKET 24: biome 0's first route row is always one wild — Slay the Spire's
                    // easy first fight. No roll is spent on it.
                    const scripted = biomeIndex === 0 && layer === 1;
                    row.push(make(layer, i, scripted ? 'wild' : pick(stream, pool)));
                }
            } else if (spec.type === 'town') {
                row.push(make(layer, 0, 'town'));
            } else {
                const exit = make(layer, 0, isFinalBiome ? REGION_PARAMS.finalBiomeExitKind : REGION_PARAMS.biomeExitKind);
                if (isFinalBiome) gymNodeId = exit.id;
                row.push(exit);
            }
            if (previousRow.length > 0) linkRows(previousRow, row, stream);
            built.push(row);
            previousRow = row;
        });

        const routeRows = built.map((row, layer) => ({ row, layer, spec: rows[layer] })).filter((r) => r.spec.type === 'route');
        const townLayer = rows.findIndex((r) => r.type === 'town');

        /*
         * --- TICKET 142b: the scout ----------------------------------------------------------
         *
         * The team you assemble for the leader is untested when the gauntlet's HP carry-over starts,
         * and nothing before gauntlet tier 1 looks like the gym. So the last fight before the
         * gauntlet is two bodies of the leader's own comp, at elite rung, at full HP, with the final
         * town (a market and a workshop) still behind you. It is the last route row before the
         * town, else the row before that.
         *
         * IT RUNS BEFORE THE RIVALS, and the order is load-bearing: promoting a node to the scout
         * consumes it, so doing this second could eat the final biome's only rival.
         */
        if (isFinalBiome) {
            const promotable: ReadonlyArray<NodeKind> = ['elite', 'wild', 'rival', 'event'];
            const scoutStream = new SeedStream(new SeedStream(seed).fork('scout'));
            const candidates = routeRows.filter((r) => r.layer < (townLayer < 0 ? rows.length : townLayer)).reverse();
            for (const { row } of candidates.slice(0, 2)) {
                const best = promotable.find((kind) => row.some((node) => node.kind === kind));
                if (!best) continue;
                const chosen = pick(scoutStream, row.filter((node) => node.kind === best));
                chosen.kind = 'elite';
                chosen.scout = true;
                break;
            }
        }

        /*
         * --- TICKET 142a: rivals ---------------------------------------------------------------
         *
         * A rival keeps its wild's rung, kit fraction and blueprint rate; only the SPECIES POOL
         * changes (`encounterSpeciesPool`). Putting the path species on the road makes the Fire pair
         * and the Nature bridge assemblable in whichever order the player's hand wants. A labelled
         * fork, so the rival roll never shifts the layout stream.
         */
        const rivalStream = new SeedStream(new SeedStream(seed).fork(`rivals:${biomeIndex}`));
        const routeNodes = routeRows.flatMap((r) => r.row).filter((node) => !(biomeIndex === 0 && node.layer === 1));
        const wilds = routeNodes.filter((node) => node.kind === 'wild');
        if (wilds.length > 0) {
            const count = Math.max(1, Math.floor(wilds.length * REGION_PARAMS.rivalWildFraction));
            for (const node of rivalStream.shuffle(wilds).slice(0, count)) node.kind = 'rival';
        } else {
            // No wild left to convert (the scout took it, or the biome rolled events and elites): an
            // event becomes the rival rather than the biome going without one.
            const events = routeNodes.filter((node) => node.kind === 'event');
            if (events.length > 0) pick(rivalStream, events).kind = 'rival';
        }

        /*
         * --- M3: the detour --------------------------------------------------------------------
         *
         * Hung off the TOP or BOTTOM link between two rows, so it sits outside the route and crosses
         * nothing: host -> detour -> the host link's target, with the plain link kept as the way to
         * skip it. Taking it costs exactly one extra fight. Never off the scripted first fight. The
         * last biome may also hang one between its last route row and the town.
         */
        const hosts: Array<{ from: MutableNode; to: MutableNode }> = [];
        routeRows.forEach(({ row, layer }) => {
            if (biomeIndex === 0 && layer === 1) return;
            const next = built[layer + 1];
            if (!next) return;
            const nextIsRoute = rows[layer + 1].type === 'route';
            if (!nextIsRoute && !(isFinalBiome && rows[layer + 1].type === 'town')) return;
            hosts.push({ from: row[0], to: next[0] });
            if (row.length > 1 || next.length > 1) hosts.push({ from: row[row.length - 1], to: next[next.length - 1] });
        });
        const eligible = hosts.filter(({ from, to }) => from.edges.includes(to.id));
        const placed: MutableNode[] = [];
        for (let i = 0; i < REGION_PARAMS.detoursPerBiome && eligible.length > 0; i += 1) {
            const { from, to } = pick(stream, eligible);
            const detour = make(from.layer, built[from.layer].length + placed.length, pick(stream, REGION_PARAMS.detourKinds), true);
            link(from, detour);
            link(detour, to);
            placed.push(detour);
        }

        // 142a, the last resort: a biome with no rival turns a wild detour into one (never the
        // scripted opening, which is pinned to the biome's own element on purpose).
        if (!nodes.some((node) => node.biomeIndex === biomeIndex && node.kind === 'rival')) {
            const wildDetour = placed.find((node) => node.kind === 'wild');
            if (wildDetour) wildDetour.kind = 'rival';
        }
    }

    return {
        // `scout` is spread through only where it is set: an explicit `scout: undefined` on every
        // ordinary node would serialise into the save as a null.
        nodes: nodes.map((node): IRegionNode => ({ ...node, edges: [...node.edges] })),
        entryNodeId,
        gymNodeId,
    };
}
