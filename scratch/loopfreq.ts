/**
 * TICKET 111 follow-up — does removing the copy cap ARM the self-draw loop, or not?
 *
 * Henry ruled on 2026-08-21 that duplicate species are legal and the ≤2 copy cap is removed, on the
 * reasoning that the cards should be balanced so no loop is worth building. The open question is
 * whether the loop is a card-balance problem at all. Two claims were in tension:
 *
 *   Henry: you would need a deck of almost nothing but 0-cost draws to empty the piles, which is a
 *          boring deck nobody builds - Slay the Spire allows the same thing.
 *   Me:    the entry condition is not draw density but CIRCULATING POOL <= HAND SIZE, and EXHAUST
 *          produces it - `valkyrie_v2` reached it with ONE glimmer, because falling_star x2 and
 *          ascension exhaust and leave a 5-card pool.
 *
 * Both are arguments. This measures instead. For each deck holding a loop-class card (a 0-cost,
 * non-exhaust card that draws), two arms at 1v1 against a fixed opponent:
 *
 *   SHIPPED   the deck as it ships.
 *   STACKED   the same deck plus TWO more copies of its loop card - illegal before the ruling,
 *             legal now, and the cheapest thing a player would actually try.
 *
 * The signature of the loop is CONSECUTIVE plays of the same loop-class card inside one turn. A
 * streak of 1-2 is ordinary play. A streak that runs away is the bug. If STACKED does not move the
 * streak distribution, the ruling is free and 111 can stay a background correctness fix; if it does,
 * 111 gates the uncapped builder.
 *
 * 0-AI-SIM-COUNTS: the bus is muted throughout `TacticalAI`'s search, so a plain subscriber counts
 * REAL plays only.
 *
 * env: ITER=<n>  ONLY=<deck,..>  OUT=<path>
 * Run: ITER=25 AI_BEAM=8 npx vite-node scratch/loopfreq.ts
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { globalBattleEventBus } from '../src/engine/events';
import fs from 'node:fs';
import { ENV } from './_env';

/** The loop class: 0-cost, non-exhaust, puts a card in hand. `forage` is bounded by killing you. */
const LOOPERS: Record<string, string> = {
    valkyrie_v2: 'glimmer',
    hraesvelgr_v1: 'slipstream',
    hraesvelgr_v2: 'slipstream',
    sleipnir_v1: 'slipstream',
    jormungandr_v1: 'undertow',
    kraken_v1: 'undertow',
    hel_v2: 'forage',
    ratatoskr_v1: 'forage',
};
const SPECIES: Record<string, string> = {
    valkyrie_v2: 'valkyrie', hraesvelgr_v1: 'hraesvelgr', hraesvelgr_v2: 'hraesvelgr',
    sleipnir_v1: 'sleipnir', jormungandr_v1: 'jormungandr', kraken_v1: 'kraken',
    hel_v2: 'hel', ratatoskr_v1: 'ratatoskr',
};
/** A fixed, ordinary opponent holding no loop-class card. */
const OPPONENT = [['huldra', 'huldra_v1']] as const;

const ITER = Number(ENV.ITER ?? 25);
const ONLY = (ENV.ONLY ?? '').split(',').filter(Boolean);
const OUT = ENV.OUT ?? '/root/probe/loopfreq.json';

let streak = 0, lastCard = '', subject = '';
let maxStreak = 0, playsThisTurn = 0, maxPlaysInTurn = 0, shuffles = 0, looperPlays = 0;
const streakHist: Record<number, number> = {};

const resetCounters = (s: string) => {
    subject = s; streak = 0; lastCard = '';
    maxStreak = 0; playsThisTurn = 0; maxPlaysInTurn = 0; shuffles = 0; looperPlays = 0;
    for (const k of Object.keys(streakHist)) delete streakHist[k];
};
const closeStreak = () => { if (streak >= 1) streakHist[streak] = (streakHist[streak] ?? 0) + 1; };

globalBattleEventBus.subscribe(e => {
    if (!globalBattleEventBus.isLive) return;          // 0-AI-SIM-COUNTS
    if (e.type === 'TURN_START') { closeStreak(); streak = 0; lastCard = ''; playsThisTurn = 0; return; }
    if (e.type === 'DECK_SHUFFLED') { shuffles++; return; }
    if (e.type !== 'PROGRAM_PLAYED') return;
    const id = (e as { programId?: string; dataId?: string }).programId
        ?? (e as { dataId?: string }).dataId ?? '';
    playsThisTurn++;
    maxPlaysInTurn = Math.max(maxPlaysInTurn, playsThisTurn);
    const looper = LOOPERS[subject];
    if (id === looper) {
        looperPlays++;
        streak = id === lastCard ? streak + 1 : 1;
        maxStreak = Math.max(maxStreak, streak);
    } else {
        closeStreak();
        streak = 0;
    }
    lastCard = id;
});

interface Row {
    deck: string; looper: string; arm: 'SHIPPED' | 'STACKED';
    games: number; turns: number; winRate: number;
    shufflesPerGame: number; looperPlaysPerGame: number;
    maxPlaysInTurn: number; maxStreak: number;
    /** How many streaks of each length occurred, pooled over all games. */
    streakHist: Record<number, number>;
}

const rows: Row[] = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const done = new Set(rows.map(r => `${r.deck}|${r.arm}`));

function run(deck: string, arm: 'SHIPPED' | 'STACKED'): Row {
    resetCounters(deck);
    const looper = LOOPERS[deck];
    const r = runPairedBatch(teamScenario({
        player: [[SPECIES[deck], deck]],
        enemy: OPPONENT as unknown as ReadonlyArray<readonly [string, string]>,
        // Two more copies of the loop card - illegal before the 2026-08-21 ruling, legal now.
        playerExtras: arm === 'STACKED' ? [looper, looper] : undefined,
        seed: `loopfreq:${deck}:${arm}`,
    }), { iterations: ITER });
    closeStreak();
    const games = r.pooled.iterations || 1;
    return {
        deck, looper, arm, games,
        turns: +r.pooled.averageTurns.toFixed(2),
        winRate: r.pooled.decisiveWinRate,
        shufflesPerGame: +(shuffles / games).toFixed(2),
        looperPlaysPerGame: +(looperPlays / games).toFixed(2),
        maxPlaysInTurn, maxStreak, streakHist: { ...streakHist },
    };
}

for (const deck of Object.keys(LOOPERS)) {
    if (ONLY.length && !ONLY.includes(deck)) continue;
    for (const arm of ['SHIPPED', 'STACKED'] as const) {
        if (done.has(`${deck}|${arm}`)) continue;
        const row = run(deck, arm);
        rows.push(row);
        fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
        const big = Object.entries(row.streakHist).filter(([k]) => +k >= 3)
            .map(([k, v]) => `${k}x${v}`).join(' ') || 'none';
        console.error(`${deck.padEnd(15)} ${row.looper.padEnd(11)} ${arm.padEnd(8)} ` +
            `win ${(row.winRate * 100).toFixed(1)}%  ${row.looperPlaysPerGame}/game  ` +
            `maxStreak ${row.maxStreak}  maxPlaysInTurn ${row.maxPlaysInTurn}  streaks3+: ${big}`);
    }
}

console.error('\n=== does stacking copies arm the loop? (max streak, SHIPPED -> STACKED) ===');
for (const deck of Object.keys(LOOPERS)) {
    const a = rows.find(r => r.deck === deck && r.arm === 'SHIPPED');
    const b = rows.find(r => r.deck === deck && r.arm === 'STACKED');
    if (!a || !b) continue;
    const flag = b.maxStreak >= 10 ? '   <-- RUNAWAY' : b.maxStreak > a.maxStreak ? '   (worse)' : '';
    console.error(`  ${deck.padEnd(15)} ${a.maxStreak} -> ${b.maxStreak}${flag}`);
}
console.error(`\n-> ${OUT}`);
