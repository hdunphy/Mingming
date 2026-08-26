/**
 * TICKET 110 follow-up A — with duplicates legal, is `panel-zoo` still the worst case?
 *
 * Henry ruled on 2026-08-21 that a comp may field the same species more than once and that the copy
 * cap is gone. `src/debug/balance/teamComps.ts` construction rule 1 ("one member per SPECIES") is
 * therefore void, and every claim resting on it needs re-reading - including ticket 109's "twenty-five
 * purpose-built stress comps could not beat zoo", because none of the twenty-five could stack a
 * species and a mono-element comp was structurally unreachable (two species per element).
 *
 * TWO QUESTIONS, ONE RUN:
 *
 *  1. STRESS CEILING. Is a stacked comp stronger than `panel-zoo`? Stacking triples one deck's
 *     payoff card count in the shared pile, which is exactly the thing the copy cap used to prevent.
 *
 *  2. THE TYPE-DILUTION RESIDUAL. Ticket 110 ruled out type dilution as the mechanism behind the web
 *     inversion, but the reasoning left one gap: at 3v3 both sides field three elements, so nobody
 *     can hold an elemental advantage across the board - and with duplicates that becomes testable
 *     for the first time. `huldra_v1` beats all three zoo decks at 1v1 (3.3 / 5.0 / 3.3%) on type.
 *     A triple-huldra comp is the ONLY way to keep that advantage at width. If it beats `panel-zoo`,
 *     the web is intact-but-type-gated after all; if it loses, the answers-divide finding stands
 *     against the strongest possible counter-example.
 *
 * Opponents: `panel-zoo` (the current champion) and `panel-control` (its designated predator, which
 * loses to it 88.3%). Report-only - nothing here touches the registry.
 *
 * env: ITER=<n>  ONLY=<comp,..>  OUT=<path>
 * Run: ITER=30 AI_LITE=1 AI_BEAM=8 npx vite-node scratch/dupcomps.ts
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { AI_TIER } from '../src/engine/ai/TacticalAI';
import fs from 'node:fs';

type Member = readonly [string, string];
const m = (sp: string, os: string): Member => [sp, os];

interface Comp { id: string; members: Member[]; intent: string }

const SUBJECTS: Comp[] = [
    {
        id: 'triple-huldra',
        members: [m('huldra', 'huldra_v1'), m('huldra', 'huldra_v1'), m('huldra', 'huldra_v1')],
        intent: 'THE type-dilution test: the only comp that keeps an elemental advantage against all three zoo decks at width.',
    },
    {
        id: 'huldra-wall-mixed',
        members: [m('huldra', 'huldra_v1'), m('huldra', 'huldra_v1'), m('huldra', 'huldra_v2')],
        intent: 'The same wall with the BarkShield variant, in case v1 x3 starves on a shared pile of one deck.',
    },
    {
        id: 'triple-jormungandr',
        members: [m('jormungandr', 'jormungandr_v1'), m('jormungandr', 'jormungandr_v1'), m('jormungandr', 'jormungandr_v1')],
        intent: 'Max zoo: triples OUROBOROS and the ink_stream scaler in one shared pile.',
    },
    {
        id: 'triple-sleipnir',
        members: [m('sleipnir', 'sleipnir_v1'), m('sleipnir', 'sleipnir_v1'), m('sleipnir', 'sleipnir_v1')],
        intent: 'Three MOMENTUM_DRIVE mints on a shared pile of 0-cost cards - the mint is owner-scoped, so this is the only way to triple it.',
    },
    {
        id: 'triple-ymir',
        members: [m('ymir', 'ymir_v1'), m('ymir', 'ymir_v1'), m('ymir', 'ymir_v1')],
        intent: 'Stack the deck that was the strongest on the roster (77.1% at its peak) rather than the most synergistic.',
    },
    {
        id: 'triple-hel',
        members: [m('hel', 'hel_v2'), m('hel', 'hel_v2'), m('hel', 'hel_v2')],
        intent: 'Three UNDERWORLD_GATEWAYs: HP-priced casting, three HP pools to pay from.',
    },
];

const OPPONENTS: Comp[] = [
    {
        id: 'panel-zoo',
        members: [m('jormungandr', 'jormungandr_v1'), m('sleipnir', 'sleipnir_v1'), m('hraesvelgr', 'hraesvelgr_v1')],
        intent: 'The current champion - 88.3% against panel-control, beamless.',
    },
    {
        id: 'panel-control',
        members: [m('kraken', 'kraken_v1'), m('huldra', 'huldra_v1'), m('draugr', 'draugr_v2')],
        intent: 'Zoo\'s designated predator, which loses to it.',
    },
];

const ITER = Number(process.env.ITER ?? 30);
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
const OUT = process.env.OUT ?? '/root/probe/dupcomps.json';

interface Row {
    subject: string; opponent: string; tier: string;
    subjectWin: number; games: number; turns: number; truncated: number; ftk: number;
    firstMoverEdge: number; intent: string;
}

const rows: Row[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const done = new Set(rows.map(r => `${r.subject}|${r.opponent}`));

for (const s of SUBJECTS) {
    if (ONLY.length && !ONLY.includes(s.id)) continue;
    for (const o of OPPONENTS) {
        if (done.has(`${s.id}|${o.id}`)) continue;
        const r = runPairedBatch(teamScenario({
            player: s.members, enemy: o.members, seed: `dupcomps:${s.id}:${o.id}`,
        }), { iterations: ITER });
        const row: Row = {
            subject: s.id, opponent: o.id, tier: `${AI_TIER}/beam${process.env.AI_BEAM ?? 0}`,
            subjectWin: r.pooled.decisiveWinRate, games: r.pooled.iterations,
            turns: +r.pooled.averageTurns.toFixed(2), truncated: r.pooled.truncatedCount,
            ftk: r.pooled.ftkCount, firstMoverEdge: +r.firstMoverEdge.toFixed(3), intent: s.intent,
        };
        rows.push(row);
        fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
        console.error(`${s.id.padEnd(20)} vs ${o.id.padEnd(14)} ` +
            `win ${(row.subjectWin * 100).toFixed(1)}%  turns ${row.turns}  ` +
            `trunc ${row.truncated}  ftk ${row.ftk}`);
    }
}

console.error('\n=== the two questions ===');
const vsZoo = rows.filter(r => r.opponent === 'panel-zoo').sort((a, b) => b.subjectWin - a.subjectWin);
console.error('  1. STRESS CEILING - anything above 50% here beats the current champion:');
for (const r of vsZoo) console.error(`     ${r.subject.padEnd(20)} ${(r.subjectWin * 100).toFixed(1)}%`);
const th = rows.find(r => r.subject === 'triple-huldra' && r.opponent === 'panel-zoo');
if (th) {
    console.error(`\n  2. TYPE-DILUTION RESIDUAL - triple-huldra vs panel-zoo: ${(th.subjectWin * 100).toFixed(1)}%`);
    console.error(th.subjectWin > 0.5
        ? '     Above 50%: an elemental advantage held across three bodies DOES beat zoo.'
        : '     At or below 50%: even a full type advantage at width does not beat zoo - the'
        + '\n     answers-divide finding survives its strongest counter-example.');
}
console.error(`\n-> ${OUT}`);
