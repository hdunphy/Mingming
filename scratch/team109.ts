/**
 * TICKET 109: the measurement harness for both parts.
 *
 * One harness, because Part 1 and Part 2 ask for the same numbers off different pairing lists -
 * Part 1 is the panel against itself, Part 2 is each canary comp against the panel.
 *
 * INSTRUMENT RULES, per the ticket:
 *   - Screening runs set `AI_BEAM=8 AI_LITE=1` **per run, never globally**, so this file reads them
 *     from the environment and reports which tier produced the numbers. Anything destined for the
 *     report is re-run beamless at full lookahead by `--confirm`.
 *   - **0-AI-SIM-COUNTS**: every counter here is either read from `RunTelemetry` (real plays only)
 *     or guarded on `globalBattleEventBus.isLive`, which is false throughout the AI's search. The
 *     reshuffle counter is a plain bus subscriber for exactly that reason.
 *
 * env:
 *   MODE=panel|canary   which pairing list (default panel)
 *   ITER=<n>            iterations per pairing; each runs BOTH orders, so games = 2 x ITER
 *   ONLY=<id,id>        restrict to these comp ids (used by the beamless confirm pass)
 *   OUT=<path>          JSON results
 */
import { runPairedBatch, type RunTelemetry } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { REFERENCE_PANEL, CANARY_COMPS, type Comp } from '../src/debug/balance/teamComps';
import { statusCensus, statusCensusReset } from '../src/engine/statusCensus';
import { globalBattleEventBus } from '../src/engine/events';
import { AI_TIER } from '../src/engine/ai/TacticalAI';
import fs from 'node:fs';
import { ENV } from './_env';

const MODE = ENV.MODE ?? 'panel';
const ITER = Number(ENV.ITER ?? 2);
const ONLY = (ENV.ONLY ?? '').split(',').filter(Boolean);
const OUT = ENV.OUT ?? `/tmp/109_${MODE}.json`;

// Reshuffles ride the bus, which the AI mutes - so a plain subscriber is already sim-clean.
let reshuffles = 0;
globalBattleEventBus.subscribe(e => { if (e.type === 'DECK_SHUFFLED') reshuffles++; });

interface Row {
    a: string; b: string; tier: string;
    winRate: number; turns: number; truncated: number; ftk: number;
    deadA: number; deadB: number; firstMoverEdge: number;
    games: number;
    /** HP removed by each status's end-of-turn tick, both sides pooled. */
    dot: Record<string, number>;
    hot: Record<string, number>;
    ticks: Record<string, number>;
    /** Every point of HP each side removed, however it got there - the share denominator. */
    totalDamage: number;
    /** Stacks of each status that actually LANDED, by the card that applied them. */
    statusLanded: Record<string, number>;
    reshuffles: number;
}

const sumStatuses = (t?: RunTelemetry): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const side of ['PLAYER', 'ENEMY'] as const)
        for (const byCard of Object.values(t?.[side].statuses ?? {}))
            for (const [status, stacks] of Object.entries(byCard))
                out[status] = (out[status] ?? 0) + stacks;
    return out;
};

function pairing(a: Comp, b: Comp): Row {
    statusCensusReset();
    reshuffles = 0;
    const r = runPairedBatch(teamScenario({
        player: a.members, enemy: b.members,
        playerExtras: a.extras, enemyExtras: b.extras,
        seed: `t109:${a.id}:${b.id}`,
    }), { iterations: ITER, telemetry: true });

    // Telemetry lives per-run; pool it across both orientations.
    let totalDamage = 0;
    const statusLanded: Record<string, number> = {};
    for (const run of r.pooled.runs) {
        totalDamage += (run.telemetry?.PLAYER.totalDamage ?? 0) + (run.telemetry?.ENEMY.totalDamage ?? 0);
        for (const [k, v] of Object.entries(sumStatuses(run.telemetry)))
            statusLanded[k] = (statusLanded[k] ?? 0) + v;
    }
    return {
        a: a.id, b: b.id, tier: `${AI_TIER}/beam${ENV.AI_BEAM ?? 0}`,
        winRate: r.pooled.decisiveWinRate, turns: r.pooled.averageTurns,
        truncated: r.pooled.truncatedCount, ftk: r.pooled.ftkCount,
        deadA: r.pooled.deadCardRatio, deadB: r.pooled.enemyDeadCardRatio,
        firstMoverEdge: r.firstMoverEdge, games: r.pooled.iterations,
        dot: { ...statusCensus.dotDamage }, hot: { ...statusCensus.hotHealing },
        ticks: { ...statusCensus.ticks },
        totalDamage, statusLanded, reshuffles,
    };
}

const pairs: Array<[Comp, Comp]> = [];
if (MODE === 'panel') {
    // Round robin, each unordered pair once - runPairedBatch already plays both orders.
    for (let i = 0; i < REFERENCE_PANEL.length; i++)
        for (let j = i + 1; j < REFERENCE_PANEL.length; j++) {
            // ONLY restricts the round robin to pairings involving a named comp - that is what the
            // beamless confirm pass needs, since confirming one flagged comp does not require
            // re-running the 14 pairings it is not in.
            const [x, y] = [REFERENCE_PANEL[i], REFERENCE_PANEL[j]];
            if (ONLY.length && !ONLY.includes(x.id) && !ONLY.includes(y.id)) continue;
            pairs.push([x, y]);
        }
} else {
    for (const c of CANARY_COMPS) {
        if (ONLY.length && !ONLY.includes(c.id)) continue;
        for (const p of REFERENCE_PANEL) pairs.push([c, p]);
    }
}

const rows: Row[] = [];
const started = Date.now();
for (const [a, b] of pairs) {
    const row = pairing(a, b);
    rows.push(row);
    const el = (Date.now() - started) / 1000;
    console.error(`[${rows.length}/${pairs.length}] ${el.toFixed(0)}s  ${a.id} vs ${b.id}  ` +
        `win ${(row.winRate * 100).toFixed(1)}%  turns ${row.turns.toFixed(1)}  ` +
        `trunc ${row.truncated}  ftk ${row.ftk}`);
    fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
}
console.error(`\nDONE ${rows.length} pairings in ${((Date.now() - started) / 60000).toFixed(1)} min -> ${OUT}`);
