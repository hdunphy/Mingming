/**
 * TICKET 113 — valkyrie_v2 DECK ARMS, per Henry's knob list (2026-08-22).
 *
 * *"replace the exhaust cards one at a time so 3 tests decrementing the number of exhaust cards then
 * keep the number but add other damage cards. maybe some can be damage plus draw. try changing the
 * deck but not glimmer."*
 *
 * `glimmer` is untouched in every arm. Making it exhaust was a DIAGNOSTIC stand-in in
 * `valkcounter.ts` to prove the loop was the cause - it was never a proposed fix.
 *
 * THE PROBLEM BEING KNOBBED. Her circulating pool - deck size minus everything that exhausts - is
 * FIVE: `falling_star` x2 and `ascension` all exhaust out of an 8-card list. Five fits in a hand, so
 * drawpile and discard both empty and `glimmer` reshuffles into its own draw. Every arm below raises
 * the pool, by one of the two routes Henry named.
 *
 *   A-arms   REPLACE exhaust cards, deck stays 8.   pool 6 -> 7 -> 8
 *   B-arms   KEEP the exhaust package, ADD cards.   deck 10 -> 12, pool 7 -> 9
 *
 * REPLACEMENT CHOICES, and one thing the pool does not contain. `smite` (1e, 27 power) is the clean
 * non-exhaust twin of `falling_star` (1e, 40 power, exhaust); `supernova_v2` (2e, 108 power) is the
 * non-exhaust 2e attack standing in for `ascension` (2e, 50 power + 2 Str + 2 Sharp, exhaust).
 * **There is no Light card that deals damage AND draws** - the nearest are `lumen_surge` (1e, draw +
 * energy, no damage) and `scry` (2e, draw 2). B3 uses `lumen_surge` for that flavour; a real
 * damage-plus-draw Light card would be a NEW card and therefore Henry's to approve.
 *
 * MEASURED AGAINST FIVE OPPONENTS, not just the loop cell, because a deck change that fixes one
 * matchup and costs four is not a fix. The five span her whole recorded range: `huldra_v1` 0% (the
 * loop cell, 17/60 decided), `gullinbursti_v1` 0% (decided - her real worst), `draugr_v2` 13%,
 * `kraken_v1` 83%, `skoll_v1` 87%.
 *
 * env: ITER=<n>  ONLY=<arm,..>  OUT=<path>
 * Run: ITER=30 AI_BEAM=8 npx vite-node scratch/valkarms.ts
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { MingmingRegistry, getDeckForOS } from '../src/engine/data/mingmingRegistry';
import { globalBattleEventBus } from '../src/engine/events';
import fs from 'node:fs';

const SHIPPED = ['falling_star', 'falling_star', 'morning_light', 'starfall', 'starfall',
    'ascension', 'radiant_spark', 'glimmer'];

interface Arm { id: string; deck: string[]; note: string }

const ARMS: Arm[] = [
    { id: 'BASE', deck: [...SHIPPED], note: 'as shipped - 8 cards, 3 exhaust, circulating pool 5.' },

    {
        id: 'C0-supernova-only',
        deck: ['falling_star', 'falling_star', 'morning_light', 'starfall', 'starfall', 'supernova_v2', 'radiant_spark', 'glimmer'],
        note: 'CONTROL ARM: only ascension -> supernova_v2. Both falling_stars kept, so 8 cards, 2 exhaust, pool 6. '
            + 'Isolates the one card the two good arms share, from the pool change and the smite swaps.',
    },
    {
        id: 'A1-exhaust2',
        deck: ['smite', 'falling_star', 'morning_light', 'starfall', 'starfall', 'ascension', 'radiant_spark', 'glimmer'],
        note: 'one falling_star -> smite. 8 cards, 2 exhaust, pool 6.',
    },
    {
        id: 'A2-exhaust1',
        deck: ['smite', 'smite', 'morning_light', 'starfall', 'starfall', 'ascension', 'radiant_spark', 'glimmer'],
        note: 'both falling_star -> smite. 8 cards, 1 exhaust, pool 7.',
    },
    {
        id: 'A3-exhaust0',
        deck: ['smite', 'smite', 'morning_light', 'starfall', 'starfall', 'supernova_v2', 'radiant_spark', 'glimmer'],
        note: 'ascension -> supernova_v2 as well. 8 cards, 0 exhaust, pool 8.',
    },

    {
        id: 'B1-add2',
        deck: [...SHIPPED, 'smite', 'dawnstrike'],
        note: 'exhaust package kept, +2 damage cards. 10 cards, 3 exhaust, pool 7.',
    },
    {
        id: 'B2-add4',
        deck: [...SHIPPED, 'smite', 'smite', 'dawnstrike', 'supernova_v2'],
        note: 'exhaust package kept, +4 damage cards. 12 cards, 3 exhaust, pool 9.',
    },
    {
        id: 'B3-add4-draw',
        deck: [...SHIPPED, 'smite', 'smite', 'dawnstrike', 'lumen_surge'],
        note: 'same as B2 but one slot is draw instead of the 2e nuke - the damage-plus-draw flavour. 12 cards, pool 9.',
    },
];

const OPPONENTS: Array<[string, string, number]> = [
    ['huldra', 'huldra_v1', 0.0],
    ['gullinbursti', 'gullinbursti_v1', 0.0],
    ['draugr', 'draugr_v2', 0.133],
    ['kraken', 'kraken_v1', 0.833],
    ['skoll', 'skoll_v1', 0.867],
];

const ITER = Number(process.env.ITER ?? 30);
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
const OUT = process.env.OUT ?? '/root/probe/valkarms.json';

let maxStreak = 0, streak = 0, last = '', glimmerPlays = 0;
globalBattleEventBus.subscribe(e => {
    if (!globalBattleEventBus.isLive) return;               // 0-AI-SIM-COUNTS
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
 * `GetMingmingData` returns the LIVE registry object (unlike `GetProgramData`, which inflates a
 * fresh copy and silently discards mutations - that trap cost one dead arm already). So the deck
 * list can be swapped in place. The assertion below is not decoration: it is the guard that would
 * have caught that trap.
 */
function setDeck(deck: string[]): void {
    MingmingRegistry['valkyrie'].decks['valkyrie_v2'] = [...deck];
    const live = getDeckForOS('valkyrie', 'valkyrie_v2');
    if (live.join(',') !== deck.join(',')) {
        throw new Error(`ARM DID NOT TAKE: asked for [${deck}] but the engine reads [${live}]`);
    }
}

interface Row {
    arm: string; opponent: string; deckSize: number; pool: number;
    winRate: number; decided: number; games: number; turns: number;
    gridWinRate: number; maxStreak: number; glimmerPlaysPerGame: number; note: string;
}

const rows: Row[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const done = new Set(rows.map(r => `${r.arm}|${r.opponent}`));
const EXHAUSTERS = new Set(['falling_star', 'ascension']);

try {
    for (const arm of ARMS) {
        if (ONLY.length && !ONLY.includes(arm.id)) continue;
        const pool = arm.deck.filter(c => !EXHAUSTERS.has(c)).length;
        for (const [sp, os, gridWin] of OPPONENTS) {
            if (done.has(`${arm.id}|${os}`)) continue;
            setDeck(arm.deck);
            maxStreak = 0; streak = 0; last = ''; glimmerPlays = 0;
            const r = runPairedBatch(teamScenario({
                player: [['valkyrie', 'valkyrie_v2']], enemy: [[sp, os]],
                seed: `valkarms:${arm.id}:${os}`,
            }), { iterations: ITER });
            const row: Row = {
                arm: arm.id, opponent: os, deckSize: arm.deck.length, pool,
                winRate: r.pooled.decisiveWinRate,
                decided: r.pooled.iterations - r.pooled.truncatedCount,
                games: r.pooled.iterations, turns: +r.pooled.averageTurns.toFixed(2),
                gridWinRate: gridWin, maxStreak,
                glimmerPlaysPerGame: +(glimmerPlays / (r.pooled.iterations || 1)).toFixed(1),
                note: arm.note,
            };
            rows.push(row);
            fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
            console.error(`${arm.id.padEnd(14)} vs ${os.padEnd(16)} ` +
                `win ${(row.winRate * 100).toFixed(1)}%  decided ${row.decided}/${row.games}  ` +
                `turns ${row.turns}  glimmer ${row.glimmerPlaysPerGame}/game  maxStreak ${row.maxStreak}`);
        }
    }
} finally {
    setDeck(SHIPPED);   // never leave the registry mutated
}

console.error('\n=== arm summary ===');
console.error(`${'arm'.padEnd(14)}${'deck'.padEnd(6)}${'pool'.padEnd(6)}${'mean win'.padEnd(10)}${'loop?'.padEnd(18)}undecided`);
for (const arm of ARMS) {
    const rs = rows.filter(r => r.arm === arm.id);
    if (!rs.length) continue;
    const mean = rs.reduce((a, r) => a + r.winRate, 0) / rs.length * 100;
    const und = rs.reduce((a, r) => a + (r.games - r.decided), 0);
    const ms = Math.max(...rs.map(r => r.maxStreak));
    console.error(`${arm.id.padEnd(14)}${String(rs[0].deckSize).padEnd(6)}${String(rs[0].pool).padEnd(6)}` +
        `${mean.toFixed(1).padStart(6)}%   ${(ms >= 10 ? `LOOPS (streak ${ms})` : `clean (streak ${ms})`).padEnd(18)}${und}`);
}
console.error(`\n-> ${OUT}`);
