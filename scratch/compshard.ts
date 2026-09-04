/**
 * compshard.ts - one lane of the 3v3 comp grid (ticket 140). Driven by scratch/compgrid.mjs; do not
 * run by hand unless debugging.
 *
 * Reads a job file (JSON: [{ a, b, iterations, seed }]) where a/b are comp ids of the form
 * "fw1+fw2+fw3", runs each as a paired batch (both turn orders), and APPENDS one JSON line per job
 * to --out as it finishes, so a killed lane loses at most the job it was on. Beamless by design:
 * under Node the beam is off unless AI_BEAM is set, which makes these numbers the same instrument
 * as every 1v1 grid on record.
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

    const jobs: Array<{ a: string; b: string; iterations: number; seed: string }> =
        JSON.parse(fs.readFileSync(JOBS, 'utf8'));

    for (const job of jobs) {
        const t0 = Date.now();
        const r = runPairedBatch(teamScenario({
            player: members(job.a), enemy: members(job.b), seed: job.seed,
        }), { iterations: job.iterations });
        const line = {
            a: job.a, b: job.b, seed: job.seed,
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
    // The dead-arm rule: this instrument is beamless on purpose. If a beam ever loads, say so loudly.
    if (census.pruned > 0) console.log(`WARNING: beam pruned ${census.pruned} candidates - this lane was NOT beamless`);
}
main().catch(e => { console.error(e); process.exit(1); });
