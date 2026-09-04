/**
 * Element matchup derivations — ticket 55, step 3.
 *
 * `formatMultiplier`, `getElementMatchups` and `getMatchupMultiplier` were exported from
 * `ElementMatchupTooltip.tsx` and `TypeChart.tsx`, which is what `react-refresh/only-export-components`
 * reports: a module that exports both a component and plain functions cannot hot-reload as a
 * component. Four other files import them, so they were never really component-local anyway.
 *
 * Everything here is derived from the engine's `ElementalMatrix` at call time, not copied from it.
 * That is the property both original docblocks argued for and the reason they belong together: a
 * second table is a table that can disagree with combat.
 */

import { ElementalMatrix } from '../../engine/combatUtils';
import type { Element } from '../../engine/types';

/** Trim a multiplier for display: 2 → "2", 0.5 → "0.5", 0.375 → "0.375". */
export const formatMultiplier = (n: number): string => (Math.round(n * 1000) / 1000).toString();

export interface MatchupGroup {
    mult: number;
    targets: string[];
}

/**
 * Runtime-derived matchup summary for one element, grouped by multiplier so
 * the tooltip never falls out of sync with the engine's ElementalMatrix.
 */
export function getElementMatchups(element: string): { strong: MatchupGroup[]; weak: MatchupGroup[] } {
    const row = ElementalMatrix[element as Element] ?? {};
    const byMult = new Map<number, string[]>();
    for (const [target, mult] of Object.entries(row)) {
        if (typeof mult !== 'number' || mult === 1) continue;
        if (!byMult.has(mult)) byMult.set(mult, []);
        byMult.get(mult)!.push(target);
    }
    const groups = [...byMult.entries()].map(([mult, targets]) => ({ mult, targets }));
    return {
        strong: groups.filter(g => g.mult > 1).sort((a, b) => b.mult - a.mult),
        weak: groups.filter(g => g.mult < 1).sort((a, b) => a.mult - b.mult)
    };
}

/**
 * Pure, runtime-derived matchup lookup: attacker row → defender column of
 * the engine's ElementalMatrix. Returns 1 for neutral (missing) entries so
 * the chart can never fall out of sync with combat math.
 */
export function getMatchupMultiplier(attacker: string, defender: string): number {
    return ElementalMatrix[attacker as Element]?.[defender as Element] ?? 1;
}
