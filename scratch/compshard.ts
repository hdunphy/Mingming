/**
 * compshard.ts - one lane of the 3v3 comp grid (ticket 140). Driven by scratch/compgrid.mjs; do not
 * run by hand unless debugging.
 *
 * Reads a job file (JSON: [{ a, b, iterations, seed }]) where a/b are comp ids of the form
 * "fw1+fw2+fw3", runs each as a paired batch (both turn orders), and APPENDS one JSON line per job
 * to --out as it finishes, so a killed lane loses at most the job it was on.
 *
 * BEAM. Ticket 144 §2 was AMENDED the day it landed (Henry, 2026-09-06: *"for the AI in the game we
 * want the bosses to use beamless, some of the other AI should use beam 8"*), so the beam is a rung
 * of `ENEMY_LADDER` rather than a global: the GAME beams its wilds and elites, its gym does not,
 * and **a harness that says nothing is BEAMLESS**. That keeps ticket 108's rule ("confirm anything
 * you intend to act on at full, BEAMLESS") as the default and keeps this instrument comparable with
 * the whole pre-144 3v3 corpus (tickets 140, 141).
 *
 * A job may carry `beam` and `BatchOptions.aiBeam` is the only route that delivers it — `AI_BEAM`
 * never reaches a vite-node lane. Every result row records the beam it ran at, because a beamed row
 * and a beamless row are not comparable: measured at 3v3, the beam takes ~12.5 points of win rate
 * off whichever side is winning and adds 0.75 turns.
 */
function arg(name: string, dflt: string): string {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? dflt : process.argv[i + 1];
}
const JOBS = arg('jobs', '');
const OUT = arg('out', '');
if (!JOBS || !OUT) throw new Error('compshard: --jobs and --out are required');

type Member = readonly [string, string];
const speciesOf = (fw: string): string => fw.replace(/_v[12]$/, '');
const members = (comp: string): Member[] => comp.split('+').map(fw => [speciesOf(fw), fw] as const);

async function main(): Promise<void> {
    const fs = await import('node:fs');
    const { census } = await import('../src/engine/ai/TacticalAI');
    const { runPairedBatch } = await import('../src/debug/balance/runBatch');
    const { teamScenario } = await import('../src/debug/balance/balanceScenarios');

    const jobs: Array<{ a: string; b: string; iterations: number; seed: string; beam?: number }> =
        JSON.parse(fs.readFileSync(JOBS, 'utf8'));

    for (const job of jobs) {
        const t0 = Date.now();
        const r = runPairedBatch(teamScenario({
            player: members(job.a), enemy: members(job.b), seed: job.seed,
        }), { iterations: job.iterations, ...(job.beam === undefined ? {} : { aiBeam: job.beam }) });
        const line = {
            a: job.a, b: job.b, seed: job.seed,
            // The DEFAULT is beamless, so an unspecified job ran at 0. Recording GAME_BEAM_WIDTH
            // here would have labelled every default row "beam 8" while it ran the full search —
            // a row that lies about which instrument produced it is worse than no row.
            beam: job.beam ?? 0,
            games: r.pooled.iterations,
            decisive: r.pooled.decisive,
            winsA: Math.round(r.pooled.decisiveWinRate * r.pooled.decisive),
            turns: Number(r.pooled.averageTurns.toFixed(2)),
            truncated: r.pooled.truncatedCount,
            ftk: r.pooled.ftkCount,
            ms: Date.now() - t0,
        };
        fs.appendFileSync(OUT, JSON.stringify(line) + '\n');
        console.log(`DONE,${job.a},${job.b},${line.winsA}/${line.decisive},${line.ms}ms`);
    }
    // The dead-arm rule, inverted since 144 §2: a beamless job that pruned something, or a beamed
    // job that pruned nothing, is a lane running a different search than its rows claim.
    // Unspecified means beamless (the process default), so `?? 0` — not "unknown".
    const wantedBeamless = jobs.every(j => (j.beam ?? 0) === 0);
    if (wantedBeamless && census.pruned > 0) console.log(`WARNING: beam pruned ${census.pruned} candidates - this lane was NOT beamless`);
    if (!wantedBeamless && census.pruned === 0) console.log('WARNING: beam pruned nothing - was the beam actually on?');
}
main().catch(e => { console.error(e); process.exit(1); });
