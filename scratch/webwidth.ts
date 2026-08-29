/**
 * WEB-WIDTH PROBE — does the archetype-web inversion come from BODY COUNT or from TYPE DILUTION?
 *
 * Ticket 109 found `panel-zoo` beating `panel-control` 100% at 3v3 when research/archetype-web.md
 * says control is zoo's designated predator, and proposed a mechanism: zoo's plan scales with bodies
 * while control's single-target answers divide among them. That mechanism is UNCONFIRMED, and the
 * existing 960-cell 1v1 grid already argues for a different one:
 *
 *   ZOO vs CONTROL, all cells        zoo wins 38.0%   (n=21) — the web's claim holds
 *   ZOO vs CONTROL, NEUTRAL only     zoo wins 59.4%   (n=3)  — the leg REVERSES without the type chart
 *
 * So at 1v1 "control preys on zoo" is carried by elemental advantage, not by role. At 3v3 both sides
 * field three elements at once, so type advantage largely cancels and the matchup reverts toward the
 * neutral matrix — where zoo already wins. If that is the whole story, no entity-count mechanism is
 * needed and ticket 72's `riptide_daemon` is aimed at the wrong thing.
 *
 * THIS PROBE holds the deck population FIXED and varies only how many of them are on the field at
 * once, so body count is the single moving part:
 *
 *   WIDTH=1   3 x 3 = 9 pairings   (each zoo deck vs each control deck)
 *   WIDTH=2   3 x 3 = 9 pairings   (each 2-subset vs each 2-subset)
 *   WIDTH=3   1 x 1 = 1 pairing    (the full panel comps)
 *
 * INSTRUMENT RULES
 *   - The AI tier must be IDENTICAL at every width. Beam and lite bias with branching, and branching
 *     is itself a function of width (~6 candidates at 1v1, ~20 at 3v3), so mixing tiers across widths
 *     would confound the very thing being measured. Set the tier once for a whole probe run.
 *   - 0-AI-SIM-COUNTS: everything reported here comes from `RunTelemetry` (real plays only) or from
 *     `statusCensus`, which is already gated on `globalBattleEventBus.isLive`.
 *   - Resumable: rows are keyed and re-read from OUT on start, because the sandbox gets reclaimed.
 *
 * env:
 *   WIDTH=1|2|3        bodies per side (default 1)
 *   ITER=<n>           iterations per pairing; both orders run, so games = 2 x ITER
 *   SEEDBASE=<label>   seed-base label; change it to get an independent sample of the same cells
 *   OUT=<path>         JSON results (resumed if present)
 */
import { runPairedBatch, type RunTelemetry } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { statusCensus, statusCensusReset } from '../src/engine/statusCensus';
import { AI_TIER } from '../src/engine/ai/TacticalAI';
import fs from 'node:fs';
import { ENV } from './_env';

type Member = readonly [string, string];

/** The zoo role in full - it has exactly three decks, so this is the role, not a sample of it. */
const ZOO: readonly Member[] = [
    ['jormungandr', 'jormungandr_v1'],
    ['sleipnir', 'sleipnir_v1'],
    ['hraesvelgr', 'hraesvelgr_v1'],
];
/** `panel-control`: the designated zoo-killer plus the two debuff decks that beat it at 1v1. */
const CTL: readonly Member[] = [
    ['kraken', 'kraken_v1'],
    ['huldra', 'huldra_v1'],
    ['draugr', 'draugr_v2'],
];

const WIDTH = Number(ENV.WIDTH ?? 1);
const ITER = Number(ENV.ITER ?? 5);
const SEEDBASE = ENV.SEEDBASE ?? 'A';
const OUT = ENV.OUT ?? `/tmp/webwidth_w${WIDTH}_${SEEDBASE}.json`;

/** Ordered k-subsets of a list, order preserved - keeps a pairing id stable and readable. */
function subsets<T>(xs: readonly T[], k: number): T[][] {
    if (k === 0) return [[]];
    if (k > xs.length) return [];
    const [head, ...rest] = xs;
    return [...subsets(rest, k - 1).map(s => [head, ...s]), ...subsets(rest, k)];
}

interface Row {
    width: number; seedBase: string; tier: string;
    zoo: string; ctl: string;
    /** ZOO's win rate over decided games. */
    winRate: number;
    games: number; turns: number; truncated: number; ftk: number;
    deadZoo: number; deadCtl: number; firstMoverEdge: number;
    /** Total HP removed by both sides - the denominator for any share. */
    totalDamage: number;
    /** Stacks that actually LANDED, pooled over both sides. Control's answers are debuff stacks, so
     *  this is the direct fingerprint of the answers-divide hypothesis: per ENEMY BODY it should
     *  fall as width rises if a fixed debuff budget is being spread over more attackers. */
    statusLanded: Record<string, number>;
    dot: Record<string, number>;
    ticks: Record<string, number>;
}

const key = (r: { width: number; zoo: string; ctl: string }) => `${r.width}|${r.zoo}|${r.ctl}`;

const sumStatuses = (t?: RunTelemetry): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const side of ['PLAYER', 'ENEMY'] as const)
        for (const byCard of Object.values(t?.[side].statuses ?? {}))
            for (const [status, stacks] of Object.entries(byCard))
                out[status] = (out[status] ?? 0) + stacks;
    return out;
};

function pairing(zoo: Member[], ctl: Member[]): Row {
    const zooId = zoo.map(m => m[1]).join('+');
    const ctlId = ctl.map(m => m[1]).join('+');
    statusCensusReset();
    const r = runPairedBatch(teamScenario({
        player: zoo, enemy: ctl,
        seed: `webwidth:${SEEDBASE}:w${WIDTH}:${zooId}:${ctlId}`,
    }), { iterations: ITER, telemetry: true });

    let totalDamage = 0;
    const statusLanded: Record<string, number> = {};
    for (const run of r.pooled.runs) {
        totalDamage += (run.telemetry?.PLAYER.totalDamage ?? 0) + (run.telemetry?.ENEMY.totalDamage ?? 0);
        for (const [k, v] of Object.entries(sumStatuses(run.telemetry)))
            statusLanded[k] = (statusLanded[k] ?? 0) + v;
    }
    return {
        width: WIDTH, seedBase: SEEDBASE, tier: `${AI_TIER}/beam${ENV.AI_BEAM ?? 0}`,
        zoo: zooId, ctl: ctlId,
        winRate: r.pooled.decisiveWinRate, games: r.pooled.iterations,
        turns: r.pooled.averageTurns, truncated: r.pooled.truncatedCount, ftk: r.pooled.ftkCount,
        deadZoo: r.pooled.deadCardRatio, deadCtl: r.pooled.enemyDeadCardRatio,
        firstMoverEdge: r.firstMoverEdge,
        totalDamage, statusLanded,
        dot: { ...statusCensus.dotDamage }, ticks: { ...statusCensus.ticks },
    };
}

const rows: Row[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const done = new Set(rows.map(key));

const pairs: Array<[Member[], Member[]]> = [];
for (const z of subsets(ZOO, WIDTH))
    for (const c of subsets(CTL, WIDTH))
        pairs.push([z, c]);

const todo = pairs.filter(([z, c]) =>
    !done.has(key({ width: WIDTH, zoo: z.map(m => m[1]).join('+'), ctl: c.map(m => m[1]).join('+') })));

console.error(`WIDTH=${WIDTH} SEEDBASE=${SEEDBASE} tier=${AI_TIER}/beam${ENV.AI_BEAM ?? 0} ` +
    `ITER=${ITER} (games=${2 * ITER}/pairing)  pairings ${todo.length} to run, ${done.size} already done`);

const started = Date.now();
for (const [z, c] of todo) {
    const row = pairing(z, c);
    rows.push(row);
    fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
    const el = (Date.now() - started) / 1000;
    console.error(`[${rows.length}/${pairs.length}] ${el.toFixed(0)}s  ${row.zoo} vs ${row.ctl}  ` +
        `ZOO win ${(row.winRate * 100).toFixed(1)}%  turns ${row.turns.toFixed(1)}  ` +
        `trunc ${row.truncated}  ftk ${row.ftk}`);
}
const decided = rows.filter(r => r.width === WIDTH);
const mean = decided.reduce((a, r) => a + r.winRate, 0) / (decided.length || 1);
console.error(`\nDONE width ${WIDTH}: ZOO mean ${(mean * 100).toFixed(1)}% over ${decided.length} pairings -> ${OUT}`);
