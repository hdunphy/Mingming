import type { StatusType } from '../../engine/types';

export interface StatusEntry { readonly targetId: string; readonly status: StatusType }
export interface StatusTellGroup { readonly status: StatusType; readonly targetIds: ReadonlyArray<string> }
export interface ScheduledStatusTell extends StatusTellGroup { readonly at: number }

/** One group per distinct status, in first-seen order; each body listed once per status. */
export function groupStatusTells(entries: ReadonlyArray<StatusEntry>): StatusTellGroup[] {
    const groups: Array<{ status: StatusType; targetIds: string[] }> = [];
    for (const entry of entries) {
        let group = groups.find((g) => g.status === entry.status);
        if (!group) { group = { status: entry.status, targetIds: [] }; groups.push(group); }
        if (!group.targetIds.includes(entry.targetId)) group.targetIds.push(entry.targetId);
    }
    return groups;
}

/**
 * When each group plays: `stagger` apart, starting `stagger` after `afterMs` (the last impact).
 * Measured from a FIXED base, so n groups end at afterMs + n * stagger - linear, not quadratic.
 */
export function scheduleStatusTells(
    afterMs: number,
    entries: ReadonlyArray<StatusEntry>,
    stagger: number,
): ScheduledStatusTell[] {
    return groupStatusTells(entries).map((group, index) => ({ ...group, at: afterMs + stagger * (index + 1) }));
}

/** The float text: "Sharp" for one stack, "Sharp ×7" for several. Splits CamelCase ("Dark Stance"). */
export function statusFloatText(status: StatusType, stacks: number): string {
    const name = String(status).replace(/([a-z])([A-Z])/g, '$1 $2');
    return stacks > 1 ? `${name} ×${stacks}` : name;
}
