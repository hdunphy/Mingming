/**
 * TICKET 98: the team-sim canary.
 *
 * Its job is NOT to balance 3v3. It is to answer the question that has to be answered before any
 * 3v3 number means anything: **does a team battle actually resolve, and where does the 1v1 harness
 * stop being able to read it?** The ticket's own framing - "canary suite joins standing gates" -
 * makes this a liveness instrument, not a balance one.
 *
 * WHAT IT WATCHES, and why each one is on the list rather than a general "did it work":
 *
 *   - **completion** - a battle that hits the turn cap or the 250-action per-turn cap is a stall,
 *     and 3v3 has three times the plays per turn to stall with. This is the canary's whole reason
 *     to exist: the `glimmer` loop (ticket 100) proves a shipped deck can already loop in 1v1, and
 *     a 27-card shared pile with three energy pools is a strictly better environment for that.
 *   - **wasted energy lives in `scratch/wastedenergy.ts`, NOT here.** An earlier version of this
 *     comment claimed this suite watched it; it never did - the columns below are FTK, stalls,
 *     turns, dead cards and first-mover edge, and none of them is an energy reading. Split out
 *     rather than bolted on because the honest metric needs an end-of-turn sample and a 1v1
 *     baseline to be read against.
 *   - **dead cards** - the DECK-SIZE audit. A 27-card pile draws a given card a third as often, so
 *     any deck whose plan needs a specific card should show it here.
 *   - **turns** - 1v1 battles run 2-3 turns. If 3v3 runs 15, every "damage over time" card in the
 *     registry is a different card, and no 1v1 price survives the transfer.
 *   - **first-mover edge** - 1v1 runs +-0.12 and the paired harness exists to average it out. If
 *     3v3 is worse, the team grid needs the pairing even more than the 1v1 grid does.
 *
 * env: ITER (default 6), TEAMS (default 6 - how many random-ish team pairs to run)
 */
import { runPairedBatch, DEFAULT_MAX_TURNS } from '../src/debug/balance/runBatch';
import { teamScenario, BALANCE_SPECIES } from '../src/debug/balance/balanceScenarios';
import { MingmingRegistry } from '../src/engine/data/mingmingRegistry';

const ITER = Number(process.env.ITER ?? 6);
const TEAMS = Number(process.env.TEAMS ?? 6);

// Deterministic team construction - stride the species list so a team is three DIFFERENT species
// and consecutive teams do not overlap. No RNG: the canary has to be re-runnable to the number.
const roster: Array<readonly [string, string]> = [];
for (const sp of BALANCE_SPECIES) for (const os of MingmingRegistry[sp].availableOS) roster.push([sp, os]);

const team = (offset: number): Array<readonly [string, string]> => {
    const picked: Array<readonly [string, string]> = [];
    const used = new Set<string>();
    for (let i = 0; picked.length < 3 && i < roster.length; i++) {
        const cand = roster[(offset + i * 7) % roster.length];
        if (used.has(cand[0])) continue;   // one member per species - shared decks, distinct plans
        used.add(cand[0]); picked.push(cand);
    }
    return picked;
};

console.log('pair,player,enemy,winRate,turns,truncated,ftk,deadPlayer,deadEnemy,firstMoverEdge');
let stalls = 0, ftks = 0, totalTurns = 0, maxTurns = 0;

for (let p = 0; p < TEAMS; p++) {
    const mine = team(p * 3);
    const theirs = team(p * 3 + 17);
    const r = runPairedBatch(teamScenario({ player: mine, enemy: theirs, seed: `canary:${p}` }),
        { iterations: ITER });
    const pooled = r.pooled;
    stalls += pooled.truncatedCount; ftks += pooled.ftkCount;
    totalTurns += pooled.averageTurns; maxTurns = Math.max(maxTurns, pooled.averageTurns);
    console.log([
        p, mine.map(m => m[1]).join('+'), theirs.map(m => m[1]).join('+'),
        (pooled.decisiveWinRate * 100).toFixed(1), pooled.averageTurns.toFixed(2),
        pooled.truncatedCount, pooled.ftkCount,
        (pooled.deadCardRatio * 100).toFixed(1), (pooled.enemyDeadCardRatio * 100).toFixed(1),
        r.firstMoverEdge.toFixed(3),
    ].join(','));
}

const games = TEAMS * ITER * 2;
console.error(`\nTEAM CANARY  ${TEAMS} pairs x ${ITER} iters x 2 orders = ${games} games`);
console.error(`  stalls    ${stalls}/${games} (${((stalls / games) * 100).toFixed(1)}%)  ` +
    `- a stall is a battle that never reached a kill by turn ${DEFAULT_MAX_TURNS}`);
console.error(`  FTK       ${ftks}/${games}`);
console.error(`  turns     mean ${(totalTurns / TEAMS).toFixed(2)}   worst pair ${maxTurns.toFixed(2)}`);
