/**
 * THE SCRAP CURVE, BIOME BY BIOME — ticket 174a.
 *
 * Henry, 2026-09-30: *"I find myself needing a lot of scrap early on and at the end having too
 * much scrap when I don't really need it."* The numbers behind that sentence were built by hand
 * from four playtest logs, one throwaway script per question. This is the same table as a tool, so
 * every future playtest is read the same way and the walker's runs can be read the same way as a
 * human's.
 *
 * `runLog.ts` already has the whole-run readers (`runCurves`, `scrapByReason`, `cardFlow`). This
 * is the per-biome view that sits beside them. It is a pure function over an `IRunLog`: no React,
 * no storage, no clock, so the debug panel, the CLI and the walker's balance report all call the
 * same code.
 *
 * # HOW A ROW IS ASSIGNED TO A BIOME
 *
 * Every row belongs to the biome of the last `NODE_ENTERED` before it. Rows before the first
 * `NODE_ENTERED` (the `RUN_STARTED` row) belong to biome 0. The `NODE_ENTERED` row that opens
 * biome N is itself in biome N, which is why `scrapAtEnd` for biome N-1 is read off it: it is the
 * first thing stamped after the previous biome's elite paid out.
 *
 * # WHAT IS NOT KNOWN: A NODE'S IDENTITY
 *
 * The log carries no node id. `revisits` therefore identifies a node by `biome` + `layer` +
 * `nodeKind`. That is an APPROXIMATION: two different wild nodes on the same layer count as one
 * node, so walking into the second after the first reads as a revisit. Layers hold a handful of
 * nodes, so it overcounts a little on a path that wanders sideways and is exact on the case this
 * report exists for (the same wild node re-entered for scrap).
 */

import type { IRunLog } from './runLog';

/** One biome's scrap economy, as one row. Amounts in `income` and `spent` are always positive. */
export interface BiomeScrapRow {
    /** 0-based biome index, as `NODE_ENTERED.biome` writes it. */
    readonly biome: number;
    /** `FIGHT_ENDED` rows in this biome, wins and losses. */
    readonly fights: number;
    /** Scrap gained, by the `reason` the `SCRAP` row carries. */
    readonly income: Readonly<Record<string, number>>;
    /** Scrap spent, by `reason`, as positive amounts. */
    readonly spent: Readonly<Record<string, number>>;
    /**
     * The scrap held when the biome closed: the `scrap` stamp of the first row of the next biome,
     * or of the last row of the log for the final biome.
     */
    readonly scrapAtEnd: number;
    /** The lowest `scrap` stamp on any row inside this biome. */
    readonly lowPoint: number;
    /** `NODE_ENTERED` rows for a node (biome + layer + kind) the run had already entered. */
    readonly revisits: number;
}

/** The sum of one `income` or `spent` record. */
export function sumByReason(byReason: Readonly<Record<string, number>>): number {
    let total = 0;
    for (const reason of Object.keys(byReason)) total += byReason[reason];
    return total;
}

interface Accumulator {
    fights: number;
    income: Record<string, number>;
    spent: Record<string, number>;
    lowPoint: number;
    revisits: number;
    firstScrap: number;
    lastScrap: number;
}

function emptyAccumulator(scrap: number): Accumulator {
    return { fights: 0, income: {}, spent: {}, lowPoint: scrap, revisits: 0, firstScrap: scrap, lastScrap: scrap };
}

/**
 * One row per biome the run reached, in biome order. A log with no fight in it gives no rows: a
 * run that never fought has no economy to read.
 */
export function scrapCurve(log: IRunLog): BiomeScrapRow[] {
    const events = log.events;
    if (!events.some((event) => event.kind === 'FIGHT_ENDED')) return [];

    const byBiome = new Map<number, Accumulator>();
    const seenNodes = new Set<string>();
    let biome = 0;

    for (const event of events) {
        if (event.kind === 'NODE_ENTERED') biome = event.biome;

        let acc = byBiome.get(biome);
        if (!acc) {
            acc = emptyAccumulator(event.scrap);
            byBiome.set(biome, acc);
        }
        acc.lastScrap = event.scrap;
        if (event.scrap < acc.lowPoint) acc.lowPoint = event.scrap;

        if (event.kind === 'FIGHT_ENDED') {
            acc.fights++;
        } else if (event.kind === 'SCRAP') {
            const bucket = event.delta >= 0 ? acc.income : acc.spent;
            bucket[event.reason] = (bucket[event.reason] ?? 0) + Math.abs(event.delta);
        } else if (event.kind === 'NODE_ENTERED') {
            const nodeKey = `${event.biome}:${event.layer}:${event.nodeKind}`;
            if (seenNodes.has(nodeKey)) acc.revisits++;
            else seenNodes.add(nodeKey);
        }
    }

    const biomes = [...byBiome.keys()].sort((a, b) => a - b);
    return biomes.map((id, index) => {
        const acc = byBiome.get(id)!;
        const next = index + 1 < biomes.length ? byBiome.get(biomes[index + 1]) : undefined;
        return {
            biome: id,
            fights: acc.fights,
            income: acc.income,
            spent: acc.spent,
            scrapAtEnd: next ? next.firstScrap : acc.lastScrap,
            lowPoint: acc.lowPoint,
            revisits: acc.revisits,
        };
    });
}
