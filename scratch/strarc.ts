/**
 * Ticket 103, feel calibration: the turn-by-turn Strengthened arc for sleipnir_v1.
 *
 * Henry played it (round 3) and gave the real gate, which is not a field win rate:
 *   - PILOTING AGAINST him: *"Sleipnir had 10 str by turn 2"*, momentum_crash for 24, wiped
 *     turn 2. TOO FAST.
 *   - PILOTING him: *"4str after turn 1 ... after turn 3 had a nice str boost to 14 ... won on
 *     turn 5 with 22 str. This felt fun to play although was a little OP."*
 *   - His read: **the problem is EARLY VELOCITY, not the ceiling.** Success = no 10-stack turn-2
 *     opener AND the turn-5 pile still reaches the teens.
 *
 * A field win rate cannot see either of those. This records the pile at the END of each of his
 * turns, so the arc can be compared against the two numbers he actually gave.
 *
 * env: OPPONENT (default control), ITER (default 12), MINT (override the OS grant), TURNS (8)
 */
import HOOKS_DATA from '../src/engine/data/lib/hooks.json';

const H = HOOKS_DATA as unknown as Record<string, { hooks: Array<any> }>;
if (process.env.MINT) H.sleipnir_v1.hooks[0].do[0].stacks = Number(process.env.MINT);

/**
 * TICKET 103 ramp arm, off Henry's round-3 feel note: *"the problem is EARLY VELOCITY, not the
 * ceiling"*. Mint 1 per 0-cost card always, and a SECOND stack per 0-cost card once he already
 * holds RAMP_AT. That is a CONDITION, not a cap: it slows the opener and leaves the late climb
 * alone, which is the exact shape he described enjoying (4 -> 14 -> 22 over five turns).
 */
if (process.env.RAMP_AT) {
    H.sleipnir_v1.hooks.push({
        id: 'sleipnir_v1_ramp',
        trigger: 'onActionStart',
        priority: 39,
        when: { source: 'SELF', baseCost: 0, sourceStatus: { status: 'Strengthened', minStacks: Number(process.env.RAMP_AT) } },
        do: [{ type: 'STATUS', target: 'SELF', status: 'Strengthened', stacks: 1 }],
    });
}

const { matchupScenario } = await import('../src/debug/balance/balanceScenarios');
const { buildScenarioState } = await import('../src/debug/scenarios/buildScenarioState');
const { deriveSeeds, applyStatJitter } = await import('../src/debug/balance/runBatch');
const { battleReducer } = await import('../src/engine/battleReducer');
const { getBestAction } = await import('../src/engine/ai/TacticalAI');
const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');
type St = Awaited<ReturnType<typeof buildScenarioState>>;

const OPPONENT = process.env.OPPONENT ?? 'control';
const ITER = Number(process.env.ITER ?? 12);
const MAX_TURN = Number(process.env.TURNS ?? 8);

const enemyOS = MingmingRegistry[OPPONENT]?.availableOS?.[0] ?? `${OPPONENT}_v1`;
const setup = matchupScenario({
    player: 'sleipnir', enemy: OPPONENT, playerOS: 'sleipnir_v1', enemyOS,
    seed: `arc:sleipnir_v1:${OPPONENT}`,
});

const byTurn: number[][] = Array.from({ length: MAX_TURN + 1 }, () => []);
let wins = 0, games = 0, winTurnSum = 0;

for (const seed of deriveSeeds(setup.seed, ITER)) {
    let st = buildScenarioState({ ...applyStatJitter(setup, seed), seed }) as St;
    games++;
    let guard = 0;
    const alive = (p: ReadonlyArray<{ currentHp: number }>) => p.some(e => e.currentHp > 0);
    let lastTurn = 0;
    while (alive(st.playerParty) && alive(st.enemyParty) && st.turn <= 60 && guard++ < 4000) {
        const wasMine = st.activeSide === 'PLAYER';
        const action = getBestAction(st);
        let next = battleReducer(st, action);
        if (next === st) { next = battleReducer(st, { type: 'END_TURN' }); if (next === st) break; }
        // Record at the moment his turn ENDS - the pile he is holding going into the reply.
        if (wasMine && action.type === 'END_TURN' && st.turn <= MAX_TURN && st.turn > lastTurn) {
            lastTurn = st.turn;
            const me = st.playerParty[0];
            byTurn[st.turn].push(me?.statusEffects.find(s => s.type === 'Strengthened')?.stacks ?? 0);
        }
        st = next;
    }
    if (!alive(st.enemyParty)) { wins++; winTurnSum += st.turn; }
}

const mint = (HOOKS_DATA as unknown as Record<string, { hooks: Array<{ do: Array<{ stacks: number }> }> }>)
    .sleipnir_v1.hooks[0].do[0].stacks;
console.error(`\nSTR ARC   sleipnir_v1 vs ${OPPONENT}   mint ${mint}/0-cost card   ${games} games`);
console.error(`  win rate ${((wins / games) * 100).toFixed(0)}%   mean winning turn ${wins ? (winTurnSum / wins).toFixed(1) : '-'}`);
for (let t = 1; t <= MAX_TURN; t++) {
    const v = byTurn[t];
    if (!v.length) continue;
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const max = Math.max(...v);
    const bar = '#'.repeat(Math.round(mean));
    console.error(`  end of turn ${t}   mean ${mean.toFixed(1).padStart(5)}   peak ${String(max).padStart(3)}   ${bar}`);
}
console.error(`CSV,${mint},${OPPONENT},` + byTurn.slice(1).map(v =>
    v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : '').join(','));
