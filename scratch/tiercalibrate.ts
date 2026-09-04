/**
 * Ticket 108: the screening tier is only worth having if it RANKS THE SAME as the tier it
 * replaces. A faster instrument that reorders arms is not an optimisation, it is a way to ship the
 * wrong number quickly.
 *
 * This runs the same subject row at a given tier and reports the wall clock plus every cell, so two
 * runs can be diffed for both speed AND agreement. It is the calibration check the ticket makes
 * mandatory ("each such sweep runs ONE arm both ways").
 *
 * Run it as:
 *   AI_TIER_LABEL=full            npx tsx scratch/tiercalibrate.ts > /tmp/full.csv
 *   AI_LITE=1 AI_TIER_LABEL=lite  npx tsx scratch/tiercalibrate.ts > /tmp/lite.csv
 *   AI_GREEDY=1 ...               (legal only for pure numeric-knob arms, per the ticket)
 *
 * THE CONTROL MATTERS MORE THAN THE COMPARISON. At 10 iters x 2 orders a cell has 20 games, so its
 * granularity is 5 points and its standard error is ~11. Lite disagreeing with full by 6 points a
 * cell means nothing until you know what full disagrees with FULL by on another seed base. SEEDBASE
 * exists for exactly that control run - it is the 0-DECISION-GRADE law applied to the instrument
 * itself.
 *
 * env: DECK (subject row), ITER (default 10 - the ticket's arm-ranking grade), SEEDBASE (default
 * `grid` - change it to re-roll every cell's seed while holding the tier fixed)
 */
import { AI_TIER } from '../src/engine/ai/TacticalAI';
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { matchupScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';
import { ENV } from './_env';

const DECK = ENV.DECK ?? 'draugr_v2';
const SPECIES = DECK.replace(/_v[12]$/, '');
const ITER = Number(ENV.ITER ?? 10);
const SEEDBASE = ENV.SEEDBASE ?? 'grid';

const opponents: Array<{ sp: string; deck: string }> = [];
for (const sp of BALANCE_SPECIES) if (sp !== SPECIES)
    for (const d of MingmingRegistry[sp].availableOS) opponents.push({ sp, deck: d });

const started = Date.now();
let sum = 0;
const rows: string[] = [];
for (const o of opponents) {
    const r = runPairedBatch(matchupScenario({
        player: SPECIES, enemy: o.sp, playerOS: DECK, enemyOS: o.deck,
        seed: `${SEEDBASE}:${DECK}:${o.deck}`,
    }), { iterations: ITER });
    sum += r.pooled.decisiveWinRate;
    rows.push(`${o.deck},${(r.pooled.decisiveWinRate * 100).toFixed(2)}`);
}
const ms = Date.now() - started;
const field = (sum / opponents.length) * 100;

// stdout is the diffable artifact; stderr is the human line.
console.log(`# tier=${AI_TIER} deck=${DECK} iter=${ITER} seedbase=${SEEDBASE} ` +
    `field=${field.toFixed(2)} ms=${ms}`);
for (const r of rows) console.log(r);
console.error(`\nTIER ${AI_TIER.padEnd(6)} ${DECK} @${SEEDBASE}  field ${field.toFixed(2)}%  ` +
    `${opponents.length} cells x ${ITER} iters x 2 orders  ${(ms / 1000).toFixed(1)}s`);
