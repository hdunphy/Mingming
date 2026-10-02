/** TICKET 180d — what a move did, as the lines printed above the next battle screen. */
import type { IBattleState } from '../../../engine/types';
import type { HitTotal } from '../battleSim';

const MAX_LINES = 6;

export function hitLines(hits: ReadonlyArray<HitTotal>): string[] {
    const lines = hits.slice(0, MAX_LINES).map((h) =>
        `  ${h.source}'s ${h.label} hit ${h.target} for ${h.total}${h.times > 1 ? ` (${h.times} hits)` : ''}.`);
    if (hits.length > MAX_LINES) lines.push(`  ...and ${hits.length - MAX_LINES} more.`);
    return lines;
}

/** Who was standing before and is down now. */
export function downedLines(before: IBattleState, after: IBattleState): string[] {
    const was = new Set([...before.playerParty, ...before.enemyParty].filter((e) => e.currentHp > 0).map((e) => e.id));
    return [...after.playerParty, ...after.enemyParty]
        .filter((e) => was.has(e.id) && e.currentHp <= 0)
        .map((e) => `  ${e.name} went down.`);
}
