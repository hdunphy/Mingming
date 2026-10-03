import type { StatusType } from '../../engine/types';

export interface StatusEntry {
    readonly targetId: string;
    readonly status: StatusType;
    /** Stacks this entry added (190f: the landing grows with them). Absent counts as 1. */
    readonly stacks?: number;
}
export interface StatusTellGroup {
    readonly status: StatusType;
    readonly targetIds: ReadonlyArray<string>;
    /** Stacks each body got of this status, summed over its entries. */
    readonly stacks: Readonly<Record<string, number>>;
}
export interface ScheduledStatusTell extends StatusTellGroup { readonly at: number }

/** One group per distinct status, in first-seen order; each body listed once per status. */
export function groupStatusTells(entries: ReadonlyArray<StatusEntry>): StatusTellGroup[] {
    const groups: Array<{ status: StatusType; targetIds: string[]; stacks: Record<string, number> }> = [];
    for (const entry of entries) {
        let group = groups.find((g) => g.status === entry.status);
        if (!group) { group = { status: entry.status, targetIds: [], stacks: {} }; groups.push(group); }
        if (!group.targetIds.includes(entry.targetId)) group.targetIds.push(entry.targetId);
        group.stacks[entry.targetId] = (group.stacks[entry.targetId] ?? 0) + (entry.stacks ?? 1);
    }
    return groups;
}

/**
 * When each group plays: `stagger` apart, the first one `firstGap` after `afterMs` (the last impact;
 * `stagger` unless told otherwise, and 0 for a landing that starts AT its moment - 190f).
 * Measured from a FIXED base, so n groups end at afterMs + firstGap + (n - 1) * stagger - linear, not quadratic.
 */
export function scheduleStatusTells(
    afterMs: number,
    entries: ReadonlyArray<StatusEntry>,
    stagger: number,
    firstGap: number = stagger,
): ScheduledStatusTell[] {
    return groupStatusTells(entries).map((group, index) => ({ ...group, at: afterMs + firstGap + stagger * index }));
}

/**
 * The float text: "Sharp" for one stack, "Sharp ×7" for several. Splits CamelCase ("Dark Stance").
 *
 * TICKET 167i: the stacks are rounded to a whole number for display. Bark Shield is a share of max
 * HP, so its stacks arrive as 1.3248929838928; the float used to print that. Rounded first, THEN
 * compared with 1, so a shield that rounds to 1 reads like a single stack instead of "×1".
 */
export function statusFloatText(status: StatusType, stacks: number): string {
    const name = String(status).replace(/([a-z])([A-Z])/g, '$1 $2');
    const shown = Math.round(stacks);
    return shown > 1 ? `${name} ×${shown}` : name;
}

/**
 * TICKET 167i: the whole number shown in the absorbed float, for what a shield took off a hit.
 * A shield that took something but rounds to nothing still says 1 - "-0" would read as no shield
 * at all. The float's shield glyph is added by `useBattleVfx`, which is where the in-battle glyph
 * vocabulary lives (the no-emoji rule in `Icon.test.tsx` exempts it and not this file).
 */
export function absorbedAmount(absorbed: number): number {
    return Math.max(1, Math.round(absorbed));
}
