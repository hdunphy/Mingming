/**
 * TICKET 109: the 1v1 BASELINE, without which Part 1 has nothing to indict.
 *
 * Every Part-1 question is comparative - "Poison's share of damage vs its 1v1 share", "status piles
 * vs the 1v1 census table", "actual-vs-1v1 rate per tagged mechanic". A 3v3 number alone says
 * nothing: if Poison carries 30% of damage in 3v3 that is only alarming if it carries 12% in 1v1.
 *
 * So this runs the SAME decks the comps are built from, 1v1, through the SAME counters, at the same
 * tier. Same instrument, same seeds-by-name, different width.
 *
 * env: ITER, OUT, plus the tier env the run is screening at.
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { matchupScenario } from '../src/debug/balance/balanceScenarios';
import { REFERENCE_PANEL } from '../src/debug/balance/teamComps';
import { statusCensus, statusCensusReset } from '../src/engine/statusCensus';
import { AI_TIER } from '../src/engine/ai/TacticalAI';
import fs from 'node:fs';

const ITER = Number(process.env.ITER ?? 4);
const OUT = process.env.OUT ?? '/tmp/109_base1v1.json';

// The decks the panel is made of - the like-for-like population.
const decks = [...new Set(REFERENCE_PANEL.flatMap(c => c.members.map(m => `${m[0]}|${m[1]}`)))]
    .map(s => s.split('|') as [string, string]);

interface Row {
    a: string; b: string; tier: string;
    winRate: number; turns: number; truncated: number; ftk: number; games: number;
    dot: Record<string, number>; hot: Record<string, number>; ticks: Record<string, number>;
    totalDamage: number; statusLanded: Record<string, number>;
}

const rows: Row[] = [];
const started = Date.now();
// Round robin over the 18 panel decks, skipping same-species pairs (a mirror measures a different
// thing and the 1v1 grid already covers it).
for (let i = 0; i < decks.length; i++) {
    for (let j = i + 1; j < decks.length; j++) {
        const [spA, osA] = decks[i];
        const [spB, osB] = decks[j];
        if (spA === spB) continue;
        statusCensusReset();
        const r = runPairedBatch(matchupScenario({
            player: spA, enemy: spB, playerOS: osA, enemyOS: osB, seed: `t109base:${osA}:${osB}`,
        }), { iterations: ITER, telemetry: true });
        let totalDamage = 0;
        const statusLanded: Record<string, number> = {};
        for (const run of r.pooled.runs) {
            totalDamage += (run.telemetry?.PLAYER.totalDamage ?? 0) + (run.telemetry?.ENEMY.totalDamage ?? 0);
            for (const side of ['PLAYER', 'ENEMY'] as const)
                for (const byCard of Object.values(run.telemetry?.[side].statuses ?? {}))
                    for (const [st, stacks] of Object.entries(byCard))
                        statusLanded[st] = (statusLanded[st] ?? 0) + stacks;
        }
        rows.push({
            a: osA, b: osB, tier: `${AI_TIER}/beam${process.env.AI_BEAM ?? 0}`,
            winRate: r.pooled.decisiveWinRate, turns: r.pooled.averageTurns,
            truncated: r.pooled.truncatedCount, ftk: r.pooled.ftkCount, games: r.pooled.iterations,
            dot: { ...statusCensus.dotDamage }, hot: { ...statusCensus.hotHealing },
            ticks: { ...statusCensus.ticks }, totalDamage, statusLanded,
        });
        fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
    }
}
console.error(`1v1 BASELINE: ${rows.length} pairings in ${((Date.now() - started) / 60000).toFixed(1)} min -> ${OUT}`);
