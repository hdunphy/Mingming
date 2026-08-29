/**
 * TICKET 98, deliverable 3: the WASTED-ENERGY metric.
 *
 * The 3v3 ruling makes this a MEASURED metric with no pre-patch: three energy pools feed one shared
 * hand, so a member can sit flush while the hand holds nothing it can cast. Measuring it is the
 * ruling; patching it is explicitly not.
 *
 * The canary claimed to watch this and did not - it reported FTK, stalls, turns, dead cards and
 * first-mover edge, and nothing about energy. This is the missing column, split three ways because
 * the three readings mean different things:
 *
 *   - **unspent at end of turn**, as a share of the side's total energy - the headline.
 *   - **members who spent NOTHING** in a turn they were alive for - the shape the shared hand
 *     predicts: not a slightly-underused pool, but a whole body idle because the hand had nothing
 *     for it.
 *   - **1v1 comparison** - a solo frame also ends turns with change in its pocket, so the number is
 *     meaningless without the baseline it should be read against.
 *
 * env: N (party sizes, default 1,3), AI_BEAM (use 8), ITER
 */
import { buildScenarioState } from '../src/debug/scenarios/buildScenarioState';
import { teamScenario } from '../src/debug/balance/balanceScenarios';
import { battleReducer } from '../src/engine/battleReducer';
import { getBestAction } from '../src/engine/ai/TacticalAI';
import { deriveSeeds } from '../src/debug/balance/runBatch';
import { ENV } from './_env';
type St = import('../src/engine/types').IBattleState;

const SQUAD: Array<readonly [string, string]> = [
    ['draugr', 'draugr_v2'], ['huldra', 'huldra_v1'], ['sleipnir', 'sleipnir_v1'],
];
const FOE: Array<readonly [string, string]> = [
    ['hel', 'hel_v2'], ['kraken', 'kraken_v1'], ['fenrir', 'fenrir_v1'],
];
const ITER = Number(ENV.ITER ?? 2);

for (const n of (ENV.N ?? '1,3').split(',').map(Number)) {
    const setup = teamScenario({ player: SQUAD.slice(0, n), enemy: FOE.slice(0, n), seed: `waste:${n}` });
    let unspent = 0, capacity = 0, idleMembers = 0, memberTurns = 0, turnsSeen = 0;

    for (const seed of deriveSeeds(`waste:${n}`, ITER)) {
        let st = buildScenarioState({ ...setup, seed }) as St;
        const alive = (p: ReadonlyArray<{ currentHp: number }>) => p.some(e => e.currentHp > 0);
        let guard = 0, lastKey = '';
        while (alive(st.playerParty) && alive(st.enemyParty) && st.turn <= 60 && guard++ < 4000) {
            const a = getBestAction(st);
            // Sample the instant the side gives up its turn - that is when what is left is WASTED
            // rather than merely unspent-so-far.
            if (a.type === 'END_TURN' && st.activeSide === 'PLAYER') {
                const key = `${st.turn}:${st.activeSide}`;
                if (key !== lastKey) {
                    lastKey = key; turnsSeen++;
                    for (const e of st.playerParty) {
                        if (e.currentHp <= 0) continue;
                        memberTurns++;
                        unspent += e.currentEnergy;
                        capacity += e.maxEnergy;
                        if (e.currentEnergy >= e.maxEnergy) idleMembers++;
                    }
                }
            }
            let next = battleReducer(st, a);
            if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; }
            st = next;
        }
    }
    console.error(`${n}v${n}  ${turnsSeen} player turns sampled over ${ITER} battles`);
    console.error(`   WASTED ENERGY  ${((unspent / Math.max(1, capacity)) * 100).toFixed(1)}% ` +
        `of the side's pool left unspent at end of turn  (${unspent}/${capacity})`);
    console.error(`   FULLY IDLE     ${((idleMembers / Math.max(1, memberTurns)) * 100).toFixed(1)}% ` +
        `of living member-turns spent NOTHING at all  (${idleMembers}/${memberTurns})`);
}
