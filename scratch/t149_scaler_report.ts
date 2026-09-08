/**
 * TICKET 149 (3d companion) — the per-turn scaling attacks vs the 30-power benchmark.
 *
 * For each card: casts, casts/game, the scaler the engine read at cast (CARDS_PLAYED counts the
 * resolving card itself, so `pre.cardsPlayed + 1`; CARDS_DISCARDED and CARDS_DRAWN_TRIGGERED read the
 * turn counter as-is; STATUS_CONSUMED reads `lastStatusConsumed`), the damage per cast from the
 * action's `damageLedger` (raw = before shields and the 0 floor - the card's true output), and the
 * same as % of the TARGET's maxHp. Then the ratio to `fire_punch_v2` (patched into fenrir_v2 in place
 * of water_slap, `--swap`) and to `baseline_strike` (control_v1, no firmware, no STAB) against the
 * ratio of the shipped powerscale scores, ranked by |divergence|.
 *
 * Run: npx vite-node scratch/t149_scaler_report.ts
 */
import fs from 'node:fs';
import { calculatePowerscale, budgetBandFor } from '../src/debug/balance/powerscale';
import { GetProgramData } from '../src/engine/data/programRegistry';
import { numericBaseCost } from '../src/engine/types';

interface Cast { card: string; turn: number; pre: Record<string, number>; post: Record<string, number> }
interface Game { owner: string; turns: number; ownerMaxHp: number; casts: Cast[] }
const load = (f: string): Game[] => fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];

const SUBJECTS: Array<{ card: string; file: string; scaler: (c: Cast) => number; scalerName: string }> = [
    { card: 'fire_punch_v2', file: 'results/t149_oscensus/w1_fenrir_v2_firepunch.jsonl', scaler: () => 1, scalerName: '-' },
    { card: 'baseline_strike', file: 'results/t149_oscensus/w1_control_v1.jsonl', scaler: () => 1, scalerName: '-' },
    { card: 'starfall', file: 'results/t149_consume/w1_valkyrie_v2.jsonl', scaler: c => c.pre.nonNaturalDrawn, scalerName: 'CARDS_DRAWN_TRIGGERED (const 1.25)' },
    { card: 'stampede', file: 'results/t149_oscensus/w1_sleipnir_v1.jsonl', scaler: c => c.pre.cardsPlayed + 1, scalerName: 'CARDS_PLAYED (const 2.5)' },
    { card: 'stampede', file: 'results/t149_oscensus/w1_sleipnir_v2.jsonl', scaler: c => c.pre.cardsPlayed + 1, scalerName: 'CARDS_PLAYED (const 2.5)' },
    { card: 'serpents_coil', file: 'results/t149_consume/w1_jormungandr_v1.jsonl', scaler: c => c.pre.cardsPlayed + 1, scalerName: 'CARDS_PLAYED (const 2.5)' },
    { card: 'carrion_swoop', file: 'results/t149_consume/w1_hraesvelgr_v1.jsonl', scaler: c => c.pre.discarded, scalerName: 'CARDS_DISCARDED (NO scorer branch: priced at printed 11)' },
    { card: 'carrion_swoop', file: 'results/t149_oscensus/w1_sleipnir_v2.jsonl', scaler: c => c.pre.discarded, scalerName: 'CARDS_DISCARDED (NO scorer branch: priced at printed 11)' },
    { card: 'momentum_crash', file: 'results/t149_oscensus/w1_sleipnir_v1.jsonl', scaler: c => c.post.consumed, scalerName: 'STATUS_CONSUMED Strengthened (const 8)' },
];

const mean = (xs: number[]): number => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
const f1 = (x: number): string => Number.isFinite(x) ? x.toFixed(1) : '-';
const f2 = (x: number): string => Number.isFinite(x) ? x.toFixed(2) : '-';

interface Out { card: string; owner: string; games: number; casts: number; perGame: number; scaler: number; scalerName: string; raw: number; pct: number; applied: number; score: number; band: number; zeroShare: number }
const outs: Out[] = [];
for (const s of SUBJECTS) {
    const games = load(s.file);
    if (!games.length) { console.error(`(missing ${s.file})`); continue; }
    const casts = games.flatMap(g => g.casts.filter(c => c.card === s.card));
    const data = GetProgramData(s.card);
    outs.push({
        card: s.card, owner: games[0].owner, games: games.length, casts: casts.length, perGame: casts.length / games.length,
        scaler: mean(casts.map(s.scaler)), scalerName: s.scalerName,
        raw: mean(casts.map(c => c.post.ledgerRaw)), applied: mean(casts.map(c => c.post.ledgerApplied)),
        pct: mean(casts.map(c => 100 * c.post.ledgerRaw / Math.max(1, c.pre.tgtMaxHp))),
        score: calculatePowerscale(data).score, band: budgetBandFor(numericBaseCost(data.baseCost)).over,
        zeroShare: casts.length ? casts.filter(c => c.post.ledgerRaw === 0).length / casts.length : NaN,
    });
}
const bench = outs.find(o => o.card === 'fire_punch_v2');
const bench2 = outs.find(o => o.card === 'baseline_strike');
console.log('| card | owner deck | games | casts | casts/game | scaler read at cast (mean) | dmg raw / cast (HP) | % target maxHp / cast | 0-dmg casts | shipped score (band) | dmg ratio vs fire_punch_v2 | score ratio vs fire_punch_v2 | divergence (dmg/score ratio) | dmg ratio vs baseline_strike |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const ranked = outs.map(o => {
    const dr = bench ? o.pct / bench.pct : NaN; const sr = bench ? o.score / bench.score : NaN;
    return { o, dr, sr, div: dr / sr, dr2: bench2 ? o.pct / bench2.pct : NaN };
}).sort((a, b) => Math.abs(Math.log(b.div)) - Math.abs(Math.log(a.div)));
for (const { o, dr, sr, div, dr2 } of ranked) {
    console.log(`| ${o.card} | ${o.owner} | ${o.games} | ${o.casts} | ${f2(o.perGame)} | ${f2(o.scaler)} ${o.scalerName} | ${f1(o.raw)} (applied ${f1(o.applied)}) | ${f2(o.pct)}% | ${(100 * o.zeroShare).toFixed(0)}% | ${o.score} (${o.band}) | ${f2(dr)} | ${f2(sr)} | ${f2(div)} | ${f2(dr2)} |`);
}
console.log('\nMethod: damage is the action\'s damageLedger raw sum (all hits of the cast, before shields and the 0 floor); the 30-power benchmark is fire_punch_v2 swapped in-memory for water_slap in fenrir_v2 (Fire STAB, CINDER_WALL Sharp) and baseline_strike on the control frame (no STAB, no firmware). Divergence = (measured damage ratio) / (scorer score ratio); 1.00 = the scorer prices the card exactly as it delivers relative to the benchmark.');
