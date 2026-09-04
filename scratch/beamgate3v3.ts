/**
 * TICKET 127 - the gate `AI_BEAM` never had: what does the beam do to a 3v3 OUTCOME?
 *
 * `research/3v3-optimisation.md` gated the beam on 90 **1v1** grid cells and said so plainly - and
 * it is honest about the gap it leaves:
 *
 *   > It is also an APPROXIMATION in 3v3, ranked on the immediate score, so it inherits the bias
 *   > ticket 108 measured in the cheap AI tier: it under-reads lines whose payoff is one play
 *   > further on.
 *
 * Nobody measured that, because until ticket 127 a 3v3 row cost too much to run twice. At 569 ms a
 * decision it does not. And the beam is only worth defaulting on for the GAME if it is safe in the
 * mode the game ships - the game is 3v3.
 *
 * Same team construction as `scratch/teamcanary.ts` (deterministic stride, one member per species,
 * no RNG) so this is comparable to the canary rather than a new corpus.
 *
 * WHY THE DYNAMIC IMPORTS. `AI_BEAM` is a module constant read from the environment at import, and
 * under vite-node the environment reaches module code by no route (`vite.config.ts` defines
 * `process.env` to `{}`; vite-node hands the module an empty bag anyway). So this writes the key
 * onto `globalThis.process.env` through computed properties - which leave no `process.env` token for
 * the define to rewrite - and only then imports the engine. One process is one beam width.
 *
 * Run: npx vite-node scratch/beamgate3v3.ts -- --beam 8 --teams 6 --iter 6
 */

function arg(name: string, dflt?: string): string {
    const i = process.argv.indexOf(`--${name}`);
    const v = i === -1 ? undefined : process.argv[i + 1];
    if (v === undefined || v.startsWith('--')) {
        if (dflt === undefined) throw new Error(`beamgate3v3: --${name} is required`);
        return dflt;
    }
    return v;
}

const BEAM = arg('beam');
const TEAMS = Number(arg('teams', '6'));
const ITER = Number(arg('iter', '6'));
const SEEDBASE = arg('seedbase', 'canary');

const P = 'process', E = 'env';
const penv = ((globalThis as unknown as Record<string, Record<string, Record<string, string>>>)[P] ??= {} as never);
const bag = (penv[E] ??= {} as never);
bag.AI_BEAM = BEAM;
// The census is on so the run can PROVE the beam took. Four arms in this arc "worked", stayed green
// and measured nothing; a beam that failed to load would print a row identical to beam 0 and I
// would report "no change" having run the same build twice.
bag.AI_CENSUS = '1';

async function main(): Promise<void> {
    const { census } = await import('../src/engine/ai/TacticalAI');
    const { runPairedBatch } = await import('../src/debug/balance/runBatch');
    const { teamScenario, BALANCE_SPECIES } = await import('../src/debug/balance/balanceScenarios');
    const { MingmingRegistry } = await import('../src/engine/data/mingmingRegistry');

    const roster: Array<readonly [string, string]> = [];
    for (const sp of BALANCE_SPECIES) for (const os of MingmingRegistry[sp].availableOS) roster.push([sp, os]);

    const team = (offset: number): Array<readonly [string, string]> => {
        const picked: Array<readonly [string, string]> = [];
        const used = new Set<string>();
        for (let i = 0; picked.length < 3 && i < roster.length; i++) {
            const cand = roster[(offset + i * 7) % roster.length];
            if (used.has(cand[0])) continue;
            used.add(cand[0]); picked.push(cand);
        }
        return picked;
    };

    for (let p = 0; p < TEAMS; p++) {
        const mine = team(p * 3);
        const theirs = team(p * 3 + 17);
        const r = runPairedBatch(teamScenario({ player: mine, enemy: theirs, seed: `${SEEDBASE}:${p}` }),
            { iterations: ITER });
        console.log(['PAIR', p,
            mine.map(m => m[1]).join('+'), theirs.map(m => m[1]).join('+'),
            (r.pooled.decisiveWinRate * 100).toFixed(2),
            r.pooled.averageTurns.toFixed(2),
            r.pooled.decisive, r.pooled.truncatedCount, r.pooled.ftkCount,
        ].join(','));
    }

    console.log(`BEAMCHECK,${BEAM},pruned=${census.pruned},enumerated=${census.enumerated}`);
    if (Number(BEAM) > 0 && census.pruned === 0) {
        throw new Error(`beamgate3v3: --beam ${BEAM} pruned NOTHING - the beam did not load`);
    }
    if (Number(BEAM) === 0 && census.pruned > 0) {
        throw new Error('beamgate3v3: --beam 0 pruned candidates - a beam leaked in from somewhere');
    }
}

main().catch(e => { console.error(e); process.exit(1); });
