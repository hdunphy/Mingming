/**
 * TICKET 113 — does the glimmer loop HELP valkyrie_v2 or COST her?
 *
 * Henry's question, and a fair one: *"how does fixing this loop problem make her stronger? I imagine
 * the loop lets her do extra damage."* There is a real reason to think so - `starfall` reads
 * **"18 power for each card a card, OS or daemon drew you this turn"**, so a turn that draws 250
 * cards should in principle produce an enormous starfall.
 *
 * TWO ARMS on the cell where the loop actually fires, same seeds, same decks:
 *
 *   SHIPPED  as it is today.
 *   NOLOOP   `glimmer` given `exhaust: true` in memory. It still draws - the card keeps its value -
 *            but it leaves circulation instead of returning to the discard, so it cannot reshuffle
 *            into its own draw. This is the closest in-memory stand-in for ticket 111's Fix B on this
 *            deck, and it deliberately does NOT just delete the card, which would understate her.
 *
 * THE METRIC THAT MATTERS is the win rate over ALL games, not over decided ones. An undecided game is
 * not a win, and the committed grid records this cell as 17 decided of 60 - so a win rate quoted over
 * the 17 hides what the other 43 cost her. Both are reported.
 *
 * Also reported: damage per game and `starfall`'s share of it, which is what settles whether the loop
 * is a damage engine or just a turn that never ends.
 *
 * env: ITER=<n>  OUT=<path>
 * Run: ITER=30 AI_BEAM=8 npx vite-node scratch/valkcounter.ts
 */
import { runPairedBatch, type RunTelemetry } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { ProgramRegistry } from '../src/engine/data/programRegistry';
import { globalBattleEventBus } from '../src/engine/events';
import fs from 'node:fs';

const ITER = Number(process.env.ITER ?? 30);
const OUT = process.env.OUT ?? '/root/probe/valkcounter.json';

let glimmerPlays = 0, maxStreak = 0, streak = 0, last = '';
globalBattleEventBus.subscribe(e => {
    if (!globalBattleEventBus.isLive) return;            // 0-AI-SIM-COUNTS
    if (e.type === 'TURN_START') { streak = 0; last = ''; return; }
    if (e.type !== 'PROGRAM_PLAYED') return;
    const id = (e as { programId?: string; dataId?: string }).programId
        ?? (e as { dataId?: string }).dataId ?? '';
    if (id === 'glimmer') {
        glimmerPlays++;
        streak = last === 'glimmer' ? streak + 1 : 1;
        maxStreak = Math.max(maxStreak, streak);
    }
    last = id;
});

/**
 * `GetProgramData` returns a FRESH INFLATED COPY on every call (`{...rawData, ...}`), so mutating
 * what it returns is discarded silently - the arm then reads byte-identical to its control, which is
 * the `isAttack` / `baseCost` dead-schema family the HANDOFF warns about. `ProgramRegistry` is the
 * mutable source of truth.
 */
function setExhaust(on: boolean): void {
    (ProgramRegistry['glimmer'] as unknown as Record<string, unknown>).exhaust = on;
}

interface Row {
    arm: string; games: number; decided: number;
    winOverDecided: number; winOverAllGames: number;
    turns: number; truncated: number;
    glimmerPlaysPerGame: number; maxStreak: number;
    damagePerGame: number; starfallPerGame: number; starfallShare: number;
}

function run(arm: 'SHIPPED' | 'NOLOOP'): Row {
    glimmerPlays = 0; maxStreak = 0; streak = 0; last = '';
    if (arm === 'NOLOOP') setExhaust(true);
    try {
        const r = runPairedBatch(teamScenario({
            player: [['valkyrie', 'valkyrie_v2']],
            enemy: [['huldra', 'huldra_v1']],
            seed: 'valkcounter',
        }), { iterations: ITER, telemetry: true });

        const games = r.pooled.iterations;
        const decided = games - r.pooled.truncatedCount;
        // decisiveWinRate is over DECIDED games; an undecided game is not a win, so the honest
        // per-game figure re-bases it over every game played.
        const winDecided = r.pooled.decisiveWinRate;
        let dmg = 0, starfall = 0;
        for (const runResult of r.pooled.runs) {
            const t: RunTelemetry | undefined = runResult.telemetry;
            dmg += t?.PLAYER.totalDamage ?? 0;
            starfall += t?.PLAYER.directDamage?.['starfall'] ?? 0;
        }
        return {
            arm, games, decided,
            winOverDecided: winDecided,
            winOverAllGames: (winDecided * decided) / games,
            turns: +r.pooled.averageTurns.toFixed(2),
            truncated: r.pooled.truncatedCount,
            glimmerPlaysPerGame: +(glimmerPlays / games).toFixed(1),
            maxStreak,
            damagePerGame: +(dmg / games).toFixed(1),
            starfallPerGame: +(starfall / games).toFixed(1),
            starfallShare: dmg > 0 ? +(starfall / dmg).toFixed(3) : 0,
        };
    } finally {
        if (arm === 'NOLOOP') setExhaust(false);
    }
}

const rows = (['SHIPPED', 'NOLOOP'] as const).map(a => {
    const row = run(a);
    console.error(`${a.padEnd(8)} decided ${row.decided}/${row.games}  ` +
        `win(decided) ${(row.winOverDecided * 100).toFixed(1)}%  win(all games) ${(row.winOverAllGames * 100).toFixed(1)}%  ` +
        `turns ${row.turns}  glimmer ${row.glimmerPlaysPerGame}/game  maxStreak ${row.maxStreak}  ` +
        `dmg ${row.damagePerGame}  starfall ${row.starfallPerGame} (${(row.starfallShare * 100).toFixed(1)}%)`);
    return row;
});
fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));

const [s, n] = rows;
console.error('\n=== the answer ===');
console.error(`  games she actually wins:   SHIPPED ${(s.winOverAllGames * 100).toFixed(1)}%  ->  NOLOOP ${(n.winOverAllGames * 100).toFixed(1)}%  ` +
    `(${((n.winOverAllGames - s.winOverAllGames) * 100 >= 0 ? '+' : '')}${((n.winOverAllGames - s.winOverAllGames) * 100).toFixed(1)} points)`);
console.error(`  damage she deals per game: SHIPPED ${s.damagePerGame}  ->  NOLOOP ${n.damagePerGame}`);
console.error(`  starfall's share:          SHIPPED ${(s.starfallShare * 100).toFixed(1)}%  ->  NOLOOP ${(n.starfallShare * 100).toFixed(1)}%`);
console.error(`\n-> ${OUT}`);
