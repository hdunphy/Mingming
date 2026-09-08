/**
 * TICKET 149 (3b) — the ticket-131 whirlpool_v2 case, in the field.
 *
 * `whirlpool_v2` ships as "8 power, draw 1, apply 2 Dazed" (scores 3.2 against a 3.0 ceiling). The
 * ticket-131 alternative was "draw 2, apply 1 Dazed, no power" (scores 2.8). This runs kraken_v1 on
 * its own frame vs the standard 1v1 opponent set under both printings, so the report has a field
 * win rate next to the two scores.
 *
 * ARM is an in-memory patch of `ProgramRegistry.whirlpool_v2.actions` + `clearProgramDataCache()`,
 * asserted to have taken, restored in `finally`. Nothing on disk changes.
 *
 * Run: npx vite-node scratch/t149_whirlpool.ts -- --arm SHIPPED --iter 20 --out results/t149_daemons/whirlpool.jsonl
 *      npx vite-node scratch/t149_whirlpool.ts -- --arm DRAW2 --iter 20 --out results/t149_daemons/whirlpool.jsonl
 */
import fs from 'node:fs';
import { runPairedBatch, type RunTelemetry } from '../src/debug/balance/runBatch';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { ProgramRegistry, clearProgramDataCache, GetProgramData } from '../src/engine/data/programRegistry';
import { calculatePowerscale } from '../src/debug/balance/powerscale';
import type { ProgramData } from '../src/engine/types';
import { arg } from './_env';

const ARM = arg('arm', 'SHIPPED');
const ITER = Number(arg('iter', '20'));
const OUT = arg('out', 'results/t149_daemons/whirlpool.jsonl');
const CARD = 'whirlpool_v2';
const OWNER = 'kraken_v1';

type Raw = { actions: unknown[] };
const raw = ProgramRegistry[CARD] as unknown as Raw;
const savedActions = raw.actions;
function applyArm(): () => void {
    if (ARM === 'SHIPPED') return () => undefined;
    if (ARM !== 'DRAW2') throw new Error(`unknown arm ${ARM}`);
    raw.actions = [
        { type: 'DRAW', amount: 2, target: 'SELF' },
        { type: 'STATUS', status: 'Dazed', stacks: 1, target: 'TARGET' },
    ];
    clearProgramDataCache();
    const got = GetProgramData(CARD).actions;
    if (got.length !== 2 || got[0].type !== 'DRAW' || (got[0] as { amount?: number }).amount !== 2) throw new Error('ARM DID NOT TAKE');
    return () => { raw.actions = savedActions; clearProgramDataCache(); };
}

const restore = applyArm();
try {
    console.error(`arm ${ARM}: ${CARD} = ${JSON.stringify(GetProgramData(CARD).actions)}  score ${calculatePowerscale(GetProgramData(CARD) as ProgramData).score}`);
    fs.mkdirSync(OUT.slice(0, OUT.lastIndexOf('/')), { recursive: true });
    const opponents: Array<{ sp: string; deck: string }> = [];
    for (const sp of BALANCE_SPECIES) if (sp !== 'kraken')
        for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });
    let wins = 0, dec = 0, games = 0;
    for (const o of opponents) {
        const t0 = Date.now();
        const r = runPairedBatch(matchupScenario({
            player: 'kraken', enemy: o.sp, playerOS: OWNER, enemyOS: o.deck, seed: `t149wp:${OWNER}:${o.deck}`,
        }), { iterations: ITER, telemetry: true });
        let casts = 0, dmg = 0, dazed = 0;
        for (const run of r.pooled.runs) {
            const t: RunTelemetry | undefined = run.telemetry;
            if (!t) continue;
            casts += t.PLAYER.played[CARD] ?? 0;
            dmg += t.PLAYER.directDamage[CARD] ?? 0;
            dazed += t.PLAYER.statuses[CARD]?.Dazed ?? 0;
        }
        const row = {
            arm: ARM, owner: OWNER, opponent: o.deck, games: r.pooled.iterations, decisive: r.pooled.decisive,
            win: r.pooled.decisiveWinRate, turns: r.pooled.averageTurns, casts, dmg, dazed, ms: Date.now() - t0,
        };
        wins += row.win * row.decisive; dec += row.decisive; games += row.games;
        fs.appendFileSync(OUT, JSON.stringify(row) + '\n');
        console.error(`  ${ARM} vs ${o.deck.padEnd(16)} win ${(row.win * 100).toFixed(1)}%  n ${row.games}  casts ${casts}  ${row.ms} ms`);
    }
    console.error(`${ARM}: field decisive win ${(100 * wins / Math.max(1, dec)).toFixed(1)}% over ${games} games (${dec} decisive)`);
} finally {
    restore();
}
