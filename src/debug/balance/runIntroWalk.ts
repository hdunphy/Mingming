/**
 * Entry point for the ticket 182c intro measurement (the `runX.ts` convention: no logic here).
 *
 *   npx vite-node src/debug/balance/runIntroWalk.ts -- --seeds 30 --label intro
 *   npx vite-node src/debug/balance/runIntroWalk.ts -- --seeds 30 --starter kraken_v1
 */
import { INTRO_LEADERS, type IIntroLeaderMember } from '../../engine/run/intro/introLeader';
import { INTRO_STARTERS_V1, minutesAt, summariseIntro, walkIntro } from './introWalk';

function main(): void {
    const argv = process.argv.slice(2);
    const get = (flag: string): string | undefined => {
        const i = argv.indexOf(flag);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const seeds = Number(get('--seeds') ?? 30);
    const label = get('--label') ?? 'intro';
    // `--leaders '{"Water":[{"species":"kraken","os":"kraken_v1","hpIV":5,"attackIV":5,"defenseIV":5}, ...]}'`
    // swaps a biome's leader pair for this process only, so a candidate can be measured without an
    // edit. A measurement lever: it changes no shipped value.
    const override = get('--leaders');
    if (override) {
        const parsed = JSON.parse(override) as Record<string, ReadonlyArray<IIntroLeaderMember>>;
        for (const [element, members] of Object.entries(parsed)) {
            (INTRO_LEADERS as Record<string, ReadonlyArray<IIntroLeaderMember>>)[element] = members;
        }
        console.log(`LEADERS ${override}`);
    }
    // `--from N` starts at seed N, so a long measurement can be run in slices and the counts added up.
    const from = Number(get('--from') ?? 0);
    const starters = get('--starter')?.split(',').map((s) => s.trim()).filter(Boolean) ?? [...INTRO_STARTERS_V1];

    // `--arm plain|ghost` runs one arm (a shell call has a time limit); left out, both.
    const arm = get('--arm');
    const arms = arm === 'plain' ? [false] : arm === 'ghost' ? [true] : [false, true];
    for (const ghost of arms) {
        console.log(`\n## ${ghost ? 'GHOST (a lost wild fight is carried on)' : 'PLAIN (a lost fight ends the run)'} - ${seeds} seeds each`);
        console.log('starter        runs  reached  leaderWin  leaderWin%  cleared%  fights  turns  minutes@20s  recruits');
        let allReached = 0; let allWins = 0;
        for (const starter of starters) {
            const started = Date.now();
            const rows = walkIntro(starter, seeds, label, ghost, from);
            if (argv.includes('--rows')) for (const r of rows) console.log(`ROW ${JSON.stringify(r)}`);
            const s = summariseIntro(starter, rows);
            allReached += s.reachedLeader; allWins += s.leaderWins;
            console.log(
                `${starter.padEnd(14)} ${String(s.runs).padStart(4)}  ${String(s.reachedLeader).padStart(7)}  ${String(s.leaderWins).padStart(9)}`
                + `  ${(s.leaderWinRate * 100).toFixed(0).padStart(9)}%  ${(s.clearRate * 100).toFixed(0).padStart(7)}%`
                + `  ${s.meanFights.toFixed(1).padStart(6)}  ${s.meanTurns.toFixed(1).padStart(5)}  ${minutesAt(s).toFixed(1).padStart(11)}`
                + `  t/fight ${s.turnsPerFight.toFixed(1)} max ${s.maxFightTurns}`
                + `  ${JSON.stringify(s.recruits)}`,
            );
            console.error(`  [${ghost ? 'ghost' : 'plain'}] ${starter}: ${seeds} runs in ${((Date.now() - started) / 1000).toFixed(0)} s`);
        }
        console.log(`ALL            leader wins ${allWins} of ${allReached} reached = ${allReached === 0 ? 0 : ((allWins / allReached) * 100).toFixed(0)}%`);
    }
}

main();
