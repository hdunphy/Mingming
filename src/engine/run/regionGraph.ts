/**
 * REGION GRAPH GENERATOR — the TypeScript port of ticket 07's ratified prototype.
 *
 * This is the thing the player walks: three sequential biomes of five layers each, generated once
 * at run start from `IRunState.seed` and stored whole in the run save. Nothing here rolls what is
 * *inside* a node — ticket 07 rules that contents are rolled at entry from the node's seed plus its
 * visit count, so that re-entry re-rolls honestly instead of replaying a cached encounter. This
 * module only decides shape and `kind`, both of which are public information the moment the map
 * is drawn (`exploration-map.md`: "types visible, contents hidden").
 *
 * **Every number in `REGION_PARAMS` is a value Henry ruled on 2026-08-21, not a guess.** They come
 * from [ticket 07](../../../docs/wayfinder/steam-release/tickets/07-region-graph.md), which he
 * closed after reacting to rendered graphs from the seeded Python prototype at
 * `docs/wayfinder/steam-release/research/07-region-graph-prototype/regiongraph.py`. Tuning them is
 * a design decision, which is why they are one exported object rather than literals sprinkled
 * through the generator: ticket 10 builds the map screen on this, and whoever tunes the map next
 * should have exactly one place to look.
 *
 * ## Four deliberate departures from the prototype
 *
 * 1. **`layer` is per biome (0–4), not the prototype's global 0–14 counter.** `RegionNodeSchema`
 *    bounds `layer` to 0–4 and carries `biomeIndex` separately, so position is (biome, layer).
 * 2. **No `x`, and no `'entry'` kind.** `x` was dropped because storing a lane index freezes a
 *    layout decision the UI has not made (ticket 06's note on why `layer` replaces raw x/y), and
 *    `NODE_KINDS` has no `'entry'`. Biome 0's layer-0 node is therefore a `wild` that starts at
 *    `visited: 1` — the run begins standing on it, so it does not trigger. Biomes 1 and 2 keep the
 *    prototype's behaviour: their layer-0 node is a `wild` connector you actually fight through.
 * 3. **Edges live on the node and point both ways.** The prototype kept a separate directed edge
 *    list; `IRegionNode.edges` is the only edge storage here, and ticket 07's "walkable in both
 *    directions" is enforced by construction — `link()` writes both halves or neither.
 * 4. **`'market'` is spelled `'marketplace'`**, matching `NodeKind`.
 *
 * One further correction, worth flagging rather than burying: the prototype built its weighted kind
 * pool as `int(weight * 20)` repeats, which truncates 14%/8% down to 2 and 1 entries out of 18 and
 * quietly turns the ruled 60/14/10/8/8 into roughly 67/11/11/6/6. This port uses the ruled
 * percentages as literal weights, so the mix is Henry's number rather than the prototype's
 * rounding error.
 *
 * Engine module: no React, no Redux, no `src/ui` or `src/debug` imports, and no `Math.random` —
 * everything procedural threads through `SeedStream` so a run replays identically from its seed.
 */

import { SeedStream } from '../core/SeedStream';
import type { IRegionNode, NodeKind } from '../runTypes';

// ---------------------------------------------------------------------------------------------
// Ruled parameters (Henry, 2026-08-21, ticket 07)
// ---------------------------------------------------------------------------------------------

export const REGION_PARAMS = {
    /** `exploration-map.md`: a run is three biomes, walked in order. */
    biomesPerRun: 3,
    /** Five layers each: 0 entry, 1–3 middle, 4 exit. `RegionNodeSchema` bounds this to 0–4. */
    layersPerBiome: 5,
    /** Layer indices 1, 2 and 3 — the only layers whose kind is rolled from the mix. */
    middleLayerCount: 3,
    /** "Width: 2–3 nodes per middle layer." Rolled per layer, so biomes are not uniform. */
    minMiddleWidth: 2,
    maxMiddleWidth: 3,
    /**
     * Each node in the previous layer reaches forward to this many nodes in the next one. The
     * prototype's `randint(1, 2)`: 1 keeps routes meaningfully separate, 2 keeps the graph from
     * degenerating into parallel lanes — which is the entire point of "explicitly NOT Spire's
     * three lanes".
     */
    minForwardEdges: 1,
    maxForwardEdges: 2,
    /** "Lateral edges between siblings ~60% of layers." One per layer, between two siblings. */
    lateralEdgeChance: 0.6,
    /**
     * The ruled middle-node mix, as literal percentages. See the header note on why these are not
     * the prototype's quantised pool, and `buildFillerKindPool` for the one place this mix and the
     * market/workshop guarantee contradict each other.
     */
    middleKindWeights: {
        wild: 60,
        event: 14,
        elite: 10,
        marketplace: 8,
        workshop: 8,
    },
    /**
     * "Exactly one market and one workshop guaranteed per biome." These are placed first and the
     * rest of the biome's middle nodes are filled from the weighted pool, so the guarantee is
     * structural rather than a retry loop that might not converge on a narrow biome.
     */
    guaranteedMiddleKinds: ['marketplace', 'workshop'],
    /** "Biome exit = an elite; biome 3's exit is the gym." */
    biomeExitKind: 'elite',
    finalBiomeExitKind: 'gym',
    /** "1 dead-end side node per biome." */
    pocketsPerBiome: 1,
    /**
     * Rolled uniformly from this list, so `wild` lands half the time: a pocket is usually a farming
     * detour and occasionally the alpha (guards a guaranteed blueprint) or the ambush (their 3 vs
     * your 2). Duplicating `wild` rather than writing weights keeps this identical to the
     * prototype Henry actually looked at.
     */
    pocketKinds: ['wild', 'wild', 'alpha', 'ambush'],
} as const;

// ---------------------------------------------------------------------------------------------
// Public shape
// ---------------------------------------------------------------------------------------------

export interface RegionGraph {
    readonly nodes: ReadonlyArray<IRegionNode>;
    /** Biome 0, layer 0 — where the run starts, and what `IRunState.currentNodeId` opens on. */
    readonly entryNodeId: string;
    /** Biome 2, layer 4 — the gauntlet, and the only way a run is won. */
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
    pocket: boolean;
    edges: string[];
    visited: number;
}

/**
 * Ticket 07: "the graph is genuinely explorable, not a frontier picker." Writing both halves in
 * one function is the cheapest way to make an asymmetric edge unrepresentable — there is no code
 * path in this module that appends to `edges` directly.
 */
function link(a: MutableNode, b: MutableNode): void {
    if (!a.edges.includes(b.id)) a.edges.push(b.id);
    if (!b.edges.includes(a.id)) b.edges.push(a.id);
}

/**
 * The weighted pool the non-guaranteed middle nodes are drawn from, as a flat array.
 *
 * **The one place ticket 07's ruled parameters contradict themselves, resolved here in the open.**
 * The mix lists marketplace at 8% and workshop at 8%, *and* the same row guarantees "exactly one
 * market and one workshop per biome". Both cannot hold: a biome has 6–9 middle nodes, so if the
 * filler pool can also roll a marketplace, biomes with two of them are common (the prototype has
 * this bug — its pool includes both, and it produces double markets regularly).
 *
 * The guarantee wins, because it is the half with a gameplay argument behind it: a biome with two
 * workshops and a biome with none are both worse than a biome with one, and ticket 07's own test
 * list names "exactly one market + one workshop per biome" as a check the port must pass. So the
 * filler pool drops the two guaranteed kinds and renormalises over what is left — wild, event and
 * elite keep their 60 : 14 : 10 ratio to each other.
 *
 * What that costs, stated rather than hidden: because the guarantee places 2 of an average 7.5
 * middle nodes, the *realised* per-biome mix runs about 13% marketplace and 13% workshop against
 * the ruled 8%, and correspondingly fewer wilds. The ruled percentages describe the pool; the
 * guarantee overrides them at these widths. Widening biomes is the only thing that would close the
 * gap, and that is Henry's call, not this module's — hence `middleKindWeights` keeps the ruled
 * numbers verbatim rather than being quietly rewritten to what the generator actually produces.
 */
function buildFillerKindPool(): NodeKind[] {
    const guaranteed = REGION_PARAMS.guaranteedMiddleKinds as ReadonlyArray<NodeKind>;
    const pool: NodeKind[] = [];
    const weights = Object.entries(REGION_PARAMS.middleKindWeights) as ReadonlyArray<[NodeKind, number]>;
    for (const [kind, weight] of weights) {
        if (guaranteed.includes(kind)) continue;
        for (let i = 0; i < weight; i += 1) pool.push(kind);
    }
    return pool;
}

function pick<T>(stream: SeedStream, items: ReadonlyArray<T>): T {
    return items[stream.nextInt(0, items.length - 1)];
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

    const nodes: MutableNode[] = [];
    const pool = buildFillerKindPool();
    /** Per (biome, layer) counter, so ids are readable positions and still unique with pockets. */
    const indexInLayer = new Map<string, number>();

    const add = (biomeIndex: number, layer: number, kind: NodeKind, pocket: boolean): MutableNode => {
        const key = `${biomeIndex}:${layer}`;
        const index = indexInLayer.get(key) ?? 0;
        indexInLayer.set(key, index + 1);
        const node: MutableNode = {
            id: `b${biomeIndex}l${layer}n${index}`,
            kind,
            biomeIndex,
            layer,
            pocket,
            edges: [],
            visited: 0,
        };
        nodes.push(node);
        return node;
    };

    let entryNodeId = '';
    let gymNodeId = '';
    /** The frontier the next layer attaches to. Carries across the biome seam, one exit deep. */
    let prevLayer: MutableNode[] = [];

    for (let biomeIndex = 0; biomeIndex < REGION_PARAMS.biomesPerRun; biomeIndex += 1) {
        const isFinalBiome = biomeIndex === REGION_PARAMS.biomesPerRun - 1;

        // --- Layer 0: the entry ---------------------------------------------------------------
        // `NODE_KINDS` has no `'entry'`, so this is a `wild`. Biome 0's is the one node the player
        // starts standing on: it is marked `visited: 1` so the entry-trigger rule ("entering a node
        // triggers it again, always") does not fire a fight before the run has begun. Biomes 1 and
        // 2 open with a wild you genuinely fight — that connector is part of the fight envelope.
        const entry = add(biomeIndex, 0, 'wild', false);
        if (biomeIndex === 0) {
            entry.visited = 1;
            entryNodeId = entry.id;
        }
        for (const previous of prevLayer) link(previous, entry);
        prevLayer = [entry];

        // --- Layers 1–3: the middle -------------------------------------------------------------
        const middles: MutableNode[] = [];
        for (let layer = 1; layer <= REGION_PARAMS.middleLayerCount; layer += 1) {
            const width = stream.nextInt(REGION_PARAMS.minMiddleWidth, REGION_PARAMS.maxMiddleWidth);
            const layerNodes: MutableNode[] = [];
            // Kind is a placeholder until the whole biome's middle is known — the market/workshop
            // guarantee is a per-biome property, so it cannot be decided one layer at a time.
            for (let i = 0; i < width; i += 1) layerNodes.push(add(biomeIndex, layer, 'wild', false));

            for (const previous of prevLayer) {
                const reach = Math.min(
                    layerNodes.length,
                    stream.nextInt(REGION_PARAMS.minForwardEdges, REGION_PARAMS.maxForwardEdges),
                );
                for (const target of stream.shuffle(layerNodes).slice(0, reach)) link(previous, target);
            }

            // A node nobody reached forward to is unreachable, and an unreachable node is a piece of
            // map the player can see and never touch. Adopt it rather than regenerating the layer.
            for (const target of layerNodes) {
                if (target.edges.length === 0) link(pick(stream, prevLayer), target);
            }

            // Lateral edges are what make this a graph rather than a braid: they let the player
            // switch route mid-layer, which is how a marketplace two lanes over becomes reachable.
            if (layerNodes.length >= 2 && stream.next() < REGION_PARAMS.lateralEdgeChance) {
                const [a, b] = stream.shuffle(layerNodes);
                link(a, b);
            }

            middles.push(...layerNodes);
            prevLayer = layerNodes;
        }

        // --- Kinds for the middle ---------------------------------------------------------------
        // The guarantees go in first and the remainder is drawn from the weighted pool, then the
        // whole list is shuffled onto the nodes. There are at least 3 x 2 = 6 middle nodes per
        // biome, so the two guaranteed kinds always fit.
        const kinds: NodeKind[] = [...REGION_PARAMS.guaranteedMiddleKinds];
        while (kinds.length < middles.length) kinds.push(pick(stream, pool));
        const assigned = stream.shuffle(kinds);
        middles.forEach((node, i) => { node.kind = assigned[i]; });

        // --- The pocket ---------------------------------------------------------------------------
        // A dead end hanging off a middle node, sharing its host's layer because it is beside the
        // route rather than along it. Its single edge is what makes it a decision: everything you
        // spend getting there you spend again coming back.
        for (let i = 0; i < REGION_PARAMS.pocketsPerBiome; i += 1) {
            const host = pick(stream, middles);
            const pocket = add(biomeIndex, host.layer, pick(stream, REGION_PARAMS.pocketKinds), true);
            link(host, pocket);
        }

        // --- Layer 4: the exit --------------------------------------------------------------------
        // Every route through the biome converges here, which is why the elite is unavoidable and
        // why the gym is the only way the run ends in a victory.
        const exit = add(
            biomeIndex,
            REGION_PARAMS.layersPerBiome - 1,
            isFinalBiome ? REGION_PARAMS.finalBiomeExitKind : REGION_PARAMS.biomeExitKind,
            false,
        );
        for (const previous of prevLayer) link(previous, exit);
        if (isFinalBiome) gymNodeId = exit.id;
        prevLayer = [exit];
    }

    return {
        nodes: nodes.map((node): IRegionNode => ({ ...node, edges: [...node.edges] })),
        entryNodeId,
        gymNodeId,
    };
}
