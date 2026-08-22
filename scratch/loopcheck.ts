/**
 * Is the self-draw loop class FIRING in the 3v3 comps ticket 109 measured?
 *
 * `handlePlayProgram` discards the played card before its actions resolve, and `drawCards`
 * reshuffles the discard whenever the drawpile is empty — so any 0-cost, non-exhaust card that
 * draws can draw itself back, forever, at no energy cost. `scratch/glimmerloop.ts` proves the
 * fixed point in five dispatches.
 *
 * The class is FOUR cards across SEVEN shipped decks, not one card in one deck:
 *   glimmer    -> valkyrie_v2
 *   slipstream -> hraesvelgr_v1, hraesvelgr_v2, sleipnir_v1
 *   undertow   -> jormungandr_v1, kraken_v1
 *   forage     -> hel_v2, ratatoskr_v1     (self-damage bounds it, by killing you)
 *
 * THREE OF `panel-zoo`'s THREE DECKS HOLD ONE, and so does `panel-control`'s kraken_v1. At 3v3 the
 * deck is SHARED and draw is sum(cardDraw)-(N-1), so the pile cycles far more often (109 measured
 * 1-4 reshuffles a game) and drawpile-empty moments — the loop's precondition — are commoner than
 * at 1v1. If the loop fires, ticket 109's headline zoo numbers are measuring an engine defect.
 *
 * The bus is muted throughout `TacticalAI`'s search (0-AI-SIM-COUNTS), so a plain subscriber counts
 * REAL plays only.
 *
 * Run: WIDTH=3 npx vite-node scratch/loopcheck.ts
 */
import { runPairedBatch } from '../src/debug/balance/runBatch';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { globalBattleEventBus } from '../src/engine/events';

const WIDTH = Number(process.env.WIDTH ?? 3);
const ITER = Number(process.env.ITER ?? 3);

const ZOO = [['jormungandr', 'jormungandr_v1'], ['sleipnir', 'sleipnir_v1'], ['hraesvelgr', 'hraesvelgr_v1']] as const;
const CTL = [['kraken', 'kraken_v1'], ['huldra', 'huldra_v1'], ['draugr', 'draugr_v2']] as const;

/** The 0-cost non-exhaust drawers - the loop class. */
const SUSPECTS = new Set(['glimmer', 'slipstream', 'undertow', 'forage']);

let playsThisTurn = 0;
let maxPlaysInATurn = 0;
let shuffles = 0;
const perCard: Record<string, number> = {};
/** Consecutive plays of the SAME suspect inside one turn - the loop's signature. */
let runLen = 0, maxRunLen = 0, lastCard = '';
const runsOver3: Record<string, number> = {};

globalBattleEventBus.subscribe(e => {
    if (e.type === 'TURN_START') { playsThisTurn = 0; runLen = 0; lastCard = ''; return; }
    if (e.type === 'DECK_SHUFFLED') { shuffles++; return; }
    if (e.type !== 'PROGRAM_PLAYED') return;
    const id = (e as { programId?: string; dataId?: string }).programId
        ?? (e as { dataId?: string }).dataId ?? 'unknown';
    playsThisTurn++;
    maxPlaysInATurn = Math.max(maxPlaysInATurn, playsThisTurn);
    perCard[id] = (perCard[id] ?? 0) + 1;
    if (id === lastCard && SUSPECTS.has(id)) {
        runLen++;
        maxRunLen = Math.max(maxRunLen, runLen);
        if (runLen >= 3) runsOver3[id] = (runsOver3[id] ?? 0) + 1;
    } else { runLen = 1; lastCard = id; }
});

const r = runPairedBatch(teamScenario({
    player: ZOO.slice(0, WIDTH) as unknown as ReadonlyArray<readonly [string, string]>,
    enemy: CTL.slice(0, WIDTH) as unknown as ReadonlyArray<readonly [string, string]>,
    seed: `loopcheck:w${WIDTH}`,
}), { iterations: ITER, telemetry: true });

console.log(`\n=== width ${WIDTH}, ${r.pooled.iterations} games ===`);
console.log(`turns mean      ${r.pooled.averageTurns.toFixed(2)}`);
console.log(`truncated       ${r.pooled.truncatedCount}`);
console.log(`deck shuffles   ${shuffles}  (${(shuffles / r.pooled.iterations).toFixed(2)} per game)`);
console.log(`MAX PLAYS IN A SINGLE TURN   ${maxPlaysInATurn}`);
console.log(`longest same-suspect streak  ${maxRunLen}`);
console.log(`streaks of 3+ by card        ${JSON.stringify(runsOver3)}`);
console.log('\nloop-class cards actually played:');
for (const id of SUSPECTS) if (perCard[id]) console.log(`  ${id.padEnd(12)} ${perCard[id]}`);
console.log('\ntop 8 cards by plays:');
for (const [id, n] of Object.entries(perCard).sort((a, b) => b[1] - a[1]).slice(0, 8))
    console.log(`  ${id.padEnd(20)} ${n}`);
console.log(
    maxPlaysInATurn > 20
        ? '\nVERDICT: a turn ran away. The loop is firing in real games — 109 numbers are suspect.'
        : '\nVERDICT: no runaway turn in this sample. The loop did not fire here.',
);
