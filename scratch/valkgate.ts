/**
 * TICKET 113 SHIP GATE — full field rows for BOTH valkyrie decks, before and after.
 *
 * The change, ruled by Henry 2026-08-22: **`ascension` drops `exhaust`; its 50 power is KEPT.**
 * Scores 6.5 against a 2e band of 5.2-6.5 - at the ceiling, in band.
 *
 * Why both decks and full rows: `ascension` is in `valkyrie_v1` AND `valkyrie_v2`, so this is a
 * shared-card change (`0-DECK-NOT-CARD`). The five-opponent sweep that chose the arm put v2 flat and
 * v1 up ~16 points, but five opponents is a sample of a 30-cell row, deliberately weighted to her
 * extremes. This measures every cell.
 *
 * BEFORE is produced by restoring `exhaust: true` in memory, so both arms run against the same
 * binary, same seeds, same everything - the only difference is the one field. `ProgramRegistry` is
 * the mutable source; `GetProgramData` inflates a fresh copy per call and would discard the mutation.
 *
 * Resumable by (arm, base, deck, opponent) - the sandbox has already eaten one long run.
 *
 * env: ITER=<n>  BASE=<label>  ARMS=BEFORE,AFTER  OUT=<path>
 * Run: ITER=30 BASE=A AI_BEAM=8 npx vite-node scratch/valkgate.ts
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import { globalBattleEventBus } from '../src/engine/events';
import fs from 'node:fs';
import { ENV } from './_env';

interface GridCell { deck: string; opponent: string; opponentSpecies: string; winRate: number; decisive: number; games: number }
const grid: { cells: GridCell[] } = JSON.parse(fs.readFileSync('docs/balance/deck_grid.json', 'utf8'));

const SUBJECTS = ['valkyrie_v1', 'valkyrie_v2'];
const ITER = Number(ENV.ITER ?? 30);
const BASE = ENV.BASE ?? 'A';
const ARMS = (ENV.ARMS ?? 'BEFORE,AFTER').split(',').filter(Boolean);
const OUT = ENV.OUT ?? '/root/probe/valkgate.json';

/** The shipped state is now exhaust-less; BEFORE puts it back for the control arm. */
function setExhaust(on: boolean): void {
    const c = ProgramRegistry['ascension'] as unknown as Record<string, unknown>;
    if (on) c.exhaust = true; else delete c.exhaust;
    if (Boolean((ProgramRegistry['ascension'] as unknown as Record<string, unknown>).exhaust) !== on) {
        throw new Error('ARM DID NOT TAKE: ascension exhaust flag did not change');
    }
}

let maxStreak = 0, streak = 0, last = '';
globalBattleEventBus.subscribe(e => {
    if (!globalBattleEventBus.isLive) return;          // 0-AI-SIM-COUNTS
    if (e.type === 'TURN_START') { streak = 0; last = ''; return; }
    if (e.type !== 'PROGRAM_PLAYED') return;
    const id = (e as { programId?: string; dataId?: string }).programId
        ?? (e as { dataId?: string }).dataId ?? '';
    if (id === 'glimmer') { streak = last === 'glimmer' ? streak + 1 : 1; maxStreak = Math.max(maxStreak, streak); }
    last = id;
});

interface Row {
    arm: string; base: string; deck: string; opponent: string;
    winRate: number; decided: number; games: number; turns: number; ftk: number; maxStreak: number;
}

const rows: Row[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const done = new Set(rows.map(r => `${r.arm}|${r.base}|${r.deck}|${r.opponent}`));

try {
    for (const arm of ARMS) {
        setExhaust(arm === 'BEFORE');
        for (const deck of SUBJECTS) {
            const cells = grid.cells.filter(c => c.deck === deck);
            for (const c of cells) {
                const key = `${arm}|${BASE}|${deck}|${c.opponent}`;
                if (done.has(key)) continue;
                maxStreak = 0; streak = 0; last = '';
                const r = runPairedBatch(teamScenario({
                    player: [['valkyrie', deck]], enemy: [[c.opponentSpecies, c.opponent]],
                    seed: `valkgate:${BASE}:${deck}:${c.opponent}`,
                }), { iterations: ITER });
                rows.push({
                    arm, base: BASE, deck, opponent: c.opponent,
                    winRate: r.pooled.decisiveWinRate,
                    decided: r.pooled.iterations - r.pooled.truncatedCount,
                    games: r.pooled.iterations, turns: +r.pooled.averageTurns.toFixed(2),
                    ftk: r.pooled.ftkCount, maxStreak,
                });
                fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
            }
            const rs = rows.filter(r => r.arm === arm && r.base === BASE && r.deck === deck);
            console.error(`${arm.padEnd(7)} base ${BASE}  ${deck.padEnd(12)} ` +
                `field ${(rs.reduce((a, r) => a + r.winRate, 0) / rs.length * 100).toFixed(1)}%  ` +
                `cells ${rs.length}  zero-cells ${rs.filter(r => r.winRate === 0).length}  ` +
                `hundred-cells ${rs.filter(r => r.winRate === 1).length}  ` +
                `undecided ${rs.reduce((a, r) => a + (r.games - r.decided), 0)}  ` +
                `FTK ${rs.reduce((a, r) => a + r.ftk, 0)}  maxStreak ${Math.max(...rs.map(r => r.maxStreak))}`);
        }
    }
} finally {
    setExhaust(false);   // leave the registry in the SHIPPED (post-change) state
}

console.error('\n=== 8-DIFF: which cells moved, and by how much ===');
for (const deck of SUBJECTS) {
    const b = rows.filter(r => r.arm === 'BEFORE' && r.deck === deck && r.base === BASE);
    const a = rows.filter(r => r.arm === 'AFTER' && r.deck === deck && r.base === BASE);
    if (!b.length || !a.length) continue;
    const moved = a.map(x => {
        const y = b.find(z => z.opponent === x.opponent);
        return y ? { opp: x.opponent, d: (x.winRate - y.winRate) * 100 } : null;
    }).filter((x): x is { opp: string; d: number } => !!x && Math.abs(x.d) >= 5)
        .sort((p, q) => Math.abs(q.d) - Math.abs(p.d));
    const bf = b.reduce((s, r) => s + r.winRate, 0) / b.length * 100;
    const af = a.reduce((s, r) => s + r.winRate, 0) / a.length * 100;
    console.error(`\n  ${deck}: field ${bf.toFixed(1)}% -> ${af.toFixed(1)}%  (${af - bf >= 0 ? '+' : ''}${(af - bf).toFixed(1)})`);
    console.error(`  cells moving 5+ points: ${moved.length} of ${a.length}`);
    for (const m of moved.slice(0, 12)) console.error(`     ${m.opp.padEnd(18)} ${m.d >= 0 ? '+' : ''}${m.d.toFixed(1)}`);
}
console.error(`\n-> ${OUT}`);
