/**
 * TICKET 176f - the map measurement.
 *
 * `vite-node src/debug/balance/runMapMeasure176.ts -- --kind ghost --detours false --seeds 30 --out g.json`
 * walks every EA starter `--seeds` times (or just the ones in `--starters a,b`, or the seed slice
 * `--from`/`--to`) and writes one small row per walk. `--report a.json b.json ...` pools row files
 * into the numbers `docs/balance/map-176.md` quotes. Run once per tree (the parent commit and 176),
 * with the same seed labels, so the two are paired seed for seed.
 *
 * Two kinds of walk:
 *
 * - `ghost` is 170a's ghost walk. A fight lost before the gym is carried on as a win, so every walk
 *   reaches the gate and "fights before the gym" is measured on every run, not on the one in seven
 *   that survives. `--detours true` takes every detour the map offers (M8). The parent map has no
 *   `takeDetours`: it ignores the flag, and its pockets are only walked into if they lie on the way.
 * - `scrap` is 174's walker with the upgrade policy on: the real walk, losses end it. Besides its
 *   per-biome scrap rows it records the scrap held on arriving at each town.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { generateRegionGraph } from '../../engine/run/regionGraph';
import type { IRegionNode } from '../../engine/runTypes';
import { scrapCurve, type BiomeScrapRow } from '../../engine/run/scrapCurve';
import { eaStarters, walkRun } from './runWalker';

interface Row {
    readonly kind: 'ghost' | 'scrap';
    readonly starter: string;
    readonly seed: string;
    /** Fights before the gym, per biome (a ghost walk: every walk; a scrap walk: until it died). */
    readonly fightsByBiome: ReadonlyArray<number>;
    readonly total: number;
    readonly ghostFights: number;
    readonly wild: { won: number; played: number };
    readonly elite: { won: number; played: number };
    readonly reachedGym: boolean;
    readonly cleared: boolean;
    readonly upgrades: number;
    /** Scrap held on arriving at each town, in order (up to three). */
    readonly townScrap: ReadonlyArray<number>;
    readonly curve: ReadonlyArray<BiomeScrapRow>;
}

const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
    const at = args.indexOf(name);
    return at >= 0 && args[at + 1] !== undefined ? args[at + 1] : fallback;
};

const tally = (fights: ReadonlyArray<{ kind: string; won: boolean }>, kind: string) => ({
    played: fights.filter((f) => f.kind === kind).length,
    won: fights.filter((f) => f.kind === kind && f.won).length,
});

function townArrivals(log: { events: ReadonlyArray<{ kind: string; nodeKind?: string; scrap: number }> }): number[] {
    return log.events.filter((e) => e.kind === 'NODE_ENTERED' && e.nodeKind === 'town').map((e) => e.scrap);
}

function walkOne(kind: 'ghost' | 'scrap', starter: string, i: number, detours: boolean): Row {
    const seed = `${kind === 'ghost' ? 'ghost176' : 'scrap174'}:${starter}:${i}`;
    if (kind === 'ghost') {
        const result = walkRun({
            seed, starter, gymIndex: i % 3, upgrades: true, ghost: true, stopAtGym: true,
            ...(detours ? { takeDetours: true } : {}),
        });
        const snap = result.gymSnapshot;
        const fights = snap?.fights ?? result.fights;
        const byBiome = [0, 1, 2].map((b) => fights.filter((f) => f.biome === b).length);
        return {
            kind, starter, seed, fightsByBiome: byBiome, total: fights.length,
            ghostFights: snap?.ghostFights ?? 0, wild: tally(fights, 'wild'), elite: tally(fights, 'elite'),
            reachedGym: snap !== undefined, cleared: false, upgrades: result.upgraded.length,
            townScrap: townArrivals(snap?.log ?? result.log), curve: [],
        };
    }
    const result = walkRun({ seed, starter, gymIndex: i % 3, upgrades: true, ...(detours ? { takeDetours: true } : {}) });
    const byBiome = [0, 1, 2].map((b) => result.fights.filter((f) => f.biome === b && f.kind !== 'gym').length);
    return {
        kind, starter, seed, fightsByBiome: byBiome, total: result.fights.length, ghostFights: 0,
        wild: tally(result.fights, 'wild'), elite: tally(result.fights, 'elite'),
        reachedGym: result.fights.some((f) => f.kind === 'gym'), cleared: result.outcome === 'victory',
        upgrades: result.upgraded.length, townScrap: townArrivals(result.log), curve: scrapCurve(result.log),
    };
}

const mean = (xs: ReadonlyArray<number>): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const f1 = (x: number): string => x.toFixed(1);

function report(paths: ReadonlyArray<string>): void {
    // `--seeds K` keeps only seed numbers below K, so two row files walked to different depths are
    // compared on the seeds they share.
    const keep = Number(flag('--seeds', '1000000'));
    const rows: Row[] = paths
        .flatMap((p) => (JSON.parse(readFileSync(p, 'utf8')) as { rows: Row[] }).rows)
        .filter((r) => Number(r.seed.slice(r.seed.lastIndexOf(':') + 1)) < keep);
    const kind = rows[0]?.kind;
    console.log(`walks: ${rows.length} (${kind})`);
    const stat = (label: string, xs: number[]) =>
        console.log(`${label}: mean ${f1(mean(xs))}, min ${Math.min(...xs)}, max ${Math.max(...xs)} (n=${xs.length})`);
    for (let b = 0; b < 3; b += 1) stat(`fights biome ${b}`, rows.map((r) => r.fightsByBiome[b]));
    stat('fights before the gym', rows.map((r) => r.total));
    const rate = (key: 'wild' | 'elite') => {
        const won = rows.reduce((s, r) => s + r[key].won, 0);
        const played = rows.reduce((s, r) => s + r[key].played, 0);
        return `${key} won ${won}/${played} (${f1((100 * won) / Math.max(1, played))}%)`;
    };
    console.log(rate('wild'), '|', rate('elite'));
    console.log(`reached gym ${rows.filter((r) => r.reachedGym).length}, cleared ${rows.filter((r) => r.cleared).length}, ghost fights/walk ${f1(mean(rows.map((r) => r.ghostFights)))}, upgrades/walk ${f1(mean(rows.map((r) => r.upgrades)))}`);
    for (let t = 0; t < 3; t += 1) {
        const xs = rows.map((r) => r.townScrap[t]).filter((x): x is number => x !== undefined);
        console.log(`scrap on arriving at town ${t + 1}: mean ${f1(mean(xs))} (reached by ${xs.length})`);
    }
    for (let b = 0; b < 3; b += 1) {
        const cs = rows.map((r) => r.curve.find((c) => c.biome === b)).filter((c): c is BiomeScrapRow => c !== undefined);
        if (cs.length === 0) continue;
        const sum = (rec: Readonly<Record<string, number>>) => Object.values(rec).reduce((a, x) => a + x, 0);
        console.log(`biome ${b} scrap (reached by ${cs.length}): fights ${f1(mean(cs.map((c) => c.fights)))}, income ${f1(mean(cs.map((c) => sum(c.income))))}, spent ${f1(mean(cs.map((c) => sum(c.spent))))}, low ${f1(mean(cs.map((c) => c.lowPoint)))}, at end ${f1(mean(cs.map((c) => c.scrapAtEnd)))}`);
    }
}

/**
 * `--kind paths`: no fights are played. For each seed it counts the fight nodes on every route from
 * the start to the gym (the gym itself and the start not counted), once with every detour skipped
 * and once with every detour taken, and reports the fewest, the most and the mean over seeds. It is
 * the map's own length, with no walker and no luck in it, so it can use hundreds of seeds.
 */
function pathCounts(seeds: number): void {
    const FIGHTS = new Set(['wild', 'rival', 'elite', 'alpha', 'ambush']);
    const stats = { skipMin: [] as number[], skipMax: [] as number[], takeMin: [] as number[], takeMax: [] as number[] };
    for (let i = 0; i < seeds; i += 1) {
        const graph = generateRegionGraph(`paths176:${i}`);
        const byId = new Map(graph.nodes.map((n) => [n.id, n] as const));
        const entry = byId.get(graph.entryNodeId)!;
        // Node weight: 1 if it is a fight. The start is a wild but is never fought.
        const weight = (n: IRegionNode): number => (n.id === entry.id || !FIGHTS.has(n.kind) ? 0 : 1);
        const solve = (allowDetour: boolean, takeAll: boolean): { min: number; max: number } => {
            const memo = new Map<string, { min: number; max: number }>();
            const go = (n: IRegionNode): { min: number; max: number } => {
                const hit = memo.get(n.id);
                if (hit) return hit;
                let result: { min: number; max: number };
                if (n.kind === 'gym') result = { min: 0, max: 0 };
                else {
                    let options = n.edges.map((id) => byId.get(id)!);
                    const detours = options.filter((o) => o.detour);
                    if (!allowDetour) options = options.filter((o) => !o.detour);
                    else if (takeAll && detours.length > 0) options = detours;
                    const sub = options.map(go);
                    result = { min: Math.min(...sub.map((x) => x.min)) + weight(n), max: Math.max(...sub.map((x) => x.max)) + weight(n) };
                }
                memo.set(n.id, result);
                return result;
            };
            return go(entry);
        };
        const skip = solve(false, false);
        const take = solve(true, true);
        stats.skipMin.push(skip.min); stats.skipMax.push(skip.max); stats.takeMin.push(take.min); stats.takeMax.push(take.max);
    }
    const line = (label: string, xs: number[]) =>
        console.log(`${label}: mean ${f1(mean(xs))}, min ${Math.min(...xs)}, max ${Math.max(...xs)}`);
    console.log(`fight nodes on a route to the gym, ${seeds} seeds (events are not counted as fights)`);
    line('detours skipped, shortest route', stats.skipMin);
    line('detours skipped, longest route', stats.skipMax);
    line('every detour taken, shortest route', stats.takeMin);
    line('every detour taken, longest route', stats.takeMax);
}

const pathsAt = args.indexOf('--paths');
const reportAt = args.indexOf('--report');
if (pathsAt >= 0) {
    pathCounts(Number(flag('--paths', '500')));
} else if (reportAt >= 0) {
    report(args.slice(reportAt + 1).filter((a) => a.endsWith('.json')));
} else {
    const kind = flag('--kind', 'ghost') as 'ghost' | 'scrap';
    const detours = flag('--detours', 'false') === 'true';
    const seeds = Number(flag('--seeds', '30'));
    const from = Number(flag('--from', '0'));
    const to = Number(flag('--to', String(seeds)));
    const starters = flag('--starters', '') === '' ? eaStarters() : flag('--starters', '').split(',');
    const out = flag('--out', `map-${kind}.json`);
    // Resumable: rows already in `out` are kept and skipped, and the file is rewritten after every
    // walk, so a run that is stopped part-way (the sandbox kills long commands) loses at most one walk.
    const rows: Row[] = existsSync(out) ? (JSON.parse(readFileSync(out, 'utf8')) as { rows: Row[] }).rows : [];
    const done = new Set(rows.map((r) => r.seed));
    for (const starter of starters) {
        for (let i = from; i < to; i += 1) {
            if (done.has(`${kind === 'ghost' ? 'ghost176' : 'scrap174'}:${starter}:${i}`)) continue;
            rows.push(walkOne(kind, starter, i, detours));
            writeFileSync(out, JSON.stringify({ kind, detours, rows }));
        }
    }
    console.log(`[${kind}${detours ? '+detours' : ''}] ${rows.length} rows in ${out}`);
}
