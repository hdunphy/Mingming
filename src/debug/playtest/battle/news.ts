/** TICKET 180d — what a move did, as the lines printed above the next battle screen. */
import type { IBattleState } from '../../../engine/types';
import { plain } from '../../../ui/labels/labels';
import type { HitTotal } from '../battleSim';

const MAX_LINES = 6;
/** How many of the game's own combat-log lines one move prints. */
export const LOG_LINES = 12;

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

/**
 * What the game's own combat log gained between two states, as the player reads it in the log panel:
 * the card's effects, the firmware's (a card's text never lists those), statuses, damage taken. The
 * lines are the game's text, in the words the log panel shows (`plain`, as `CombatLog` does). Cut to `LOG_LINES`, with a count of the rest.
 */
export function logLines(before: IBattleState, after: IBattleState, cap: number = LOG_LINES): string[] {
    const added = after.logs.slice(before.logs.length).map((line) => plain(line.trim())).filter((line) => line.length > 0);
    if (added.length === 0) return [];
    const shown = added.slice(0, cap).map((line) => `  ${line}`);
    if (added.length > cap) shown.push(`  ...and ${added.length - cap} more log lines.`);
    return ['The combat log says:', ...shown];
}
