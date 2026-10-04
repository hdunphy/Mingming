/**
 * TICKET 193h — THE TABLE AT THE TOP OF THE MORNING REPORT: how party size lined up with the gym.
 *
 * The one comparison that explained two nights (ticket 193g): half of the sessions that ended with a
 * party reached the gym against one in thirteen solo ones. Counting only; one row per party size that
 * anyone had, smallest first.
 */
import type { RunFact } from './facts';

const sizeLabel = (size: number): string => (size === 1 ? '1 (solo)' : String(size));

/** The table as markdown lines, or nothing when the night has no runs. */
export function partyTable(runs: ReadonlyArray<RunFact>): string[] {
    if (runs.length === 0) return [];
    const sizes = [...new Set(runs.map((r) => r.partySize))].sort((a, b) => a - b);
    return [
        '| Party at the end | Sessions | Reached the gym | Won |',
        '|---|---|---|---|',
        ...sizes.map((size) => {
            const group = runs.filter((r) => r.partySize === size);
            return `| ${sizeLabel(size)} | ${group.length} | ${group.filter((r) => r.reachedGym).length} | ${group.filter((r) => r.outcome === 'victory').length} |`;
        }),
        '',
    ];
}
