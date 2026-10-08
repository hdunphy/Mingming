/**
 * TICKET 193h — THE TABLE AT THE TOP OF THE MORNING REPORT: how party size lined up with the gym.
 *
 * The one comparison that explained two nights (ticket 193g): half of the sessions that ended with a
 * party reached the gym against one in thirteen solo ones. Counting only; one row per party size that
 * anyone had, smallest first.
 *
 * TICKET 202c: it counts RUNS, not sessions (a session plays up to two), and a last column, "run 2 of a
 * session", holds the second runs alone, so the morning report can say whether second runs summon more and
 * get further. The first runs are the rest.
 */
import type { RunFact } from './facts';
import { legsOf, type RunLeg } from './runLeg';

const sizeLabel = (size: number): string => (size === 1 ? '1 (solo)' : String(size));

const secondRunCell = (group: ReadonlyArray<RunLeg>): string => {
    const second = group.filter((leg) => leg.number === 2);
    if (second.length === 0) return '-';
    return `${second.length} (${second.filter((l) => l.reachedGym).length} reached the gym, ${second.filter((l) => l.outcome === 'victory').length} won)`;
};

/** The table as markdown lines, or nothing when the night has no runs. */
export function partyTable(runs: ReadonlyArray<RunFact>): string[] {
    if (runs.length === 0) return [];
    const legs = runs.flatMap((run) => [...legsOf(run)]);
    const sizes = [...new Set(legs.map((leg) => leg.partySize))].sort((a, b) => a - b);
    return [
        '| Party at the end | Runs | Reached the gym | Won | Run 2 of a session |',
        '|---|---|---|---|---|',
        ...sizes.map((size) => {
            const group = legs.filter((leg) => leg.partySize === size);
            return `| ${sizeLabel(size)} | ${group.length} | ${group.filter((l) => l.reachedGym).length} | ${group.filter((l) => l.outcome === 'victory').length} | ${secondRunCell(group)} |`;
        }),
        '',
        'The table counts runs, not sessions: a session that played two runs is in it twice. "Run 2 of a session" is the second runs alone (how many, how many reached the gym, how many won); the first runs are the rest.',
        '',
    ];
}
