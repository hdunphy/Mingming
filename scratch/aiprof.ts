/**
 * TICKET 127 - where does an enemy turn actually spend its time?
 *
 * Henry, ticket-118 playtest: *"enemy turns are taking a long time between each card. Its slow to
 * think"*, and on the stacked comps *"the AI is incredibly slow here. Taking a couple seconds to
 * even play a card."*
 *
 * MEASURE THE SPLIT BEFORE PROPOSING ANYTHING. `getBestAction` has two halves that scale
 * differently, and there are two knobs that already exist and are already grid-gated:
 *
 *   SAME-TURN ENUMERATION  `findBestSequence(state, side, 0, MAX_DEPTH, candidates)` walks every
 *                          legal (card, target) ordering to depth 3, pushing each through the real
 *                          reducer. Cost is `branching ^ 3`, and branching is casters x hand x
 *                          targets - ~6 at 1v1, ~20 at 3v3. `AI_BEAM` cuts the exponent here.
 *   LOOKAHEAD              Top-N same-turn lines replayed through END_TURN + reply, once per
 *                          determinization. `enemyAiTier` cuts N and the determinizations here.
 *
 * SO THE TIER MUST COME OFF THE BATTLE, NOT THE ENVIRONMENT. Under vite-node environment variables
 * do not reach module code by any route (`vite.config.ts`'s `define: {'process.env': {}}` plus
 * vite-node's own sanitising - probed: `globalThis.process.env` has zero keys). `AI_LITE=1` in front
 * of this script would silently profile full three times. Ticket 67's per-battle field
 * `IBattleState.enemyAiTier` is the supported switch and it is what this uses - which also means it
 * profiles the ENEMY side, which is the side a player waits on.
 *
 * The beam is still a module constant read from `env`, so this file WRITES that key onto
 * `globalThis.process.env` through a computed property and only then imports the AI. Computed keys
 * leave no `process.env` token for the define to rewrite, so the assignment survives - the same
 * trick `TacticalAI` uses to read it. Hence the dynamic imports below.
 *
 * Run: npx vite-node scratch/aiprof.ts -- --width 3 --tier full --beam 0 --decisions 30
 */

const arg = (name: string, dflt: string): string => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : dflt;
};

const WIDTH = Number(arg('width', '3'));
const TIER = arg('tier', 'full') as 'greedy' | 'lite' | 'full';
const BEAM = arg('beam', '0');
const DECISIONS = Number(arg('decisions', '30'));
const SEED = arg('seed', 'aiprof');
const CENSUS = arg('census', '0');

if (!['greedy', 'lite', 'full'].includes(TIER)) throw new Error(`[aiprof] bad --tier ${TIER}`);

// Written BEFORE the AI module is loaded, through computed keys so Vite's `define` cannot rewrite
// the read or the write. `AI_BEAM` and `AI_CENSUS` are module-level constants in TacticalAI.
const P = 'process', E = 'env';
const penv = ((globalThis as unknown as Record<string, Record<string, Record<string, string>>>)[P] ??= {} as never);
const envBag = (penv[E] ??= {} as never);
envBag.AI_BEAM = BEAM;
envBag.AI_CENSUS = CENSUS;

async function main(): Promise<void> {
    const { getBestAction, census, censusReset, censusNewDecision } =
        await import('../src/engine/ai/TacticalAI');
    const { battleReducer } = await import('../src/engine/battleReducer');
    const { buildScenarioState } = await import('../src/debug/scenarios/buildScenarioState');
    const { teamScenario } = await import('../src/debug/balance/balanceScenarios');
    const { globalBattleEventBus } = await import('../src/engine/events');
    type IBattleState = import('../src/engine/types').IBattleState;

    type Member = readonly [string, string];
    // A zoo panel against a control panel: the comp Henry actually played in ticket 118, and the
    // one whose side-wide cards widened the search in the first place.
    const ZOO: Member[] = [
        ['jormungandr', 'jormungandr_v1'], ['sleipnir', 'sleipnir_v1'], ['hraesvelgr', 'hraesvelgr_v1'],
    ];
    const CTL: Member[] = [
        ['kraken', 'kraken_v1'], ['huldra', 'huldra_v1'], ['draugr', 'draugr_v2'],
    ];

    function freshBattle(): IBattleState {
        const base = buildScenarioState(teamScenario({
            player: CTL.slice(0, WIDTH) as Member[],
            enemy: ZOO.slice(0, WIDTH) as Member[],
            seed: `${SEED}:w${WIDTH}`,
        }));
        // The grade is a property of the BATTLE (ticket 67) and it describes the ENEMY only, so
        // only ENEMY decisions are timed below. Setting it here is the whole reason this profiler
        // can tell the three tiers apart at all.
        return { ...base, enemyAiTier: TIER };
    }

    /**
     * Play real turns and time every ENEMY `getBestAction`.
     *
     * Real turns, not a constructed board: hand size, energy and the number of live targets all
     * move as a battle progresses, and the expensive decisions are the ones with a full hand and
     * three living enemies. A synthetic mid-game state would have measured whatever I built.
     */
    function profile(): { ms: number[]; sims: number; turnLens: number[] } {
        let state = freshBattle();
        const ms: number[] = [];
        const turnLens: number[] = [];
        let thisTurn = 0;
        let guard = 0;
        if (CENSUS === '1') censusReset();

        while (ms.length < DECISIONS && guard++ < 8000) {
            const timed = state.activeSide === 'ENEMY';
            const t0 = performance.now();
            if (CENSUS === '1' && timed) censusNewDecision();
            const action = getBestAction(state);
            if (timed) {
                ms.push(performance.now() - t0);
                if (action.type === 'END_TURN') { turnLens.push(thisTurn); thisTurn = 0; }
                else thisTurn++;
            }

            const next = globalBattleEventBus.runMuted(() => battleReducer(state, action));
            if (next === state) break;                 // refused - board is stuck
            state = next;
            const over = state.playerParty.every(e => e.currentHp <= 0)
                || state.enemyParty.every(e => e.currentHp <= 0);
            if (over) state = freshBattle();           // keep sampling; a finished battle decides nothing
        }
        return { ms, sims: census.simulated, turnLens };
    }

    const pct = (a: number[], p: number): number =>
        [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];
    const mean = (a: number[]): number => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

    const r = profile();
    if (r.ms.length === 0) throw new Error('[aiprof] no ENEMY decisions timed - the arm did not take');

    // The number a player feels is a TURN, not a decision. Measured, not assumed: `turnLens` counts
    // the plays the enemy actually made before ending each turn.
    const cardsPerTurn = r.turnLens.length > 0 ? mean(r.turnLens) : NaN;
    const decisionsPerTurn = cardsPerTurn + 1;   // the closing END_TURN is a decision too

    console.log(`tier ${TIER}  beam ${BEAM}  width ${WIDTH}  ${r.ms.length} ENEMY decisions`);
    console.log(`  mean   ${mean(r.ms).toFixed(1)} ms`);
    console.log(`  median ${pct(r.ms, 0.5).toFixed(1)} ms`);
    console.log(`  p95    ${pct(r.ms, 0.95).toFixed(1)} ms`);
    console.log(`  max    ${Math.max(...r.ms).toFixed(1)} ms`);
    console.log(`  total  ${(r.ms.reduce((s, x) => s + x, 0) / 1000).toFixed(2)} s`);
    if (r.turnLens.length > 0) {
        console.log(`  turns sampled ${r.turnLens.length}, ${cardsPerTurn.toFixed(1)} plays/turn`);
        console.log(`  THINK TIME PER ENEMY TURN (mean x ${decisionsPerTurn.toFixed(1)} decisions): `
            + `${(mean(r.ms) * decisionsPerTurn / 1000).toFixed(2)} s`);
    }
    if (CENSUS === '1') {
        console.log(`  reducer sims ${census.simulated} over ${census.decisions} decisions `
            + `= ${Math.round(census.simulated / Math.max(1, census.decisions))}/decision`);
        console.log(`  enumerated ${census.enumerated}  duplicate ${census.duplicate}  pruned ${census.pruned}`);
    }
}

main().catch(e => { console.error(e); process.exit(1); });
